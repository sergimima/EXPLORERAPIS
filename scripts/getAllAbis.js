// Script para obtener todos los ABIs de los contratos de vesting
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Cargar variables de entorno
dotenv.config();

// Lista de todos los contratos de vesting (obtenidos de VestingInfo.tsx)
const vestingContracts = [
  "0xa699Cf416FFe6063317442c3Fbd0C39742E971c5",
  "0x3e0ef51811B647E00A85A7e5e495fA4763911982",
  "0xE521B2929DD28a725603bCb6F4009FBb656C4b15",
  "0x3a7cf4cCC76bb23Cf15845B0d4f05BafF1D478cF",
  "0x417Fc9c343210AA52F0b19dbf4EecBD786139BC1",
  "0xFC750D874077F8c90858cC132e0619CE7571520b",
  "0xde68AD324aafD9F2b6946073C90ED5e61D5d51B8",
  "0xC4CE5cFea2B6e32Ad41973348AC70EB3b00D8e6d",
  "0xe507e342c2225ed4141a2b9b3e6bf74a1f3dfcaf",
  "0x7BBDa50bE87DFf935782C80D4222D46490F242A1",
  "0x1808CF66F69DC1B8217d1C655fBD134B213AE358"
];

// Eliminar duplicados (normalizando a minúsculas)
const allContracts = [...new Set(vestingContracts.map(addr => addr.toLowerCase()))].map(addr => addr);

console.log(`=== INICIO DEL PROCESO ===`);
console.log(`Total de contratos a procesar: ${allContracts.length}`);

// Función para obtener el ABI de un contrato
async function getContractABI(contractAddress) {
  const apiKey = process.env.NEXT_PUBLIC_BASESCAN_API_KEY;
  if (!apiKey) {
    console.error('ERROR: API key no encontrada. Define NEXT_PUBLIC_BASESCAN_API_KEY en el archivo .env o como variable de entorno.');
    process.exit(1);
  }

  const url = `https://api.basescan.org/api?module=contract&action=getabi&address=${contractAddress}&apikey=${apiKey}`;
  
  try {
    console.log(`\n[${new Date().toLocaleTimeString()}] Obteniendo ABI para ${contractAddress}...`);
    const response = await axios.get(url);
    
    if (response.data.status === '1') {
      console.log(`✅ ABI obtenido correctamente para ${contractAddress}`);
      const abi = JSON.parse(response.data.result);
      return abi;
    } else {
      console.error(`❌ Error al obtener ABI para ${contractAddress}: ${response.data.message}`);
      return null;
    }
  } catch (error) {
    console.error(`❌ Error en la solicitud para ${contractAddress}:`, error.message);
    return null;
  }
}

// Función para guardar el ABI en un archivo
function saveABI(contractAddress, abi) {
  const fileName = `abi_${contractAddress}.json`;
  const filePath = path.join(__dirname, '..', 'abis', fileName);
  
  // Crear directorio si no existe
  const abiDir = path.join(__dirname, '..', 'abis');
  if (!fs.existsSync(abiDir)) {
    fs.mkdirSync(abiDir, { recursive: true });
  }
  
  fs.writeFileSync(filePath, JSON.stringify(abi, null, 2));
  console.log(`💾 ABI guardado en ${fileName}`);
}

// Función para generar el archivo contractAbis.ts
function generateContractAbisFile(abis) {
  const filePath = path.join(__dirname, '..', 'src', 'lib', 'contractAbis.ts');
  
  let content = `/**
 * ABIs de contratos precargados para evitar llamadas a la API
 * Estos ABIs fueron obtenidos directamente de BaseScan
 */

export const VESTING_CONTRACT_ABIS: Record<string, any> = {
`;

  // Añadir cada contrato con su ABI
  Object.entries(abis).forEach(([address, abi]) => {
    content += `  // Contrato: ${address}\n`;
    content += `  "${address}": ${JSON.stringify(abi)},\n\n`;
  });

  // Cerrar el objeto
  content = content.slice(0, -2); // Eliminar la última coma y salto de línea
  content += `\n};\n\n`;

  // Añadir el ABI por defecto
  content += `// ABI por defecto para contratos sin ABI específico
export const DEFAULT_VESTING_ABI = [
  {"inputs":[{"internalType":"address","name":"_token","type":"address"}],"stateMutability":"nonpayable","type":"constructor"},
  {"inputs":[],"name":"token","outputs":[{"internalType":"contract IERC20","name":"","type":"address"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"internalType":"address","name":"_beneficiary","type":"address"}],"name":"getHolderVestingCount","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"internalType":"address","name":"holder","type":"address"}],"name":"getVestingListByHolder","outputs":[{"components":[{"internalType":"string","name":"id","type":"string"},{"internalType":"address","name":"beneficiary","type":"address"},{"internalType":"uint256","name":"cliff","type":"uint256"},{"internalType":"uint256","name":"start","type":"uint256"},{"internalType":"uint256","name":"duration","type":"uint256"},{"internalType":"uint256","name":"amountTotal","type":"uint256"},{"internalType":"uint256","name":"slicePeriodSeconds","type":"uint256"},{"internalType":"uint256","name":"released","type":"uint256"},{"internalType":"uint256","name":"releasable","type":"uint256"},{"internalType":"bool","name":"revocable","type":"bool"},{"internalType":"bool","name":"revoked","type":"bool"}],"internalType":"struct TokenVesting.VestingSchedule[]","name":"","type":"tuple[]"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"internalType":"string","name":"vestingId","type":"string"}],"name":"getVestingSchedule","outputs":[{"components":[{"internalType":"string","name":"id","type":"string"},{"internalType":"address","name":"beneficiary","type":"address"},{"internalType":"uint256","name":"cliff","type":"uint256"},{"internalType":"uint256","name":"start","type":"uint256"},{"internalType":"uint256","name":"duration","type":"uint256"},{"internalType":"uint256","name":"amountTotal","type":"uint256"},{"internalType":"uint256","name":"slicePeriodSeconds","type":"uint256"},{"internalType":"uint256","name":"released","type":"uint256"},{"internalType":"uint256","name":"releasable","type":"uint256"},{"internalType":"bool","name":"revocable","type":"bool"},{"internalType":"bool","name":"revoked","type":"bool"}],"internalType":"struct TokenVesting.VestingSchedule","name":"","type":"tuple"}],"stateMutability":"view","type":"function"}
];`;

  fs.writeFileSync(filePath, content);
  console.log(`\n📄 Archivo contractAbis.ts generado en src/lib/contractAbis.ts`);
}

// Función principal
async function main() {
  const abis = {};
  
  // Procesar cada contrato
  for (const contract of allContracts) {
    const abi = await getContractABI(contract);
    if (abi) {
      abis[contract] = abi;
      saveABI(contract, abi);
    }
    
    // Esperar 3 segundos entre solicitudes para no sobrecargar la API
    console.log(`⏳ Esperando 3 segundos antes de la siguiente solicitud...`);
    await new Promise(resolve => setTimeout(resolve, 3000));
  }
  
  // Generar el archivo contractAbis.ts
  generateContractAbisFile(abis);
  
  console.log('\n=== PROCESO COMPLETADO ===');
  console.log(`Se procesaron ${Object.keys(abis).length} de ${allContracts.length} contratos correctamente.`);
}

main().catch(error => {
  console.error('\n❌ ERROR EN EL PROCESO:', error);
  process.exit(1);
});
