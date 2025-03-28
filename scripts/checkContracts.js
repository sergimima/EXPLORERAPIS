// Script para verificar si varias direcciones son contratos
const { ethers } = require('ethers');

// Lista de direcciones a verificar
const addresses = [
  "0xe507e342c2225ed4141a2b9b3e6bf74a1f3dfcaf",
  "0x7BBDa50bE87DFf935782C80D4222D46490F242A1",
  "0x1808CF66F69DC1B8217d1C655fBD134B213AE358"
];

async function checkIsContract(address) {
  try {
    // Usar Base Mainnet
    const provider = new ethers.JsonRpcProvider('https://mainnet.base.org');
    
    // Obtener el código de la dirección
    const code = await provider.getCode(address);
    
    // Si el código es '0x', no es un contrato
    const isContract = code !== '0x';
    
    return {
      address,
      isContract,
      codeSize: isContract ? (code.length - 2) / 2 : 0
    };
  } catch (error) {
    console.error(`Error al verificar ${address}:`, error.message);
    return {
      address,
      isContract: false,
      error: error.message
    };
  }
}

// Función principal
async function main() {
  console.log('=== VERIFICANDO DIRECCIONES ===');
  
  for (const address of addresses) {
    const result = await checkIsContract(address);
    console.log(`\nDirección: ${result.address}`);
    console.log(`¿Es un contrato?: ${result.isContract ? 'SÍ' : 'NO'}`);
    
    if (result.isContract) {
      console.log(`Tamaño del código: ${result.codeSize} bytes`);
    }
    
    if (result.error) {
      console.log(`Error: ${result.error}`);
    }
  }
  
  console.log('\n=== VERIFICACIÓN COMPLETADA ===');
}

main().catch(error => {
  console.error('\n❌ ERROR EN EL PROCESO:', error);
  process.exit(1);
});
