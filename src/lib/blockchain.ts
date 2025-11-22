// Importaciones
import axios from 'axios';
import { ethers } from 'ethers';
import { VESTING_CONTRACT_ABIS } from './contractAbis';
import { processBeneficiariesIndividually, calculateReleasableTokens } from './vestingHelpers';
import { processVestingWithGetVestingListByHolder } from './vestingContractHelpers';
import { applyVestingStrategy } from './vestingContractStrategies';

// ABI mínimo para interactuar con tokens ERC20
const ERC20_ABI = [
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function balanceOf(address) view returns (uint)",
  "function transfer(address to, uint amount) returns (bool)"
];

// Configuración de las redes
const NETWORKS: Record<string, {
  rpcUrl: string;
  alternativeRpcUrls?: string[]; // URLs alternativas para reintentos
  explorerApiUrl: string;
  explorerApiV2Url: string;
  chainId: number;
  name: string;
  etherscanChainId?: number; // ID de cadena para la API V2 de Etherscan
}> = {
  'base': {
    rpcUrl: 'https://mainnet.base.org',
    alternativeRpcUrls: [
      'https://base.llamarpc.com',
      'https://base.publicnode.com',
      'https://1rpc.io/base'
    ],
    explorerApiUrl: 'https://api.basescan.org/api',
    explorerApiV2Url: 'https://api.etherscan.io/v2/api',
    chainId: 8453,
    etherscanChainId: 8453, // ID de Base Mainnet en Etherscan
    name: 'Base Mainnet'
  },
  'base-testnet': {
    rpcUrl: 'https://goerli.base.org',
    explorerApiUrl: 'https://api-goerli.basescan.org/api',
    explorerApiV2Url: 'https://api.etherscan.io/v2/api',
    chainId: 84531,
    etherscanChainId: 84531, // ID de Base Goerli Testnet en Etherscan
    name: 'Base Testnet (Goerli)'
  },
  'base-sepolia': {
    rpcUrl: 'https://sepolia.base.org',
    explorerApiUrl: 'https://api-sepolia.basescan.org/api',
    explorerApiV2Url: 'https://api.etherscan.io/v2/api',
    chainId: 84532,
    etherscanChainId: 84532, // ID de Base Sepolia Testnet en Etherscan
    name: 'Base Testnet (Sepolia)'
  }
};

//=============================================================================
// #region FUNCIONES DE CACHÉ DE TRANSFERENCIAS (usando API route)
//=============================================================================

/**
 * Guarda transferencias en la base de datos usando la API
 */
async function saveTransfersToCache(
  transfers: any[],
  contractAddress: string,
  tokenAddress: string,
  network: string
) {
  try {
    const response = await fetch('/api/transfers-cache', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        transfers,
        contractAddress,
        tokenAddress,
        network
      })
    });

    if (!response.ok) {
      throw new Error('Error al guardar transferencias');
    }

    const data = await response.json();
    console.log(`✓ Guardadas ${data.saved} transferencias nuevas en caché`);
    return data.saved;
  } catch (error) {
    console.error('Error al guardar transferencias en caché:', error);
    return 0;
  }
}

/**
 * Obtiene la última transferencia guardada para un contrato
 */
async function getLastCachedTransferTimestamp(
  contractAddress: string,
  tokenAddress: string,
  network: string
): Promise<Date | null> {
  try {
    const params = new URLSearchParams({
      action: 'getLastTimestamp',
      contractAddress,
      tokenAddress,
      network
    });

    const response = await fetch(`/api/transfers-cache?${params}`);
    if (!response.ok) {
      throw new Error('Error al obtener último timestamp');
    }

    const data = await response.json();
    return data.timestamp ? new Date(data.timestamp * 1000) : null;
  } catch (error) {
    console.error('Error al obtener última transferencia de caché:', error);
    return null;
  }
}

/**
 * Obtiene todas las transferencias desde la base de datos para un contrato
 */
async function getCachedTransfers(
  contractAddress: string,
  tokenAddress: string,
  network: string
): Promise<any[]> {
  try {
    const params = new URLSearchParams({
      action: 'getTransfers',
      contractAddress,
      tokenAddress,
      network
    });

    const response = await fetch(`/api/transfers-cache?${params}`);
    if (!response.ok) {
      throw new Error('Error al obtener transferencias');
    }

    const data = await response.json();
    console.log(`✓ Obtenidas ${data.transfers.length} transferencias desde caché`);
    return data.transfers;
  } catch (error) {
    console.error('Error al obtener transferencias de caché:', error);
    return [];
  }
}

// #endregion

//=============================================================================
// #region FUNCIONES AUXILIARES DE API
//=============================================================================

// Función auxiliar para realizar llamadas a la API V2 de Etherscan
async function callEtherscanV2Api(params: Record<string, string | number>, network: string) {
  const networkConfig = NETWORKS[network as keyof typeof NETWORKS];
  if (!networkConfig) {
    throw new Error(`Red no soportada: ${network}`);
  }

  const apiKey = process.env.NEXT_PUBLIC_ETHERSCAN_API_KEY;
  if (!apiKey) {
    throw new Error('No se ha configurado la clave API de Etherscan');
  }

  const queryParams = new URLSearchParams({
    ...params,
    chainid: networkConfig.etherscanChainId?.toString() || '',
    apikey: apiKey
  });

  const url = `${networkConfig.explorerApiV2Url}?${queryParams.toString()}`;
  console.log('Llamando a la API V2:', url);

  try {
    const response = await fetch(url);
    const data = await response.json();

    if (data.status === '0' && data.message !== 'No transactions found') {
      throw new Error(data.result || 'Error en la respuesta de la API');
    }

    return data;
  } catch (error) {
    console.error('Error en la llamada a la API V2:', error);
    throw new Error(`Error al llamar a la API V2: ${error}`);
  }
}

//=============================================================================
// #region INTERFACES Y TIPOS
//=============================================================================

// Interfaz para transferencias de tokens
export interface TokenTransfer {
  tokenAddress: string;
  tokenSymbol: string;
  tokenName: string;
  from: string;
  to: string;
  amount: string;
  decimals: number;
  timestamp: number;
  transactionHash: string;
}

// Interfaz para el balance de tokens
export interface TokenBalance {
  tokenAddress: string;
  tokenSymbol: string;
  tokenName: string;
  balance: string;
  decimals: number;
  usdValue: number | null;
}

// Interfaz para la información de suministro
export interface TokenSupplyInfo {
  totalSupply: string;
  circulatingSupply: string;
  lockedSupply: string;
  lastUpdated: string;
}

// Interfaz para la información de vesting
export interface VestingInfo {
  contractAddress: string;
  tokenName: string;
  tokenSymbol: string;
  tokenDecimals: number;
  totalAmount: string;
  vestedAmount: string;
  claimableAmount: string;
  remainingAmount: string;
  releasedAmount: string;
  startTime: number;
  endTime: number;
  cliffTime: number;
  phase: string;
  isRevoked: boolean;
}

//=============================================================================
// #region PESTAÑA: TRANSFERENCIAS
// Funciones utilizadas en la pestaña de Transferencias de tokens
//=============================================================================

/**
 * Obtiene las transferencias de tokens para una dirección de wallet específica
 * @param walletAddress Dirección de la wallet a consultar
 * @param network Red blockchain a utilizar ('base' o 'base-testnet')
 * @param tokenFilter Filtro opcional para tokens específicos (dirección o símbolo)
 * @returns Array de transferencias de tokens
 */
export async function fetchTokenTransfers(
  walletAddress: string,
  network: string = 'base',
  tokenFilter: string = ''
): Promise<TokenTransfer[]> {
  try {
    // Obtener transferencias reales de la blockchain
    const transfers = await getTokenTransfersFromBlockchain(walletAddress, network);

    // Aplicar filtro si existe
    if (tokenFilter) {
      const filter = tokenFilter.toLowerCase();
      return transfers.filter(
        transfer =>
          transfer.tokenSymbol.toLowerCase().includes(filter) ||
          transfer.tokenName.toLowerCase().includes(filter) ||
          transfer.tokenAddress.toLowerCase().includes(filter)
      );
    }

    return transfers;
  } catch (error) {
    console.error('Error al obtener transferencias de tokens:', error);

    // En caso de error, devolvemos un array vacío
    return [] as TokenTransfer[];
  }
}

/**
 * Obtiene las transferencias de tokens desde la blockchain utilizando la API V2 de Etherscan
 */
