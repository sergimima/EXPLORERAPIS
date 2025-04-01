// Importaciones
import axios from 'axios';
import { ethers } from 'ethers';
import { VESTING_CONTRACT_ABIS } from './contractAbis';
import { processBeneficiariesIndividually, calculateReleasableTokens } from './vestingHelpers';
import { processVestingWithGetVestingListByHolder } from './vestingContractHelpers';

// Configuración de las redes
const NETWORKS: Record<string, {
  rpcUrl: string;
  explorerApiUrl: string;
  chainId: number;
  name: string;
}> = {
  'base': {
    rpcUrl: 'https://mainnet.base.org',
    explorerApiUrl: 'https://api.basescan.org/api',
    chainId: 8453,
    name: 'Base Mainnet'
  },
  'base-testnet': {
    rpcUrl: 'https://goerli.base.org',
    explorerApiUrl: 'https://api-goerli.basescan.org/api',
    chainId: 84531,
    name: 'Base Testnet (Goerli)'
  },
  'base-sepolia': {
    rpcUrl: 'https://sepolia.base.org',
    explorerApiUrl: 'https://api-sepolia.basescan.org/api',
    chainId: 84532,
    name: 'Base Testnet (Sepolia)'
  }
};

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
    return [];
  }
}

/**
 * Obtiene las transferencias de tokens desde la blockchain utilizando la API de Basescan
 */
export async function getTokenTransfersFromBlockchain(
  walletAddress: string,
  network: string = 'base'
): Promise<TokenTransfer[]> {
  try {
    const networkConfig = NETWORKS[network as keyof typeof NETWORKS];
    if (!networkConfig) {
      throw new Error(`Red no soportada: ${network}`);
    }
    
    // Obtener la clave API de las variables de entorno
    const apiKey = process.env.NEXT_PUBLIC_BASESCAN_API_KEY;
    if (!apiKey) {
      console.warn('No se ha configurado la clave API de Basescan');
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
            action: 'tokentx',
            address: walletAddress,
            sort: 'desc',
            apikey: apiKey || 'YourApiKeyToken' // Usar clave API por defecto si no hay una configurada
          }
        });
        
        // Verificar si la respuesta es válida
        if (response.data.status === '1' && Array.isArray(response.data.result)) {
          // Transformar los datos de la API al formato de nuestra aplicación
          return response.data.result.map((tx: any) => ({
            tokenAddress: tx.contractAddress,
            tokenSymbol: tx.tokenSymbol || 'UNKNOWN',
            tokenName: tx.tokenName || 'Unknown Token',
            from: tx.from,
            to: tx.to,
            amount: ethers.formatUnits(tx.value, parseInt(tx.tokenDecimal) || 18),
            timestamp: parseInt(tx.timeStamp),
            transactionHash: tx.hash
          }));
        } else if (response.data.status === 'NOTOK' && response.data.message?.includes('rate limit')) {
          // Si es un error de límite de tasa, esperamos y reintentamos
          console.warn(`Límite de tasa excedido en BaseScan (intento ${retryCount + 1}/${maxRetries}), esperando antes de reintentar...`);
          await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1))); // Espera exponencial
          retryCount++;
          lastError = new Error(response.data.message);
        } else {
          // Si la respuesta es NOTOK pero no es por límite de tasa
          console.warn('La API de Basescan no devolvió resultados válidos:', response.data.message || 'Sin mensaje de error');
          
          // Si el mensaje indica que no hay transferencias, retornamos un array vacío
          if (response.data.message?.includes('No transactions found')) {
            return [];
          }
          
          // Para otros errores, intentamos una vez más después de una pausa
          if (retryCount < maxRetries - 1) {
            console.warn(`Reintentando después de error (intento ${retryCount + 1}/${maxRetries})...`);
            await new Promise(resolve => setTimeout(resolve, 1000));
            retryCount++;
          } else {
            return []; // Devolver array vacío después de agotar los reintentos
          }
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
    console.error('Error al obtener transferencias después de múltiples intentos:', lastError);
    return [];
  } catch (error) {
    console.error('Error al obtener transferencias de tokens desde la blockchain:', error);
    return []; // Devolver array vacío en lugar de propagar el error
  }
}

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
      return [];
    }
  } catch (error) {
    console.error('Error al obtener balances de tokens:', error);
    return [];
  }
}

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
    const normalizedWalletAddress = walletAddress.toLowerCase();
    const normalizedContractAddress = vestingContractAddress.toLowerCase();

    // Obtener información de vesting desde la blockchain
    const vestingInfo = await getVestingInfoFromBlockchain(normalizedWalletAddress, normalizedContractAddress, network);
    
    // Si no hay información de vesting, devolver un array vacío
    if (!vestingInfo || vestingInfo.length === 0) {
      return [];
    }
    
    return vestingInfo;
  } catch (error) {
    console.error(`Error al obtener información de vesting para wallet ${walletAddress} en contrato ${vestingContractAddress}:`, error);
    // Devolver un array vacío en lugar de propagar el error
    return [];
  }
}

