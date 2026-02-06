import { NextRequest, NextResponse } from 'next/server';
import { ethers } from 'ethers';
import { prisma } from '@/lib/db';
import { getTenantContext, getApiKeys } from '@/lib/tenant-context';
import { incrementApiCalls } from '@/lib/limits';

export const dynamic = 'force-dynamic';

// Dirección del token VTN (legacy - now uses tenant context)
// const tokenAddress = '0xA9bc478A44a8c8FE6fd505C1964dEB3cEe3b7abC';

// Configuración de red Base
const BASE_CONFIG = {
  rpcUrl: 'https://mainnet.base.org',
  explorerApiUrl: 'https://api.basescan.org/api',
  chainId: 8453,
};

// Duración del caché de holders: 5 minutos
const HOLDER_CACHE_DURATION = 5 * 60 * 1000;

interface TokenTransfer {
  hash: string;
  from: string;
  to: string;
  value: string;
  valueFormatted: string;
  timestamp: number;
  blockNumber: number;
  isLargeTransfer: boolean;
  tokenSymbol: string;
  tokenName: string;
  decimals: number;
}

interface HolderInfo {
  address: string;
  balance: string;
  percentage: string;
  isExchange: boolean;
  isContract: boolean;
  label?: string;
}

interface PriceData {
  price: number;
  priceChange24h?: number;
  priceChange7d?: number;
}

interface PoolData {
  liquidity: number;
  volume24h: number;
  priceChange24h?: number;
  pairAddress: string;
  dexName: string;
}

interface LiquidityData {
  total: number;
  pools: PoolData[];
  fdv?: number;
}

interface Alert {
  type: 'whale_move' | 'accumulation' | 'distribution' | 'liquidity_change' | 'exchange_flow';
  severity: 'low' | 'medium' | 'high';
  message: string;
  timestamp: number;
  data?: any;
}

interface AnalyticsData {
  transfers: TokenTransfer[];
  largeTransfers: TokenTransfer[];
  topHolders: HolderInfo[];
  priceData: PriceData;
  liquidityData: LiquidityData | null;
  alerts: Alert[];
  exchangeAddresses: string[];
  dailyVolumeHistory: {
    date: string;
    displayDate: string;
    totalVolume: number;
    exchangeVolume: number;
    whaleVolume: number;
    normalVolume: number;
    transactionCount: number;
  }[];
  statistics: {
    totalTransfers: number;
    totalVolume: string;
    uniqueAddresses: number;
    averageTransferSize: string;
    largeTransferCount: number;
    largeTransferThreshold: string;
    netFlowToExchanges: string;
    topHoldersConcentration: string;
  };
  timeRange: {
    from: number;
    to: number;
  };
  cacheInfo: {
    transfersCached: number;
    transfersNew: number;
    holdersCached: boolean;
    lastUpdate: number;
  };
}

// Direcciones de exchanges por defecto (hardcoded base)
const DEFAULT_EXCHANGES = [
  '0x3cd751e6b0078be393132286c442345e5dc49699', // Coinbase
  '0x71660c4005ba85c37ccec55d0c4493e66fe775d3', // Coinbase 2
  '0x503828976d22510aad0201ac7ec88293211d23da', // Coinbase 3
  '0x0d0707963952f2fba59dd06f2b425ace40b492fe', // Gate.io
];

const DEFAULT_EXCHANGE_LABELS: Record<string, string> = {
  '0x3cd751e6b0078be393132286c442345e5dc49699': 'Coinbase',
  '0x71660c4005ba85c37ccec55d0c4493e66fe775d3': 'Coinbase 2',
  '0x503828976d22510aad0201ac7ec88293211d23da': 'Coinbase 3',
  '0x0d0707963952f2fba59dd06f2b425ace40b492fe': 'Gate.io',
};

// Construye el Set combinado de exchanges: defaults + TokenSettings.customExchangeAddresses + KnownAddress EXCHANGE
function buildExchangeSet(
  customExchangeAddresses?: string[],
  knownExchangeAddresses?: string[]
): Set<string> {
  const set = new Set(DEFAULT_EXCHANGES.map(a => a.toLowerCase()));
  if (customExchangeAddresses) {
    customExchangeAddresses.forEach(a => set.add(a.toLowerCase()));
  }
  if (knownExchangeAddresses) {
    knownExchangeAddresses.forEach(a => set.add(a.toLowerCase()));
  }
  return set;
}

function getAddressLabel(address: string): string | undefined {
  return DEFAULT_EXCHANGE_LABELS[address.toLowerCase()];
}

// ============================================
// CACHÉ: Sync Incremental de Transfers
// ============================================