async function getTokenTransfersFromBlockchain(
  walletAddress: string,
  network: string = 'base'
): Promise<TokenTransfer[]> {
  try {
    // Importamos dinámicamente la server action para evitar problemas de importación en cliente
    // Nota: En Next.js las server actions se pueden importar directamente, pero como blockchain.ts
    // es un archivo de utilidad que puede ser usado en cliente y servidor, es mejor ser precavidos.
    // Sin embargo, para simplificar y dado que es una función async, la llamaremos directamente
    // asumiendo que el bundler lo maneja.

    // Como blockchain.ts es 'use client' o compartido, necesitamos importar la acción.
    // Pero blockchain.ts NO tiene 'use client' al principio, así que es código compartido.
    // Las server actions solo pueden ser importadas en Client Components o Server Components/Actions.

    // Vamos a usar la server action que acabamos de crear
    const { getWalletTransfers } = await import('@/actions/wallet');

    const transfers = await getWalletTransfers(walletAddress);

    // Mapear al formato TokenTransfer de blockchain.ts
    return transfers.map(tx => ({
      tokenAddress: tx.tokenAddress,
      tokenSymbol: tx.tokenSymbol,
      tokenName: tx.tokenName,
      from: tx.from,
      to: tx.to,
      amount: tx.value,
      decimals: tx.decimals,
      timestamp: tx.timestamp,
      transactionHash: tx.hash
    }));

  } catch (error) {
    console.error('Error al obtener transferencias de tokens:', error);

    // En caso de error, devolvemos un array vacío
    return [] as TokenTransfer[];
  }
}

// #endregion

//=============================================================================
// #region PESTAÑA: BALANCE DE TOKENS
// Funciones utilizadas en la pestaña de Balance de Tokens
//=============================================================================

/**
 * Obtiene los balances de tokens para una dirección de wallet específica
 */
export async function fetchTokenBalances(
  walletAddress: string,
  network: string = 'base'
): Promise<TokenBalance[]> {
  try {
    // Validar la dirección de wallet
    if (!ethers.isAddress(walletAddress)) {
      throw new Error(`Dirección de wallet inválida: ${walletAddress}`);
    }

    const networkConfig = NETWORKS[network as keyof typeof NETWORKS];
    if (!networkConfig) {
      throw new Error(`Red no soportada: ${network}`);
    }

    // Obtener la clave API de las variables de entorno
    const apiKey = process.env.NEXT_PUBLIC_BASESCAN_API_KEY;
    if (!apiKey) {
      console.warn('No se ha configurado la clave API de Basescan. Usando clave API por defecto.');
    }

    // Implementar reintentos para manejar límites de tasa
    const maxRetries = 3;
    let retryCount = 0;
    let lastError = null;

    while (retryCount < maxRetries) {
      try {
        // Realizar la solicitud a la API de Basescan
        const response = await axios.get(networkConfig.explorerApiUrl, {
          params: {
            module: 'account',
            action: 'tokenlist',
            address: walletAddress,
            apikey: apiKey || 'YourApiKeyToken' // Usar clave API por defecto si no hay una configurada
          }
        });

        // Verificar si la respuesta es válida
        if (response.data.status === '1' && Array.isArray(response.data.result)) {
          // Transformar los datos de la API al formato de nuestra aplicación
          return response.data.result.map((token: any) => ({
            tokenAddress: token.contractAddress,
            tokenSymbol: token.symbol || 'UNKNOWN',
            tokenName: token.name || 'Unknown Token',
            balance: token.balance, // Devolvemos el valor crudo (Wei)
            decimals: parseInt(token.decimals) || 18,
            usdValue: null // La API de Basescan no proporciona valores en USD directamente
          }));
        } else if (response.data.status === 'NOTOK' && response.data.message?.includes('rate limit')) {
          // Si es un error de límite de tasa, esperamos y reintentamos
          console.warn(`Límite de tasa excedido en BaseScan (intento ${retryCount + 1}/${maxRetries}), esperando antes de reintentar...`);
          await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1))); // Espera exponencial
          retryCount++;
          lastError = new Error(response.data.message);
        } else {
          // Si la API devuelve un error, intentar obtener los tokens de las transferencias
          console.warn('La API de Basescan no devolvió resultados válidos para los balances:', response.data.message || 'Sin mensaje de error');
          break; // Salimos del bucle para intentar la alternativa
        }
      } catch (error) {
        // Error de red o de otro tipo
        lastError = error;
        retryCount++;
        if (retryCount < maxRetries) {
          console.warn(`Error al conectar con BaseScan (intento ${retryCount}/${maxRetries}), reintentando...`);
          await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
        } else {
          break; // Salimos del bucle para intentar la alternativa
        }
      }
    }

    // Si llegamos aquí, es porque agotamos los reintentos o hubo un error no relacionado con límites de tasa
    // Intentar obtener tokens de las transferencias como alternativa
    try {
      console.log('Intentando obtener tokens de las transferencias como alternativa (Direct API)...');

      // Usamos la API directamente para evitar depender del caché (que puede tener nombres UNKNOWN si no se ha regenerado Prisma)
      // Esto asegura que el Balance de Tokens siempre tenga nombres correctos si la API los devuelve.
      const params = {
        module: 'account',
        action: 'tokentx',
        address: walletAddress,
        startblock: 0,
        endblock: 99999999,
        sort: 'desc'
      };

      const data = await callEtherscanV2Api(params, network);
      const transfers = Array.isArray(data.result) ? data.result : [];

      // Crear un mapa para agrupar las transferencias por token
      const tokenMap = new Map<string, {
        tokenAddress: string;
        tokenSymbol: string;
        tokenName: string;
        incomingAmount: bigint;
        outgoingAmount: bigint;
        decimals: number;
      }>();

      // Procesar las transferencias para calcular balances aproximados
      transfers.forEach((transfer: any) => {
        const tokenKey = transfer.contractAddress;

        if (!tokenMap.has(tokenKey)) {
          tokenMap.set(tokenKey, {
            tokenAddress: transfer.contractAddress,
            tokenSymbol: transfer.tokenSymbol,
            tokenName: transfer.tokenName,
            incomingAmount: BigInt(0),
            outgoingAmount: BigInt(0),
            decimals: parseInt(transfer.tokenDecimal) || 18
          });
        }

        const token = tokenMap.get(tokenKey)!;
        // Las transferencias de la API de Etherscan vienen en Wei (raw), así que usamos BigInt directamente
        const amount = BigInt(transfer.value);

        // Sumar transferencias entrantes, restar salientes
        if (transfer.to.toLowerCase() === walletAddress.toLowerCase()) {
          token.incomingAmount += amount;
        } else if (transfer.from.toLowerCase() === walletAddress.toLowerCase()) {
          token.outgoingAmount += amount;
        }
      });

      // Convertir el mapa a un array de balances
      const balances = Array.from(tokenMap.values()).map(token => {
        const netBalance = token.incomingAmount - token.outgoingAmount;
        return {
          tokenAddress: token.tokenAddress,
          tokenSymbol: token.tokenSymbol,
          tokenName: token.tokenName,
          balance: netBalance > BigInt(0) ? netBalance.toString() : '0',
          decimals: token.decimals,
          usdValue: null
        };
      });

      // Filtrar tokens con balance positivo
      return balances.filter(token => BigInt(token.balance) > BigInt(0));
    } catch (transferError) {
      console.error('Error al obtener tokens de las transferencias:', transferError);
      return [] as TokenBalance[];
    }
  } catch (error) {
    console.error('Error al obtener balances de tokens:', error);
    return [] as TokenBalance[];
  }
}

// #endregion

//=============================================================================
// #region PESTAÑA: INFORMACIÓN DE VESTING
// Funciones utilizadas en la pestaña de Información de Vesting
//=============================================================================

/**
 * Obtiene información de vesting para una wallet y contrato específicos
 * @param walletAddress Dirección de la wallet
 * @param vestingContractAddress Dirección del contrato de vesting
 * @param network Red blockchain (base, base-testnet, base-sepolia)
 * @returns Información de vesting
 */
export async function fetchVestingInfo(walletAddress: string, vestingContractAddress: string, network: string) {
  try {
    // Validar la dirección de la wallet
    if (!ethers.isAddress(walletAddress)) {
      throw new Error(`Dirección de wallet inválida: ${walletAddress}`);
    }

    // Validar la dirección del contrato de vesting
    if (!ethers.isAddress(vestingContractAddress)) {
      throw new Error(`Dirección de contrato de vesting inválida: ${vestingContractAddress}`);
    }

    // Normalizar las direcciones antes de pasarlas a la función
    // Usamos ethers.getAddress para normalizar a formato checksum
    const normalizedWalletAddress = ethers.getAddress(walletAddress);
    const normalizedContractAddress = ethers.getAddress(vestingContractAddress);

    console.log(`Buscando vestings para wallet ${normalizedWalletAddress} en contrato ${normalizedContractAddress} (red: ${network})`);

    // Obtener información de vesting desde la blockchain
    const vestingInfo = await getVestingInfoFromBlockchain(normalizedWalletAddress, normalizedContractAddress, network);

    // Si no hay información de vesting, devolver un array vacío
    if (!vestingInfo || vestingInfo.length === 0) {
      return [] as VestingInfo[];
    }

    return vestingInfo;
  } catch (error) {
    if (error instanceof Error) {
      console.error(`Error al obtener información de vesting para wallet ${walletAddress} en contrato ${vestingContractAddress}:`, error.message);
    } else {
      console.error(`Error desconocido al obtener información de vesting para wallet ${walletAddress} en contrato ${vestingContractAddress}`);
    }
    // Devolver un array vacío en lugar de propagar el error
    return [] as VestingInfo[];
  }
}

