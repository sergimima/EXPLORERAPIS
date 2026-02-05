import { NextRequest, NextResponse } from 'next/server';
import axios, { AxiosError } from 'axios';
import { ethers } from 'ethers';
import { getTenantContext, getApiKeys } from '@/lib/tenant-context';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

// Duración del caché: 5 minutos
const CACHE_DURATION = 5 * 60 * 1000;

// ABI mínimo de ERC20 para totalSupply
const ERC20_ABI = [
  'function totalSupply() view returns (uint256)',
  'function decimals() view returns (uint8)'
];

// Configuración de redes
const NETWORKS: Record<string, string> = {
  'base': 'https://mainnet.base.org',
  'base-testnet': 'https://goerli.base.org',
  'base-sepolia': 'https://sepolia.base.org'
};

/**
 * Calcula el supply on-chain directamente desde el contrato ERC20
 */
async function getSupplyOnChain(
  tokenAddress: string,
  network: string,
  customQuiknodeUrl?: string
): Promise<{ totalSupply: string; circulatingSupply: string; lockedSupply: string }> {
  // Intentar primero con QuikNode custom, luego con RPC público como fallback
  const rpcUrls = [
    customQuiknodeUrl,
    NETWORKS[network] || NETWORKS['base']
  ].filter(Boolean);

  let lastError: Error | null = null;

  for (const rpcUrl of rpcUrls) {
    try {
      console.log(`[token-supply] Intentando RPC: ${rpcUrl?.substring(0, 40)}...`);
      const provider = new ethers.JsonRpcProvider(rpcUrl);

      const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);

      // Obtener total supply y decimals
      const [totalSupplyBigInt, decimals] = await Promise.all([
        tokenContract.totalSupply(),
        tokenContract.decimals()
      ]);

      // Convertir de wei a tokens
      const totalSupply = ethers.formatUnits(totalSupplyBigInt, decimals);

      // Por ahora, circulating = total (simplificación)
      // TODO: Restar balances de vesting contracts, burned addresses, etc.
      const circulatingSupply = totalSupply;
      const lockedSupply = '0';

      console.log(`[token-supply] ✅ On-chain: Total=${totalSupply}, Circulating=${circulatingSupply}`);

      return {
        totalSupply,
        circulatingSupply,
        lockedSupply
      };
    } catch (error) {
      lastError = error as Error;
      console.warn(`[token-supply] ⚠️ Error con RPC ${rpcUrl?.substring(0, 40)}: ${lastError.message}`);
      // Continuar con el siguiente RPC
      continue;
    }
  }

  // Si llegamos aquí, todos los RPCs fallaron
  throw new Error(`No se pudo obtener supply on-chain. Último error: ${lastError?.message}`);
}

