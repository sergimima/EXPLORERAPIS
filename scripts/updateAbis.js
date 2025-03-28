// Script para actualizar contractAbis.ts con los ABIs obtenidos de BaseScan
const fs = require('fs');
const path = require('path');

// Directorio raíz del proyecto
const rootDir = path.resolve(__dirname, '..');

// Obtener la lista de archivos de ABI
const abiFiles = fs.readdirSync(rootDir).filter(file => file.startsWith('abi_') && file.endsWith('.json'));

// Crear el contenido del archivo contractAbis.ts
let fileContent = `/**
 * ABIs de contratos precargados para evitar llamadas a la API
 * Estos ABIs fueron obtenidos directamente de BaseScan
 */

export const VESTING_CONTRACT_ABIS: Record<string, any> = {\n`;

// Procesar cada archivo de ABI
for (const abiFile of abiFiles) {
  // Extraer la dirección del contrato del nombre del archivo
  const contractAddress = abiFile.replace('abi_', '').replace('.json', '');
  
  // Leer el contenido del archivo
  const abiContent = fs.readFileSync(path.join(rootDir, abiFile), 'utf8');
  
  try {
    // Intentar parsear el JSON
    const abi = JSON.parse(abiContent);
    
    // Añadir el ABI al contenido del archivo
    fileContent += `  // Contrato: ${contractAddress}\n`;
    fileContent += `  "${contractAddress}": ${JSON.stringify(abi, null, 2)},\n\n`;
    
    console.log(`Procesado ABI para ${contractAddress}`);
  } catch (error) {
    console.error(`Error al procesar el ABI para ${contractAddress}:`, error);
  }
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

// Guardar el contenido en el archivo contractAbis.ts
fs.writeFileSync(path.join(rootDir, 'src', 'lib', 'contractAbis.ts'), fileContent);

console.log('ABIs actualizados correctamente en src/lib/contractAbis.ts');