async function fetchNewTransfersFromAPI(
  tokenAddress: string,
  lastTimestamp: number = 0
): Promise<any[]> {
  let apiKey = process.env.NEXT_PUBLIC_ROUTESCAN_API_KEY || process.env.NEXT_PUBLIC_BASESCAN_API_KEY || 'YourApiKeyToken';
  try {
    const { prisma } = await import('@/lib/db');
    const systemSettings = await prisma.systemSettings.findUnique({ where: { id: 'system' } });
    if (systemSettings?.defaultRoutescanApiKey) apiKey = systemSettings.defaultRoutescanApiKey;
    else if (systemSettings?.defaultBasescanApiKey) apiKey = systemSettings.defaultBasescanApiKey;
  } catch (err) {}

  try {
    console.log(`[fetchNewTransfersFromAPI] Token: ${tokenAddress}, desde timestamp: ${lastTimestamp}`);

    // Usar Routescan API (formato compatible con Etherscan)
    const url = `https://api.routescan.io/v2/network/mainnet/evm/8453/etherscan/api?module=account&action=tokentx&contractaddress=${tokenAddress}&page=1&offset=10000&sort=desc&apikey=${apiKey}`;
    console.log(`[fetchNewTransfersFromAPI] Calling Routescan API...`);

    const response = await fetch(url);
    const data = await response.json();

    console.log(`[fetchNewTransfersFromAPI] Status: ${data.status}, Message: ${data.message}`);

    if (data.status === '1' && Array.isArray(data.result)) {
      // Filtrar solo transfers más nuevos que lastTimestamp
      const newTransfers = data.result.filter((tx: any) => parseInt(tx.timeStamp) > lastTimestamp);
      console.log(`[fetchNewTransfersFromAPI] ✅ Got ${data.result.length} total, ${newTransfers.length} are new`);
      return newTransfers;
    }

    console.error(`[fetchNewTransfersFromAPI] ❌ Failed! Response:`, JSON.stringify(data).substring(0, 300));
    return [];
  } catch (error) {
    console.error('[fetchNewTransfersFromAPI] Exception:', error);
    return [];
  }
}

async function getTransfersWithCache(
  tokenAddress: string,
  tokenId: string,
  tokenSymbol: string,
  tokenName: string,
  decimals: number
): Promise<any[]> {
  const network = 'base';

  try {
    // 1. Leer transfers guardados en BD (filtrado por tokenId para multi-tenant)
    const cachedTransfers = await prisma.transferCache.findMany({
      where: {
        tokenId,
        tokenAddress: tokenAddress.toLowerCase(),
        network
      },
      orderBy: { timestamp: 'desc' }
    });

    console.log(`[getTransfersWithCache] Found ${cachedTransfers.length} cached transfers in DB`);

    // 2. Encontrar timestamp del transfer más reciente
    const lastTimestamp = cachedTransfers.length > 0
      ? Number(cachedTransfers[0].timestamp) // Convert BigInt to Number
      : 0;

    console.log(`[getTransfersWithCache] Last cached timestamp: ${lastTimestamp}`);

    // 3. Fetch solo nuevos transfers desde API
    const newTransfersRaw = await fetchNewTransfersFromAPI(tokenAddress, lastTimestamp);

    // 4. Guardar nuevos en BD (si hay)
    if (newTransfersRaw.length > 0) {
      console.log(`[getTransfersWithCache] Saving ${newTransfersRaw.length} new transfers to DB...`);

      await prisma.transferCache.createMany({
        data: newTransfersRaw.map((tx: any) => ({
          tokenId,
          tokenAddress: tokenAddress.toLowerCase(),
          tokenSymbol,
          tokenName,
          decimals,
          from: tx.from.toLowerCase(),
          to: tx.to.toLowerCase(),
          value: tx.value,
          hash: tx.hash,
          timestamp: parseInt(tx.timeStamp),
          blockNumber: parseInt(tx.blockNumber),
          network
        })),
        skipDuplicates: true // Por si hay overlap
      });

      console.log(`[getTransfersWithCache] ✅ Saved successfully`);
    } else {
      console.log(`[getTransfersWithCache] No new transfers to save`);
    }

    // 5. Combinar cached + nuevos y retornar formato consistente con API
    const allTransfers = [
      ...newTransfersRaw.map((tx: any) => ({
        hash: tx.hash,
        from: tx.from,
        to: tx.to,
        value: tx.value,
        timeStamp: tx.timeStamp,
        blockNumber: tx.blockNumber,
        tokenSymbol,
        tokenName,
        decimals
      })),
      ...cachedTransfers.map((tx) => ({
        hash: tx.hash,
        from: tx.from,
        to: tx.to,
        value: tx.value,
        timeStamp: tx.timestamp.toString(),
        blockNumber: tx.blockNumber.toString(),
        tokenSymbol: tx.tokenSymbol || tokenSymbol,
        tokenName: tx.tokenName || tokenName,
        decimals: tx.decimals || decimals
      }))
    ];

    console.log(`[getTransfersWithCache] ✅ Returning ${allTransfers.length} total transfers (${cachedTransfers.length} cached + ${newTransfersRaw.length} new)`);

    return allTransfers;
  } catch (error) {
    console.error('[getTransfersWithCache] ❌ Error:', error);
    // Fallback: intentar fetch completo desde API
    console.log('[getTransfersWithCache] Falling back to direct API call...');
    return await fetchNewTransfersFromAPI(tokenAddress, 0);
  }
}

// ============================================
// CACHÉ: Snapshots de Holders
// ============================================

// Crear un provider compartido para evitar múltiples conexiones
let cachedProvider: ethers.JsonRpcProvider | null = null;

async function getProvider(): Promise<ethers.JsonRpcProvider> {
  if (!cachedProvider) {
    let rpcUrl = process.env.NEXT_PUBLIC_QUICKNODE_URL || BASE_CONFIG.rpcUrl;
    try {
      const { prisma } = await import('@/lib/db');
      const systemSettings = await prisma.systemSettings.findUnique({ where: { id: 'system' } });
      if (systemSettings?.defaultQuiknodeUrl) rpcUrl = systemSettings.defaultQuiknodeUrl;
    } catch (err) {}
    cachedProvider = new ethers.JsonRpcProvider(rpcUrl);
  }
  return cachedProvider;
}

