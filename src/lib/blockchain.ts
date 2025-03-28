// Importaciones
import axios from 'axios';
import { ethers } from 'ethers';
import { VESTING_CONTRACT_ABIS } from './contractAbis';

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
        if (abiMethods.includes('getVestingSchedule')) {
          // Tipo con getVestingSchedule
          console.log("Detectado método getVestingSchedule");
          
          // Primero verificamos si necesitamos obtener IDs de vesting
          if (abiMethods.includes('getVestingListByHolder')) {
            console.log("El contrato requiere obtener IDs primero con getVestingListByHolder");
            // Este caso ya se manejó en la sección anterior
          } else {
            // Intentamos llamar directamente a getVestingSchedule con la dirección
            try {
              // Verificamos si el método espera un bytes32 o una dirección
              const functionFragment = contract.interface.getFunction('getVestingSchedule');
              console.log("Firma del método getVestingSchedule:", functionFragment?.format() || "No se pudo obtener la firma");
              
              // Si el primer parámetro es bytes32, no podemos usar la dirección directamente
              if (functionFragment && functionFragment.inputs[0].type === 'bytes32') {
                console.warn("getVestingSchedule espera bytes32, no podemos usar la dirección directamente");
                throw new Error("Tipo de parámetro incompatible");
              }
              
              const schedule = await contract.getVestingSchedule(walletAddress);
              
              let nextUnlockTime, nextUnlockAmount;
              if (abiMethods.includes('getNextUnlock')) {
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
        } 
        else if (abiMethods.includes('vestingAmount') || abiMethods.includes('getVestingAmount')) {
          // Tipo con vestingAmount
          console.log("Detectado método vestingAmount o getVestingAmount");
          
          try {
            const vestingAmountMethod = abiMethods.includes('vestingAmount') ? 'vestingAmount' : 'getVestingAmount';
            const vestingStartMethod = abiMethods.includes('vestingStart') ? 'vestingStart' : 
                                      (abiMethods.includes('getVestingStart') ? 'getVestingStart' : null);
            const vestingDurationMethod = abiMethods.includes('vestingDuration') ? 'vestingDuration' : 
                                         (abiMethods.includes('getVestingDuration') ? 'getVestingDuration' : null);
            const vestingCliffMethod = abiMethods.includes('vestingCliff') ? 'vestingCliff' : 
                                      (abiMethods.includes('getVestingCliff') ? 'getVestingCliff' : null);
            const releasedMethod = abiMethods.includes('released') ? 'released' : 
                                  (abiMethods.includes('getVestingReleased') ? 'getVestingReleased' : null);
            const releasableMethod = abiMethods.includes('releasable') || abiMethods.includes('releasableAmount') ? 
                                    (abiMethods.includes('releasable') ? 'releasable' : 'releasableAmount') : null;
            
            // Obtener valores usando los métodos detectados
            const totalAmount = await contract[vestingAmountMethod](walletAddress);
            
            let startTime = 0, duration = 0, cliff = 0, released = BigInt(0), releasable = BigInt(0);
            
            if (vestingStartMethod) {
              startTime = Number(await contract[vestingStartMethod](walletAddress));
            }
            
            if (vestingDurationMethod) {
              duration = Number(await contract[vestingDurationMethod](walletAddress));
            }
            
            if (vestingCliffMethod) {
              cliff = Number(await contract[vestingCliffMethod](walletAddress));
            }
            
            if (releasedMethod) {
              released = await contract[releasedMethod](walletAddress);
            }
            
            if (releasableMethod) {
              releasable = await contract[releasableMethod](walletAddress);
            }
            
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
        if (abi.some(fn => fn.includes("getVestingSchedule"))) {
          // Tipo 2 - Con getVestingSchedule
          console.log("Probando contrato Tipo 2 (getVestingSchedule)");
          
          try {
            const schedule = await contract.getVestingSchedule(walletAddress);
            
            let nextUnlockTime, nextUnlockAmount;
            try {
              const nextUnlock = await contract.getNextUnlock(walletAddress);
              nextUnlockTime = Number(nextUnlock.timestamp);
              nextUnlockAmount = ethers.formatUnits(nextUnlock.amount, tokenDecimals);
            } catch (e) {
              console.warn("No se pudo obtener próximo desbloqueo:", e);
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
        else if (abi.some(fn => fn.includes("vestingAmount"))) {
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
            
            // Calcular el monto restante
            const remainingAmount = totalAmount - released - releasable;
            
            vestingInfo = {
              totalAmount: ethers.formatUnits(totalAmount, tokenDecimals),
              vestedAmount: ethers.formatUnits(released, tokenDecimals),
              claimableAmount: ethers.formatUnits(releasable, tokenDecimals),
              remainingAmount: ethers.formatUnits(remainingAmount, tokenDecimals),
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
        else if (abi.some(fn => fn.includes("cliff"))) {
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
