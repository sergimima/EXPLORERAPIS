/**
 * Script de migración: Contratos de Vesting Hardcoded → Base de Datos
 *
 * Este script migra los contratos de vesting hardcoded de Vottun
 * a la tabla VestingContract en la base de datos.
 *
 * Ejecutar con: npx tsx prisma/migrate-vesting-contracts.ts
 */

import { config } from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

// Cargar variables de entorno
config();

// Prisma 7 requiere driver adapter - usar el mismo setup que db.ts
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// Contratos de vesting hardcoded de Vottun
const VOTTUN_VESTING_CONTRACTS = [
  {
    name: 'Vottun World',
    address: '0xa699Cf416FFe6063317442c3Fbd0C39742E971c5',
    category: 'community',
    description: 'Vesting contract for Vottun World community allocation'
  },
  {
    name: 'Investors',
    address: '0x3e0ef51811B647E00A85A7e5e495fA4763911982',
    category: 'investors',
    description: 'Vesting contract for early investors'
  },
  {
    name: 'Marketing',
    address: '0xE521B2929DD28a725603bCb6F4009FBb656C4b15',
    category: 'marketing',
    description: 'Vesting contract for marketing and growth initiatives'
  },
  {
    name: 'Staking',
    address: '0x3a7cf4cCC76bb23Cf15845B0d4f05BafF1D478cF',
    category: 'staking',
    description: 'Vesting contract for staking rewards'
  },
  {
    name: 'Liquidity',
    address: '0x417Fc9c343210AA52F0b19dbf4EecBD786139BC1',
    category: 'liquidity',
    description: 'Vesting contract for liquidity provision'
  },
  {
    name: 'Promos',
    address: '0xFC750D874077F8c90858cC132e0619CE7571520b',
    category: 'promos',
    description: 'Vesting contract for promotional campaigns'
  },
  {
    name: 'Team',
    address: '0xde68AD324aafD9F2b6946073C90ED5e61D5d51B8',
    category: 'team',
    description: 'Vesting contract for team allocation'
  },
  {
    name: 'Reserve',
    address: '0xC4CE5cFea2B6e32Ad41973348AC70EB3b00D8e6d',
    category: 'reserve',
    description: 'Vesting contract for treasury reserve'
  }
];

const VTN_TOKEN_ADDRESS = '0xA9bc478A44a8c8FE6fd505C1964dEB3cEe3b7abC';

async function main() {
  console.log('🚀 Iniciando migración de contratos de vesting...\n');

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

  // 2. Migrar cada contrato
  let created = 0;
  let skipped = 0;
  let errors = 0;

  for (const contract of VOTTUN_VESTING_CONTRACTS) {
    try {
      // Verificar si ya existe
      const existing = await prisma.contract.findFirst({
        where: {
          tokenId: vtnToken.id,
          address: contract.address.toLowerCase(),
          network: 'base'
        }
      });

      if (existing) {
        console.log(`⏭️  ${contract.name}: Ya existe (skipped)`);
        skipped++;
        continue;
      }

      // Crear el contrato
      await prisma.contract.create({
        data: {
          tokenId: vtnToken.id,
          name: contract.name,
          address: contract.address.toLowerCase(),
          network: 'base',
          category: 'VESTING', // Usar el enum ContractCategory
          description: contract.description,
          isActive: true
        }
      });

      console.log(`✅ ${contract.name}: Creado correctamente`);
      created++;
    } catch (error: any) {
      console.error(`❌ ${contract.name}: Error - ${error.message}`);
      errors++;
    }
  }

  // 3. Resumen
  console.log('\n' + '='.repeat(60));
  console.log('📊 RESUMEN DE MIGRACIÓN');
  console.log('='.repeat(60));
  console.log(`✅ Contratos creados:  ${created}`);
  console.log(`⏭️  Contratos omitidos: ${skipped} (ya existían)`);
  console.log(`❌ Errores:            ${errors}`);
  console.log(`📦 Total procesados:   ${VOTTUN_VESTING_CONTRACTS.length}`);
  console.log('='.repeat(60) + '\n');

  if (created > 0) {
    console.log('🎉 Migración completada exitosamente!\n');
    console.log('💡 Ahora puedes:');
    console.log('   - Ver los contratos en /settings/tokens/[id]');
    console.log('   - Gestionar contratos desde la UI de settings');
    console.log('   - Los componentes ahora cargarán desde la BD en lugar de arrays hardcoded\n');
  } else if (skipped > 0) {
    console.log('ℹ️  Todos los contratos ya estaban migrados. No se realizaron cambios.\n');
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