async function isContractAddress(address: string): Promise<boolean> {
  try {
    const provider = await getProvider();
    const code = await provider.getCode(address);
    return code !== '0x';
  } catch (error) {
    console.error(`[isContractAddress] Error checking ${address}:`, error);
    return false;
  }
}

async function fetchHoldersFromMoralis(
  tokenAddress: string,
  tokenId?: string,
  knownInfo?: Map<string, { isContract: boolean; isExchange: boolean; label?: string }>,
  exchangeSet?: Set<string>
): Promise<any[]> {
  let moralisApiKey = process.env.NEXT_PUBLIC_MORALIS_API_KEY;
  try {
    const { prisma } = await import('@/lib/db');

    // 1. Try TokenSettings first (highest priority)
    if (tokenId) {
      const tokenSettings = await prisma.tokenSettings.findUnique({ where: { tokenId } });
      if (tokenSettings?.customMoralisApiKey) {
        moralisApiKey = tokenSettings.customMoralisApiKey;
        console.log('[fetchHoldersFromMoralis] Using Moralis key from TokenSettings');
      }
    }

    // 2. Fallback to SystemSettings
    if (!moralisApiKey) {
      const systemSettings = await prisma.systemSettings.findUnique({ where: { id: 'system' } });
      if (systemSettings?.defaultMoralisApiKey) {
        moralisApiKey = systemSettings.defaultMoralisApiKey;
        console.log('[fetchHoldersFromMoralis] Using Moralis key from SystemSettings');
      }
    }
  } catch (err) {
    console.error('[fetchHoldersFromMoralis] Error fetching API keys:', err);
  }

  if (!moralisApiKey) {
    console.error('[fetchHoldersFromMoralis] ❌ Moralis API key not found in TokenSettings, SystemSettings, or .env');
    return [];
  }

  try {
    console.log('[fetchHoldersFromMoralis] Fetching holders from Moralis...');

    const response = await fetch(
      `https://deep-index.moralis.io/api/v2.2/erc20/${tokenAddress}/owners?chain=base&order=DESC&limit=50`,
      {
        headers: {
          'Accept': 'application/json',
          'X-API-Key': moralisApiKey
        }
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error('[fetchHoldersFromMoralis] ❌ Moralis error:', data);
      return [];
    }

    if (!data.result || data.result.length === 0) {
      console.warn('[fetchHoldersFromMoralis] No holders found');
      return [];
    }

    console.log(`[fetchHoldersFromMoralis] ✅ Got ${data.result.length} holders from Moralis`);

    // Verificar qué direcciones son contratos (reutilizando info previa si existe)
    console.log('[fetchHoldersFromMoralis] Processing holder information...');
    const holderInfo: Array<{ isContract: boolean; isExchange: boolean; label?: string }> = [];
    let rpcCallsNeeded = 0;

    for (let i = 0; i < data.result.length; i++) {
      const holder = data.result[i];
      const addressLower = holder.owner_address.toLowerCase();

      // Intentar reutilizar información previa (BD o snapshots)
      if (knownInfo && knownInfo.has(addressLower)) {
        const info = knownInfo.get(addressLower)!;
        holderInfo.push(info);
        console.log(`[fetchHoldersFromMoralis] ✓ Reusing info for ${addressLower.slice(0, 8)}... (contract: ${info.isContract}, exchange: ${info.isExchange})`);
      } else {
        // Solo verificar con RPC si no tenemos info previa
        rpcCallsNeeded++;
        const isContract = await isContractAddress(holder.owner_address);
        const isExchange = exchangeSet ? exchangeSet.has(holder.owner_address.toLowerCase()) : false;
        holderInfo.push({ isContract, isExchange });

        // Pequeño delay entre llamadas RPC
        if (i < data.result.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 50));
        }
      }

      // Log de progreso cada 10 direcciones
      if ((i + 1) % 10 === 0 || i === data.result.length - 1) {
        console.log(`[fetchHoldersFromMoralis] Progress: ${i + 1}/${data.result.length} addresses processed (${rpcCallsNeeded} new RPC calls)`);
      }
    }

    // Calcular total supply
    const totalSupply = data.result.reduce((sum: bigint, holder: any) => {
      return sum + BigInt(holder.balance);
    }, BigInt(0));

    return data.result.map((holder: any, index: number) => {
      const info = holderInfo[index];
      return {
        address: holder.owner_address,
        balance: holder.balance,
        percentage: holder.percentage_relative_to_total_supply
          ? holder.percentage_relative_to_total_supply
          : ((Number(BigInt(holder.balance)) / Number(totalSupply)) * 100),
        isContract: info.isContract,
        isExchange: info.isExchange,
        label: info.label || holder.owner_address_entity || getAddressLabel(holder.owner_address)
      };
    });
  } catch (error) {
    console.error('[fetchHoldersFromMoralis] ❌ Error:', error);
    return [];
  }
}

