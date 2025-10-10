import { NextRequest, NextResponse } from 'next/server';
import { ethers } from 'ethers';

// Dirección del token VTN
const VTN_TOKEN_ADDRESS = '0xA9bc478A44a8c8FE6fd505C1964dEB3cEe3b7abC';

// Configuración de red Base
const BASE_CONFIG = {
  rpcUrl: 'https://mainnet.base.org',
  explorerApiUrl: 'https://api.basescan.org/api',
  chainId: 8453,
};

interface TokenTransfer {
  hash: string;
  from: string;
  to: string;
  value: string;
  valueFormatted: string;
  timestamp: number;
  blockNumber: number;
  isLargeTransfer: boolean;
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

interface LiquidityData {
  liquidity: number;
  volume24h: number;
  priceChange24h: number;
  fdv?: number;
  pairAddress?: string;
  dexName?: string;
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
}

// Lista de direcciones conocidas de exchanges (puedes expandir esto)
const KNOWN_EXCHANGES = new Set([
  '0x3cd751e6b0078be393132286c442345e5dc49699', // Coinbase
  '0x71660c4005ba85c37ccec55d0c4493e66fe775d3', // Coinbase 2
  '0x503828976d22510aad0201ac7ec88293211d23da', // Coinbase 3
  '0x0d0707963952f2fba59dd06f2b425ace40b492fe', // Gate.io
  // Añade más direcciones de exchanges según sea necesario
]);

function isExchangeAddress(address: string): boolean {
  return KNOWN_EXCHANGES.has(address.toLowerCase());
}

function getAddressLabel(address: string): string | undefined {
  const addr = address.toLowerCase();
  if (addr === '0x3cd751e6b0078be393132286c442345e5dc49699') return 'Coinbase';
  if (addr === '0x71660c4005ba85c37ccec55d0c4493e66fe775d3') return 'Coinbase 2';
  if (addr === '0x503828976d22510aad0201ac7ec88293211d23da') return 'Coinbase 3';
  if (addr === '0x0d0707963952f2fba59dd06f2b425ace40b492fe') return 'Gate.io';
  return undefined;
}

async function fetchTransferHistory(
  tokenAddress: string,
  startBlock: number = 0,
  endBlock: number = 99999999
): Promise<any[]> {
  const apiKey = process.env.NEXT_PUBLIC_ETHERSCAN_API_KEY || process.env.NEXT_PUBLIC_BASESCAN_API_KEY || 'YourApiKeyToken';

  try {
    console.log(`[fetchTransferHistory] Token: ${tokenAddress}`);
    console.log(`[fetchTransferHistory] API key: ${apiKey ? apiKey.substring(0, 10) + '...' : 'MISSING'}`);

    // Usar API V2 de Etherscan (sin startblock/endblock porque causan problemas)
    const url = `https://api.etherscan.io/v2/api?chainid=${BASE_CONFIG.chainId}&module=account&action=tokentx&contractaddress=${tokenAddress}&page=1&offset=10000&sort=desc&apikey=${apiKey}`;
    console.log(`[fetchTransferHistory] Calling API...`);

    const response = await fetch(url);
    const data = await response.json();

    console.log(`[fetchTransferHistory] Status: ${data.status}, Message: ${data.message}`);

    if (data.status === '1' && Array.isArray(data.result)) {
      console.log(`[fetchTransferHistory] ✅ Success! Got ${data.result.length} transfers`);
      return data.result;
    }

    console.error(`[fetchTransferHistory] ❌ Failed! Response:`, JSON.stringify(data).substring(0, 300));
    return [];
  } catch (error) {
    console.error('[fetchTransferHistory] Exception:', error);
    return [];
  }
}

// Función para obtener precio actual desde QuikNode
async function getCurrentPrice(): Promise<PriceData> {
  const quiknodeUrl = process.env.NEXT_PUBLIC_QUICKNODE_URL || 'https://quick-old-patina.base-mainnet.quiknode.pro/1d225d2d7f2fa80e9ea072e82f151f5dcf221d52';
  
  try {
    const response = await fetch(`${quiknodeUrl}/addon/1051/v1/prices/${VTN_TOKEN_ADDRESS}?target=aero`);
    const data = await response.json();
    
    if (data.price) {
      console.log(`[getCurrentPrice] ✅ Current price: $${data.price}`);
      return {
        price: data.price,
      };
    }
    
    throw new Error('Price not available');
  } catch (error) {
    console.error('[getCurrentPrice] ❌ Error fetching price:', error);
    return { price: 0 };
  }
}

// Función para obtener datos de liquidez desde DEX Screener (GRATIS)
async function getLiquidityData(): Promise<LiquidityData | null> {
  try {
    console.log('[getLiquidityData] Fetching from DEX Screener...');
    const response = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${VTN_TOKEN_ADDRESS}`);
    const data = await response.json();
    
    if (data.pairs && data.pairs.length > 0) {
      // Buscar el par principal (mayor liquidez en Base)
      const basePairs = data.pairs.filter((p: any) => p.chainId === 'base');
      const mainPair = basePairs.sort((a: any, b: any) => b.liquidity.usd - a.liquidity.usd)[0];
      
      if (mainPair) {
        console.log(`[getLiquidityData] ✅ Found pair on ${mainPair.dexId}: $${mainPair.liquidity.usd.toFixed(2)} liquidity`);
        return {
          liquidity: mainPair.liquidity.usd || 0,
          volume24h: mainPair.volume.h24 || 0,
          priceChange24h: mainPair.priceChange.h24 || 0,
          fdv: mainPair.fdv || 0,
          pairAddress: mainPair.pairAddress,
          dexName: mainPair.dexId,
        };
      }
    }
    
    console.warn('[getLiquidityData] ⚠️ No pairs found on Base');
    return null;
  } catch (error) {
    console.error('[getLiquidityData] ❌ Error:', error);
    return null;
  }
}

// Crear un provider compartido para evitar crear múltiples conexiones
let cachedProvider: ethers.JsonRpcProvider | null = null;

function getProvider(): ethers.JsonRpcProvider {
  if (!cachedProvider) {
    cachedProvider = new ethers.JsonRpcProvider(BASE_CONFIG.rpcUrl);
  }
  return cachedProvider;
}

async function isContractAddress(address: string): Promise<boolean> {
  try {
    const provider = getProvider();
    const code = await provider.getCode(address);
    const isContract = code !== '0x';
    
    if (isContract) {
      console.log(`[isContractAddress] ✅ ${address} IS a contract (code length: ${code.length})`);
    } else {
      console.log(`[isContractAddress] ℹ️ ${address} is NOT a contract (EOA)`);
    }
    
    return isContract;
  } catch (error) {
    console.error(`[isContractAddress] ❌ Error checking ${address}:`, error);
    // En caso de error, intentar una vez más después de un pequeño delay
    try {
      await new Promise(resolve => setTimeout(resolve, 500));
      const provider = getProvider();
      const code = await provider.getCode(address);
      const isContract = code !== '0x';
      console.log(`[isContractAddress] 🔄 Retry successful for ${address}: ${isContract ? 'CONTRACT' : 'EOA'}`);
      return isContract;
    } catch (retryError) {
      console.error(`[isContractAddress] ❌ Retry failed for ${address}:`, retryError);
      return false;
    }
  }
}

async function getTopHolders(tokenAddress: string): Promise<HolderInfo[]> {
  const moralisApiKey = process.env.NEXT_PUBLIC_MORALIS_API_KEY;

  if (!moralisApiKey) {
    console.error('[getTopHolders] ❌ Moralis API key not found');
    return [];
  }

  try {
    console.log('[getTopHolders] Fetching REAL holders from Moralis...');

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
      console.error('[getTopHolders] ❌ Moralis error:', data);
      return [];
    }

    if (!data.result || data.result.length === 0) {
      console.warn('[getTopHolders] No holders found');
      return [];
    }

    console.log(`[getTopHolders] ✅ Got ${data.result.length} REAL holders from Moralis`);

    // Calcular total supply desde los holders
    const totalSupply = data.result.reduce((sum: bigint, holder: any) => {
      return sum + BigInt(holder.balance);
    }, BigInt(0));

    // Verificar qué direcciones son contratos (secuencialmente para evitar límites del RPC)
    console.log('[getTopHolders] Checking which addresses are contracts...');
    const contractChecks: boolean[] = [];
    
    for (let i = 0; i < data.result.length; i++) {
      const holder = data.result[i];
      const isContract = await isContractAddress(holder.owner_address);
      contractChecks.push(isContract);
      
      // Pequeño delay entre cada llamada para ser amigables con el RPC público
      if (i < data.result.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      
      // Log de progreso cada 10 direcciones
      if ((i + 1) % 10 === 0 || i === data.result.length - 1) {
        console.log(`[getTopHolders] Progress: ${i + 1}/${data.result.length} addresses checked, ${contractChecks.filter(Boolean).length} contracts found`);
      }
    }
    
    console.log(`[getTopHolders] ✅ Contract verification complete. Found ${contractChecks.filter(Boolean).length} contracts out of ${contractChecks.length} addresses`);

    return data.result.map((holder: any, index: number) => {
      const isExchange = isExchangeAddress(holder.owner_address);
      const isContract = contractChecks[index];
      
      return {
        address: holder.owner_address,
        balance: ethers.formatUnits(holder.balance, 18),
        percentage: holder.percentage_relative_to_total_supply
          ? holder.percentage_relative_to_total_supply.toFixed(2)
          : ((Number(BigInt(holder.balance)) / Number(totalSupply)) * 100).toFixed(2),
        isExchange,
        isContract, // Solo usar la verificación RPC real
        label: holder.owner_address_entity || getAddressLabel(holder.owner_address),
      };
    });
  } catch (error) {
    console.error('[getTopHolders] ❌ Error:', error);
    return [];
  }
}

// Función para calcular flujo neto hacia exchanges
function calculateNetFlowToExchanges(transfers: TokenTransfer[]): string {
  let netFlow = BigInt(0);
  
  transfers.forEach(transfer => {
    const fromIsExchange = isExchangeAddress(transfer.from);
    const toIsExchange = isExchangeAddress(transfer.to);
    const value = BigInt(transfer.value);
    
    if (toIsExchange && !fromIsExchange) {
      // Tokens ENTRANDO a exchange (presión de venta)
      netFlow += value;
    } else if (fromIsExchange && !toIsExchange) {
      // Tokens SALIENDO de exchange (menos presión de venta)
      netFlow -= value;
    }
  });
  
  return ethers.formatUnits(netFlow, 18);
}

// Función para generar alertas basadas en los datos
function generateAlerts(
  transfers: TokenTransfer[],
  largeTransfers: TokenTransfer[],
  topHolders: HolderInfo[],
  netFlow: string
): Alert[] {
  const alerts: Alert[] = [];
  const now = Math.floor(Date.now() / 1000);
  
  // Alerta: Movimientos grandes recientes (últimas 2 horas)
  const recentLargeTransfers = largeTransfers.filter(t => now - t.timestamp < 7200); // 2 horas
  if (recentLargeTransfers.length >= 3) {
    const totalAmount = recentLargeTransfers.reduce((sum, t) => sum + parseFloat(t.valueFormatted), 0);
    alerts.push({
      type: 'whale_move',
      severity: 'high',
      message: `${recentLargeTransfers.length} transferencias grandes en las últimas 2h (${totalAmount.toFixed(0)} VTN)`,
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
        message: `⚠️ ${netFlowNum.toFixed(0)} VTN enviados a exchanges (presión de venta)`,
        timestamp: now,
        data: { netFlow: netFlowNum }
      });
    } else {
      alerts.push({
        type: 'exchange_flow',
        severity: 'low',
        message: `✅ ${Math.abs(netFlowNum).toFixed(0)} VTN retirados de exchanges (menos presión)`,
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
      message: `Top 10 holders controlan ${top10Concentration.toFixed(1)}% del supply (alta concentración)`,
      timestamp: now,
      data: { concentration: top10Concentration }
    });
  }
  
  // Alerta: Acumulación por ballenas (holder individual con múltiples compras grandes recientes)
  const holderActivity = new Map<string, number>();
  recentLargeTransfers.forEach(t => {
    if (!isExchangeAddress(t.to)) {
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
        message: `🐋 Ballena acumulando: ${amount.toFixed(0)} VTN recibidos por ${holder?.label || formatAddress(address)}`,
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

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const days = parseInt(searchParams.get('days') || '7');
    const threshold = searchParams.get('threshold') || '10000'; // Umbral para transferencias grandes (en tokens)

    // Calcular bloques aproximados (Base: ~2 segundos por bloque)
    const blocksPerDay = (24 * 60 * 60) / 2;
    const startBlock = Math.floor(Date.now() / 1000 - days * 24 * 60 * 60);

    console.log(`Fetching analytics for last ${days} days...`);
    console.log(`Token address: ${VTN_TOKEN_ADDRESS}`);

    // Obtener historial de transferencias
    const rawTransfers = await fetchTransferHistory(VTN_TOKEN_ADDRESS);
    console.log(`Raw transfers fetched: ${rawTransfers.length}`);

    if (rawTransfers.length === 0) {
      console.warn('No transfers found from API');
    }

    // Filtrar por rango de tiempo
    const currentTime = Math.floor(Date.now() / 1000);
    const timeThreshold = currentTime - (days * 24 * 60 * 60);
    console.log(`Filtering transfers from timestamp ${timeThreshold} to ${currentTime}`);

    const recentTransfers = rawTransfers.filter(tx =>
      parseInt(tx.timeStamp) >= timeThreshold
    );
    console.log(`Recent transfers after filtering: ${recentTransfers.length}`);

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
        valueFormatted: ethers.formatUnits(value, 18),
        timestamp: parseInt(tx.timeStamp),
        blockNumber: parseInt(tx.blockNumber),
        isLargeTransfer: value >= thresholdBigInt,
      };
    });

    // Filtrar transferencias grandes (sin ordenar - se ordena en el frontend)
    const largeTransfers = transfers
      .filter(tx => tx.isLargeTransfer)
      .slice(0, 100); // Top 100 transferencias grandes

    // Obtener top holders
    console.log('Calculating top holders...');
    const topHolders = await getTopHolders(VTN_TOKEN_ADDRESS);

    // Calcular net flow a exchanges
    console.log('Calculating net flow to exchanges...');
    const netFlowToExchanges = calculateNetFlowToExchanges(transfers);
    console.log(`[Analytics] Net flow to exchanges: ${netFlowToExchanges} VTN`);

    // Calcular concentración de top holders
    const topHoldersConcentration = topHolders.slice(0, 10).reduce((sum, h) => sum + parseFloat(h.percentage), 0);

    // Obtener precio actual y liquidez (en paralelo)
    console.log('Fetching price and liquidity data...');
    const [priceData, liquidityData] = await Promise.all([
      getCurrentPrice(),
      getLiquidityData()
    ]);

    // Generar alertas
    console.log('Generating alerts...');
    const alerts = generateAlerts(transfers, largeTransfers, topHolders, netFlowToExchanges);
    console.log(`[Analytics] Generated ${alerts.length} alerts`);

    // Calcular estadísticas
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
      transfers: transfers.slice(0, 1000), // Limitar a 1000 más recientes
      largeTransfers,
      topHolders: topHolders, // Todos los que devuelva Moralis (50)
      priceData,
      liquidityData,
      alerts,
      statistics,
      timeRange: {
        from: timeThreshold,
        to: currentTime,
      },
    };

    return NextResponse.json(analyticsData);
  } catch (error) {
    console.error('Error in token analytics API:', error);
    return NextResponse.json(
      { error: 'Failed to fetch token analytics' },
      { status: 500 }
    );
  }
}