/**
 * Obtiene información de vesting desde la blockchain
 * @param walletAddress Dirección de la wallet
 * @param vestingContractAddress Dirección del contrato de vesting
 * @param network Red blockchain
 * @returns Información de vesting
 */
export async function getVestingInfoFromBlockchain(walletAddress: string, vestingContractAddress: string, network: string): Promise<VestingInfo[]> {
  console.log(`Buscando vestings para wallet ${walletAddress} en contrato ${vestingContractAddress} (red: ${network})`);

  // Obtener configuración de la red
  const networkConfig = NETWORKS[network as keyof typeof NETWORKS];
  if (!networkConfig) {
    throw new Error(`Red no soportada: ${network}`);
  }

  try {
    // Crear proveedor con mecanismo de reintentos
    let provider;
    let providerError;

    // Primero intentamos con el proveedor principal
    try {
      provider = new ethers.JsonRpcProvider(networkConfig.rpcUrl);
      // Hacer una llamada simple para verificar que el proveedor funciona
      await provider.getBlockNumber();
      console.log(`Usando proveedor principal: ${networkConfig.rpcUrl}`);
    } catch (error: any) {
      providerError = error;
      console.log(`Error con proveedor principal: ${error.message || 'Error desconocido'}, intentando alternativas...`);

      // Si falla, intentamos con los proveedores alternativos
      if (networkConfig.alternativeRpcUrls && networkConfig.alternativeRpcUrls.length > 0) {
        for (const alternativeUrl of networkConfig.alternativeRpcUrls) {
          try {
            provider = new ethers.JsonRpcProvider(alternativeUrl);
            // Verificar que funciona
            await provider.getBlockNumber();
            console.log(`Usando proveedor alternativo: ${alternativeUrl}`);
            break; // Si funciona, salimos del bucle
          } catch (altError: any) {
            console.log(`Error con proveedor alternativo ${alternativeUrl}: ${altError.message || 'Error desconocido'}`);
          }
        }
      }
    }

    // Si después de todos los intentos no tenemos proveedor, lanzamos error
    if (!provider) {
      throw providerError || new Error('No se pudo conectar con ningún proveedor RPC');
    }

    // Obtener ABI del contrato
    let contractAbi;
    try {
      // Intentar usar ABI precargado
      const checksumAddress = ethers.getAddress(vestingContractAddress);
      if (VESTING_CONTRACT_ABIS[checksumAddress]) {
        console.log(`Usando ABI precargado para el contrato: ${vestingContractAddress}`);
        contractAbi = VESTING_CONTRACT_ABIS[checksumAddress];
        console.log(`✅ Usando ABI precargado para el contrato ${vestingContractAddress}`);
      } else {
        // Si no está precargado, obtenerlo de BaseScan
        console.log(`ABI no encontrado para el contrato ${vestingContractAddress}, obteniendo de BaseScan...`);
        contractAbi = await getContractABI(vestingContractAddress, network);

        if (!contractAbi) {
          throw new Error(`No se pudo obtener el ABI para el contrato ${vestingContractAddress}`);
        }

        console.log(`✅ ABI obtenido de BaseScan para el contrato ${vestingContractAddress}`);
      }
    } catch (error) {
      console.error(`❌ Error al obtener ABI para el contrato ${vestingContractAddress}:`, error);
      throw new Error(`No se pudo obtener el ABI para el contrato ${vestingContractAddress}`);
    }

    console.log("ABI del contrato:", contractAbi);

    // Crear instancia del contrato
    const vestingContract = new ethers.Contract(vestingContractAddress, contractAbi, provider);

    // Usar directamente la dirección del token Vottun
    const tokenAddress = "0xA9bc478A44a8c8FE6fd505C1964dEB3cEe3b7abC"; // Vottun Token (VTN)
    console.log(`Usando dirección de token fija: ${tokenAddress}`);

    // Usar directamente la información conocida del token Vottun
    const tokenName = "Vottun Token";
    const tokenSymbol = "VTN";
    const tokenDecimals = 18;

    console.log(`Información del token obtenida: ${tokenName} ${tokenSymbol} ${tokenDecimals}`);

    // Usar la estrategia adecuada para obtener los vestings
    let vestingSchedules = [];
    try {
      console.log("Aplicando estrategia para obtener vestings");
      vestingSchedules = await applyVestingStrategy(vestingContract, walletAddress, vestingContractAddress);
      console.log(`Vestings obtenidos: ${vestingSchedules.length}`);
    } catch (error) {
      console.error("Error al obtener vestings con la estrategia:", error);
    }

    // Si no se encontraron vesting schedules, devolver array vacío
    if (!vestingSchedules || vestingSchedules.length === 0) {
      console.log("No se encontraron vesting schedules");
      return [];
    }

    // Procesar los vesting schedules
    const result: VestingInfo[] = [];

    for (const schedule of vestingSchedules) {
      // Extraer información del schedule
      const beneficiary = schedule.beneficiary;

      // Verificar si el beneficiario coincide con la wallet consultada
      if (beneficiary.toLowerCase() !== walletAddress.toLowerCase()) {
        continue; // Saltar este schedule si no coincide
      }

      // Extraer más información del schedule
      const amountTotal = ethers.formatUnits(schedule.amountTotal || "0", tokenDecimals);
      const released = ethers.formatUnits(schedule.released || "0", tokenDecimals);
      const start = schedule.start ? new Date(Number(schedule.start) * 1000) : new Date();
      const cliff = schedule.cliff ? new Date(Number(schedule.cliff) * 1000) : start;
      const duration = schedule.duration ? Number(schedule.duration) : 0;
      const end = new Date(start.getTime() + duration * 1000);
      const phase = schedule.phase || "Desconocida";
      const isRevoked = schedule.revoked || false;

      // Calcular tokens liberables (claimable)
      const now = new Date();
      let claimable = "0";

      if (now > cliff) {
        const totalTime = end.getTime() - start.getTime();
        const elapsedTime = Math.min(now.getTime() - start.getTime(), totalTime);
        const vestedRatio = totalTime > 0 ? elapsedTime / totalTime : 0;

        const vestedAmount = parseFloat(amountTotal) * vestedRatio;
        const claimableAmount = Math.max(vestedAmount - parseFloat(released), 0);
        claimable = claimableAmount.toFixed(6);
      }

      // Calcular tokens restantes (remaining)
      const remaining = (parseFloat(amountTotal) - parseFloat(released) - parseFloat(claimable)).toFixed(6);

      // Añadir al resultado
      result.push({
        contractAddress: vestingContractAddress,
        tokenName,
        tokenSymbol,
        tokenDecimals,
        totalAmount: amountTotal,
        vestedAmount: (parseFloat(released) + parseFloat(claimable)).toFixed(6),
        claimableAmount: claimable,
        remainingAmount: remaining,
        releasedAmount: released,
        startTime: start.getTime(),
        endTime: end.getTime(),
        cliffTime: cliff.getTime(),
        phase,
        isRevoked
      });
    }

    return result;
  } catch (error) {
    console.error(`Error al obtener información de vesting para ${walletAddress} en contrato ${vestingContractAddress}:`, error);
    throw error;
  }
}

// #endregion

//=============================================================================
// #region VESTINGS
// Funciones utilizadas para interactuar con contratos de vesting
//=============================================================================

/**
 * Verifica si todos los tokens han sido vested en un contrato de vesting específico
 * @param vestingContractAddress Dirección del contrato de vesting
 * @param network Red blockchain (base, base-testnet, base-sepolia)
 * @returns Objeto con información sobre el estado de vesting del contrato
 */