/**
 * Obtiene información de vesting desde la blockchain
 * @param walletAddress Dirección de la wallet
 * @param vestingContractAddress Dirección del contrato de vesting
 * @param network Red blockchain
 * @returns Información de vesting
 */
async function getVestingInfoFromBlockchain(walletAddress: string, vestingContractAddress: string, network: string) {
  try {
    // Normalizar direcciones (convertir a checksum address)
    walletAddress = ethers.getAddress(walletAddress.toLowerCase());
    vestingContractAddress = ethers.getAddress(vestingContractAddress.toLowerCase());
    
    // Obtener configuración de la red
    const networkConfig = NETWORKS[network];
    if (!networkConfig) {
      throw new Error(`Red no soportada: ${network}`);
    }

    // Crear proveedor de Ethereum
    const provider = new ethers.JsonRpcProvider(networkConfig.rpcUrl);
    
    // Usar ABI precargado si existe, o intentar obtenerlo desde BaseScan
    let contractABI;
    
    // Primero intentamos usar el ABI precargado
    if (VESTING_CONTRACT_ABIS[vestingContractAddress]) {
      console.log('Usando ABI precargado para el contrato:', vestingContractAddress);
      contractABI = VESTING_CONTRACT_ABIS[vestingContractAddress];
    } else {
      // Si no tenemos el ABI precargado, intentamos obtenerlo desde BaseScan
      console.log('Intentando obtener ABI desde BaseScan...');
      contractABI = await getContractABI(vestingContractAddress, network);
      // Si obtuvimos el ABI, lo guardamos para futuras consultas
      if (contractABI) {
        console.log('Guardando ABI obtenido para futuras consultas');
        // @ts-ignore - Ignoramos el error de TypeScript porque sabemos que estamos modificando un objeto importado
        VESTING_CONTRACT_ABIS[vestingContractAddress] = contractABI;
      }
    }
    
    // Si tenemos el ABI, lo usamos
    if (contractABI) {
      try {
        console.log('Usando ABI obtenido');
        const contract = new ethers.Contract(vestingContractAddress, contractABI, provider);
        
        // Intentar obtener la dirección del token
        let tokenAddress;
        try {
          tokenAddress = await contract.token();
          console.log("Encontrado método token() con ABI de BaseScan:", tokenAddress);
        } catch (e) {
          console.warn("No se encontró método token() en el ABI de BaseScan:", e);
          // Si no podemos obtener el token, probamos con nuestros ABIs predefinidos
          throw new Error("No se pudo obtener token con ABI de BaseScan");
        }
        
        // Obtener información del token
        const tokenABI = [
          "function name() view returns (string)",
          "function symbol() view returns (string)",
          "function decimals() view returns (uint8)"
        ];
        
        const tokenContract = new ethers.Contract(tokenAddress, tokenABI, provider);
        let tokenName, tokenSymbol, tokenDecimals;
        
        try {
          tokenName = await tokenContract.name();
          tokenSymbol = await tokenContract.symbol();
          tokenDecimals = await tokenContract.decimals();
          console.log("Información del token obtenida:", tokenName, tokenSymbol, tokenDecimals);
        } catch (e) {
          console.warn("Error al obtener información del token:", e);
          // Usamos valores por defecto si no podemos obtener la información
          tokenName = "Token Desconocido";
          tokenSymbol = "???";
          tokenDecimals = 18;
        }
        
        // Intentar obtener información de vesting
        // Primero verificamos qué métodos están disponibles en el ABI
        const abiMethods = contractABI.filter((item: any) => item.type === 'function').map((item: any) => item.name);
        console.log("Métodos disponibles en el ABI:", abiMethods);
        
        let vestingInfo = null;
        
        // Contrato Vottun específico (0x3e0ef51811B647E00A85A7e5e495fA4763911982)
        if (abiMethods.includes('getVestingListByHolder') && abiMethods.includes('getVestingSchedule')) {
          console.log("Detectado contrato Vottun con getVestingListByHolder");
          
          try {
            // Verificar primero si el contrato tiene un método para contar vestings
            if (abiMethods.includes('getHolderVestingCount')) {
              try {
                const vestingCount = await contract.getHolderVestingCount(walletAddress);
                console.log(`Número de vestings para ${walletAddress}:`, vestingCount);
                
                // Si no hay vestings, devolvemos un array vacío inmediatamente
                if (vestingCount && Number(vestingCount) === 0) {
                  console.log(`La dirección ${walletAddress} no tiene vestings en este contrato`);
                  return [];
                }
              } catch (e) {
                console.warn("Error al obtener el conteo de vestings:", e);
                // Continuamos con el método normal si falla
              }
            }
            
            // Obtener la lista de IDs de vesting para el holder
            const vestingIds = await contract.getVestingListByHolder(walletAddress);
            console.log("IDs de vesting obtenidos:", vestingIds);
            
            // Verificar la estructura de los datos
            console.log("Tipo de vestingIds:", typeof vestingIds);
            console.log("Es Array:", Array.isArray(vestingIds));
            console.log("Longitud:", vestingIds.length);
            
            // Intentar extraer información directamente de la respuesta
            const vestingSchedules = [];
            
            // Si vestingIds es un objeto con propiedades numéricas (como un array-like)
            if (vestingIds && typeof vestingIds === 'object') {
              // Determinar cuántos elementos hay
              let numItems = 0;
              
              if (Array.isArray(vestingIds)) {
                numItems = vestingIds.length;
              } else {
                numItems = Object.keys(vestingIds)
                  .filter(key => !isNaN(Number(key)))
                  .length;
              }
              
              console.log("Número de elementos detectados:", numItems);
              
              if (numItems === 0) {
                console.log(`La dirección ${walletAddress} no tiene vestings en este contrato (array vacío)`);
                return [];
              }
              
              for (let i = 0; i < numItems; i++) {
                try {
                  // Intentar extraer información directamente
                  console.log("Elemento", i, ":", vestingIds[i]);
                  
                  // Intentar extraer el ID de vesting (puede estar en diferentes formatos)
                  let vestingId;
                  if (vestingIds[i] && typeof vestingIds[i] === 'object') {
                    // Puede ser un objeto con el ID en la primera posición
                    if (vestingIds[i][0]) {
                      vestingId = vestingIds[i][0];
                    } 
                    // O puede tener propiedades específicas
                    else if (vestingIds[i].id) {
                      vestingId = vestingIds[i].id;
                    }
                    // Si es un objeto con propiedades numéricas, tomamos la primera
                    else if (Object.keys(vestingIds[i]).some(k => !isNaN(Number(k)))) {
                      vestingId = vestingIds[i][0];
                    }
                    // Intentar con vestingId directamente
                    else if (vestingIds[i].vestingId) {
                      vestingId = vestingIds[i].vestingId;
                    }
                  } else if (typeof vestingIds[i] === 'string') {
                    // Si es directamente un string
                    vestingId = vestingIds[i];
                  } else if (typeof vestingIds[i] === 'bigint' || typeof vestingIds[i] === 'number') {
                    // Si es un número o bigint
                    vestingId = vestingIds[i].toString();
                  }
                  
                  if (!vestingId) {
                    console.warn("No se pudo determinar el ID de vesting para el elemento", i);
                    continue;
                  }
                  
                  console.log("Procesando vesting ID:", vestingId);
                  
                  // Intentar obtener información directamente del objeto si ya contiene los datos
                  let schedule;
                  if (vestingIds[i] && typeof vestingIds[i] === 'object' && 
                      (vestingIds[i].amount || vestingIds[i].amountTotal || vestingIds[i][5])) {
                    // El objeto ya contiene la información que necesitamos
                    console.log("Usando información de vesting directamente del objeto");
                    schedule = vestingIds[i];
                  } else {
                    // Necesitamos hacer una llamada adicional para obtener el schedule
                    try {
                      schedule = await contract.getVestingSchedule(vestingId);
                      console.log("Vesting schedule para ID", vestingId, ":", schedule);
                    } catch (e) {
                      console.warn("Error al obtener schedule para ID", vestingId, ":", e);
                      // Intentar con otro formato si falla
                      try {
                        // Algunos contratos esperan un bytes32 en lugar de string
                        if (typeof vestingId === 'string' && vestingId.startsWith('0x')) {
                          console.log("Intentando con formato bytes32...");
                          schedule = await contract.getVestingSchedule(ethers.zeroPadValue(vestingId, 32));
                        } else {
                          throw new Error("Formato de ID no compatible");
                        }
                      } catch (e2) {
                        console.warn("Error en segundo intento:", e2);
                        continue;
                      }
                    }
                  }
                  
                  if (!schedule) {
                    console.warn("No se pudo obtener schedule para ID", vestingId);
                    continue;
                  }
                  
                  // Extraer los valores del schedule (adaptando a diferentes formatos posibles)
                  // Para el contrato Vottun específico, sabemos que los campos están en posiciones específicas
                  // o con nombres específicos
                  const totalAmount = schedule.amountTotal || schedule.amount || schedule[5] || BigInt(0);
                  const startTime = Number(schedule.start || schedule.startTime || schedule[3] || 0);
                  const duration = Number(schedule.duration || schedule[4] || 0);
                  const endTime = startTime + duration;
                  const cliff = Number(schedule.cliff || 0);
                  const slicePeriodSeconds = Number(schedule.slicePeriodSeconds || schedule[6] || 0);
                  const revocable = schedule.revocable || schedule[9] || false;
                  const released = schedule.released || schedule[7] || BigInt(0);
                  
                  // Para este contrato específico, podemos calcular aproximadamente
                  const currentTime = Math.floor(Date.now() / 1000);
                  let vestedAmount = BigInt(0);
                  
                  if (currentTime >= startTime) {
                    if (currentTime >= endTime) {
                      // Si ya pasó el tiempo total, todo está liberado
                      vestedAmount = totalAmount;
                    } else {
                      // Calcular proporción liberada
                      const timeFromStart = currentTime - startTime;
                      const vestedPortion = timeFromStart / duration;
                      vestedAmount = (totalAmount * BigInt(Math.floor(vestedPortion * 1000000))) / BigInt(1000000);
                    }
                  }
                  
                  // Calcular monto reclamable (liberado menos lo ya reclamado)
                  const claimableAmount = vestedAmount > released ? vestedAmount - released : BigInt(0);
                  
                  // Calcular el monto restante
                  const remainingAmount = totalAmount - vestedAmount;
                  
                  vestingSchedules.push({
                    vestingId: vestingId,
                    totalAmount: ethers.formatUnits(totalAmount, tokenDecimals),
                    vestedAmount: ethers.formatUnits(vestedAmount, tokenDecimals),
                    claimableAmount: ethers.formatUnits(claimableAmount, tokenDecimals),
                    remainingAmount: ethers.formatUnits(remainingAmount, tokenDecimals),
                    releasedAmount: ethers.formatUnits(released, tokenDecimals), // Tokens ya reclamados
                    startTime: startTime,
                    endTime: endTime,
                    cliff: cliff,
                    slicePeriodSeconds: slicePeriodSeconds,
                    revocable: revocable
                  });
                } catch (e) {
                  console.warn("Error al procesar vesting ID", i, ":", e);
                }
              }
              
              if (vestingSchedules.length > 0) {
                // Devolver información para todos los vestings encontrados
                return vestingSchedules.map(schedule => ({
                  tokenAddress,
                  tokenSymbol,
                  tokenName,
                  vestingContract: vestingContractAddress,
                  ...schedule
                }));
              }
            } else {
              console.warn("No se encontraron IDs de vesting para el holder o formato no reconocido:", walletAddress);
            }
          } catch (e) {
            console.warn("Error al obtener lista de vestings:", e);
          }
        }
        
        // Verificar si tiene métodos específicos y obtener la información correspondiente
        if (abiMethods.some((fn: any) => typeof fn === 'object' && fn.name === 'getVestingSchedule')) {
          // Tipo con getVestingSchedule
          console.log("Detectado método getVestingSchedule");
          
          try {
            const schedule = await contract.getVestingSchedule(walletAddress);
            
            let nextUnlockTime, nextUnlockAmount;
            if (abiMethods.some((fn: any) => typeof fn === 'object' && fn.name === 'getNextUnlock')) {
              try {
                const nextUnlock = await contract.getNextUnlock(walletAddress);
                nextUnlockTime = Number(nextUnlock.timestamp);
                nextUnlockAmount = ethers.formatUnits(nextUnlock.amount, tokenDecimals);
              } catch (e) {
                console.warn("No se pudo obtener próximo desbloqueo:", e);
              }
            }
            
            vestingInfo = {
              totalAmount: ethers.formatUnits(schedule.totalAmount, tokenDecimals),
              vestedAmount: ethers.formatUnits(schedule.vestedAmount, tokenDecimals),
              claimableAmount: ethers.formatUnits(schedule.claimableAmount, tokenDecimals),
              remainingAmount: ethers.formatUnits(schedule.remainingAmount, tokenDecimals),
              releasedAmount: ethers.formatUnits(schedule.released || BigInt(0), tokenDecimals), // Tokens ya reclamados
              startTime: Number(schedule.startTime),
              endTime: Number(schedule.endTime),
              ...(nextUnlockTime && { nextUnlockTime }),
              ...(nextUnlockAmount && { nextUnlockAmount })
            };
          } catch (e) {
            console.warn("Error al obtener vesting schedule:", e);
          }
        } 
        else if (abiMethods.some((fn: any) => typeof fn === 'object' && (fn.name === 'vestingAmount' || fn.name === 'getVestingAmount'))) {
          // Tipo Vottun - Contrato específico
          console.log("Probando contrato Tipo Vottun");
          try {
            const totalAmount = await contract.vestingAmount(walletAddress);
            const startTime = Number(await contract.vestingStart(walletAddress));
            const duration = Number(await contract.vestingDuration(walletAddress));
            const cliff = Number(await contract.vestingCliff(walletAddress));
            const released = await contract.released(walletAddress);
            const releasable = await contract.releasable(walletAddress);
            
            const endTime = startTime + duration;
            const cliffEndTime = startTime + cliff;
            
            vestingInfo = {
              totalAmount: ethers.formatUnits(totalAmount, tokenDecimals),
              vestedAmount: ethers.formatUnits(released, tokenDecimals),
              claimableAmount: ethers.formatUnits(releasable, tokenDecimals),
              remainingAmount: ethers.formatUnits(totalAmount - released - releasable, tokenDecimals),
              releasedAmount: ethers.formatUnits(released, tokenDecimals), 
              startTime: startTime,
              endTime: endTime,
              cliffEndTime: cliffEndTime
            };
          } catch (e) {
            console.warn("Error al obtener información de vesting:", e);
          }
        }
        
        // Si encontramos información de vesting, la devolvemos
        if (vestingInfo) {
          return [{
            tokenAddress,
            tokenSymbol,
            tokenName,
            vestingContract: vestingContractAddress,
            ...vestingInfo
          }];
        }
      } catch (e) {
        console.warn("Error al usar ABI de BaseScan:", e);
        // Si hay un error, continuamos con nuestros ABIs predefinidos
      }
    }
    
    // Si no pudimos obtener el ABI desde BaseScan o hubo un error, usamos nuestros ABIs predefinidos
    console.log('Usando ABIs predefinidos...');
    
    // Intentamos con diferentes ABIs comunes para contratos de vesting
    // Esta es una lista más completa de posibles funciones en contratos de vesting
    const vestingABIs = [
      // ABI específico para el contrato Vottun (0x3e0ef51811B647E00A85A7e5e495fA4763911982)
      [
        "function token() view returns (address)",
        "function vestingAmount(address) view returns (uint256)",
        "function vestingStart(address) view returns (uint256)",
        "function vestingDuration(address) view returns (uint256)",
        "function vestingCliff(address) view returns (uint256)",
        "function released(address) view returns (uint256)",
        "function releasable(address) view returns (uint256)",
        "function vestingBeneficiary(address) view returns (address)"
      ],
      // ABI Tipo 1 - Estilo OpenZeppelin VestingWallet
      [
        "function beneficiary() view returns (address)",
        "function token() view returns (address)",
        "function start() view returns (uint256)",
        "function duration() view returns (uint256)",
        "function released() view returns (uint256)",
        "function releasable() view returns (uint256)",
        "function vestedAmount(uint64) view returns (uint256)"
      ],
      // ABI Tipo 2 - Estilo personalizado con getVestingSchedule
      [
        "function getVestingSchedule(address beneficiary) view returns (uint256 totalAmount, uint256 vestedAmount, uint256 claimableAmount, uint256 remainingAmount, uint256 startTime, uint256 endTime)",
        "function getNextUnlock(address beneficiary) view returns (uint256 timestamp, uint256 amount)",
        "function token() view returns (address)"
      ],
      // ABI Tipo 3 - Estilo con cliff
      [
        "function token() view returns (address)",
        "function cliff() view returns (uint256)",
        "function start() view returns (uint256)",
        "function duration() view returns (uint256)",
        "function released(address) view returns (uint256)",
        "function releasableAmount(address) view returns (uint256)",
        "function totalAmount(address) view returns (uint256)"
      ]
    ];
    
    // Información que intentaremos obtener
    let tokenAddress;
    let vestingInfo = null;
    let tokenContract;
    let tokenName;
    let tokenSymbol;
    let tokenDecimals;
    
    // Probar cada ABI hasta encontrar uno que funcione
    for (const abi of vestingABIs) {
      try {
        const contract = new ethers.Contract(vestingContractAddress, abi, provider);
        
        // Intentar obtener la dirección del token
        try {
          tokenAddress = await contract.token();
          console.log("Encontrado método token()", tokenAddress);
        } catch (e) {
          // Si no tiene método token(), intentamos otras opciones
          console.log("No se encontró método token(), probando alternativas");
          continue;
        }
        
        // Si llegamos aquí, tenemos un contrato que al menos tiene token()
        // Ahora intentamos obtener información del token
        const tokenABI = [
          "function name() view returns (string)",
          "function symbol() view returns (string)",
          "function decimals() view returns (uint8)"
        ];
        
        tokenContract = new ethers.Contract(tokenAddress, tokenABI, provider);
        
        try {
          tokenName = await tokenContract.name();
          tokenSymbol = await tokenContract.symbol();
          tokenDecimals = await tokenContract.decimals();
          console.log("Información del token obtenida:", tokenName, tokenSymbol, tokenDecimals);
        } catch (e) {
          console.warn("Error al obtener información del token:", e);
          // Usamos valores por defecto si no podemos obtener la información
          tokenName = "Token Desconocido";
          tokenSymbol = "???";
          tokenDecimals = 18;
        }
        
        // Ahora intentamos obtener información de vesting según el tipo de contrato
        if (abi.some((fn: any) => typeof fn === 'object' && fn.name === 'getVestingSchedule')) {
          // Tipo 2 - Con getVestingSchedule
          console.log("Probando contrato Tipo 2 (getVestingSchedule)");
          
          try {
            const schedule = await contract.getVestingSchedule(walletAddress);
            
            let nextUnlockTime, nextUnlockAmount;
            if (abi.some((fn: any) => typeof fn === 'object' && fn.name === 'getNextUnlock')) {
              try {
                const nextUnlock = await contract.getNextUnlock(walletAddress);
                nextUnlockTime = Number(nextUnlock.timestamp);
                nextUnlockAmount = ethers.formatUnits(nextUnlock.amount, tokenDecimals);
              } catch (e) {
                console.warn("No se pudo obtener próximo desbloqueo:", e);
              }
            }
            
            vestingInfo = {
              totalAmount: ethers.formatUnits(schedule.totalAmount, tokenDecimals),
              vestedAmount: ethers.formatUnits(schedule.vestedAmount, tokenDecimals),
              claimableAmount: ethers.formatUnits(schedule.claimableAmount, tokenDecimals),
              remainingAmount: ethers.formatUnits(schedule.remainingAmount, tokenDecimals),
              releasedAmount: ethers.formatUnits(schedule.released || BigInt(0), tokenDecimals), // Tokens ya reclamados
              startTime: Number(schedule.startTime),
              endTime: Number(schedule.endTime),
              ...(nextUnlockTime && { nextUnlockTime }),
              ...(nextUnlockAmount && { nextUnlockAmount })
            };
            break;
          } catch (e) {
            console.warn("Error al probar ABI:", e);
            continue;
          }
        } 
        else if (abi.some((fn: any) => typeof fn === 'object' && (fn.name === 'vestingAmount' || fn.name === 'getVestingAmount'))) {
          // Tipo Vottun - Contrato específico
          console.log("Probando contrato Tipo Vottun");
          try {
            const totalAmount = await contract.vestingAmount(walletAddress);
            const startTime = Number(await contract.vestingStart(walletAddress));
            const duration = Number(await contract.vestingDuration(walletAddress));
            const cliff = Number(await contract.vestingCliff(walletAddress));
            const released = await contract.released(walletAddress);
            const releasable = await contract.releasable(walletAddress);
            
            const endTime = startTime + duration;
            const cliffEndTime = startTime + cliff;
            
            vestingInfo = {
              totalAmount: ethers.formatUnits(totalAmount, tokenDecimals),
              vestedAmount: ethers.formatUnits(released, tokenDecimals),
              claimableAmount: ethers.formatUnits(releasable, tokenDecimals),
              remainingAmount: ethers.formatUnits(totalAmount - released - releasable, tokenDecimals),
              releasedAmount: ethers.formatUnits(released, tokenDecimals), 
              startTime: startTime,
              endTime: endTime,
              cliffEndTime: cliffEndTime
            };
            break;
          } catch (e) {
            console.warn("Error al probar ABI:", e);
            continue;
          }
        }
        else if (abi.some((fn: any) => typeof fn === 'object' && fn.name === 'cliff')) {
          // Tipo 3 - Estilo con cliff
          console.log("Probando contrato Tipo 3 (con cliff)");
          try {
            const start = Number(await contract.start());
            const cliff = Number(await contract.cliff());
            const duration = Number(await contract.duration());
            const totalAmount = await contract.totalAmount(walletAddress);
            const released = await contract.released(walletAddress);
            let releasable;
            
            try {
              releasable = await contract.releasableAmount(walletAddress);
            } catch (e) {
              // Si no hay método releasableAmount, calculamos una aproximación
              const currentTime = Math.floor(Date.now() / 1000);
              const timeFromStart = currentTime - start;
              if (timeFromStart < cliff) {
                releasable = BigInt(0);
              } else if (timeFromStart >= duration) {
                releasable = totalAmount - released;
              } else {
                const vestedPortion = timeFromStart / duration;
                const vestedAmount = (totalAmount * BigInt(Math.floor(vestedPortion * 1000000))) / BigInt(1000000);
                releasable = vestedAmount - released;
              }
            }
            
            const endTime = start + duration;
            const cliffEnd = start + cliff;
            
            vestingInfo = {
              totalAmount: ethers.formatUnits(totalAmount, tokenDecimals),
              vestedAmount: ethers.formatUnits(released, tokenDecimals),
              claimableAmount: ethers.formatUnits(releasable, tokenDecimals),
              remainingAmount: ethers.formatUnits(totalAmount - released - releasable, tokenDecimals),
              releasedAmount: ethers.formatUnits(released, tokenDecimals), 
              startTime: start,
              endTime: endTime,
              cliffEndTime: cliffEnd
            };
            break;
          } catch (e) {
            console.warn("Error al probar ABI:", e);
            continue;
          }
        }
        else {
          // Tipo 1 - Estilo OpenZeppelin
          console.log("Probando contrato Tipo 1 (OpenZeppelin)");
          try {
            const start = Number(await contract.start());
            const duration = Number(await contract.duration());
            const released = await contract.released();
            const releasable = await contract.releasable();
            
            // Para obtener el total, necesitamos calcular el vested amount al final del período
            const currentTime = Math.floor(Date.now() / 1000);
            const endTime = start + duration;
            
            // Calculamos el total sumando lo liberado y lo que se puede liberar
            const totalAmount = await contract.vestedAmount(BigInt(endTime));
            
            vestingInfo = {
              totalAmount: ethers.formatUnits(totalAmount, tokenDecimals),
              vestedAmount: ethers.formatUnits(released, tokenDecimals),
              claimableAmount: ethers.formatUnits(releasable, tokenDecimals),
              remainingAmount: ethers.formatUnits(totalAmount - released - releasable, tokenDecimals),
              releasedAmount: ethers.formatUnits(released, tokenDecimals), 
              startTime: start,
              endTime: endTime
            };
            break;
          } catch (e) {
            console.warn("Error al probar ABI:", e);
            continue;
          }
        }
      } catch (e) {
        console.warn("Error al probar ABI:", e);
        // Continuamos con el siguiente ABI
        continue;
      }
    }
    
    // Si no encontramos información de vesting, devolvemos array vacío
    if (!vestingInfo) {
      console.warn("No se pudo obtener información de vesting con ninguno de los ABIs probados");
      return [];
    }
    
    // Crear objeto con la información de vesting
    return [{
      tokenAddress,
      tokenSymbol,
      tokenName,
      vestingContract: vestingContractAddress,
      ...vestingInfo
    }];
  } catch (error) {
    console.error('Error al obtener información de vesting desde la blockchain:', error);
    // Si hay un error específico con el contrato, podemos devolver un array vacío
    // para indicar que no hay información de vesting disponible
    return [];
  }
}

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

    // Crear proveedor de Ethereum
    const provider = new ethers.JsonRpcProvider(networkConfig.rpcUrl);
    
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
          const abiMethods = contractABI.filter((item: any) => item.type === 'function').map((item: any) => item.name);
          console.log("Métodos disponibles en el ABI:", abiMethods);
          
          // Determinar el tipo de contrato de vesting basado en los métodos disponibles
          if (abiMethods.some((fn: any) => typeof fn === 'object' && fn.name === 'getVestingSchedulesCount') && abiMethods.some((fn: any) => typeof fn === 'object' && fn.name === 'getVestingScheduleById')) {
            result.contractType = 'VestingSchedules';
          } else if (abiMethods.some((fn: any) => typeof fn === 'object' && fn.name === 'getVestingListByHolder')) {
            result.contractType = 'Vottun';
          } else if (abiMethods.some((fn: any) => typeof fn === 'object' && fn.name === 'vestingSchedules')) {
            result.contractType = 'OpenZeppelin';
          }
          
          console.log("Tipo de contrato detectado:", result.contractType);
          
          // Intentar obtener la dirección del token usando diferentes métodos
          const tokenMethods = ['token', 'getToken', 'tokenAddress'];
          for (const method of tokenMethods) {
            if (abiMethods.some((fn: any) => typeof fn === 'object' && fn.name === method)) {
              try {
                result.tokenAddress = await contract[method]();
                console.log(`Dirección del token obtenida con ${method}():`, result.tokenAddress);
                break;
              } catch (e) {
                console.warn(`Error al obtener dirección del token con ${method}():`, e);
              }
            }
          }
          
          // Si no pudimos obtener la dirección del token, intentamos buscar transferencias de tokens
          if (!result.tokenAddress) {
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
                  address: normalizedContractAddress,
                  sort: 'asc', // Ordenar por antigüedad para ver primero las más antiguas
                  apikey: apiKey || 'YourApiKeyToken' // Usar clave API por defecto si no hay una configurada
                }
              });
              
              if (response.data.status === '1' && Array.isArray(response.data.result) && response.data.result.length > 0) {
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
                result.tokenSymbol = await tokenContract.symbol();
                result.tokenDecimals = await tokenContract.decimals();
                console.log("Información del token obtenida:", result.tokenName, result.tokenSymbol, result.tokenDecimals);
              } catch (e) {
                console.warn("Error al obtener información del token:", e);
                // Usamos valores por defecto si no podemos obtener la información
                if (!result.tokenName) result.tokenName = "Token Desconocido";
                if (!result.tokenSymbol) result.tokenSymbol = "???";
              }
            } catch (e) {
              console.warn("Error al crear contrato de token:", e);
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
            
            // Si el contrato tiene el método getVestingListByHolder, usarlo para obtener información exacta
            if (hasGetVestingListByHolder) {
              console.log("Usando getVestingListByHolder para obtener información exacta de vesting");
              
              // Usar la función auxiliar para procesar los beneficiarios con getVestingListByHolder
              const exactVestingInfo = await processVestingWithGetVestingListByHolder(
                contract,
                beneficiaries,
                contractABI,
                result.tokenDecimals
              );
              
              // Actualizar el resultado con la información exacta
              result.beneficiaries = exactVestingInfo.beneficiaries;
              result.totalSchedulesCreated = exactVestingInfo.totalSchedulesCreated;
              
              if (exactVestingInfo.releasableTokens && parseFloat(exactVestingInfo.releasableTokens) > 0) {
                result.releasableTokens = exactVestingInfo.releasableTokens;
              }
              
              // Si ya procesamos los beneficiarios, no necesitamos continuar
              return result;
            }
            
            // Intentar obtener información de vesting directamente desde el historial de transacciones
            // Esto es útil para contratos que no exponen métodos para obtener información de vesting
            try {
              const apiKey = process.env.NEXT_PUBLIC_BASESCAN_API_KEY || '';
              const response = await axios.get(networkConfig.explorerApiUrl, {
                params: {
                  module: 'account',
                  action: 'tokentx',
                  address: normalizedContractAddress.toLowerCase(),
                  sort: 'asc',
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
                      endTime: daysDiff > 30 ? Math.floor(lastTx.timestamp / 1000) : Math.floor(firstTx.timestamp / 1000) + 365 * 24 * 60 * 60, // 1 año por defecto
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
                      ...(schedule.cliff && { cliff: Number(schedule.cliff) }),
                      ...(schedule.slicePeriodSeconds && { slicePeriodSeconds: Number(schedule.slicePeriodSeconds) })
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
    console.error(`Error al verificar el estado del contrato de vesting ${vestingContractAddress}:`, error);
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
    const networkConfig = NETWORKS[network as keyof typeof NETWORKS];
    const apiKey = process.env.NEXT_PUBLIC_BASESCAN_API_KEY || '';
    
    const response = await axios.get(networkConfig.explorerApiUrl, {
      params: {
        module: 'account',
        action: 'tokentx',
        address: contractAddress.toLowerCase(),
        sort: 'desc',
        apikey: apiKey
      }
    });
    
    if (response.data.status === '1' && Array.isArray(response.data.result)) {
      // Extraer direcciones únicas que han recibido tokens del contrato
      const beneficiaries = new Set<string>();
      
      // Guardar la información de cada transacción para analizar múltiples vestings
      const vestingTransactions: Record<string, any[]> = {};
      
      response.data.result.forEach((tx: any) => {
        if (tx.from.toLowerCase() === contractAddress.toLowerCase()) {
          const beneficiary = tx.to.toLowerCase();
          beneficiaries.add(beneficiary);
          
          // Guardar la transacción para este beneficiario
          if (!vestingTransactions[beneficiary]) {
            vestingTransactions[beneficiary] = [];
          }
          vestingTransactions[beneficiary].push(tx);
        }
      });
      
      console.log("Transacciones de vesting por beneficiario:", vestingTransactions);
      
      // Analizar si hay beneficiarios con múltiples vestings
      // Si un beneficiario tiene múltiples transacciones separadas por más de 1 día,
      // es posible que tenga múltiples vestings
      const beneficiariesWithMultipleVestings: string[] = [];
      
      Object.entries(vestingTransactions).forEach(([beneficiary, transactions]) => {
        if (transactions.length > 1) {
          // Ordenar transacciones por timestamp
          transactions.sort((a, b) => parseInt(a.timeStamp) - parseInt(b.timeStamp));
          
          // Verificar si hay transacciones separadas por más de 1 día (86400 segundos)
          for (let i = 1; i < transactions.length; i++) {
            const timeDiff = parseInt(transactions[i].timeStamp) - parseInt(transactions[i-1].timeStamp);
            if (timeDiff > 86400) {
              // Es probable que sean vestings diferentes
              beneficiariesWithMultipleVestings.push(beneficiary);
              console.log(`Posible múltiple vesting para ${beneficiary}: ${transactions.length} transacciones, diferencia de tiempo: ${timeDiff} segundos`);
              break;
            }
          }
        }
      });
      
      if (beneficiariesWithMultipleVestings.length > 0) {
        console.log("Beneficiarios con posibles múltiples vestings:", beneficiariesWithMultipleVestings);
      }
      
      return Array.from(beneficiaries);
    }
    
    return [];
  } catch (e) {
    console.warn("Error al obtener beneficiarios:", e);
    return [];
  }
}

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
    console.error('Error al obtener ABI desde BaseScan:', error);
    return null;
  }
}
