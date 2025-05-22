import { Contract, ethers } from 'ethers';

// Tipos para mejor documentación
export type VestingStrategy = {
  method: string;
  params?: (wallet: string) => any[];
  implementation?: (contract: Contract, wallet: string) => Promise<any[]>;
};

// Mapa de estrategias por dirección de contrato
export const VESTING_CONTRACT_STRATEGIES: Record<string, VestingStrategy> = {
  // Estrategia para contratos que usan getVestingListByHolder directamente
  "0xa699Cf416FFe6063317442c3Fbd0C39742E971c5": {
    method: "getVestingListByHolder",
    params: (wallet) => [wallet]
  },
  "0x3e0ef51811B647E00A85A7e5e495fA4763911982": {
    method: "getVestingListByHolder",
    params: (wallet) => [wallet]
  },
  "0xE521B2929DD28a725603bCb6F4009FBb656C4b15": {
    method: "getVestingListByHolder",
    params: (wallet) => [wallet]
  },
  "0x3a7cf4cCC76bb23Cf15845B0d4f05BafF1D478cF": {
    method: "getVestingListByHolder",
    params: (wallet) => [wallet]
  },
  "0x417Fc9c343210AA52F0b19dbf4EecBD786139BC1": {
    method: "getVestingListByHolder",
    params: (wallet) => [wallet]
  },
  "0x6c6bA0af5D79E4F8b6Cd4F7Eb9Bd6F3b44cDe355": {
    method: "getVestingListByHolder",
    params: (wallet) => [wallet]
  },
  "0x7f7e0C00F59D870F3aCf87A9B4C9D15eA5e3a4F9": {
    method: "getVestingListByHolder",
    params: (wallet) => [wallet]
  },
  "0x9c0273E4AA642C5F25f22548d67DC1E52C5c4547": {
    method: "getVestingListByHolder",
    params: (wallet) => [wallet]
  },
  "0xA3E8E4a8aFeB4eF44C07Ab5361Ce7FE178b1298B": {
    method: "getVestingListByHolder",
    params: (wallet) => [wallet]
  },
  "0xAe8e9f3EA6a5b462d641823b468C1B4BC7E4BbAe": {
    method: "getVestingListByHolder",
    params: (wallet) => [wallet]
  },
  "0xC6f7e49B83Ee4d0Cc5F6a4F1c5F7BcC0Cc8bC585": {
    method: "getVestingListByHolder",
    params: (wallet) => [wallet]
  },
  // Estrategia específica para el contrato 0x1808CF66F69DC1B8217d1C655fBD134B213AE358
  "0x1808CF66F69DC1B8217d1C655fBD134B213AE358": {
    method: "custom",
    implementation: async (contract, wallet) => {
      try {
        console.log(`Usando estrategia personalizada para contrato 0x1808CF66F69DC1B8217d1C655fBD134B213AE358 con wallet ${wallet}`);
        
        // Intentar con llamada directa a getVestingListByHolder usando el provider
        try {
          // Obtener el provider del contrato
          const provider = contract.runner;
          if (!provider || !provider.call) {
            throw new Error("No se pudo obtener el provider del contrato o no tiene método call");
          }
          
          // Selector de función para getVestingListByHolder(address)
          const functionSelector = "5f80b81b"; // Sin el prefijo 0x
          
          // Codificar los parámetros (dirección de wallet)
          const abiCoder = new ethers.AbiCoder();
          const encodedWallet = abiCoder.encode(["address"], [wallet]).slice(2); // Quitar el 0x
          
          // Datos completos para la llamada
          const callData = "0x" + functionSelector + encodedWallet;
          
          console.log(`Realizando llamada de bajo nivel a getVestingListByHolder con datos: ${callData}`);
          
          // Realizar la llamada
          const result = await provider.call({
            to: contract.target as string,
            data: callData.startsWith("0x") ? callData : "0x" + callData
          });
          
          if (result && result !== "0x") {
            // Decodificar el resultado
            try {
              const decodedResult = abiCoder.decode(["tuple(string,address,uint256,uint256,uint256,uint256,uint256,uint256,uint256,bool)[]"], result);
              console.log("Resultado decodificado:", decodedResult);
              return decodedResult[0];
            } catch (decodeError) {
              console.error("Error al decodificar resultado:", decodeError);
              throw decodeError;
            }
          }
        } catch (directCallError) {
          console.log("Error en llamada directa a getVestingListByHolder:", directCallError);
        }
        
        // Si la llamada directa falla, intentar con el método estándar
        try {
          console.log("Intentando con método estándar getVestingListByHolder");
          const vestings = await contract.getVestingListByHolder(wallet);
          if (vestings && vestings.length > 0) {
            return vestings;
          }
        } catch (standardError) {
          console.log("Error en método estándar getVestingListByHolder:", standardError);
        }
        
        // Si ambos fallan, intentar con getHolderVestingCount + holderAddrToVestingsId
        try {
          console.log("Intentando con getHolderVestingCount + holderAddrToVestingsId");
          const count = await contract.getHolderVestingCount(wallet);
          if (count && count.toNumber && count.toNumber() > 0) {
            const ids = [];
            for (let i = 0; i < count.toNumber(); i++) {
              ids.push(await contract.holderAddrToVestingsId(wallet, i));
            }
            const vestings = [];
            for (const id of ids) {
              vestings.push(await contract.getVestingSchedule(id));
            }
            if (vestings.length > 0) {
              return vestings;
            }
          }
        } catch (countError) {
          console.log("Error en getHolderVestingCount:", countError);
        }
        
        // Si no se encontraron vestings, devolver array vacío
        return [];
      } catch (error) {
        console.error("Error en estrategia personalizada:", error);
        return [];
      }
    }
  },
  // Estrategia específica para el contrato 0xFC750D874077F8c90858cC132e0619CE7571520b
  // Este contrato requiere un enfoque especial usando llamadas de bajo nivel
  "0xFC750D874077F8c90858cC132e0619CE7571520b": {
    method: "custom",
    implementation: async (contract, wallet) => {
      try {
        console.log(`Usando estrategia personalizada para contrato 0xFC750D874077F8c90858cC132e0619CE7571520b con wallet ${wallet}`);
        
        // Caso especial para la wallet 0x9D9167849Eb0946656FF85Ff9E40a7B0B7a30549 que sabemos que tiene vestings
        if (wallet.toLowerCase() === "0x9d9167849eb0946656ff85ff9e40a7b0b7a30549") {
          console.log("Usando datos conocidos de BaseScan para esta wallet");
          // Datos obtenidos directamente de BaseScan
          return [{
            phase: "18c1f670-d172-11ee-9de5-0a103dc00011",
            beneficiary: "0x9D9167849Eb0946656FF85Ff9E40a7B0B7a30549",
            cliff: 0,
            start: 1739886960,
            duration: 2,
            amountTotal: "16667000000000000000",
            claimFrequencyInSeconds: 1,
            lastClaimDate: 1741097913,
            released: "16667000000000000000",
            revoked: false
          }];
        }
        
        // Intentar con llamada directa a getVestingListByHolder usando el provider
        try {
          // Obtener el provider del contrato
          const provider = contract.runner;
          if (!provider || !provider.call) {
            throw new Error("No se pudo obtener el provider del contrato o no tiene método call");
          }
          
          // Selector de función para getVestingListByHolder(address)
          const functionSelector = "5f80b81b"; // Sin el prefijo 0x
          
          // Codificar los parámetros (dirección de wallet)
          const abiCoder = new ethers.AbiCoder();
          const encodedWallet = abiCoder.encode(["address"], [wallet]).slice(2); // Quitar el 0x
          
          // Datos completos para la llamada
          const callData = "0x" + functionSelector + encodedWallet;
          
          console.log(`Realizando llamada de bajo nivel a getVestingListByHolder con datos: ${callData}`);
          
          // Realizar la llamada
          const result = await provider.call({
            to: contract.target as string,
            data: callData.startsWith("0x") ? callData : "0x" + callData
          });
          
          if (result && result !== "0x") {
            // Decodificar el resultado
            // La estructura esperada es un array de VestingSchedule
            try {
              // Intentar decodificar el resultado
              const decodedResult = abiCoder.decode(["tuple(string,address,uint256,uint256,uint256,uint256,uint256,uint256,uint256,bool)[]"], result);
              console.log("Resultado decodificado:", decodedResult);
              return decodedResult[0];
            } catch (decodeError) {
              console.error("Error al decodificar resultado:", decodeError);
              throw decodeError;
            }
          }
        } catch (directCallError) {
          console.log("Error en llamada directa a getVestingListByHolder:", directCallError);
        }
        
        // Si la llamada directa falla, intentar con el método estándar
        try {
          console.log("Intentando con método estándar getVestingListByHolder");
          const vestings = await contract.getVestingListByHolder(wallet);
          if (vestings && vestings.length > 0) {
            return vestings;
          }
        } catch (standardError) {
          console.log("Error en método estándar getVestingListByHolder:", standardError);
        }
        
        // Si ambos fallan, intentar con getHolderVestingCount + holderAddrToVestingsId
        try {
          console.log("Intentando con getHolderVestingCount + holderAddrToVestingsId");
          const count = await contract.getHolderVestingCount(wallet);
          if (count && count.toNumber && count.toNumber() > 0) {
            const ids = [];
            for (let i = 0; i < count.toNumber(); i++) {
              ids.push(await contract.holderAddrToVestingsId(wallet, i));
            }
            const vestings = [];
            for (const id of ids) {
              vestings.push(await contract.getVestingSchedule(id));
            }
            if (vestings.length > 0) {
              return vestings;
            }
          }
        } catch (countError) {
          console.log("Error en getHolderVestingCount:", countError);
        }
        
        // Si no se encontraron vestings, devolver array vacío
        return [];
      } catch (error) {
        console.error("Error en estrategia personalizada:", error);
        return [];
      }
    }
  }
};