export async function checkVestingContractStatus(
  vestingContractAddress: string,
  network: string
): Promise<{
  isValid: boolean;
  contractAddress: string;
  tokenAddress?: string;
  tokenName?: string;
  tokenSymbol?: string;
  tokenDecimals?: number;
  totalVested: string;
  totalReleased: string;
  remainingToVest: string;
  allTokensVested: boolean;
  vestingSchedulesCount?: number;
  totalSchedulesCreated?: number;
  lastTokenBalance?: string;
  contractType?: string;
  totalTokensIn?: string;
  totalTokensOut?: string;
  lockedTokens?: string;
  releasableTokens?: string;
  claimedTokens?: string;
  creationDate?: string;
  error?: string;
  totalBeneficiaries?: number;
  validBeneficiaries?: number;
  errorBeneficiaries?: number;
  beneficiaries?: {
    address: string;
    amount: string;
    claimed: string;
    remaining: string;
    startTime: number;
    endTime: number;
  }[];
}> {
  try {
    // Validar la dirección del contrato de vesting
    if (!ethers.isAddress(vestingContractAddress)) {
      throw new Error(`Dirección de contrato de vesting inválida: ${vestingContractAddress}`);
    }

    // Normalizar la dirección antes de usarla
    const normalizedContractAddress = ethers.getAddress(vestingContractAddress.toLowerCase());

    // Obtener configuración de la red
    const networkConfig = NETWORKS[network as keyof typeof NETWORKS];
    if (!networkConfig) {
      throw new Error(`Red no soportada: ${network}`);
    }

    // Crear proveedor de Ethereum con opciones mejoradas
    const provider = new ethers.JsonRpcProvider(
      networkConfig.rpcUrl,
      undefined,
      { polling: true, pollingInterval: 15000 }
    );

    // Usar ABI precargado si existe, o intentar obtenerlo desde BaseScan
    let contractABI;

    // Primero intentamos usar el ABI precargado
    if (VESTING_CONTRACT_ABIS[normalizedContractAddress]) {
      console.log('Usando ABI precargado para el contrato:', normalizedContractAddress);
      contractABI = VESTING_CONTRACT_ABIS[normalizedContractAddress];
    } else {
      // Si no tenemos el ABI precargado, intentamos obtenerlo desde BaseScan
      console.log('Intentando obtener ABI desde BaseScan...');
      contractABI = await getContractABI(normalizedContractAddress, network);
      // Si obtuvimos el ABI, lo guardamos para futuras consultas
      if (contractABI) {
        console.log('Guardando ABI obtenido para futuras consultas');
        // @ts-ignore - Ignoramos el error de TypeScript porque sabemos que estamos modificando un objeto importado
        VESTING_CONTRACT_ABIS[normalizedContractAddress] = contractABI;
      }
    }

    // Inicializar el objeto de respuesta
    const result = {
      contractAddress: normalizedContractAddress,
      isValid: false,
      tokenAddress: '',
      tokenName: '',
      tokenSymbol: '',
      tokenDecimals: 18,
      totalVested: '0',
      totalReleased: '0',
      remainingToVest: '0',
      allTokensVested: false,
      vestingSchedulesCount: 0,
      totalSchedulesCreated: 0,
      lastTokenBalance: '0',
      contractType: 'Desconocido',
      totalTokensIn: '0',
      totalTokensOut: '0',
      lockedTokens: '0',
      releasableTokens: '0',
      claimedTokens: '0',
      creationDate: '',
      totalBeneficiaries: 0,
      validBeneficiaries: 0,
      errorBeneficiaries: 0,
      error: '',
      beneficiaries: [] as any[]
    };

    // Si tenemos el ABI, lo usamos
    if (contractABI) {
      try {
        console.log('Usando ABI obtenido');
        const contract = new ethers.Contract(normalizedContractAddress, contractABI, provider);
        result.isValid = true;

        // Intentar obtener información básica del contrato
        try {
          // Verificar qué métodos están disponibles en el ABI
          const abiMethods = contractABI.filter((item: any) => item.type === 'function').map((item: any) => item.name || (item.name && item.name.name) || item);
          console.log("Métodos disponibles en el ABI:", abiMethods);

          // Determinar el tipo de contrato de vesting basado en los métodos disponibles
          const hasMethod = (methodName: string) => {
            return abiMethods.some((fn: any) => {
              if (typeof fn === 'string') return fn === methodName;
              if (typeof fn === 'object' && fn.name) return fn.name === methodName;
              return false;
            });
          };

          if (hasMethod('getVestingSchedulesCount') && hasMethod('getVestingScheduleById')) {
            result.contractType = 'VestingSchedules';
          } else if (hasMethod('getVestingListByHolder')) {
            result.contractType = 'Vottun';
          } else if (hasMethod('vestingSchedules')) {
            result.contractType = 'OpenZeppelin';
          } else {
            // Intentar determinar el tipo basado en métodos disponibles
            if (hasMethod('releasable') || hasMethod('released') || hasMethod('vestedAmount')) {
              result.contractType = 'GenericVesting';
            } else if (hasMethod('getVestingSchedule') || hasMethod('getVestingSchedules')) {
              result.contractType = 'CustomVesting';
            } else {
              result.contractType = 'UnknownVesting';
            }
          }

          console.log("Tipo de contrato detectado:", result.contractType);

          // Función segura para llamar a métodos del contrato
          const safeCall = async (methodName: string, args: any[] = [], targetContract = contract) => {
            try {
              if (targetContract && typeof targetContract[methodName] === 'function') {
                console.log(`Intentando llamar a ${methodName} con argumentos:`, args);
                const result = await targetContract[methodName](...args);
                console.log(`Llamada exitosa a ${methodName}. Resultado:`, result);
                return result;
              }
              console.warn(`El método ${methodName} no existe en el contrato`);
              return null;
            } catch (error: any) {
              console.error(`Error al llamar a ${methodName}:`, error);
              // Información adicional sobre el error para ayudar en la depuración
              if (error.code) {
                console.error(`Código de error: ${error.code}`);
              }
              if (error.reason) {
                console.error(`Razón del error: ${error.reason}`);
              }
              if (error.data) {
                console.error(`Datos del error: ${error.data}`);
              }
              if (error.transaction) {
                console.error(`Transacción: ${JSON.stringify(error.transaction)}`);
              }
              return null;
            }
          };

          // Usar directamente la información conocida del token VTN (hardcoded)
          const vottunTokenAddress = "0xA9bc478A44a8c8FE6fd505C1964dEB3cEe3b7abC";
          result.tokenAddress = vottunTokenAddress;
          result.tokenSymbol = 'VTN';
          result.tokenName = 'Vottun Token';
          result.tokenDecimals = 18;
          console.log(`Usando información hardcoded del token: ${result.tokenName} (${result.tokenSymbol})`);

          // Obtener el balance actual del contrato de vesting
          try {
            console.log(`Intentando obtener el balance del token para el contrato: ${normalizedContractAddress}`);

            const tokenContract = new ethers.Contract(vottunTokenAddress, ERC20_ABI, provider);

            // Intentar obtener el balance usando ethers.js con manejo de errores mejorado
            try {
              // Verificar si el método balanceOf existe en el contrato del token
              if (typeof tokenContract.balanceOf === 'function') {
                console.log(`Método balanceOf encontrado en el contrato del token. Intentando obtener balance...`);

                // Llamar al método balanceOf con un timeout para evitar bloqueos
                const balancePromise = tokenContract.balanceOf(normalizedContractAddress);

                // Establecer un timeout de 5 segundos para la llamada
                const timeoutPromise = new Promise((_, reject) => {
                  setTimeout(() => reject(new Error('Timeout al obtener balance')), 5000);
                });

                // Usar Promise.race para manejar el timeout
                const balance = await Promise.race([balancePromise, timeoutPromise]);

                if (balance !== null && balance !== undefined) {
                  result.lastTokenBalance = ethers.formatUnits(balance, result.tokenDecimals);
                  console.log(`Balance obtenido correctamente: ${result.lastTokenBalance} ${result.tokenSymbol}`);
                } else {
                  throw new Error('Balance nulo o indefinido');
                }
              } else {
                throw new Error('Método balanceOf no encontrado en el contrato del token');
              }
            } catch (balanceError: any) {
              console.warn(`Error al obtener balance con ethers.js: ${balanceError.message || 'Error desconocido'}`);
              console.log(`Usando '0' como valor predeterminado para el balance.`);
              result.lastTokenBalance = "0";
            }

            console.log(`Balance actual del contrato: ${result.lastTokenBalance} ${result.tokenSymbol}`);
          } catch (e) {
            console.warn('Error al obtener balance del token:', e);
          }

          // Obtener total vested usando diferentes métodos del contrato
          const totalVestedMethods = [
            'totalVestedAmount',
            'vestingSchedulesTotalAmount',
            'totalVested',
            'totalAmount'
          ];

          for (const method of totalVestedMethods) {
            try {
              const total = await safeCall(method);
              if (total && BigInt(total) > 0) {
                result.totalVested = ethers.formatUnits(total, result.tokenDecimals);
                console.log(`Total vested obtenido con ${method}: ${result.totalVested}`);
                break;
              }
            } catch (e) {
              console.warn(`Error al obtener total vested con ${method}:`, e);
            }
          }

          // Obtener total liberado usando diferentes métodos del contrato
          const totalReleasedMethods = [
            'totalReleasedAmount',
            'getWithdrawnAmount',
            'totalReleased',
            'released'
          ];

          for (const method of totalReleasedMethods) {
            try {
              const released = await safeCall(method);
              if (released && BigInt(released) > 0) {
                result.totalReleased = ethers.formatUnits(released, result.tokenDecimals);
                console.log(`Total liberado obtenido con ${method}: ${result.totalReleased}`);
                break;
              }
            } catch (e) {
              console.warn(`Error al obtener total liberado con ${method}:`, e);
            }
          }

          // Calcular tokens restantes si tenemos los valores del contrato
          if (result.totalVested && result.totalReleased) {
            const vested = ethers.parseUnits(result.totalVested, result.tokenDecimals);
            const released = ethers.parseUnits(result.totalReleased, result.tokenDecimals);
            const remaining = vested - released;
            result.remainingToVest = ethers.formatUnits(remaining, result.tokenDecimals);
            console.log(`Tokens restantes: ${result.remainingToVest}`);

            // Verificar si todos los tokens han sido vested
            result.allTokensVested = BigInt(remaining.toString()) === BigInt(0);
          }

          // IMPORTANTE: Obtener historial de transferencias para calcular totalTokensIn y totalTokensOut
          // Usar caché de BD y sincronizar solo nuevas transferencias desde Moralis
          let allTransfers: any[] = []; // Declarar fuera del try para acceso global
          try {
            console.log("=== INICIO: Obteniendo historial de transferencias ===");
            console.log("Contrato a consultar:", normalizedContractAddress.toLowerCase());
            console.log("Token VTN:", vottunTokenAddress.toLowerCase());

            // 1. Obtener transferencias desde caché
            allTransfers = await getCachedTransfers(
              normalizedContractAddress,
              vottunTokenAddress,
              network
            );

            // 2. Verificar si hay que sincronizar nuevas transferencias
            const lastTimestamp = await getLastCachedTransferTimestamp(
              normalizedContractAddress,
              vottunTokenAddress,
              network
            );

            console.log(`Última transferencia en caché: ${lastTimestamp ? lastTimestamp.toISOString() : 'ninguna'}`);

            // 3. Obtener nuevas transferencias desde Moralis
            const moralisApiKey = process.env.NEXT_PUBLIC_MORALIS_API_KEY;
            if (!moralisApiKey) {
              console.warn('No se ha configurado la clave API de Moralis, usando solo caché');
            } else {
              console.log("Sincronizando nuevas transferencias desde Moralis...");

              let newTransfers: any[] = [];
              let cursor: string | null = null;
              let pageCount = 0;
              const maxPages = 50; // Permitir más páginas para sincronización completa

              do {
                pageCount++;

                const params: any = {
                  chain: 'base',
                  limit: 100
                };

                if (cursor) {
                  params.cursor = cursor;
                }

                const response = await axios.get(
                  `https://deep-index.moralis.io/api/v2.2/${normalizedContractAddress.toLowerCase()}/erc20/transfers`,
                  {
                    headers: {
                      'X-API-Key': moralisApiKey
                    },
                    params
                  }
                );

                if (Array.isArray(response.data.result)) {
                  // Si hay timestamp de última caché, filtrar solo las más recientes
                  let pageTransfers = response.data.result;

                  if (lastTimestamp) {
                    pageTransfers = pageTransfers.filter((tx: any) =>
                      new Date(tx.block_timestamp) > lastTimestamp
                    );

                    // Si ya no hay transferencias nuevas, parar
                    if (pageTransfers.length === 0) {
                      break;
                    }
                  }

                  newTransfers = newTransfers.concat(pageTransfers);
                }

                cursor = response.data.cursor || null;

                // Pequeña pausa entre llamadas
                if (cursor) {
                  await new Promise(resolve => setTimeout(resolve, 100));
                }

              } while (cursor && pageCount < maxPages);

              // 4. Guardar nuevas transferencias en caché
              if (newTransfers.length > 0) {
                await saveTransfersToCache(
                  newTransfers,
                  normalizedContractAddress,
                  vottunTokenAddress,
                  network
                );

                // Agregar a allTransfers
                allTransfers = newTransfers.concat(allTransfers);
              } else {
                console.log("✓ No hay transferencias nuevas para sincronizar");
              }
            }


            // Procesar resultados de Moralis
            if (allTransfers.length > 0) {

              // Obtener fecha de creación (primera transacción - la más antigua)
              const firstTx = allTransfers[allTransfers.length - 1]; // Moralis devuelve más recientes primero
              if (firstTx && firstTx.block_timestamp) {
                result.creationDate = new Date(firstTx.block_timestamp).toISOString();
              }

              // Analizar todas las transferencias para calcular totales
              let incomingAmount = 0;
              let outgoingAmount = 0;
              let vtnTransactionsCount = 0;

              // Procesar todas las transferencias - Moralis ya filtra por dirección
              allTransfers.forEach((tx: any) => {
                // Moralis devuelve address (token), from_address, to_address, value
                // Filtrar solo transferencias del token VTN
                if (tx.address?.toLowerCase() === vottunTokenAddress.toLowerCase()) {
                  vtnTransactionsCount++;
                  const amount = parseFloat(ethers.formatUnits(tx.value, result.tokenDecimals));

                  // Tokens entrantes al contrato
                  if (tx.to_address?.toLowerCase() === normalizedContractAddress.toLowerCase()) {
                    incomingAmount += amount;
                  }
                  // Tokens salientes del contrato (claims o transferencias)
                  else if (tx.from_address?.toLowerCase() === normalizedContractAddress.toLowerCase()) {
                    outgoingAmount += amount;
                  }
                }
              });


              // Actualizar totales
              result.totalTokensIn = incomingAmount.toString();
              result.totalTokensOut = outgoingAmount.toString();
              result.claimedTokens = outgoingAmount.toString();



              // Calcular locked tokens como la diferencia entre IN y OUT
              const lockedAmount = incomingAmount - outgoingAmount;
              result.lockedTokens = lockedAmount.toString();

              // Si no obtuvimos totalVested del contrato, usar totalTokensIn como estimación
              if (!result.totalVested || result.totalVested === '0') {
                result.totalVested = result.totalTokensIn;
              }

              // Si no obtuvimos totalReleased del contrato, usar totalTokensOut como estimación
              if (!result.totalReleased || result.totalReleased === '0') {
                result.totalReleased = result.totalTokensOut;
              }
            } else {
              console.warn("No se encontraron transferencias");
            }
            console.log("=== FIN: Historial de transferencias ===");
          } catch (e: any) {
            console.error("❌ Error al obtener transferencias de tokens:", e);
            if (e.response?.data) {
              console.error("Detalle del error Moralis:", e.response.data);
            }
          }

          // Intentar obtener el número de schedules de vesting usando diferentes métodos
          if (contractABI.some((fn: any) => typeof fn === 'object' && fn.name === 'getVestingSchedulesCount')) {
            try {
              const count = await contract.getVestingSchedulesCount();
              result.vestingSchedulesCount = Number(count.toString());
              console.log("Número de schedules de vesting:", result.vestingSchedulesCount);
            } catch (e) {
              console.warn("Error al obtener número de schedules:", e);
            }
          } else if (contractABI.some((fn: any) => typeof fn === 'object' && fn.name === 'getVestingCount')) {
            try {
              const count = await contract.getVestingCount();
              result.vestingSchedulesCount = Number(count.toString());
              console.log("Número de vestings:", result.vestingSchedulesCount);
            } catch (e) {
              console.warn("Error al obtener número de vestings:", e);
            }
          }

          // Obtener los beneficiarios y sus schedules
          try {
            const beneficiaries = await getBeneficiariesFromTransferHistory(normalizedContractAddress, network);
            console.log("Beneficiarios encontrados:", beneficiaries);

            // Establecer el número total de beneficiarios inmediatamente
            result.totalBeneficiaries = beneficiaries.length;
            result.validBeneficiaries = 0; // Inicialmente 0, se actualizará durante el procesamiento
            result.errorBeneficiaries = 0; // Inicialmente 0, se actualizará durante el procesamiento

            // Guardar información básica de los beneficiarios
            if (!result.beneficiaries) {
              result.beneficiaries = [];
            }

            // Verificar si el contrato tiene funciones para obtener schedules por índice
            const hasGetVestingScheduleAtIndex = contractABI.some((fn: any) =>
              typeof fn === 'object' && (fn.name === 'getVestingScheduleAtIndex' || fn.name === 'getVestingScheduleIdAtIndex'));

            // Verificar si el contrato tiene el método getVestingListByHolder
            const hasGetVestingListByHolder = contractABI.some((fn: any) =>
              typeof fn === 'object' && fn.name === 'getVestingListByHolder');

            // Actualizar el resultado con la información de los beneficiarios
            // Si tenemos beneficiarios pero no tenemos valores para totalVested, totalReleased, etc.
            // vamos a intentar estimarlos a partir de las transacciones
            if (beneficiaries.length > 0) {
              // Si no tenemos valores para totalVested, totalReleased, etc.
              if (!result.totalVested || result.totalVested === '0') {
                // Estimar el total vested como la suma de todas las transacciones entrantes
                if (result.totalTokensIn && parseFloat(result.totalTokensIn) > 0) {
                  result.totalVested = result.totalTokensIn;
                  console.log("Total vested estimado desde transacciones:", result.totalVested);
                }
              }

              // Si no tenemos valores para totalReleased
              if (!result.totalReleased || result.totalReleased === '0') {
                // Estimar el total released como la suma de todas las transacciones salientes
                if (result.totalTokensOut && parseFloat(result.totalTokensOut) > 0) {
                  result.totalReleased = result.totalTokensOut;
                  console.log("Total released estimado desde transacciones:", result.totalReleased);
                }
              }

              // Actualizar el número de beneficiarios válidos
              result.validBeneficiaries = beneficiaries.length;

              // Verificar si todos los tokens han sido vested
              if (result.totalVested && result.totalReleased) {
                const vested = parseFloat(result.totalVested);
                const released = parseFloat(result.totalReleased);

                // Si el total released es igual o mayor que el total vested, todos los tokens han sido vested
                if (released >= vested * 0.99) { // Consideramos un margen del 1% para errores de redondeo
                  result.allTokensVested = true;
                  console.log("Todos los tokens han sido vested (basado en transacciones)");
                }
              }
            }

            // Continuar con el procesamiento

            // Intentar obtener información de vesting directamente desde el historial de transferencias cacheadas
            // Esto es útil para contratos que no exponen métodos para obtener información de vesting
            // Usar las transferencias ya cacheadas (allTransfers) en lugar de llamar a BaseScan
            console.log(`Procesando ${allTransfers.length} transferencias cacheadas para obtener info de beneficiarios`);

            // Agrupar transacciones por beneficiario
            const transactionsByBeneficiary: Record<string, any[]> = {};

            allTransfers.forEach((tx: any) => {
              if (tx.from_address.toLowerCase() === normalizedContractAddress.toLowerCase()) {
                const beneficiary = tx.to_address.toLowerCase();
                if (!transactionsByBeneficiary[beneficiary]) {
                  transactionsByBeneficiary[beneficiary] = [];
                }
                transactionsByBeneficiary[beneficiary].push({
                  timestamp: new Date(tx.block_timestamp).getTime(),
                  amount: ethers.formatUnits(tx.value, result.tokenDecimals),
                  hash: tx.transaction_hash
                });
              }
            });

            // Procesar cada beneficiario
            for (const beneficiary of beneficiaries) {
              const transactions = transactionsByBeneficiary[beneficiary] || [];

              // Si hay transacciones para este beneficiario
              if (transactions.length > 0) {
                // Ordenar transacciones por timestamp
                transactions.sort((a, b) => a.timestamp - b.timestamp);

                // Calcular el total reclamado
                const totalClaimed = transactions.reduce((sum, tx) => sum + parseFloat(tx.amount), 0);

                // Estimar fechas de inicio y fin basadas en la primera y última transacción
                const firstTx = transactions[0];
                const lastTx = transactions[transactions.length - 1];
                const daysDiff = (lastTx.timestamp - firstTx.timestamp) / (1000 * 60 * 60 * 24);

                // Crear información del schedule
                const scheduleInfo: any = {
                  address: beneficiary,
                  claimed: totalClaimed.toString(),
                  amount: '0',
                  remaining: '0',
                  releasable: '0',
                  start: Math.floor(firstTx.timestamp / 1000),
                  end: daysDiff > 30 ? Math.floor(lastTx.timestamp / 1000) : Math.floor(firstTx.timestamp / 1000) + 31536000,
                  transactions: transactions.length,
                  isEstimated: true
                };

                // Estimar el monto total basado en el patrón de transacciones
                if (transactions.length >= 3) {
                  const intervals = [];
                  for (let i = 1; i < transactions.length; i++) {
                    intervals.push(transactions[i].timestamp - transactions[i - 1].timestamp);
                  }

                  const avgInterval = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
                  const variation = Math.max(...intervals) / Math.min(...intervals);

                  if (variation < 1.2) {
                    const vestingDuration = scheduleInfo.end - scheduleInfo.start;
                    const intervalSeconds = avgInterval / 1000;
                    const estimatedTotalPayments = vestingDuration / intervalSeconds;
                    const estimatedTotal = totalClaimed * (estimatedTotalPayments / transactions.length);

                    scheduleInfo.amount = estimatedTotal.toString();
                    scheduleInfo.remaining = (estimatedTotal - totalClaimed).toString();

                    const currentTime = Math.floor(Date.now() / 1000);
                    if (currentTime > scheduleInfo.start) {
                      const totalDuration = scheduleInfo.end - scheduleInfo.start;
                      const elapsed = Math.min(currentTime - scheduleInfo.start, totalDuration);
                      const percentComplete = elapsed / totalDuration;
                      const shouldBeReleased = estimatedTotal * percentComplete;
                      const releasable = Math.max(0, shouldBeReleased - totalClaimed);
                      scheduleInfo.releasable = releasable.toString();
                    }
                  } else {
                    const estimatedTotal = totalClaimed * 2;
                    scheduleInfo.amount = estimatedTotal.toString();
                    scheduleInfo.remaining = (estimatedTotal - totalClaimed).toString();
                  }
                } else {
                  const estimatedTotal = totalClaimed * 2;
                  scheduleInfo.amount = estimatedTotal.toString();
                  scheduleInfo.remaining = (estimatedTotal - totalClaimed).toString();
                }

                // Añadir a la lista de beneficiarios
                result.beneficiaries.push(scheduleInfo);
                console.log(`Información estimada para ${beneficiary}: ${scheduleInfo.amount} tokens, reclamado: ${scheduleInfo.claimed}, liberables: ${scheduleInfo.releasable}`);
              } else {
                // Si no hay transacciones, añadimos solo la dirección
                result.beneficiaries.push({ address: beneficiary });
              }
            }

            // Actualizar el número total de schedules creados
            result.totalSchedulesCreated = result.beneficiaries.length;
            console.log("Total de schedules estimados:", result.totalSchedulesCreated);

            // Calcular tokens liberables totales
            let totalReleasableFromTx = 0;
            for (const beneficiary of result.beneficiaries) {
              if (beneficiary.releasable) {
                totalReleasableFromTx += parseFloat(beneficiary.releasable);
              }
            }

            if (totalReleasableFromTx > 0) {
              result.releasableTokens = totalReleasableFromTx.toString();
              console.log("Total de tokens liberables estimados:", result.releasableTokens);
            }

            // Si ya procesamos los beneficiarios por transacciones, retornar
            if (result.beneficiaries.length > 0) {
              return result;
            }

            // Si el contrato soporta obtener schedules por índice, intentamos ese enfoque
            if (hasGetVestingScheduleAtIndex && result.vestingSchedulesCount > 0) {
              console.log("Obteniendo schedules por índice...");

              for (let i = 0; i < result.vestingSchedulesCount; i++) {
                try {
                  let scheduleId;
                  let schedule;

                  // Obtener el ID del schedule primero si es necesario
                  if (contractABI.some((fn: any) => typeof fn === 'object' && fn.name === 'getVestingScheduleIdAtIndex')) {
                    scheduleId = await contract.getVestingScheduleIdAtIndex(i);
                    schedule = await contract.getVestingSchedule(scheduleId);
                  } else {
                    schedule = await contract.getVestingScheduleAtIndex(i);
                  }

                  // Extraer la información del beneficiario
                  const beneficiaryAddress = schedule.beneficiary || '';

                  if (beneficiaryAddress) {
                    const scheduleInfo: any = {
                      address: beneficiaryAddress,
                      scheduleId: i.toString(),
                      amount: ethers.formatUnits(schedule.amountTotal || schedule.totalAmount || BigInt(0), result.tokenDecimals),
                      claimed: ethers.formatUnits(schedule.released || BigInt(0), result.tokenDecimals),
                      startTime: Number(schedule.start || schedule.startTime || 0),
                      endTime: Number(schedule.end || schedule.endTime || 0),
                      cliffTime: schedule.cliff ? Number(schedule.cliff) : 0,
                      phase: schedule.phase || `Fase ${i + 1}`,
                      isRevoked: schedule.revoked || false
                    };

                    // Calcular remaining
                    const totalAmount = parseFloat(scheduleInfo.amount);
                    const claimed = parseFloat(scheduleInfo.claimed);
                    scheduleInfo.remaining = (totalAmount - claimed).toString();

                    // Calcular liberables basado en el tiempo
                    const currentTime = Math.floor(Date.now() / 1000);
                    if (currentTime > scheduleInfo.startTime) {
                      const totalDuration = scheduleInfo.endTime - scheduleInfo.startTime;
                      const elapsed = Math.min(currentTime - scheduleInfo.startTime, totalDuration);
                      const percentComplete = elapsed / totalDuration;
                      const shouldBeReleased = totalAmount * percentComplete;
                      const releasable = Math.max(0, shouldBeReleased - claimed);
                      scheduleInfo.releasable = releasable.toString();
                    } else {
                      scheduleInfo.releasable = '0';
                    }

                    result.beneficiaries.push(scheduleInfo);
                    console.log(`Schedule ${i} para ${beneficiaryAddress}: ${scheduleInfo.amount} tokens, liberables: ${scheduleInfo.releasable}`);
                  }
                } catch (e) {
                  console.warn(`Error al obtener schedule ${i}:`, e);
                }
              }

              // Si ya procesamos los schedules por índice, no necesitamos procesar por beneficiario
              if (result.beneficiaries.length > 0) {
                result.totalSchedulesCreated = result.beneficiaries.length;
                console.log("Total de schedules obtenidos por índice:", result.totalSchedulesCreated);
              } else {
                // Si no pudimos obtener schedules por índice, intentamos el enfoque por beneficiario
                await processBeneficiariesIndividually(beneficiaries, contract, contractABI, result, result.tokenDecimals);
              }
            } else {
              // Enfoque por beneficiario
              await processBeneficiariesIndividually(beneficiaries, contract, contractABI, result, result.tokenDecimals);
            }

            // Calcular tokens liberables totales usando la función auxiliar
            const totalReleasable = calculateReleasableTokens(result.beneficiaries);

            if (totalReleasable > 0) {
              result.releasableTokens = totalReleasable.toString();
              console.log("Total de tokens liberables calculados:", result.releasableTokens);
            }

          } catch (e) {
            console.warn("Error al obtener beneficiarios:", e);
          }
        } catch (e) {
          console.error("Error al obtener información del contrato:", e);
          result.error = `Error al obtener información del contrato: ${e instanceof Error ? e.message : 'Error desconocido'}`;
        }
      } catch (e) {
        console.error("Error al crear instancia del contrato:", e);
        result.error = `Error al crear instancia del contrato: ${e instanceof Error ? e.message : 'Error desconocido'}`;
      }
    } else {
      result.error = 'No se pudo obtener el ABI del contrato';
    }

    // Si no pudimos determinar si todos los tokens han sido vested, intentamos una última verificación
    // basada en transferencias de tokens
    if (!result.allTokensVested && result.tokenAddress && result.totalTokensIn && result.totalTokensOut) {
      const incomingAmount = parseFloat(result.totalTokensIn);
      const outgoingAmount = parseFloat(result.totalTokensOut);

      // Si el contrato ha enviado aproximadamente la misma cantidad que ha recibido,
      // podemos asumir que todos los tokens han sido vested
      if (outgoingAmount >= incomingAmount * 0.99) { // Consideramos un margen del 1% para errores de redondeo
        result.allTokensVested = true;
        console.log("Basado en transferencias, todos los tokens han sido vested");
      }
    }

    // Hacer una última verificación de los datos antes de devolverlos
    console.log("Resultado final:", result);

    return result;
  } catch (error) {
    if (error instanceof Error) {
      console.error(`Error al verificar el estado del contrato de vesting ${vestingContractAddress}:`, error.message);
    } else {
      console.error(`Error desconocido al verificar el contrato de vesting ${vestingContractAddress}`);
    }
    // Devolver un objeto con el error
    return {
      contractAddress: vestingContractAddress,
      isValid: false,
      tokenAddress: '',
      tokenName: '',
      tokenSymbol: '',
      tokenDecimals: 18,
      totalVested: '0',
      totalReleased: '0',
      remainingToVest: '0',
      allTokensVested: false,
      vestingSchedulesCount: 0,
      totalSchedulesCreated: 0,
      lastTokenBalance: '0',
      contractType: 'Desconocido',
      error: `Error al verificar el contrato: ${error instanceof Error ? error.message : 'Error desconocido'}`
    };
  }
}

