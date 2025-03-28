// Script para obtener el ABI de un contrato específico
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Cargar variables de entorno
dotenv.config();

// Verificar que se proporcionó una dirección de contrato
if (process.argv.length < 3) {
  console.error('Uso: node getAbi.js <dirección_contrato>');
  process.exit(1);
}

const contractAddress = process.argv[2];
console.log(`=== OBTENIENDO ABI PARA ${contractAddress} ===`);

// Función para obtener el ABI de un contrato
async function getContractABI(contractAddress) {
  const apiKey = process.env.NEXT_PUBLIC_BASESCAN_API_KEY;
  if (!apiKey) {
    console.error('ERROR: API key no encontrada. Define NEXT_PUBLIC_BASESCAN_API_KEY en el archivo .env o como variable de entorno.');
    process.exit(1);
  }

  const url = `https://api.basescan.org/api?module=contract&action=getabi&address=${contractAddress}&apikey=${apiKey}`;
  
  try {
    console.log(`\n[${new Date().toLocaleTimeString()}] Obteniendo ABI...`);
    const response = await axios.get(url);
    
    if (response.data.status === '1') {
      console.log(`✅ ABI obtenido correctamente`);
      const abi = JSON.parse(response.data.result);
      return abi;
    } else {
      console.error(`❌ Error al obtener ABI: ${response.data.message}`);
      return null;
    }
  } catch (error) {
    console.error(`❌ Error en la solicitud:`, error.message);
    return null;
  }
}

// Función para guardar el ABI en un archivo
function saveABI(contractAddress, abi) {
  // Crear directorio si no existe
  const abiDir = path.join(__dirname, '..', 'abis');
  if (!fs.existsSync(abiDir)) {
    fs.mkdirSync(abiDir, { recursive: true });
  }

  // Guardar ABI individual
  const fileName = `abi_${contractAddress}.json`;
  const filePath = path.join(abiDir, fileName);
  fs.writeFileSync(filePath, JSON.stringify(abi, null, 2));
  console.log(`💾 ABI guardado en abis/${fileName}`);
  
  // Actualizar contractAbis.ts
  updateContractAbisFile(contractAddress, abi);
}

// Función para actualizar el archivo contractAbis.ts
function updateContractAbisFile(contractAddress, abi) {
  const filePath = path.join(__dirname, '..', 'src', 'lib', 'contractAbis.ts');
  
  // Leer el archivo actual
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Buscar la entrada del contrato
  const regex = new RegExp(`"${contractAddress}":\\s*\\[\\]`, 'i');
  
  if (regex.test(content)) {
    // Reemplazar la entrada vacía con el ABI
    content = content.replace(regex, `"${contractAddress}": ${JSON.stringify(abi)}`);
    
    // Guardar el archivo actualizado
    fs.writeFileSync(filePath, content);
    console.log(`📄 Archivo contractAbis.ts actualizado con el ABI de ${contractAddress}`);
  } else {
    console.warn(`⚠️ No se encontró la entrada para ${contractAddress} en contractAbis.ts`);
  }
}

// Función principal
async function main() {
  const abi = await getContractABI(contractAddress);
  if (abi) {
    saveABI(contractAddress, abi);
    console.log('\n=== PROCESO COMPLETADO ===');
  } else {
    console.error('\n=== ERROR AL OBTENER EL ABI ===');
    process.exit(1);
  }
}

main().catch(error => {
  console.error('\n❌ ERROR EN EL PROCESO:', error);
  process.exit(1);
});