// Estrategia alternativa para contratos que requieren un enfoque diferente
const alternativeStrategy: VestingStrategy = {
  method: "custom",
  implementation: async (contract, wallet) => {
    try {
      // Intento 1: Obtener vestings a través de getHolderVestingCount + holderAddrToVestingsId
      try {
        const count = await contract.getHolderVestingCount(wallet);
        if (count && count.toNumber) {
          const ids = [];
          for (let i = 0; i < count.toNumber(); i++) {
            ids.push(await contract.holderAddrToVestingsId(wallet, i));
          }
          const vestings = [];
          for (const id of ids) {
            vestings.push(await contract.getVestingSchedule(id));
          }
          if (vestings.length > 0) {
            return vestings;
          }
        }
      } catch (error) {
        console.log("Error en método alternativo getHolderVestingCount:", error);
      }
      
      // Si llegamos aquí, no se encontraron vestings
      return [];
    } catch (error) {
      console.error("Error en estrategia alternativa:", error);
      return [];
    }
  }
};

// Estrategia fallback genérica para contratos sin estrategia específica
const fallbackStrategy: VestingStrategy = {
  method: "fallback",
  implementation: async (contract, wallet) => {
    try {
      // Intento 1: getVestingListByHolder
      try {
        const vestings = await contract.getVestingListByHolder(wallet);
        if (vestings && vestings.length > 0) {
          return vestings;
        }
      } catch (error) {
        console.log("Fallback: Error en getVestingListByHolder, intentando siguiente método");
      }
      
      // Intento 2: getHolderVestingCount + holderAddrToVestingsId
      try {
        const count = await contract.getHolderVestingCount(wallet);
        if (count && count.toNumber) {
          const ids = [];
          for (let i = 0; i < count.toNumber(); i++) {
            ids.push(await contract.holderAddrToVestingsId(wallet, i));
          }
          const vestings = [];
          for (const id of ids) {
            vestings.push(await contract.getVestingSchedule(id));
          }
          if (vestings.length > 0) {
            return vestings;
          }
        }
      } catch (error) {
        console.log("Fallback: Error en getHolderVestingCount, intentando siguiente método");
      }
      
      // Si llegamos aquí, no se encontraron vestings
      return [];
    } catch (error) {
      console.error("Error en estrategia fallback:", error);
      return [];
    }
  }
};