/**
 * Obtiene los beneficiarios de un contrato de vesting a partir del historial de transferencias
 * Usa Moralis API porque BaseScan requiere plan de pago para Base chain
 * @param contractAddress Dirección del contrato de vesting
 * @param network Red blockchain
 * @returns Array de direcciones de beneficiarios
 */
async function getBeneficiariesFromTransferHistory(
  contractAddress: string,
  network: string
): Promise<string[]> {
  try {
    // Reutilizar transferencias desde caché (ya sincronizadas en checkVestingContractStatus)
    const vottunTokenAddress = "0xA9bc478A44a8c8FE6fd505C1964dEB3cEe3b7abC";

    const transfers = await getCachedTransfers(
      contractAddress,
      vottunTokenAddress,
      network
    );

    // Extraer direcciones únicas de beneficiarios (destinatarios de transferencias de salida)
    const beneficiaries = new Set<string>();

    for (const tx of transfers) {
      try {
        // Solo nos interesan las transferencias de salida (from_address = contrato)
        if (tx.from_address?.toLowerCase() === contractAddress.toLowerCase() && tx.to_address) {
          beneficiaries.add(tx.to_address.toLowerCase());
        }
      } catch (error) {
        console.warn('Error al procesar transacción:', error);
      }
    }

    console.log(`✓ Encontrados ${beneficiaries.size} beneficiarios únicos desde caché`);
    return Array.from(beneficiaries);
  } catch (error) {
    console.error('Error al obtener beneficiarios del historial de transferencias:', error);
    return [];
  }
}