export async function GET(request: NextRequest) {
  console.log('Iniciando petición a la API de token-supply');

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

    const tokenId = tenantContext.activeToken.id;
    const tokenAddress = tenantContext.activeToken.address;
    const tokenSymbol = tenantContext.activeToken.symbol;
    const forceRefresh = request.nextUrl.searchParams.get('forceRefresh') === 'true';

    console.log(`Token: ${tokenSymbol} (${tokenAddress})`);

    // 2. Buscar en caché si no es force refresh
    if (!forceRefresh) {
      const cachedSupply = await prisma.tokenSupplyCache.findFirst({
        where: { tokenId },
        orderBy: { cachedAt: 'desc' }
      });

      if (cachedSupply) {
        const cacheAge = Date.now() - cachedSupply.cachedAt.getTime();
        if (cacheAge < CACHE_DURATION) {
          console.log(`[token-supply] ✅ Using cached data (${Math.floor(cacheAge / 1000)}s old)`);
          return NextResponse.json({
            totalSupply: cachedSupply.totalSupply,
            circulatingSupply: cachedSupply.circulatingSupply,
            lockedSupply: cachedSupply.lockedSupply,
            lastUpdated: cachedSupply.cachedAt.toISOString(),
            cached: true
          });
        }
      }
    }

    // 3. Obtener configuración de supply del token
    const tokenSettings = await prisma.tokenSettings.findUnique({
      where: { tokenId }
    });

    const supplyMethod = tokenSettings?.supplyMethod || 'API';
    const totalSupplyUrl = tokenSettings?.supplyApiTotalUrl || 'https://intapi.vottun.tech/tkn/v1/total-supply';
    const circulatingSupplyUrl = tokenSettings?.supplyApiCirculatingUrl || 'https://intapi.vottun.tech/tkn/v1/circulating-supply';

    console.log(`[token-supply] Method: ${supplyMethod}`);

    let totalSupply: string;
    let circulatingSupply: string;
    let lockedSupply: string;

    if (supplyMethod === 'ONCHAIN') {
      // Calcular supply on-chain
      console.log('[token-supply] Calculating supply on-chain...');
      const apiKeys = await getApiKeys(tenantContext);
      const supplyData = await getSupplyOnChain(
        tokenAddress,
        tenantContext.activeToken.network,
        apiKeys.quiknodeUrl
      );
      totalSupply = supplyData.totalSupply;
      circulatingSupply = supplyData.circulatingSupply;
      lockedSupply = supplyData.lockedSupply;
    } else {
      // 4. Fetch desde API (método por defecto)
      console.log(`[token-supply] Fetching from API...`);
      console.log(`[token-supply] Total Supply URL: ${totalSupplyUrl}`);
      console.log(`[token-supply] Circulating Supply URL: ${circulatingSupplyUrl}`);

      const config = {
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      };

      const totalSupplyResponse = await axios.get(totalSupplyUrl, config);
      const circulatingSupplyResponse = await axios.get(circulatingSupplyUrl, config);

      totalSupply = totalSupplyResponse.data?.totalSupply || '0';
      circulatingSupply = circulatingSupplyResponse.data?.circulatingSupply || '0';

      const totalSupplyNum = parseFloat(totalSupply);
      const circulatingSupplyNum = parseFloat(circulatingSupply);
      lockedSupply = (totalSupplyNum - circulatingSupplyNum).toFixed(2);
    }

    // 5. Guardar en caché
    const network = tenantContext.activeToken.network;
    await prisma.tokenSupplyCache.upsert({
      where: {
        tokenAddress_network: {
          tokenAddress: tokenAddress.toLowerCase(),
          network
        }
      },
      create: {
        tokenId,
        tokenAddress: tokenAddress.toLowerCase(),
        network,
        totalSupply,
        circulatingSupply,
        lockedSupply,
        cachedAt: new Date(),
        expiresAt: new Date(Date.now() + CACHE_DURATION)
      },
      update: {
        tokenId, // Update tokenId if it was null before
        totalSupply,
        circulatingSupply,
        lockedSupply,
        cachedAt: new Date(),
        expiresAt: new Date(Date.now() + CACHE_DURATION)
      }
    });

    console.log('[token-supply] ✅ Fresh data cached successfully');

    return NextResponse.json({
      totalSupply,
      circulatingSupply,
      lockedSupply,
      lastUpdated: new Date().toISOString(),
      cached: false
    });
  } catch (error: unknown) {
    console.error('Error al obtener información del suministro de tokens:', error);

    let errorMessage = 'Error al obtener información del suministro de tokens';

    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;
      if (axiosError.response) {
        errorMessage += ` - Status: ${axiosError.response.status}`;
        console.error('Datos de respuesta:', axiosError.response.data);
      } else if (axiosError.request) {
        errorMessage += ' - No se recibió respuesta del servidor';
      } else {
        errorMessage += ` - ${axiosError.message}`;
      }
    } else if (error instanceof Error) {
      errorMessage += ` - ${error.message}`;
    }

    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
