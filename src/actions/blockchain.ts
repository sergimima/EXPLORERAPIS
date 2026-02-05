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
 * Obtiene la API key de Routescan/Basescan desde .env o SystemSettings
 */
async function getApiKeys() {
    // 1. Intentar desde .env
    const basescanKey = process.env.NEXT_PUBLIC_BASESCAN_API_KEY;
    const routescanKey = process.env.NEXT_PUBLIC_ROUTESCAN_API_KEY;
    const etherscanKey = process.env.NEXT_PUBLIC_ETHERSCAN_API_KEY;
    const moralisKey = process.env.NEXT_PUBLIC_MORALIS_API_KEY;
    const quiknodeUrl = process.env.NEXT_PUBLIC_QUICKNODE_URL;

    // 2. Si no hay keys en .env, leer de SystemSettings (BD)
    if (!basescanKey && !routescanKey && !etherscanKey) {
        try {
            const systemSettings = await prisma.systemSettings.findUnique({
                where: { id: 'system' }
            });

            return {
                basescanApiKey: systemSettings?.defaultBasescanApiKey || basescanKey || 'YourApiKeyToken',
                routescanApiKey: systemSettings?.defaultRoutescanApiKey || routescanKey || 'YourApiKeyToken',
                etherscanApiKey: systemSettings?.defaultEtherscanApiKey || etherscanKey || 'YourApiKeyToken',
                moralisApiKey: systemSettings?.defaultMoralisApiKey || moralisKey,
                quiknodeUrl: systemSettings?.defaultQuiknodeUrl || quiknodeUrl || 'https://mainnet.base.org'
            };
        } catch (error) {
            console.warn('[getApiKeys] Error fetching SystemSettings:', error);
        }
    }

    // 3. Fallback a .env si SystemSettings no está disponible
    return {
        basescanApiKey: basescanKey || 'YourApiKeyToken',
        routescanApiKey: routescanKey || 'YourApiKeyToken',
        etherscanApiKey: etherscanKey || 'YourApiKeyToken',
        moralisApiKey: moralisKey,
        quiknodeUrl: quiknodeUrl || 'https://mainnet.base.org'
    };
}

/**
 * Server Action: Obtiene los balances de tokens para una wallet
 */
export async function fetchTokenBalances(walletAddress: string, network: Network) {
    try {
        console.log('[Server Action] fetchTokenBalances:', walletAddress, network);
        const apiKeys = await getApiKeys();
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
 * Signature: (walletAddress, network, tokenFilter, customApiKeys?)
 */
export async function fetchTokenTransfers(
    walletAddress: string,
    network: Network = 'base',
    tokenFilter: string = ''
) {
    try {
        console.log('[Server Action] fetchTokenTransfers:', walletAddress, network);
        const apiKeys = await getApiKeys();
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
 * Signature: (onProgress?, options?)
 */
export async function getTokenSupplyInfo(
    tokenAddress: string,
    network: Network,
    onProgress?: ProgressCallback
): Promise<TokenSupplyInfo> {
    try {
        console.log('[Server Action] getTokenSupplyInfo:', tokenAddress, network);
        // getTokenSupplyInfo usa un formato diferente: (onProgress?, options?)
        const options: TokenSupplyOptions = {
            tokenAddress,
            network,
            vestingContracts: [] // Puede ser personalizado si es necesario
        };
        return await getTokenSupplyInfoOriginal(onProgress, options);
    } catch (error) {
        console.error('[Server Action] getTokenSupplyInfo error:', error);
        throw error;
    }
}