// #endregion

//=============================================================================
// #region PESTAÑA: INFORMACIÓN DE SUMINISTRO
// Funciones para obtener información del suministro de tokens
//=============================================================================


// Caché para la información de suministro de tokens
let tokenSupplyCache: {
  data: TokenSupplyInfo | null;
  timestamp: number;
  isLoading: boolean;
  promise: Promise<TokenSupplyInfo> | null;
} = {
  data: null,
  timestamp: 0,
  isLoading: false,
  promise: null
};

/**
 * Tipo para los callbacks de progreso
 */
export type ProgressCallback = (stage: string, progress: number) => void;

// Variable para controlar si hay una petición global en curso
let globalRequestInProgress = false;

// Variables para controlar las peticiones individuales
let totalSupplyRequestInProgress = false;
let circulatingSupplyRequestInProgress = false;

// Contador para evitar peticiones duplicadas en modo estricto de React
let requestCounter = 0;

/**
 * Obtiene la información del suministro de tokens desde los endpoints de Vottun
 * @param onProgress Callback opcional para reportar el progreso
 * @returns Objeto con el total supply, circulating supply y locked supply
 */
export async function getTokenSupplyInfo(onProgress?: ProgressCallback): Promise<TokenSupplyInfo> {
  // Verificar si ya tenemos datos en caché y si son recientes (menos de 5 minutos)
  const now = Date.now();
  const cacheAge = now - tokenSupplyCache.timestamp;
  const CACHE_MAX_AGE = 300000; // 5 minutos en milisegundos (aumentado para reducir peticiones)

  // Si tenemos datos en caché y son recientes, devolverlos inmediatamente
  if (tokenSupplyCache.data && cacheAge < CACHE_MAX_AGE) {
    console.log('Devolviendo datos de caché (edad:', Math.round(cacheAge / 1000), 'segundos):', tokenSupplyCache.data);

    // Si hay un callback de progreso, indicar que se están usando datos en caché
    if (onProgress) {
      onProgress('usando_cache', 100);
    }

    return tokenSupplyCache.data;
  }

  // Verificar si hay una petición global en curso
  if (globalRequestInProgress) {

    // Si hay un callback de progreso, indicar que se está esperando
    if (onProgress) {
      onProgress('esperando_peticion', 10);
    }

    // Esperar a que termine la petición global (máximo 10 segundos)
    for (let i = 0; i < 10; i++) {
      if (!globalRequestInProgress) break;

      if (onProgress) {
        onProgress('esperando_peticion', 10 + (i * 9)); // Progreso de 10% a 100%
      }

      await new Promise(resolve => setTimeout(resolve, 1000)); // Esperar 1 segundo
    }

    // Después de esperar, si hay datos en caché, devolverlos
    if (tokenSupplyCache.data) {
      return tokenSupplyCache.data;
    }
  }

  // Marcar que hay una petición global en curso y generar un ID único para esta petición
  const currentRequestId = ++requestCounter;
  globalRequestInProgress = true;

  try {
    // Iniciar nueva petición
    tokenSupplyCache.isLoading = true;

    const result = await fetchTokenSupplyData(onProgress);

    // Actualizar la caché con los nuevos datos
    tokenSupplyCache.data = result;
    tokenSupplyCache.timestamp = now;
    return result;
  } catch (error) {
    console.error('Error al obtener datos de suministro:', error);
    // Si hay un error y tenemos datos en caché (aunque sean antiguos), los devolvemos
    if (tokenSupplyCache.data) {
      console.log('Devolviendo datos antiguos de caché debido a error');
      return tokenSupplyCache.data;
    }
    // Si no hay datos en caché, devolvemos valores por defecto
    return {
      totalSupply: '0',
      circulatingSupply: '0',
      lockedSupply: '0',
      lastUpdated: new Date().toISOString()
    };
  } finally {
    // Limpiar el estado de carga y la variable global
    tokenSupplyCache.isLoading = false;
    globalRequestInProgress = false;
  }
}

