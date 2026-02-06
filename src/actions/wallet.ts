'use server';

import { prisma } from '@/lib/db';

const BASE_CONFIG = {
    chainId: 8453,
};

// Interfaz para transferencias de tokens (formato interno)
interface TokenTransfer {
    hash: string;
    from: string;
    to: string;
    value: string;
    timestamp: number;
    blockNumber: number;
    tokenAddress: string;
    tokenSymbol: string;
    tokenName: string;
    decimals: number;
}

/**
 * Obtiene API keys con jerarquía: TokenSettings → SystemSettings → .env
 * @param tokenId - ID único del token (opcional)
 */
async function getApiKeys(tokenId?: string) {
    let keys = {
        routescanApiKey: null as string | null,
        basescanApiKey: null as string | null,
        etherscanApiKey: null as string | null
    };

    // 1. TokenSettings (prioridad máxima si hay tokenId)
    if (tokenId) {
        try {
            const tokenSettings = await prisma.tokenSettings.findUnique({
                where: { tokenId }
            });
            if (tokenSettings) {
                keys.routescanApiKey = tokenSettings.customRoutescanApiKey;
                keys.basescanApiKey = tokenSettings.customBasescanApiKey;
                keys.etherscanApiKey = tokenSettings.customEtherscanApiKey;
                console.log('[getApiKeys] Using TokenSettings for token:', tokenId);
            }
        } catch (error) {
            console.warn('[getApiKeys] Error fetching TokenSettings:', error);
        }
    }

    // 2. SystemSettings (fallback para keys no configuradas)
    try {
        const systemSettings = await prisma.systemSettings.findUnique({
            where: { id: 'system' }
        });
        if (systemSettings) {
            keys.routescanApiKey = keys.routescanApiKey || systemSettings.defaultRoutescanApiKey;
            keys.basescanApiKey = keys.basescanApiKey || systemSettings.defaultBasescanApiKey;
            keys.etherscanApiKey = keys.etherscanApiKey || systemSettings.defaultEtherscanApiKey;
            if (!tokenId) {
                console.log('[getApiKeys] Using SystemSettings (no tokenId provided)');
            }
        }
    } catch (error) {
        console.warn('[getApiKeys] Error fetching SystemSettings:', error);
    }

    // 3. .env fallback
    return {
        routescanApiKey: keys.routescanApiKey || process.env.NEXT_PUBLIC_ROUTESCAN_API_KEY || 'YourApiKeyToken',
        basescanApiKey: keys.basescanApiKey || process.env.NEXT_PUBLIC_BASESCAN_API_KEY || 'YourApiKeyToken',
        etherscanApiKey: keys.etherscanApiKey || process.env.NEXT_PUBLIC_ETHERSCAN_API_KEY || 'YourApiKeyToken'
    };
}

/**
 * Obtiene nuevas transferencias desde la API de Etherscan/Basescan
 * @param tokenId - ID único del token para usar sus API keys custom
 */
async function fetchNewTransfersFromAPI(
    walletAddress: string,
    lastTimestamp: number = 0,
    tokenId?: string
): Promise<any[]> {
    const keys = await getApiKeys(tokenId);
    const apiKey = keys.routescanApiKey || keys.etherscanApiKey || keys.basescanApiKey;

    if (!apiKey || apiKey === 'YourApiKeyToken') {
        console.warn('No API key found (checked TokenSettings, SystemSettings, and .env)');
        return [];
    }

    try {
        console.log(`[fetchNewTransfersFromAPI] Wallet: ${walletAddress}, desde timestamp: ${lastTimestamp}`);

        // Usar Routescan API (compatible con Etherscan) para obtener transferencias de tokens ERC20
        const url = `https://api.routescan.io/v2/network/mainnet/evm/8453/etherscan/api?module=account&action=tokentx&address=${walletAddress}&startblock=0&endblock=99999999&sort=desc&apikey=${apiKey}`;

        const response = await fetch(url);
        const data = await response.json();

        if (data.status === '1' && Array.isArray(data.result)) {
            // Filtrar solo transfers más nuevos que lastTimestamp y que tengan info de token válida
            const newTransfers = data.result.filter((tx: any) =>
                parseInt(tx.timeStamp) > lastTimestamp &&
                tx.contractAddress &&
                tx.tokenSymbol &&
                tx.tokenName
            );

            console.log(`[fetchNewTransfersFromAPI] ✅ Got ${data.result.length} total, ${newTransfers.length} are new`);
            return newTransfers;
        }

        if (data.message !== 'No transactions found') {
            console.warn(`[fetchNewTransfersFromAPI] API returned status ${data.status}: ${data.message}`);
        }

        return [];
    } catch (error) {
        console.error('[fetchNewTransfersFromAPI] Exception:', error);
        return [];
    }
}

/**
 * Obtiene las transferencias de una wallet, usando caché de base de datos
 * @param tokenId - ID único del token para usar sus API keys custom (si no se pasa, intenta obtenerlo del contexto)
 */