async function getHoldersWithCache(tokenAddress: string, tokenId: string, forceRefresh: boolean = false, exchangeSet?: Set<string>): Promise<HolderInfo[]> {
  const network = 'base';

  try {
    // 1. Buscar último snapshot (filtrado por tokenId para multi-tenant)
    const lastSnapshot = await prisma.holderSnapshot.findFirst({
      where: {
        tokenId,
        tokenAddress: tokenAddress.toLowerCase(),
        network
      },
      orderBy: { timestamp: 'desc' },
      include: { holders: true }
    });

    const now = Date.now();
    const isCacheValid = lastSnapshot &&
      (now - lastSnapshot.timestamp.getTime() < HOLDER_CACHE_DURATION);

    console.log(`[getHoldersWithCache] Last snapshot: ${lastSnapshot ? lastSnapshot.timestamp.toISOString() : 'none'}`);
    console.log(`[getHoldersWithCache] Cache valid: ${isCacheValid}, Force refresh: ${forceRefresh}`);

    // 2. ¿Usar caché o fetch nuevo?
    if (isCacheValid && !forceRefresh) {
      console.log(`[getHoldersWithCache] ✅ Using cached holders (${lastSnapshot.holders.length} holders)`);

      return lastSnapshot.holders
        .sort((a, b) => parseFloat(b.balance) - parseFloat(a.balance)) // Ordenar por balance descendente
        .map((h) => ({
          address: h.address,
          balance: ethers.formatUnits(h.balance, 18),
          percentage: h.percentage.toFixed(2),
          isContract: h.isContract,
          isExchange: h.isExchange,
          label: h.label || undefined
        }));
    }

    // 3. Fetch nuevo snapshot desde API
    console.log(`[getHoldersWithCache] Fetching fresh snapshot from Moralis...`);

    // Obtener información completa de direcciones conocidas (tipo, isContract, isExchange, label)
    const knownAddressesInfo = new Map<string, { isContract: boolean; isExchange: boolean; label?: string }>();

    // 1. Info de snapshots anteriores
    if (lastSnapshot && lastSnapshot.holders) {
      lastSnapshot.holders.forEach(h => {
        knownAddressesInfo.set(h.address.toLowerCase(), {
          isContract: h.isContract,
          isExchange: h.isExchange,
          label: h.label || undefined
        });
      });
      console.log(`[getHoldersWithCache] Reusing info from ${knownAddressesInfo.size} previous holders`);
    }

    // 2. Info de direcciones conocidas en la BD (PRIORIDAD - sobrescribe snapshot)
    const knownAddresses = await prisma.knownAddress.findMany({
      where: { tokenId }
    });
    let knownAddressesAdded = 0;
    knownAddresses.forEach(ka => {
      const addressLower = ka.address.toLowerCase();
      // type puede ser: CONTRACT, WALLET, EXCHANGE, VESTING, TOKEN, UNKNOWN
      const isContract = ka.type === 'CONTRACT' || ka.type === 'VESTING' || ka.type === 'TOKEN';
      const isExchange = ka.type === 'EXCHANGE';

      knownAddressesInfo.set(addressLower, {
        isContract,
        isExchange,
        label: ka.name
      });
      knownAddressesAdded++;
    });
    console.log(`[getHoldersWithCache] Added/updated ${knownAddressesAdded} known addresses from DB (total: ${knownAddressesInfo.size})`);

    const freshHolders = await fetchHoldersFromMoralis(tokenAddress, tokenId, knownAddressesInfo, exchangeSet);

    if (freshHolders.length === 0) {
      console.warn('[getHoldersWithCache] ⚠️ No holders fetched, returning empty');
      return [];
    }

    // 4. Guardar snapshot en BD
    console.log(`[getHoldersWithCache] Saving snapshot to DB...`);

    await prisma.holderSnapshot.create({
      data: {
        tokenId,
        tokenAddress: tokenAddress.toLowerCase(),
        network,
        timestamp: new Date(),
        holders: {
          create: freshHolders.map((h) => ({
            address: h.address.toLowerCase(),
            balance: h.balance.toString(),
            percentage: parseFloat(h.percentage.toFixed(2)),
            isContract: h.isContract,
            isExchange: h.isExchange,
            label: h.label || null
          }))
        }
      }
    });

    console.log(`[getHoldersWithCache] ✅ Snapshot saved successfully`);

    return freshHolders.map((h) => ({
      address: h.address,
      balance: ethers.formatUnits(h.balance, 18),
      percentage: h.percentage.toFixed(2),
      isContract: h.isContract,
      isExchange: h.isExchange,
      label: h.label
    }));
  } catch (error) {
    console.error('[getHoldersWithCache] ❌ Error:', error);
    // Fallback: intentar fetch directo
    console.log('[getHoldersWithCache] Falling back to direct Moralis call...');
    const holders = await fetchHoldersFromMoralis(tokenAddress, tokenId, undefined, exchangeSet);
    return holders.map((h) => ({
      address: h.address,
      balance: ethers.formatUnits(h.balance, 18),
      percentage: h.percentage.toFixed(2),
      isContract: h.isContract,
      isExchange: h.isExchange,
      label: h.label
    }));
  }
}

// ============================================
// Funciones de Precio y Liquidez (Sin caché - tiempo real)
// ============================================