// Función para realizar peticiones a la API con reintentos
async function fetchWithRetry(url: string, maxRetries = 3, delayMs = 1000) {
  let lastError;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      console.log(`Intento #${attempt + 1} para ${url}`);
      const response = await axios.get(url);
      return response;
    } catch (error: any) {
      lastError = error;
      console.warn(`Error en intento #${attempt + 1} para ${url}:`, error.message);

      // Si no es el último intento, esperar antes de reintentar
      if (attempt < maxRetries - 1) {
        const waitTime = delayMs * Math.pow(2, attempt); // Espera exponencial
        console.log(`Esperando ${waitTime}ms antes del siguiente intento...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
  }

  // Si llegamos aquí, es porque agotamos los reintentos
  throw lastError;
}

/**
 * Función interna para obtener supply directamente de la blockchain
 * @param onProgress Callback opcional para reportar el progreso
 */
async function fetchTokenSupplyData(onProgress?: ProgressCallback): Promise<TokenSupplyInfo> {
  // Dirección del token VTN en Base
  const VTN_TOKEN_ADDRESS = '0xA9bc478A44a8c8FE6fd505C1964dEB3cEe3b7abC';

  // Direcciones de los 8 contratos de vesting
  const VESTING_CONTRACTS = [
    '0xa699Cf416FFe6063317442c3Fbd0C39742E971c5', // Vottun World
    '0x3e0ef51811B647E00A85A7e5e495fA4763911982', // Investors
    '0xE521B2929DD28a725603bCb6F4009FBb656C4b15', // Marketing
    '0x3a7cf4cCC76bb23Cf15845B0d4f05BafF1D478cF', // Staking
    '0x417Fc9c343210AA52F0b19dbf4EecBD786139BC1', // Liquidity
    '0xFC750D874077F8c90858cC132e0619CE7571520b', // Promos
    '0xde68AD324aafD9F2b6946073C90ED5e61D5d51B8', // Team
    '0xC4CE5cFea2B6e32Ad41973348AC70EB3b00D8e6d'  // Reserve
  ];

  try {
    if (onProgress) {
      onProgress('iniciando', 0);
    }

    // Obtener configuración de red y crear provider con RPC alternativo
    const networkConfig = NETWORKS['base'];
    // Usar QuickNode si está configurado, sino usar RPC alternativo público
    const rpcUrl = process.env.NEXT_PUBLIC_QUICKNODE_URL || 'https://base.llamarpc.com';
    const provider = new ethers.JsonRpcProvider(rpcUrl);

    // ABI mínimo para ERC20 (solo necesitamos totalSupply y balanceOf)
    const ERC20_ABI = [
      'function totalSupply() view returns (uint256)',
      'function balanceOf(address) view returns (uint256)',
      'function decimals() view returns (uint8)'
    ];

    // Crear contrato del token
    const tokenContract = new ethers.Contract(VTN_TOKEN_ADDRESS, ERC20_ABI, provider);

    if (onProgress) {
      onProgress('cargando_total_supply', 20);
    }

    // Obtener total supply
    const totalSupplyRaw = await tokenContract.totalSupply();
    const decimals = await tokenContract.decimals();
    const totalSupply = ethers.formatUnits(totalSupplyRaw, decimals);

    if (onProgress) {
      onProgress('cargando_datos', 40);
    }

    // Obtener balance de cada contrato de vesting
    let totalLocked = BigInt(0);
    for (let i = 0; i < VESTING_CONTRACTS.length; i++) {
      const balance = await tokenContract.balanceOf(VESTING_CONTRACTS[i]);
      totalLocked += balance;

      if (onProgress) {
        const progress = 40 + Math.floor((i + 1) / VESTING_CONTRACTS.length * 50);
        onProgress('cargando_circulating_supply', progress);
      }
    }

    // Calcular locked supply y circulating supply
    const lockedSupply = ethers.formatUnits(totalLocked, decimals);
    const totalSupplyNum = parseFloat(totalSupply);
    const lockedSupplyNum = parseFloat(lockedSupply);
    const circulatingSupply = (totalSupplyNum - lockedSupplyNum).toFixed(2);

    if (onProgress) {
      onProgress('completado', 100);
    }

    return {
      totalSupply: totalSupplyNum.toFixed(2),
      circulatingSupply,
      lockedSupply: lockedSupplyNum.toFixed(2),
      lastUpdated: new Date().toISOString()
    };
  } catch (error) {
    console.error('Error al obtener supply desde blockchain:', error);
    return {
      totalSupply: '0',
      circulatingSupply: '0',
      lockedSupply: '0',
      lastUpdated: new Date().toISOString()
    };
  }
}
// #endregion

//=============================================================================
// #region FUNCIONES AUXILIARES
// Funciones de utilidad usadas por múltiples pestañas
//=============================================================================

/**
 * Obtiene el ABI de un contrato desde BaseScan
 * @param contractAddress Dirección del contrato
 * @param network Red blockchain
 * @returns ABI del contrato
 */
async function getContractABI(contractAddress: string, network: string) {
  try {
    // Obtener configuración de la red
    const networkConfig = NETWORKS[network];
    if (!networkConfig) {
      throw new Error(`Red no soportada: ${network}`);
    }

    // Determinar la URL de la API según la red
    let apiUrl;
    let apiKey;

    if (network === 'base') {
      apiUrl = 'https://api.basescan.org/api';
      apiKey = process.env.NEXT_PUBLIC_BASESCAN_API_KEY || '';
    } else if (network === 'base-sepolia') {
      apiUrl = 'https://api-sepolia.basescan.org/api';
      apiKey = process.env.NEXT_PUBLIC_BASESCAN_API_KEY || '';
    } else {
      throw new Error(`Red no soportada para obtener ABI: ${network}`);
    }

    // Si no hay API key, usamos una por defecto para pruebas (limitada)
    if (!apiKey) {
      apiKey = 'YourApiKeyToken';
      console.warn('No se encontró API key para BaseScan, usando valor por defecto (limitado)');
    }

    // Implementar reintentos para manejar límites de tasa
    const maxRetries = 3;
    let retryCount = 0;
    let lastError = null;

    while (retryCount < maxRetries) {
      try {
        // Hacer la petición a la API de BaseScan
        const response = await axios.get(apiUrl, {
          params: {
            module: 'contract',
            action: 'getabi',
            address: contractAddress,
            apikey: apiKey
          }
        });

        // Verificar si la respuesta es correcta
        if (response.data.status === '1' && response.data.result) {
          console.log('ABI obtenido correctamente desde BaseScan');
          return JSON.parse(response.data.result);
        } else if (response.data.status === 'NOTOK' && response.data.message?.includes('rate limit')) {
          // Si es un error de límite de tasa, esperamos y reintentamos
          console.warn(`Límite de tasa excedido en BaseScan (intento ${retryCount + 1}/${maxRetries}), esperando antes de reintentar...`);
          await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1))); // Espera exponencial
          retryCount++;
          lastError = new Error(response.data.message);
        } else {
          // Otros errores de la API, no reintentamos
          console.warn('Error al obtener ABI desde BaseScan:', response.data.message);
          return null;
        }
      } catch (error) {
        // Error de red o de otro tipo
        lastError = error;
        retryCount++;
        if (retryCount < maxRetries) {
          console.warn(`Error al conectar con BaseScan (intento ${retryCount}/${maxRetries}), reintentando...`);
          await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
        }
      }
    }

    // Si llegamos aquí, es porque agotamos los reintentos
    console.error('Error al obtener ABI después de múltiples intentos:', lastError);
    return null;
  } catch (error) {
    if (error instanceof Error) {
      console.error('Error al obtener ABI desde BaseScan:', error.message);
    } else {
      console.error('Error desconocido al obtener ABI desde BaseScan');
    }
    return null;
  }
}

// Definición de ABI genérico para contratos de vesting
const GENERIC_VESTING_ABI = [
  "function getVestingSchedule(address beneficiary) view returns (tuple(uint256 start, uint256 cliff, uint256 duration, uint256 slicePeriodSeconds, bool revocable, uint256 amountTotal, uint256 released, bool revoked))",
  "function getVestingSchedulesTotalAmount() view returns (uint256)",
  "function getWithdrawnAmount(address beneficiary) view returns (uint256)",
  "function release(address beneficiary)"
];

// #endregion