export async function getWalletTransfers(walletAddress: string, tokenId?: string): Promise<TokenTransfer[]> {
    const network = 'base';
    const normalizedWallet = walletAddress.toLowerCase();

    // Si no se pasó tokenId, intentar obtenerlo desde el contexto del tenant
    if (!tokenId) {
        try {
            const { getTenantContext } = await import('@/lib/tenant-context');
            const tenantContext = await getTenantContext();
            tokenId = tenantContext?.activeToken?.id;
            if (tokenId) {
                console.log('[getWalletTransfers] Using tokenId from tenant context:', tokenId);
            }
        } catch (error) {
            console.warn('[getWalletTransfers] Could not get tokenId from context:', error);
        }
    }

    try {
        // 1. Leer transfers guardados en BD donde la wallet sea 'from' o 'to'
        // 1. Leer transfers guardados en BD usando queryRaw para asegurar que traemos tokenSymbol/tokenName
        // aunque el cliente de Prisma no esté regenerado.
        const cachedTransfers = await prisma.$queryRaw<any[]>`
            SELECT * FROM "transfer_cache"
            WHERE ("from" = ${normalizedWallet} OR "to" = ${normalizedWallet})
            AND "network" = ${network}
            ORDER BY "timestamp" DESC
        `;

        console.log(`[getWalletTransfers] Found ${cachedTransfers.length} cached transfers in DB for ${normalizedWallet}`);

        // 2. Encontrar timestamp del transfer más reciente
        const lastTimestamp = cachedTransfers.length > 0
            ? Number(cachedTransfers[0].timestamp)
            : 0;

        // 3. Fetch solo nuevos transfers desde API
        const newTransfersRaw = await fetchNewTransfersFromAPI(walletAddress, lastTimestamp, tokenId);

        // 4. Guardar nuevos en BD (si hay)
        if (newTransfersRaw.length > 0) {
            console.log(`[getWalletTransfers] Saving ${newTransfersRaw.length} new transfers to DB...`);

            await prisma.transferCache.createMany({
                data: newTransfersRaw.map((tx: any) => ({
                    hash: tx.hash,
                    tokenAddress: tx.contractAddress.toLowerCase(),
                    tokenSymbol: tx.tokenSymbol,
                    tokenName: tx.tokenName,
                    decimals: parseInt(tx.tokenDecimal) || 18,
                    from: tx.from.toLowerCase(),
                    to: tx.to.toLowerCase(),
                    value: tx.value,
                    timestamp: parseInt(tx.timeStamp),
                    blockNumber: parseInt(tx.blockNumber),
                    network
                })),
                skipDuplicates: true
            });

            console.log(`[getWalletTransfers] ✅ Saved successfully`);
        }

        // 5. Combinar cached + nuevos y retornar formato unificado

        const allTransfers: TokenTransfer[] = [
            ...newTransfersRaw.map((tx: any) => ({
                hash: tx.hash,
                from: tx.from,
                to: tx.to,
                value: tx.value,
                timestamp: parseInt(tx.timeStamp),
                blockNumber: parseInt(tx.blockNumber),
                tokenAddress: tx.contractAddress,
                tokenSymbol: tx.tokenSymbol,
                tokenName: tx.tokenName,
                decimals: parseInt(tx.tokenDecimal) || 18
            })),
            ...cachedTransfers.map((tx: any) => ({
                hash: tx.hash,
                from: tx.from,
                to: tx.to,
                value: tx.value,
                timestamp: Number(tx.timestamp),
                blockNumber: Number(tx.blockNumber),
                tokenAddress: tx.tokenAddress,
                // Usamos 'any' en tx para evitar error de TS si los tipos de Prisma no se han regenerado aún
                tokenSymbol: tx.tokenSymbol || 'UNKNOWN',
                tokenName: tx.tokenName || 'Unknown Token',
                decimals: tx.decimals || 18
            }))
        ];

        // Ordenar por timestamp descendente
        return allTransfers.sort((a, b) => Number(b.timestamp) - Number(a.timestamp));

    } catch (error) {
        console.error('[getWalletTransfers] ❌ Error:', error);
        // Fallback: intentar fetch directo sin guardar
        const raw = await fetchNewTransfersFromAPI(walletAddress, 0, tokenId);
        return raw.map((tx: any) => ({
            hash: tx.hash,
            from: tx.from,
            to: tx.to,
            value: tx.value,
            timestamp: parseInt(tx.timeStamp),
            blockNumber: parseInt(tx.blockNumber),
            tokenAddress: tx.contractAddress,
            tokenSymbol: tx.tokenSymbol,
            tokenName: tx.tokenName,
            decimals: parseInt(tx.tokenDecimal) || 18
        }));
    }
}

/**
 * Limpia el caché de transferencias para una wallet específica
 */
export async function clearWalletCache(walletAddress: string): Promise<void> {
    const normalizedWallet = walletAddress.toLowerCase();

    try {
        console.log(`[clearWalletCache] Clearing cache for ${normalizedWallet}`);

        const result = await prisma.transferCache.deleteMany({
            where: {
                OR: [
                    { from: normalizedWallet },
                    { to: normalizedWallet }
                ]
            }
        });

        console.log(`[clearWalletCache] ✅ Deleted ${result.count} records`);
    } catch (error) {
        console.error('[clearWalletCache] ❌ Error:', error);
        throw new Error('Error al limpiar el caché');
    }
}
