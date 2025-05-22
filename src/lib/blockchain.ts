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
    const data = await callEtherscanV2Api({
      module: 'account',
      action: 'tokentx',
      address: walletAddress.toLowerCase(),
      startblock: '0',
      endblock: '99999999',
      sort: 'desc',
      page: '1',
      offset: '1000', // Límite de resultados por página
    }, network);

    if (!data.result || !Array.isArray(data.result)) {
      throw new Error('Formato de respuesta inesperado de la API V2');
    }

    // Procesar los resultados para extraer la información relevante
    const transfers: TokenTransfer[] = [];
    const uniqueTokens = new Set<string>();

    for (const tx of data.result) {
      try {
        // Solo procesar transacciones de transferencia estándar
        if (tx.tokenSymbol && tx.tokenName && tx.contractAddress) {
          uniqueTokens.add(tx.contractAddress.toLowerCase());

          transfers.push({
            tokenAddress: tx.contractAddress,
            tokenSymbol: tx.tokenSymbol,
            tokenName: tx.tokenName,
            from: tx.from,
            to: tx.to,
            amount: tx.value,
            timestamp: parseInt(tx.timeStamp),
            transactionHash: tx.hash
          });
        }
      } catch (error) {
        console.warn('Error al procesar transacción:', tx, error);
      }
    }


    // Si no hay resultados, devolver array vacío
    if (transfers.length === 0) {
      return [];
    }

    // Ordenar por timestamp descendente (más reciente primero)
    transfers.sort((a, b) => b.timestamp - a.timestamp);

    return transfers;
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
            balance: ethers.formatUnits(token.balance, parseInt(token.decimals) || 18),
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
      console.log('Intentando obtener tokens de las transferencias como alternativa...');
      const transfers = await getTokenTransfersFromBlockchain(walletAddress, network);
      
      // Crear un mapa para agrupar las transferencias por token
      const tokenMap = new Map<string, {
        tokenAddress: string;
        tokenSymbol: string;
        tokenName: string;
        incomingAmount: number;
        outgoingAmount: number;
        decimals: number;
      }>();
      
      // Procesar las transferencias para calcular balances aproximados
      transfers.forEach(transfer => {
        const tokenKey = transfer.tokenAddress;
        
        if (!tokenMap.has(tokenKey)) {
          tokenMap.set(tokenKey, {
            tokenAddress: transfer.tokenAddress,
            tokenSymbol: transfer.tokenSymbol,
            tokenName: transfer.tokenName,
            incomingAmount: 0,
            outgoingAmount: 0,
            decimals: 18 // Valor por defecto
          });
        }
        
        const token = tokenMap.get(tokenKey)!;
        const amount = parseFloat(transfer.amount);
        
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
          balance: netBalance > 0 ? netBalance.toString() : '0',
          decimals: token.decimals,
          usdValue: null
        };
      });
      
      // Filtrar tokens con balance positivo
      return balances.filter(token => parseFloat(token.balance) > 0);
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
                return await targetContract[methodName](...args);
              }
              return null;
            } catch (e) {
              console.warn(`Error al llamar a ${methodName}:`, e);
              return null;
            }
          };

          // Intentar obtener la dirección del token usando diferentes métodos
          const tokenMethods = ['token', 'getToken', 'tokenAddress'];
          for (const method of tokenMethods) {
            try {
              if (hasMethod(method)) {
                const tokenAddr = await safeCall(method);
                if (tokenAddr && ethers.isAddress(tokenAddr)) {
                  result.tokenAddress = tokenAddr;
                  console.log(`Dirección del token obtenida con ${method}():`, result.tokenAddress);
                  break;
                }
              }
            } catch (e) {
              console.warn(`Error al obtener dirección del token con ${method}():`, e);
            }
          }
          
          // Obtener información del token si tenemos la dirección
          if (result.tokenAddress) {
            try {
              const tokenContract = new ethers.Contract(
                result.tokenAddress,
                ERC20_ABI,
                provider
              );
              
              // Obtener símbolo, nombre y decimales del token
              result.tokenSymbol = await safeCall('symbol', [], tokenContract) || 'UNKNOWN';
              result.tokenName = await safeCall('name', [], tokenContract) || 'Unknown Token';
              result.tokenDecimals = await safeCall('decimals', [], tokenContract) || 18;
              
              console.log(`Información del token obtenida: ${result.tokenName} (${result.tokenSymbol}), ${result.tokenDecimals} decimales`);
              
              // Obtener el balance actual del contrato de vesting
              try {
                const balance = await safeCall('balanceOf', [normalizedContractAddress], tokenContract);
                if (balance) {
                  result.lastTokenBalance = ethers.formatUnits(balance, result.tokenDecimals);
                  console.log(`Balance actual del contrato: ${result.lastTokenBalance} ${result.tokenSymbol}`);
                }
                
                // Obtener total vested usando diferentes métodos
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
                
                // Obtener total liberado usando diferentes métodos
                const totalReleasedMethods = [
                  'totalReleased',
                  'released',
                  'totalWithdrawn',
                  'totalClaimed'
                ];
                
                for (const method of totalReleasedMethods) {
                  try {
                    const released = await safeCall(method);
                    if (released !== null && released !== undefined) {
                      result.totalReleased = ethers.formatUnits(released, result.tokenDecimals);
                      console.log(`Total liberado obtenido con ${method}: ${result.totalReleased}`);
                      break;
                    }
                  } catch (e) {
                    console.warn(`Error al obtener total liberado con ${method}:`, e);
                  }
                }
                
                // Calcular tokens restantes
                if (result.totalVested && result.totalReleased) {
                  const vested = ethers.parseUnits(result.totalVested, result.tokenDecimals);
                  const released = ethers.parseUnits(result.totalReleased, result.tokenDecimals);
                  const remaining = vested - released;
                  result.remainingToVest = ethers.formatUnits(remaining, result.tokenDecimals);
                  console.log(`Tokens restantes: ${result.remainingToVest}`);
                  
                  // Verificar si todos los tokens han sido vested
                  result.allTokensVested = BigInt(remaining.toString()) === BigInt(0);
                }
                
              } catch (e) {
                console.warn('Error al obtener información de vesting:', e);
              }
              
            } catch (e) {
              console.warn('Error al obtener información del token:', e);
            }
          } else {
            // Si no pudimos obtener la dirección del token, intentamos buscar transferencias de tokens
            try {
              // Obtener historial de transferencias de tokens para el contrato
              const apiKey = process.env.NEXT_PUBLIC_BASESCAN_API_KEY;
              if (!apiKey) {
                console.warn('No se ha configurado la clave API de Basescan');
              }
              
              const response = await axios.get(networkConfig.explorerApiUrl, {
                params: {
                  module: 'account',
                  action: 'tokentx',
                  address: normalizedContractAddress.toLowerCase(),
                  sort: 'desc', // Ordenar por antigüedad para ver primero las más antiguas
                  apikey: apiKey || 'YourApiKeyToken' // Usar clave API por defecto si no hay una configurada
                }
              });
              
              if (response.data.status === '1' && Array.isArray(response.data.result)) {
                // Obtener fecha de creación (primera transacción)
                const firstTx = response.data.result[0];
                if (firstTx && firstTx.timeStamp) {
                  const timestamp = parseInt(firstTx.timeStamp) * 1000;
                  result.creationDate = new Date(timestamp).toISOString();
                  console.log("Fecha de creación del contrato:", result.creationDate);
                }
                
                // Asumimos que el token más frecuente es el token de vesting
                const tokenCounts: Record<string, number> = {};
                response.data.result.forEach((tx: any) => {
                  const tokenAddr = tx.contractAddress.toLowerCase();
                  tokenCounts[tokenAddr] = (tokenCounts[tokenAddr] || 0) + 1;
                });
                
                // Encontrar el token más frecuente
                let maxCount = 0;
                let mostFrequentToken = '';
                
                for (const [token, count] of Object.entries(tokenCounts)) {
                  if (count > maxCount) {
                    maxCount = count;
                    mostFrequentToken = token;
                  }
                }
                
                if (mostFrequentToken) {
                  result.tokenAddress = mostFrequentToken;
                  
                  // Obtener información del token
                  const tokenTx = response.data.result.find((tx: any) => tx.contractAddress.toLowerCase() === mostFrequentToken);
                  if (tokenTx) {
                    result.tokenName = tokenTx.tokenName || "Token Desconocido";
                    result.tokenSymbol = tokenTx.tokenSymbol || "???";
                    result.tokenDecimals = parseInt(tokenTx.tokenDecimal) || 18;
                  }
                }
                
                // Analizar todas las transferencias para calcular totales
                let incomingAmount = 0;
                let outgoingAmount = 0;
                
                // Mapeo para rastrear direcciones que han recibido tokens (beneficiarios)
                const beneficiaries: Record<string, {
                  received: number;
                  claimed: number;
                }> = {};
                
                // Procesar todas las transferencias del token principal
                if (result.tokenAddress) {
                  response.data.result.forEach((tx: any) => {
                    if (tx.contractAddress.toLowerCase() === result.tokenAddress.toLowerCase()) {
                      const amount = parseFloat(ethers.formatUnits(tx.value, result.tokenDecimals));
                      
                      // Tokens entrantes al contrato
                      if (tx.to.toLowerCase() === normalizedContractAddress.toLowerCase()) {
                        incomingAmount += amount;
                      } 
                      // Tokens salientes del contrato (claims o transferencias)
                      else if (tx.from.toLowerCase() === normalizedContractAddress.toLowerCase()) {
                        outgoingAmount += amount;
                        
                        // Registrar beneficiario
                        const beneficiary = tx.to.toLowerCase();
                        if (!beneficiaries[beneficiary]) {
                          beneficiaries[beneficiary] = { received: 0, claimed: amount };
                        } else {
                          beneficiaries[beneficiary].claimed += amount;
                        }
                      }
                    }
                  });
                  
                  // Actualizar totales
                  result.totalTokensIn = incomingAmount.toString();
                  result.totalTokensOut = outgoingAmount.toString();
                  result.claimedTokens = outgoingAmount.toString(); // Por ahora, asumimos que todas las salidas son claims
                  
                  // Estimar el número total de schedules creados basado en beneficiarios únicos
                  result.totalSchedulesCreated = Object.keys(beneficiaries).length;
                  
                  console.log("Total de tokens recibidos:", incomingAmount);
                  console.log("Total de tokens enviados:", outgoingAmount);
                  console.log("Número estimado de beneficiarios:", result.totalSchedulesCreated);
                }
              }
            } catch (e) {
              console.warn("Error al obtener transferencias de tokens:", e);
            }
          }
          
          // Si tenemos la dirección del token, intentamos obtener su información
          if (result.tokenAddress && (!result.tokenName || !result.tokenSymbol)) {
            try {
              const tokenABI = [
                "function name() view returns (string)",
                "function symbol() view returns (string)",
                "function decimals() view returns (uint8)"
              ];
              
              const tokenContract = new ethers.Contract(result.tokenAddress, tokenABI, provider);
              
              try {
                result.tokenName = await tokenContract.name();
              } catch (e) {
                console.log("No se pudo obtener el nombre del token");
              }
              try {
                result.tokenSymbol = await tokenContract.symbol();
              } catch (e) {
                console.log("No se pudo obtener el símbolo del token");
              }
              try {
                result.tokenDecimals = await tokenContract.decimals();
              } catch (e) {
                console.log("No se pudo obtener los decimales del token, usando valor por defecto: 18");
              }
              console.log("Información del token obtenida:", result.tokenName, result.tokenSymbol, result.tokenDecimals);
            } catch (e) {
              console.warn("Error al obtener información del token:", e);
              // Mantenemos los valores por defecto
              result.tokenName = "Token Desconocido";
              result.tokenSymbol = "???";
              result.tokenDecimals = 18;
            }
          } else {
            console.warn("No se pudo crear contrato de token: dirección inválida o nula", result.tokenAddress);
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
          
          // Intentar obtener el monto total en vesting usando diferentes métodos
          const totalAmountMethods = ['getVestingSchedulesTotalAmount', 'getTotalVestingAmount', 'totalVestingAmount'];
          for (const method of totalAmountMethods) {
            if (contractABI.some((fn: any) => typeof fn === 'object' && fn.name === method)) {
              try {
                const totalAmount = await contract[method]();
                result.totalVested = ethers.formatUnits(totalAmount, result.tokenDecimals);
                console.log(`Monto total en vesting (${method}):`, result.totalVested);
                break;
              } catch (e) {
                console.warn(`Error al obtener monto total en vesting con ${method}:`, e);
              }
            }
          }
          
          // Intentar obtener el último balance de tokens
          if (contractABI.some((fn: any) => typeof fn === 'object' && fn.name === 'getLastTokenBalance')) {
            try {
              const lastBalance = await contract.getLastTokenBalance();
              result.lastTokenBalance = ethers.formatUnits(lastBalance, result.tokenDecimals);
              console.log("Último balance de tokens:", result.lastTokenBalance);
            } catch (e) {
              console.warn("Error al obtener último balance de tokens:", e);
            }
          }
          
          // Intentar obtener el monto liberado usando diferentes métodos
          const releasedMethods = ['getTotalReleased', 'totalReleased', 'getReleasedAmount'];
          for (const method of releasedMethods) {
            if (contractABI.some((fn: any) => typeof fn === 'object' && fn.name === method)) {
              try {
                const releasedAmount = await contract[method]();
                result.totalReleased = ethers.formatUnits(releasedAmount, result.tokenDecimals);
                console.log(`Monto total liberado (${method}):`, result.totalReleased);
                break;
              } catch (e) {
                console.warn(`Error al obtener monto liberado con ${method}:`, e);
              }
            }
          }
          
          // Si tenemos la dirección del token, intentamos obtener el balance actual del contrato
          if (result.tokenAddress && (!result.lastTokenBalance || result.lastTokenBalance === '0')) {
            try {
              const tokenABI = [
                "function balanceOf(address) view returns (uint256)"
              ];
              
              const tokenContract = new ethers.Contract(result.tokenAddress, tokenABI, provider);
              const currentBalance = await tokenContract.balanceOf(normalizedContractAddress);
              const formattedBalance = ethers.formatUnits(currentBalance, result.tokenDecimals);
              
              console.log("Balance actual del token en el contrato:", formattedBalance);
              result.lastTokenBalance = formattedBalance;
              
              // Si tenemos el monto total y el balance actual, podemos calcular el monto liberado
              if (result.totalVested !== '0' && result.totalReleased === '0') {
                const totalAmount = parseFloat(result.totalVested);
                const currentBalanceNum = parseFloat(formattedBalance);
                
                // El monto liberado es la diferencia entre el total y el balance actual
                const released = totalAmount - currentBalanceNum;
                if (released > 0) {
                  result.totalReleased = released.toString();
                  console.log("Monto liberado calculado desde balance:", result.totalReleased);
                }
              }
              
              // Si el balance es 0 o muy pequeño (considerando posibles errores de redondeo),
              // podemos asumir que todos los tokens han sido vested
              if (parseFloat(formattedBalance) < 0.000001) {
                result.allTokensVested = true;
                console.log("Balance cercano a cero, todos los tokens han sido vested");
              }
            } catch (e) {
              console.warn("Error al obtener balance del token:", e);
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
            
            // Intentar obtener información de vesting directamente desde el historial de transacciones
            // Esto es útil para contratos que no exponen métodos para obtener información de vesting
            try {
              const apiKey = process.env.NEXT_PUBLIC_BASESCAN_API_KEY || '';
              const response = await axios.get(networkConfig.explorerApiUrl, {
                params: {
                  module: 'account',
                  action: 'tokentx',
                  address: normalizedContractAddress.toLowerCase(),
                  sort: 'asc', // Ordenar por antigüedad para ver primero las más antiguas
                  apikey: apiKey
                }
              });
              
              if (response.data.status === '1' && Array.isArray(response.data.result)) {
                // Agrupar transacciones por beneficiario
                const transactionsByBeneficiary: Record<string, any[]> = {};
                
                response.data.result.forEach((tx: any) => {
                  if (tx.from.toLowerCase() === normalizedContractAddress.toLowerCase()) {
                    const beneficiary = tx.to.toLowerCase();
                    if (!transactionsByBeneficiary[beneficiary]) {
                      transactionsByBeneficiary[beneficiary] = [];
                    }
                    transactionsByBeneficiary[beneficiary].push({
                      timestamp: parseInt(tx.timeStamp) * 1000,
                      amount: ethers.formatUnits(tx.value, result.tokenDecimals),
                      hash: tx.hash
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
                    // Asumimos que la primera transacción es cercana al inicio del vesting
                    // y la última transacción es cercana al fin del vesting si han pasado más de 30 días
                    const firstTx = transactions[0];
                    const lastTx = transactions[transactions.length - 1];
                    const daysDiff = (lastTx.timestamp - firstTx.timestamp) / (1000 * 60 * 60 * 24);
                    
                    // Crear información del schedule
                    const scheduleInfo: any = {
                      address: beneficiary,
                      claimed: totalClaimed.toString(),
                      amount: '0', // No podemos saber el monto total solo desde las transacciones
                      remaining: '0',
                      releasable: '0',
                      startTime: Math.floor(firstTx.timestamp / 1000),
                      endTime: daysDiff > 30 ? Math.floor(lastTx.timestamp / 1000) : Math.floor(firstTx.timestamp / 1000) + 31536000, // 1 año por defecto
                      transactions: transactions.length,
                      isEstimated: true
                    };
                    
                    // Estimar el monto total basado en el patrón de transacciones
                    // Si las transacciones son regulares, podemos estimar un patrón de vesting
                    if (transactions.length >= 3) {
                      // Calcular intervalos entre transacciones
                      const intervals = [];
                      for (let i = 1; i < transactions.length; i++) {
                        intervals.push(transactions[i].timestamp - transactions[i-1].timestamp);
                      }
                      
                      // Calcular el intervalo promedio
                      const avgInterval = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
                      
                      // Si el intervalo promedio es consistente (variación < 20%)
                      const variation = Math.max(...intervals) / Math.min(...intervals);
                      if (variation < 1.2) {
                        // Parece un vesting regular, estimamos el total
                        const vestingDuration = scheduleInfo.endTime - scheduleInfo.startTime;
                        const intervalSeconds = avgInterval / 1000;
                        const estimatedTotalPayments = vestingDuration / intervalSeconds;
                        const estimatedTotal = totalClaimed * (estimatedTotalPayments / transactions.length);
                        
                        scheduleInfo.amount = estimatedTotal.toString();
                        scheduleInfo.remaining = (estimatedTotal - totalClaimed).toString();
                        
                        // Calcular tokens liberables basado en el tiempo
                        const currentTime = Math.floor(Date.now() / 1000);
                        if (currentTime > scheduleInfo.startTime) {
                          const totalDuration = scheduleInfo.endTime - scheduleInfo.startTime;
                          const elapsed = Math.min(currentTime - scheduleInfo.startTime, totalDuration);
                          const percentComplete = elapsed / totalDuration;
                          const shouldBeReleased = estimatedTotal * percentComplete;
                          const releasable = Math.max(0, shouldBeReleased - totalClaimed);
                          scheduleInfo.releasable = releasable.toString();
                        }
                      } else {
                        // Vesting irregular, usamos una estimación más conservadora
                        // Asumimos que el total es al menos el doble de lo reclamado
                        const estimatedTotal = totalClaimed * 2;
                        scheduleInfo.amount = estimatedTotal.toString();
                        scheduleInfo.remaining = (estimatedTotal - totalClaimed).toString();
                      }
                    } else {
                      // Pocas transacciones, usamos una estimación conservadora
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
                let totalReleasable = 0;
                for (const beneficiary of result.beneficiaries) {
                  if (beneficiary.releasable) {
                    totalReleasable += parseFloat(beneficiary.releasable);
                  }
                }
                
                if (totalReleasable > 0) {
                  result.releasableTokens = totalReleasable.toString();
                  console.log("Total de tokens liberables estimados:", result.releasableTokens);
                }
                
                // Si ya procesamos los beneficiarios por transacciones, no necesitamos continuar
                return result;
              }
            } catch (e) {
              console.warn("Error al obtener información desde transacciones:", e);
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
 * @param contractAddress Dirección del contrato de vesting
 * @param network Red blockchain
 * @returns Array de direcciones de beneficiarios
 */
async function getBeneficiariesFromTransferHistory(
  contractAddress: string,
  network: string
): Promise<string[]> {
  try {
    const data = await callEtherscanV2Api({
      module: 'account',
      action: 'tokentx',
      address: contractAddress.toLowerCase(),
      sort: 'desc',
      page: '1',
      offset: '1000', // Límite de resultados por página
      startblock: '0',
      endblock: '99999999',
    }, network);

    if (!data.result || !Array.isArray(data.result)) {
      throw new Error('Formato de respuesta inesperado de la API V2');
    }

    // Extraer direcciones únicas de beneficiarios (destinatarios de transferencias)
    const beneficiaries = new Set<string>();
    
    for (const tx of data.result) {
      try {
        // Solo nos interesan las transferencias de salida (from = contrato)
        if (tx.from && tx.from.toLowerCase() === contractAddress.toLowerCase() && tx.to) {
          beneficiaries.add(tx.to.toLowerCase());
        }
      } catch (error) {
        console.warn('Error al procesar transacción:', error);
      }
    }

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
    console.log('Devolviendo datos de caché (edad:', Math.round(cacheAge/1000), 'segundos):', tokenSupplyCache.data);
    
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
 * Función interna para hacer las peticiones a la API de Vottun
 * @param onProgress Callback opcional para reportar el progreso
 */
async function fetchTokenSupplyData(onProgress?: ProgressCallback): Promise<TokenSupplyInfo> {
  try {
    // Indicar inicio del proceso
    if (onProgress) {
      onProgress('iniciando', 0);
    }
    
    // Obtener total supply (con protección contra peticiones duplicadas)
    if (onProgress) {
      onProgress('cargando_total_supply', 10);
    }
    
    let totalSupplyResponse;
    if (!totalSupplyRequestInProgress) {
      totalSupplyRequestInProgress = true;
      try {
        // Usar la función de reintento
        totalSupplyResponse = await fetchWithRetry('https://intapi.vottun.tech/tkn/v1/total-supply');
      } catch (error) {
        console.error('Error después de múltiples intentos para total-supply:', error);
        throw error;
      } finally {
        // Asegurarse de que la bandera se restablezca incluso si hay un error
        setTimeout(() => {
          totalSupplyRequestInProgress = false;
        }, 5000); // Esperar 5 segundos antes de permitir otra petición
      }
    } else {
      console.log('Ya hay una petición de total supply en curso, esperando...');
      // Esperar a que termine la petición en curso (máximo 5 segundos)
      for (let i = 0; i < 5; i++) {
        if (!totalSupplyRequestInProgress) break;
        await new Promise(resolve => setTimeout(resolve, 1000)); // Esperar 1 segundo
      }
      // Si después de esperar sigue en curso, usar el valor por defecto
      if (totalSupplyRequestInProgress) {
        console.warn('Tiempo de espera agotado para la petición de total supply, usando valor por defecto');
        throw new Error('Tiempo de espera agotado para la petición de total supply');
      }
      // Intentar de nuevo con reintentos
      try {
        totalSupplyResponse = await fetchWithRetry('https://intapi.vottun.tech/tkn/v1/total-supply');
      } catch (error) {
        console.error('Error después de múltiples intentos para total-supply (reintento):', error);
        throw error;
      }
    }

    // Verificar si la respuesta tiene la estructura esperada
    let totalSupply = '0';
    if (totalSupplyResponse.data !== null && totalSupplyResponse.data !== undefined) {
      // Detectar el tipo de respuesta y extraer el valor
      if (typeof totalSupplyResponse.data === 'object' && totalSupplyResponse.data.totalSupply) {
        // Si es un objeto con propiedad totalSupply
        totalSupply = totalSupplyResponse.data.totalSupply.toString();
      } else if (typeof totalSupplyResponse.data === 'string') {
        // Si la API devuelve directamente un string
        totalSupply = totalSupplyResponse.data;
      } else if (typeof totalSupplyResponse.data === 'number') {
        // Si la API devuelve directamente un número
        totalSupply = totalSupplyResponse.data.toString();
      } else {
        // Intentar convertir a string como último recurso
        try {
          totalSupply = String(totalSupplyResponse.data);
        } catch (e) {
          console.error('No se pudo convertir la respuesta a string:', e);
        }
      }
    }
    
    // Verificar que el valor obtenido sea un número válido
    if (totalSupply && !isNaN(parseFloat(totalSupply))) {
    } else {
      console.warn('El valor de total supply no es un número válido:', totalSupply);
      totalSupply = '0';
    }
    
    // Añadir un delay de 5 segundos para evitar errores de rate limit
    
    // Implementar contador de progreso durante la espera
    const WAIT_TIME = 5000; // 5 segundos en milisegundos
    const INTERVAL = 100; // Actualizar cada 100ms
    const STEPS = WAIT_TIME / INTERVAL;
    
    if (onProgress) {
      onProgress('cargando_datos', 25); // 25% después de obtener total supply
    }
    
    // Esperar con actualizaciones de progreso
    await new Promise<void>(resolve => {
      let elapsed = 0;
      const interval = setInterval(() => {
        elapsed += INTERVAL;
        const progress = Math.min(25 + Math.floor((elapsed / WAIT_TIME) * 25), 50); // De 25% a 50%
        
        if (onProgress) {
          onProgress('esperando', progress);
        }
        
        if (elapsed >= WAIT_TIME) {
          clearInterval(interval);
          resolve();
        }
      }, INTERVAL);
    });
    
    // Obtener circulating supply (con protección contra peticiones duplicadas)
    let circulatingSupply = '0';
    try {
      if (onProgress) {
        onProgress('cargando_circulating_supply', 60);
      }
      
      let circulatingSupplyResponse;
      if (!circulatingSupplyRequestInProgress) {
        circulatingSupplyRequestInProgress = true;
        try {
          // Usar la función de reintento
          circulatingSupplyResponse = await fetchWithRetry('https://intapi.vottun.tech/tkn/v1/circulating-supply');
        } catch (error) {
          console.error('Error después de múltiples intentos para circulating-supply:', error);
          throw error;
        } finally {
          // Asegurarse de que la bandera se restablezca incluso si hay un error
          setTimeout(() => {
            circulatingSupplyRequestInProgress = false;
          }, 5000); // Esperar 5 segundos antes de permitir otra petición
        }
      } else {
        console.log('Ya hay una petición de circulating supply en curso, esperando...');
        // Esperar a que termine la petición en curso (máximo 5 segundos)
        for (let i = 0; i < 5; i++) {
          if (!circulatingSupplyRequestInProgress) break;
          await new Promise(resolve => setTimeout(resolve, 1000)); // Esperar 1 segundo
        }
        // Si después de esperar sigue en curso, usar el valor por defecto
        if (circulatingSupplyRequestInProgress) {
          console.warn('Tiempo de espera agotado para la petición de circulating supply, usando valor por defecto');
          throw new Error('Tiempo de espera agotado para la petición de circulating supply');
        }
        // Intentar de nuevo con reintentos
        try {
          circulatingSupplyResponse = await fetchWithRetry('https://intapi.vottun.tech/tkn/v1/circulating-supply');
        } catch (error) {
          console.error('Error después de múltiples intentos para circulating-supply (reintento):', error);
          throw error;
        }
      }

      
      // Verificar si la respuesta tiene la estructura esperada
      if (circulatingSupplyResponse.data !== null && circulatingSupplyResponse.data !== undefined) {
        if (typeof circulatingSupplyResponse.data === 'object' && circulatingSupplyResponse.data.circulatingSupply) {
          circulatingSupply = circulatingSupplyResponse.data.circulatingSupply.toString();
        } else if (typeof circulatingSupplyResponse.data === 'string') {
          circulatingSupply = circulatingSupplyResponse.data;
        } else if (typeof circulatingSupplyResponse.data === 'number') {
          circulatingSupply = circulatingSupplyResponse.data.toString();
        } else {
          try {
            circulatingSupply = String(circulatingSupplyResponse.data);
          } catch (e) {
            console.error('No se pudo convertir la respuesta a string:', e);
          }
        }
      }
    } catch (error) {
      console.error('Error al obtener circulating supply:', error);
      // Si falla, continuamos con el valor por defecto
    }
    
    // Asegurarse de que los valores sean numéricos para el cálculo
    const totalSupplyNum = parseFloat(totalSupply) || 0;
    const circulatingSupplyNum = parseFloat(circulatingSupply) || 0;
    const lockedSupply = (totalSupplyNum - circulatingSupplyNum).toFixed(2);
    
    // Crear el objeto de respuesta
    const supplyInfo: TokenSupplyInfo = {
      totalSupply: totalSupplyNum.toString(),
      circulatingSupply: circulatingSupplyNum.toString(),
      lockedSupply,
      lastUpdated: new Date().toISOString()
    };
    
    // Indicar que el proceso ha finalizado
    if (onProgress) {
      onProgress('completado', 100);
    }
    

    return supplyInfo;
  } catch (error) {
    console.error('Error al obtener la información del suministro:', error);
    
    // En caso de error, devolver valores por defecto en lugar de propagar el error
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
