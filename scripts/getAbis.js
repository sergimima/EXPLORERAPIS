// Script para obtener los ABIs de los contratos de vesting desde BaseScan
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Lista de contratos de vesting
const vestingContracts = [
  "0xa699Cf416FFe6063317442c3Fbd0C39742E971c5",
  "0x3e0ef51811B647E00A85A7e5e495fA4763911982",
  "0xE521B2929DD28a725603bCb6F4009FBb656C4b15",
  "0x3a7cf4cCC76bb23Cf15845B0d4f05BafF1D478cF",
  "0x417Fc9c343210AA52F0b19dbf4EecBD786139BC1",
  "0xFC750D874077F8c90858cC132e0619CE7571520b",
  "0xde68AD324aafD9F2b6946073C90ED5e61D5d51B8",
  "0xC4CE5cFea2B6e32Ad41973348AC70EB3b00D8e6d",
  "0xe507e342c2225ed4141a2b9b3e6bf74a1f3dfcaf"
];

// API key de BaseScan
const apiKey = process.env.NEXT_PUBLIC_BASESCAN_API_KEY || 'R9QA73N9K75VQNPPE1W1VX14W8S83K2JJT';

// Función para obtener el ABI de un contrato
async function getContractABI(contractAddress) {
  try {
    const apiUrl = 'https://api.basescan.org/api';
    
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
      console.log(`ABI obtenido correctamente para ${contractAddress}`);
      return JSON.parse(response.data.result);
    } else {
      console.warn(`Error al obtener ABI para ${contractAddress}:`, response.data.message);
      return null;
    }
  } catch (error) {
    console.error(`Error al obtener ABI para ${contractAddress}:`, error);
    return null;
  }
}

// Función principal
async function main() {
  const abis = {};
  
  // Obtener los ABIs de todos los contratos
  for (const contract of vestingContracts) {
    console.log(`Obteniendo ABI para ${contract}...`);
    const abi = await getContractABI(contract);
    
    if (abi) {
      abis[contract] = abi;
    } else {
      console.warn(`No se pudo obtener el ABI para ${contract}`);
    }
    
    // Esperar un poco entre peticiones para evitar límites de tasa
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // Crear el contenido del archivo
  let fileContent = `/**
 * ABIs de contratos precargados para evitar llamadas a la API
 */

export const VESTING_CONTRACT_ABIS: Record<string, any> = {\n`;
  
  // Añadir cada ABI al contenido
  for (const [contract, abi] of Object.entries(abis)) {
    fileContent += `  // Contrato: ${contract}\n`;
    fileContent += `  "${contract}": ${JSON.stringify(abi, null, 2)},\n\n`;
  }
  
  // Añadir el ABI por defecto
  fileContent += `  // ABI por defecto para contratos sin ABI específico\n`;
  fileContent += `  "default": [\n`;
  fileContent += `    {"inputs":[{"internalType":"address","name":"_token","type":"address"}],"stateMutability":"nonpayable","type":"constructor"},\n`;
  fileContent += `    {"inputs":[],"name":"token","outputs":[{"internalType":"contract IERC20","name":"","type":"address"}],"stateMutability":"view","type":"function"},\n`;
  fileContent += `    {"inputs":[{"internalType":"address","name":"_beneficiary","type":"address"}],"name":"getHolderVestingCount","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},\n`;
  fileContent += `    {"inputs":[{"internalType":"address","name":"holder","type":"address"}],"name":"getVestingListByHolder","outputs":[{"components":[{"internalType":"string","name":"id","type":"string"},{"internalType":"address","name":"beneficiary","type":"address"},{"internalType":"uint256","name":"cliff","type":"uint256"},{"internalType":"uint256","name":"start","type":"uint256"},{"internalType":"uint256","name":"duration","type":"uint256"},{"internalType":"uint256","name":"amountTotal","type":"uint256"},{"internalType":"uint256","name":"slicePeriodSeconds","type":"uint256"},{"internalType":"uint256","name":"released","type":"uint256"},{"internalType":"uint256","name":"releasable","type":"uint256"},{"internalType":"bool","name":"revocable","type":"bool"},{"internalType":"bool","name":"revoked","type":"bool"}],"internalType":"struct TokenVesting.VestingSchedule[]","name":"","type":"tuple[]"}],"stateMutability":"view","type":"function"},\n`;
  fileContent += `    {"inputs":[{"internalType":"string","name":"vestingId","type":"string"}],"name":"getVestingSchedule","outputs":[{"components":[{"internalType":"string","name":"id","type":"string"},{"internalType":"address","name":"beneficiary","type":"address"},{"internalType":"uint256","name":"cliff","type":"uint256"},{"internalType":"uint256","name":"start","type":"uint256"},{"internalType":"uint256","name":"duration","type":"uint256"},{"internalType":"uint256","name":"amountTotal","type":"uint256"},{"internalType":"uint256","name":"slicePeriodSeconds","type":"uint256"},{"internalType":"uint256","name":"released","type":"uint256"},{"internalType":"uint256","name":"releasable","type":"uint256"},{"internalType":"bool","name":"revocable","type":"bool"},{"internalType":"bool","name":"revoked","type":"bool"}],"internalType":"struct TokenVesting.VestingSchedule","name":"","type":"tuple"}],"stateMutability":"view","type":"function"}\n`;
  fileContent += `  ]\n`;
  fileContent += `};\n`;
  
  // Guardar el contenido en el archivo
  fs.writeFileSync(path.join(__dirname, '..', 'src', 'lib', 'contractAbis.ts'), fileContent);
  
  console.log('ABIs guardados correctamente en src/lib/contractAbis.ts');
}

main().catch(console.error);
