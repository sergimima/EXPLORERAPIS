// Script para verificar si una dirección es un contrato
const { ethers } = require('ethers');
const dotenv = require('dotenv');

// Cargar variables de entorno
dotenv.config();

// Verificar que se proporcionó una dirección
if (process.argv.length < 3) {
  console.error('Uso: node checkContract.js <dirección>');
  process.exit(1);
}

const address = process.argv[2];
console.log(`=== VERIFICANDO SI ${address} ES UN CONTRATO ===`);

async function checkIsContract(address) {
  try {
    // Usar Base Mainnet
    const provider = new ethers.JsonRpcProvider('https://mainnet.base.org');
    
    // Obtener el código de la dirección
    const code = await provider.getCode(address);
    
    // Si el código es '0x', no es un contrato
    const isContract = code !== '0x';
    
    console.log(`Dirección: ${address}`);
    console.log(`¿Es un contrato?: ${isContract ? 'SÍ' : 'NO'}`);
    
    if (isContract) {
      console.log(`Tamaño del código: ${(code.length - 2) / 2} bytes`);
      // Intentar obtener el saldo del contrato
      const balance = await provider.getBalance(address);
      console.log(`Saldo: ${ethers.formatEther(balance)} ETH`);
    }
    
    return isContract;
  } catch (error) {
    console.error('Error al verificar la dirección:', error.message);
    return false;
  }
}

// Función principal
async function main() {
  const isContract = await checkIsContract(address);
  console.log(`\nRESULTADO: La dirección ${address} ${isContract ? 'ES' : 'NO ES'} un contrato.`);
}

main().catch(error => {
  console.error('\n❌ ERROR EN EL PROCESO:', error);
  process.exit(1);
});
