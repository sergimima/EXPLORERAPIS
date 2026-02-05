'use server';

import { prisma } from '@/lib/db';
import {
    fetchTokenBalances as fetchTokenBalancesOriginal,
    checkVestingContractStatus as checkVestingContractStatusOriginal,
    fetchTokenTransfers as fetchTokenTransfersOriginal,
    fetchVestingInfo as fetchVestingInfoOriginal,
    getTokenSupplyInfo as getTokenSupplyInfoOriginal,
    type CustomApiKeys,
    type TokenSupplyInfo,
    type ProgressCallback,
    type TokenSupplyOptions
} from '@/lib/blockchain';
import type { Network } from '@/lib/types';

// Re-export types for components
export type { CustomApiKeys, TokenSupplyInfo };

/**
 * Obtiene API keys con jerarquía: TokenSettings → SystemSettings → .env
 * @param tokenId - ID único del token (opcional)
 */
async function getApiKeys(tokenId?: string) {
    let keys = {
        basescanApiKey: null as string | null,
        routescanApiKey: null as string | null,
        etherscanApiKey: null as string | null,
        moralisApiKey: null as string | null,
        quiknodeUrl: null as string | null
    };

    // 1. TokenSettings (prioridad máxima si hay tokenId)
    if (tokenId) {
        try {
            const tokenSettings = await prisma.tokenSettings.findUnique({
                where: { tokenId }
            });
            if (tokenSettings) {
                keys.basescanApiKey = tokenSettings.customBasescanApiKey;
                keys.routescanApiKey = tokenSettings.customRoutescanApiKey;
                keys.etherscanApiKey = tokenSettings.customEtherscanApiKey;
                keys.moralisApiKey = tokenSettings.customMoralisApiKey;
                keys.quiknodeUrl = tokenSettings.customQuiknodeUrl;
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
            keys.basescanApiKey = keys.basescanApiKey || systemSettings.defaultBasescanApiKey;
            keys.routescanApiKey = keys.routescanApiKey || systemSettings.defaultRoutescanApiKey;
            keys.etherscanApiKey = keys.etherscanApiKey || systemSettings.defaultEtherscanApiKey;
            keys.moralisApiKey = keys.moralisApiKey || systemSettings.defaultMoralisApiKey;
            keys.quiknodeUrl = keys.quiknodeUrl || systemSettings.defaultQuiknodeUrl;
            if (!tokenId) {
                console.log('[getApiKeys] Using SystemSettings (no tokenId provided)');
            }
        }
    } catch (error) {
        console.warn('[getApiKeys] Error fetching SystemSettings:', error);
    }

    // 3. .env fallback
    return {
        basescanApiKey: keys.basescanApiKey || process.env.NEXT_PUBLIC_BASESCAN_API_KEY || 'YourApiKeyToken',
        routescanApiKey: keys.routescanApiKey || process.env.NEXT_PUBLIC_ROUTESCAN_API_KEY || 'YourApiKeyToken',
        etherscanApiKey: keys.etherscanApiKey || process.env.NEXT_PUBLIC_ETHERSCAN_API_KEY || 'YourApiKeyToken',
        moralisApiKey: keys.moralisApiKey || process.env.NEXT_PUBLIC_MORALIS_API_KEY,
        quiknodeUrl: keys.quiknodeUrl || process.env.NEXT_PUBLIC_QUICKNODE_URL || 'https://mainnet.base.org'
    };
}

/**
 * Server Action: Obtiene los balances de tokens para una wallet
 * @param tokenId - ID único del token para usar sus API keys custom
 */
export async function fetchTokenBalances(walletAddress: string, network: Network, tokenId?: string) {
    try {
        console.log('[Server Action] fetchTokenBalances:', walletAddress, network, tokenId);
        const apiKeys = await getApiKeys(tokenId);
        const result = await fetchTokenBalancesOriginal(walletAddress, network, apiKeys);
        return result;
    } catch (error) {
        console.error('[Server Action] fetchTokenBalances error:', error);
        throw error;
    }
}

/**
 * Server Action: Verifica el estado de un contrato de vesting
 * Signature: (contractAddress, network, loadBeneficiaries?, tokenAddress?)
 */
export async function checkVestingContractStatus(
    contractAddress: string,
    network: Network,
    loadBeneficiaries?: boolean
) {
    try {
        console.log('[Server Action] checkVestingContractStatus:', contractAddress, network);
        // Esta función no acepta customApiKeys, usa variables de entorno internamente
        return await checkVestingContractStatusOriginal(contractAddress, network, loadBeneficiaries);
    } catch (error) {
        console.error('[Server Action] checkVestingContractStatus error:', error);
        throw error;
    }
}

/**
 * Server Action: Obtiene las transferencias de un token
 * @param tokenId - ID único del token para usar sus API keys custom
 */
export async function fetchTokenTransfers(
    walletAddress: string,
    network: Network = 'base',
    tokenFilter: string = '',
    tokenId?: string
) {
    try {
        console.log('[Server Action] fetchTokenTransfers:', walletAddress, network, tokenId);
        const apiKeys = await getApiKeys(tokenId);
        return await fetchTokenTransfersOriginal(walletAddress, network, tokenFilter, apiKeys);
    } catch (error) {
        console.error('[Server Action] fetchTokenTransfers error:', error);
        throw error;
    }
}

/**
 * Server Action: Obtiene información de vesting para una wallet
 * Signature: (walletAddress, vestingContractAddress, network)
 */
export async function fetchVestingInfo(
    walletAddress: string,
    vestingContractAddress: string,
    network: Network
) {
    try {
        console.log('[Server Action] fetchVestingInfo:', walletAddress, vestingContractAddress, network);
        // Esta función no acepta customApiKeys
        return await fetchVestingInfoOriginal(walletAddress, vestingContractAddress, network);
    } catch (error) {
        console.error('[Server Action] fetchVestingInfo error:', error);
        throw error;
    }
}

/**
 * Server Action: Obtiene información del supply de un token
 * @param tokenId - ID único del token para usar sus API keys custom
 */
export async function getTokenSupplyInfo(
    tokenAddress: string,
    network: Network,
    tokenId?: string,
    onProgress?: ProgressCallback
): Promise<TokenSupplyInfo> {
    try {
        console.log('[Server Action] getTokenSupplyInfo:', tokenAddress, network, tokenId);

        // Obtener API keys con jerarquía correcta: TokenSettings → SystemSettings → .env
        const apiKeys = await getApiKeys(tokenId);

        // getTokenSupplyInfo usa un formato diferente: (onProgress?, options?)
        const options: TokenSupplyOptions = {
            tokenAddress,
            network,
            vestingContracts: [], // Puede ser personalizado si es necesario
            customApiKeys: apiKeys // CRÍTICO: Pasar API keys con jerarquía correcta
        };
        return await getTokenSupplyInfoOriginal(onProgress, options);
    } catch (error) {
        console.error('[Server Action] getTokenSupplyInfo error:', error);
        throw error;
    }
}