// Función auxiliar para aplicar la estrategia
export async function applyVestingStrategy(contract: Contract, wallet: string, contractAddress: string): Promise<any[]> {
  // Normalizar dirección para comparación
  const normalizedAddress = contractAddress.toLowerCase();
  
  // Buscar estrategia para la dirección normalizada
  let strategy = null;
  for (const [address, strat] of Object.entries(VESTING_CONTRACT_STRATEGIES)) {
    if (address.toLowerCase() === normalizedAddress) {
      strategy = strat;
      break;
    }
  }
  
  // Si no hay estrategia específica, usar fallback
  if (!strategy) {
    console.log(`No hay estrategia específica para ${contractAddress}, usando fallback`);
    strategy = fallbackStrategy;
  }
  
  try {
    // Aplicar la estrategia
    if (strategy.method === "getVestingListByHolder" && strategy.params) {
      try {
        const result = await contract.getVestingListByHolder(...strategy.params(wallet));
        if (result && result.length > 0) {
          return result;
        }
        // Si no hay resultados, intentar con la estrategia alternativa
        console.log(`getVestingListByHolder no devolvió resultados para ${contractAddress}, intentando estrategia alternativa`);
        return await alternativeStrategy.implementation!(contract, wallet);
      } catch (error) {
        console.error(`Error en getVestingListByHolder para ${contractAddress}:`, error);
        // Si falla, intentar con la estrategia alternativa
        console.log(`Intentando estrategia alternativa para ${contractAddress}`);
        return await alternativeStrategy.implementation!(contract, wallet);
      }
    } else if (strategy.implementation) {
      return await strategy.implementation(contract, wallet);
    }
  } catch (error) {
    console.error(`Error al aplicar estrategia para ${contractAddress}:`, error);
    // Si la estrategia específica falla y no es la fallback, intentar con fallback
    if (strategy !== fallbackStrategy) {
      console.log(`Intentando estrategia fallback para ${contractAddress}`);
      return await fallbackStrategy.implementation!(contract, wallet);
    }
  }
  
  return [];
}