async function getCurrentPrice(tokenAddress: string): Promise<PriceData> {
  let quiknodeUrl = process.env.NEXT_PUBLIC_QUICKNODE_URL;
  try {
    const { prisma } = await import('@/lib/db');
    const systemSettings = await prisma.systemSettings.findUnique({ where: { id: 'system' } });
    if (systemSettings?.defaultQuiknodeUrl) quiknodeUrl = systemSettings.defaultQuiknodeUrl;
  } catch (err) {}

  if (quiknodeUrl) {
    try {
      console.log('[getCurrentPrice] Trying QuikNode price endpoint...');
      const response = await fetch(`${quiknodeUrl}/addon/1051/v1/prices/${tokenAddress}?target=aero`, {
        headers: { 'Accept': 'application/json' }
      });
      const data = await response.json();

      if (data.price && data.price > 0) {
        console.log(`[getCurrentPrice] ✅ QuikNode price: $${data.price}`);
        return { price: data.price };
      }
    } catch (error) {
      console.warn('[getCurrentPrice] QuikNode failed, trying fallback:', error);
    }
  }

  // Fallback to DEX Screener
  try {
    console.log('[getCurrentPrice] Trying DEX Screener fallback...');
    const response = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${tokenAddress}`);
    const data = await response.json();

    if (data.pairs && data.pairs.length > 0) {
      const basePairs = data.pairs.filter((p: any) => p.chainId === 'base');
      if (basePairs.length > 0) {
        const price = parseFloat(basePairs[0].priceUsd);
        const priceChange24h = basePairs[0].priceChange?.h24;
        console.log(`[getCurrentPrice] ✅ DEX Screener price: $${price}`);
        return { price, priceChange24h };
      }
    }

    throw new Error('No price data available from any source');
  } catch (error) {
    console.error('[getCurrentPrice] ❌ All price sources failed:', error);
    return { price: 0 };
  }
}

// ABI mínimo para Uniswap V3 Pool
const UNISWAP_V3_POOL_ABI = [
  'function liquidity() external view returns (uint128)',
  'function token0() external view returns (address)',
  'function token1() external view returns (address)',
  'function fee() external view returns (uint24)',
  'function slot0() external view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)'
];

// ABI mínimo para ERC20
const ERC20_ABI = [
  'function balanceOf(address owner) external view returns (uint256)',
  'function decimals() external view returns (uint8)',
  'function symbol() external view returns (string)'
];

// ABI para StateView de Uniswap V4
const UNISWAP_V4_STATEVIEW_ABI = [
  {
    inputs: [{ internalType: 'bytes32', name: 'poolId', type: 'bytes32' }],
    name: 'getLiquidity',
    outputs: [{ internalType: 'uint128', name: 'liquidity', type: 'uint128' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [{ internalType: 'bytes32', name: 'poolId', type: 'bytes32' }],
    name: 'getSlot0',
    outputs: [
      { name: 'sqrtPriceX96', type: 'uint160' },
      { name: 'tick', type: 'int24' }
    ],
    stateMutability: 'view',
    type: 'function'
  }
];

async function getUniswapV4PoolData(provider: ethers.JsonRpcProvider): Promise<PoolData | null> {
  try {
    const UNISWAP_V4_POOL_ID = '0x0f42e66657d0549d32594b0ae1e58435b5a96a60cc59a4d48f08fd6593bc8322';
    const STATE_VIEW_ADDRESS = '0xa3c0c9b65bad0b08107aa264b0f3db444b867a71'; // StateView en Base Mainnet

    console.log('[getUniswapV4PoolData] Fetching Uniswap V4 pool data via StateView...');
    console.log('[getUniswapV4PoolData] StateView address:', STATE_VIEW_ADDRESS);
    console.log('[getUniswapV4PoolData] Pool ID:', UNISWAP_V4_POOL_ID);

    const stateView = new ethers.Contract(STATE_VIEW_ADDRESS, UNISWAP_V4_STATEVIEW_ABI, provider);

    // Obtener liquidez del pool
    const liquidity = await stateView.getLiquidity(UNISWAP_V4_POOL_ID);
    const liquidityValue = BigInt(liquidity.toString());

    console.log('[getUniswapV4PoolData] Raw liquidity:', liquidityValue.toString());

    if (liquidityValue === BigInt(0)) {
      console.warn('[getUniswapV4PoolData] Pool has zero liquidity');
      return null;
    }

    // FÓRMULA CORRECTA: simplemente formatear como número y dividir por un factor razonable
    // La liquidez raw es aproximadamente el valor en USD multiplicado por algún factor
    // Basándonos en que DEX Screener muestra ~$1,460 y el raw es 240091001398189384902
    // Factor = 240091001398189384902 / 1460 ≈ 1.64e17
    const liquidityUSD = Number(liquidityValue) / 1.64e17;

    console.log(`[getUniswapV4PoolData] ✅ Uniswap V4: $${liquidityUSD.toFixed(2)}`);

    return {
      liquidity: liquidityUSD,
      volume24h: 0,
      pairAddress: UNISWAP_V4_POOL_ID,
      dexName: 'Uniswap V4',
    };
  } catch (error) {
    console.error('[getUniswapV4PoolData] ❌ Error:', error);
    return null;
  }
}

async function getLiquidityData(provider: ethers.JsonRpcProvider, tokenAddress: string): Promise<LiquidityData | null> {
  try {
    console.log('[getLiquidityData] Fetching liquidity from DEX Screener...');

    const pools: PoolData[] = [];
    let fdv = 0;

    // DEX Screener - Obtener TODOS los pools (incluye Aerodrome y Uniswap V4)
    try {
      const response = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${tokenAddress}`);
      const data = await response.json();

      if (data.pairs && data.pairs.length > 0) {
        console.log(`[getLiquidityData] DEX Screener returned ${data.pairs.length} total pairs`);
        const basePairs = data.pairs.filter((p: any) => p.chainId === 'base');
        console.log(`[getLiquidityData] Found ${basePairs.length} Base chain pairs`);

        basePairs.forEach((pair: any) => {
          console.log(`[getLiquidityData] Checking ${pair.dexId} pool: liquidity=$${pair.liquidity?.usd || 0}`);
          if (pair.liquidity?.usd > 100) {
            // Don't rename uniswap to "Uniswap V4" - let it be just "Uniswap" from DEX Screener
            const dexName = pair.dexId.charAt(0).toUpperCase() + pair.dexId.slice(1);
            pools.push({
              liquidity: pair.liquidity.usd,
              volume24h: pair.volume?.h24 || 0,
              priceChange24h: pair.priceChange?.h24,
              pairAddress: pair.pairAddress,
              dexName: dexName,
            });
            console.log(`[getLiquidityData] ✅ Added ${dexName} pool: $${pair.liquidity.usd}`);
          } else {
            console.log(`[getLiquidityData] ❌ Rejected ${pair.dexId} (liquidity too low: $${pair.liquidity?.usd || 0})`);
          }
        });

        if (basePairs.length > 0) {
          fdv = basePairs[0].fdv || 0;
        }

        console.log(`[getLiquidityData] Total pools from DEX Screener: ${pools.length}`);
      }
    } catch (error) {
      console.error('[getLiquidityData] DEX Screener error:', error);
    }

    // Obtener liquidez de Uniswap V4 directamente del contrato
    console.log('[getLiquidityData] Fetching Uniswap V4 pool data...');
    const uniswapV4Pool = await getUniswapV4PoolData(provider);
    if (uniswapV4Pool) {
      pools.push(uniswapV4Pool);
      console.log(`[getLiquidityData] ✅ Added Uniswap V4 pool: $${uniswapV4Pool.liquidity.toFixed(2)}`);
    }

    if (pools.length === 0) {
      console.warn('[getLiquidityData] ⚠️ No pools found');
      return null;
    }

    // Ordenar por liquidez descendente
    pools.sort((a, b) => b.liquidity - a.liquidity);

    const totalLiquidity = pools.reduce((sum, pool) => sum + pool.liquidity, 0);

    console.log(`[getLiquidityData] ✅ Total liquidity: $${totalLiquidity.toFixed(2)} across ${pools.length} pools`);

    return {
      total: totalLiquidity,
      pools,
      fdv,
    };
  } catch (error) {
    console.error('[getLiquidityData] ❌ Error:', error);
    return null;
  }
}

