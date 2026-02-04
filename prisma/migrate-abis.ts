/**
 * Script de migración: ABIs Hardcoded → Base de Datos
 *
 * Este script migra los ABIs hardcoded de contractAbis.ts
 * a la tabla CustomAbi en la base de datos.
 *
 * Ejecutar con: npx tsx prisma/migrate-abis.ts
 */

import { config } from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { VESTING_CONTRACT_ABIS } from '../src/lib/contractAbis';

// Cargar variables de entorno
config();

// Prisma 7 requiere driver adapter - usar el mismo setup que db.ts
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const VTN_TOKEN_ADDRESS = '0xA9bc478A44a8c8FE6fd505C1964dEB3cEe3b7abC';

// Mapeo de direcciones a nombres descriptivos (para logging)
const CONTRACT_NAMES: Record<string, string> = {
  '0xa9bc478a44a8c8fe6fd505c1964deb3cee3b7abc': 'VTN Token (ERC20)',
  '0xa699cf416ffe6063317442c3fbd0c39742e971c5': 'Vottun World Vesting',
  '0x3e0ef51811b647e00a85a7e5e495fa4763911982': 'Investors Vesting',
  '0xe521b2929dd28a725603bcb6f4009fbb656c4b15': 'Marketing Vesting',
  '0x3a7cf4ccc76bb23cf15845b0d4f05baff1d478cf': 'Staking Vesting',
  '0x417fc9c343210aa52f0b19dbf4eecbd786139bc1': 'Liquidity Vesting',
  '0xfc750d874077f8c90858cc132e0619ce7571520b': 'Promos Vesting',
  '0xde68ad324aafd9f2b6946073c90ed5e61d5d51b8': 'Team Vesting',
  '0xc4ce5cfea2b6e32ad41973348ac70eb3b00d8e6d': 'Reserve Vesting',
  '0x1808cf66f69dc1b8217d1c655fbd134b213ae358': 'Unknown Contract 1',
  '0x7bbda50be87dff935782c80d4222d46490f242a1': 'Unknown Contract 2',
};

async function main() {
  console.log('🚀 Iniciando migración de ABIs...\n');

  // 1. Buscar el token VTN (cualquier organización)
  console.log(`📝 Buscando token VTN (${VTN_TOKEN_ADDRESS})...`);
  const vtnToken = await prisma.token.findFirst({
    where: {
      address: {
        equals: VTN_TOKEN_ADDRESS,
        mode: 'insensitive'
      },
      network: 'base'
    }
  });

  if (!vtnToken) {
    console.error('❌ Error: No se encontró el token VTN en la base de datos.');
    console.log('\n💡 Sugerencia: Asegúrate de que el token VTN esté creado primero.');
    console.log('   Puedes crearlo desde /settings/tokens o ejecutar el script de seed.');
    return;
  }

  console.log(`✅ Token VTN encontrado: ${vtnToken.symbol} (ID: ${vtnToken.id})\n`);

  // 2. Obtener todos los ABIs del archivo contractAbis.ts
  const abiEntries = Object.entries(VESTING_CONTRACT_ABIS);
  console.log(`📦 ABIs encontrados en contractAbis.ts: ${abiEntries.length}\n`);

  // 3. Migrar cada ABI
  let created = 0;
  let skipped = 0;
  let errors = 0;

  for (const [contractAddress, abi] of abiEntries) {
    const normalizedAddress = contractAddress.toLowerCase();
    const contractName = CONTRACT_NAMES[normalizedAddress] || `Unknown (${normalizedAddress})`;

    try {
      // Verificar si ya existe
      const existing = await prisma.customAbi.findUnique({
        where: {
          tokenId_contractAddress_network: {
            tokenId: vtnToken.id,
            contractAddress: normalizedAddress,
            network: 'base'
          }
        }
      });

      if (existing) {
        console.log(`⏭️  ${contractName}: Ya existe (skipped)`);
        skipped++;
        continue;
      }

      // Crear el ABI
      await prisma.customAbi.create({
        data: {
          tokenId: vtnToken.id,
          contractAddress: normalizedAddress,
          network: 'base',
          abi: abi as any, // Cast necesario porque Prisma espera JsonValue
          source: 'STANDARD'
        }
      });

      console.log(`✅ ${contractName}: Creado correctamente`);
      created++;
    } catch (error: any) {
      console.error(`❌ ${contractName}: Error - ${error.message}`);
      errors++;
    }
  }

  // 4. Resumen
  console.log('\n' + '='.repeat(60));
  console.log('📊 RESUMEN DE MIGRACIÓN');
  console.log('='.repeat(60));
  console.log(`✅ ABIs creados:       ${created}`);
  console.log(`⏭️  ABIs omitidos:     ${skipped} (ya existían)`);
  console.log(`❌ Errores:            ${errors}`);
  console.log(`📦 Total procesados:   ${abiEntries.length}`);
  console.log('='.repeat(60) + '\n');

  if (created > 0) {
    console.log('🎉 Migración completada exitosamente!\n');
    console.log('💡 Ahora puedes:');
    console.log('   - Ver los ABIs en /settings/tokens/[id] (pestaña ABIs)');
    console.log('   - Los ABIs se cargarán desde la BD en lugar de contractAbis.ts');
    console.log('   - blockchain.ts consultará la BD antes de llamar a BaseScan\n');
  } else if (skipped > 0) {
    console.log('ℹ️  Todos los ABIs ya estaban migrados. No se realizaron cambios.\n');
  }
}

main()
  .catch((error) => {
    console.error('\n❌ Error fatal durante la migración:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