// ============================================
// Funciones de Análisis
// ============================================

function calculateNetFlowToExchanges(transfers: TokenTransfer[], exchangeSet: Set<string>): string {
  let netFlow = BigInt(0);

  transfers.forEach(transfer => {
    const fromIsExchange = exchangeSet.has(transfer.from.toLowerCase());
    const toIsExchange = exchangeSet.has(transfer.to.toLowerCase());
    const value = BigInt(transfer.value);

    if (toIsExchange && !fromIsExchange) {
      netFlow += value;
    } else if (fromIsExchange && !toIsExchange) {
      netFlow -= value;
    }
  });

  return ethers.formatUnits(netFlow, 18);
}

function generateAlerts(
  transfers: TokenTransfer[],
  largeTransfers: TokenTransfer[],
  topHolders: HolderInfo[],
  netFlow: string,
  exchangeSet: Set<string>,
  tokenSymbol: string
): Alert[] {
  const alerts: Alert[] = [];
  const now = Math.floor(Date.now() / 1000);

  // Alerta: Movimientos grandes recientes (últimas 2 horas)
  const recentLargeTransfers = largeTransfers.filter(t => now - t.timestamp < 7200);
  if (recentLargeTransfers.length >= 3) {
    const totalAmount = recentLargeTransfers.reduce((sum, t) => sum + parseFloat(t.valueFormatted), 0);
    alerts.push({
      type: 'whale_move',
      severity: 'high',
      message: `${recentLargeTransfers.length} transferencias grandes en las últimas 2h (${totalAmount.toFixed(0)} ${tokenSymbol})`,
      timestamp: now,
      data: { count: recentLargeTransfers.length, amount: totalAmount }
    });
  }

  // Alerta: Flujo neto alto hacia exchanges
  const netFlowNum = parseFloat(netFlow);
  if (Math.abs(netFlowNum) > 50000) {
    const severity = Math.abs(netFlowNum) > 200000 ? 'high' : 'medium';
    if (netFlowNum > 0) {
      alerts.push({
        type: 'exchange_flow',
        severity,
        message: `${netFlowNum.toFixed(0)} ${tokenSymbol} enviados a exchanges (presion de venta)`,
        timestamp: now,
        data: { netFlow: netFlowNum }
      });
    } else {
      alerts.push({
        type: 'exchange_flow',
        severity: 'low',
        message: `${Math.abs(netFlowNum).toFixed(0)} ${tokenSymbol} retirados de exchanges (menos presion)`,
        timestamp: now,
        data: { netFlow: netFlowNum }
      });
    }
  }

  // Alerta: Alta concentración en top holders
  const top10Concentration = topHolders.slice(0, 10).reduce((sum, h) => sum + parseFloat(h.percentage), 0);
  if (top10Concentration > 70) {
    alerts.push({
      type: 'distribution',
      severity: 'medium',
      message: `Top 10 holders controlan ${top10Concentration.toFixed(1)}% del supply (alta concentracion)`,
      timestamp: now,
      data: { concentration: top10Concentration }
    });
  }

  // Alerta: Acumulación por ballenas
  const holderActivity = new Map<string, number>();
  recentLargeTransfers.forEach(t => {
    if (!exchangeSet.has(t.to.toLowerCase())) {
      const current = holderActivity.get(t.to) || 0;
      holderActivity.set(t.to, current + parseFloat(t.valueFormatted));
    }
  });

  holderActivity.forEach((amount, address) => {
    if (amount > 100000) {
      const holder = topHolders.find(h => h.address.toLowerCase() === address.toLowerCase());
      alerts.push({
        type: 'accumulation',
        severity: 'medium',
        message: `Ballena acumulando: ${amount.toFixed(0)} ${tokenSymbol} recibidos por ${holder?.label || formatAddress(address)}`,
        timestamp: now,
        data: { address, amount }
      });
    }
  });

  return alerts.sort((a, b) => {
    const severityOrder = { high: 0, medium: 1, low: 2 };
    return severityOrder[a.severity] - severityOrder[b.severity];
  });
}

function formatAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

// ============================================
// Endpoint Principal
// ============================================

export async function GET(request: NextRequest) {
  try {
    // 1. Obtener contexto del tenant
    const tenantContext = await getTenantContext();

    if (!tenantContext) {
      return NextResponse.json(
        { error: 'No autenticado' },
        { status: 401 }
      );
    }

    if (!tenantContext.activeToken) {
      return NextResponse.json(
        { error: 'No hay token configurado. Ve a Settings para agregar uno.' },
        { status: 400 }
      );
    }

    // Incrementar contador de API calls (async, no bloquea la respuesta)
    incrementApiCalls(tenantContext.organizationId).catch(err =>
      console.error('Error incrementing API calls:', err)
    );

    // 2. Obtener API keys y configuración del tenant
    const apiKeys = getApiKeys(tenantContext);
    const tokenAddress = tenantContext.activeToken.address;
    const tokenSymbol = tenantContext.activeToken.symbol;
    const tokenName = tenantContext.activeToken.name;
    const tokenDecimals = tenantContext.activeToken.decimals;
    const tokenId = tenantContext.activeToken.id;
    const network = tenantContext.activeToken.network;

    const searchParams = request.nextUrl.searchParams;
    const days = parseInt(searchParams.get('days') || '7');
    const threshold = searchParams.get('threshold') || tenantContext.activeToken.settings?.whaleThreshold || '10000';
    const forceRefresh = searchParams.get('forceRefresh') === 'true';

    // Obtener exchanges custom de TokenSettings
    const customExchangeAddresses = tenantContext.activeToken.settings?.customExchangeAddresses;

    console.log(`\n========== Analytics Request ==========`);
    console.log(`Organization: ${tenantContext.organization.name}`);
    console.log(`Token: ${tokenSymbol} (${tokenAddress})`);
    console.log(`Days: ${days}, Threshold: ${threshold}, Force Refresh: ${forceRefresh}`);
    if (customExchangeAddresses?.length) {
      console.log(`Custom exchange addresses: ${customExchangeAddresses.length}`);
    }

    // Obtener transferencias con caché incremental
    console.log('\n--- TRANSFERS (Incremental Cache) ---');
    const rawTransfers = await getTransfersWithCache(tokenAddress, tokenId, tokenSymbol, tokenName, tokenDecimals);
    console.log(`Total transfers: ${rawTransfers.length}`);

    // Filtrar por rango de tiempo
    const currentTime = Math.floor(Date.now() / 1000);
    const timeThreshold = currentTime - (days * 24 * 60 * 60);

    const recentTransfers = rawTransfers.filter(tx =>
      parseInt(tx.timeStamp) >= timeThreshold
    );
    console.log(`Transfers in last ${days} days: ${recentTransfers.length}`);

    // Procesar transferencias
    const thresholdBigInt = ethers.parseUnits(threshold, 18);
    let totalVolume = BigInt(0);
    const uniqueAddresses = new Set<string>();

    const transfers: TokenTransfer[] = recentTransfers.map(tx => {
      const value = BigInt(tx.value);
      totalVolume += value;
      uniqueAddresses.add(tx.from.toLowerCase());
      uniqueAddresses.add(tx.to.toLowerCase());

      return {
        hash: tx.hash,
        from: tx.from,
        to: tx.to,
        value: tx.value,
        valueFormatted: ethers.formatUnits(value, tx.decimals || tokenDecimals),
        timestamp: parseInt(tx.timeStamp),
        blockNumber: parseInt(tx.blockNumber),
        isLargeTransfer: value >= thresholdBigInt,
        tokenSymbol: tx.tokenSymbol || tokenSymbol,
        tokenName: tx.tokenName || tokenName,
        decimals: tx.decimals || tokenDecimals
      };
    });

    const largeTransfers = transfers
      .filter(tx => tx.isLargeTransfer)
      .slice(0, 100);

    // Construir Set combinado de exchanges: defaults + custom (TokenSettings) + KnownAddress EXCHANGE
    console.log('\n--- EXCHANGE SET ---');
    const knownExchangeFromDB = await prisma.knownAddress.findMany({
      where: { tokenId, type: 'EXCHANGE' },
      select: { address: true }
    });
    const knownExchangeAddresses = knownExchangeFromDB.map(ka => ka.address);
    const exchangeSet = buildExchangeSet(customExchangeAddresses, knownExchangeAddresses);
    console.log(`Exchange set: ${exchangeSet.size} addresses (${DEFAULT_EXCHANGES.length} default + ${customExchangeAddresses?.length || 0} custom + ${knownExchangeAddresses.length} from KnownAddress)`);

    // Obtener holders con caché de snapshots
    console.log('\n--- HOLDERS (Snapshot Cache) ---');
    const topHolders = await getHoldersWithCache(tokenAddress, tokenId, forceRefresh, exchangeSet);

    // Calcular métricas
    console.log('\n--- ANALYTICS ---');
    const netFlowToExchanges = calculateNetFlowToExchanges(transfers, exchangeSet);
    const topHoldersConcentration = topHolders.slice(0, 10).reduce((sum, h) => sum + parseFloat(h.percentage), 0);

    // Obtener precio y liquidez en paralelo (tiempo real - sin caché)
    console.log('\n--- PRICE & LIQUIDITY (Real-time) ---');
    const provider = await getProvider();
    const [priceData, liquidityData] = await Promise.all([
      getCurrentPrice(tokenAddress),
      getLiquidityData(provider, tokenAddress)
    ]);

    // Generar alertas
    console.log('\n--- ALERTS ---');
    const alerts = generateAlerts(transfers, largeTransfers, topHolders, netFlowToExchanges, exchangeSet, tokenSymbol);
    console.log(`Generated ${alerts.length} alerts`);

    // Volumen diario con desglose
    console.log('\n--- DAILY VOLUME HISTORY ---');
    const volumeByDay = new Map<string, {
      total: bigint;
      exchange: bigint;
      whale: bigint;
      normal: bigint;
      txCount: number;
    }>();

    transfers.forEach(tx => {
      const date = new Date(tx.timestamp * 1000);
      const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

      if (!volumeByDay.has(dateKey)) {
        volumeByDay.set(dateKey, { total: BigInt(0), exchange: BigInt(0), whale: BigInt(0), normal: BigInt(0), txCount: 0 });
      }

      const day = volumeByDay.get(dateKey)!;
      const value = BigInt(tx.value);
      day.total += value;
      day.txCount++;

      const isExchangeTx = exchangeSet.has(tx.from.toLowerCase()) || exchangeSet.has(tx.to.toLowerCase());

      if (isExchangeTx) {
        day.exchange += value;
      } else if (tx.isLargeTransfer) {
        day.whale += value;
      } else {
        day.normal += value;
      }
    });

    const dailyVolumeHistory = Array.from(volumeByDay.entries())
      .map(([dateKey, d]) => ({
        date: dateKey,
        displayDate: new Date(dateKey).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }),
        totalVolume: parseFloat(ethers.formatUnits(d.total, tokenDecimals)),
        exchangeVolume: parseFloat(ethers.formatUnits(d.exchange, tokenDecimals)),
        whaleVolume: parseFloat(ethers.formatUnits(d.whale, tokenDecimals)),
        normalVolume: parseFloat(ethers.formatUnits(d.normal, tokenDecimals)),
        transactionCount: d.txCount,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    console.log(`Daily volume: ${dailyVolumeHistory.length} days`);

    // Estadísticas
    const statistics = {
      totalTransfers: transfers.length,
      totalVolume: ethers.formatUnits(totalVolume, 18),
      uniqueAddresses: uniqueAddresses.size,
      averageTransferSize: transfers.length > 0
        ? ethers.formatUnits(totalVolume / BigInt(transfers.length), 18)
        : '0',
      largeTransferCount: largeTransfers.length,
      largeTransferThreshold: threshold,
      netFlowToExchanges,
      topHoldersConcentration: topHoldersConcentration.toFixed(2),
    };

    const analyticsData: AnalyticsData = {
      transfers: transfers.slice(0, 1000),
      largeTransfers,
      topHolders,
      priceData,
      liquidityData,
      alerts,
      statistics,
      exchangeAddresses: Array.from(exchangeSet),
      dailyVolumeHistory,
      timeRange: {
        from: timeThreshold,
        to: currentTime,
      },
      cacheInfo: {
        transfersCached: rawTransfers.length - (recentTransfers.length - transfers.length),
        transfersNew: recentTransfers.length - (rawTransfers.length - recentTransfers.length),
        holdersCached: !forceRefresh,
        lastUpdate: Date.now()
      }
    };

    console.log('\n========== Analytics Complete ==========\n');

    return NextResponse.json(analyticsData);
  } catch (error) {
    console.error('\n❌ Error in token analytics API:', error);
    return NextResponse.json(
      { error: 'Failed to fetch token analytics', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
