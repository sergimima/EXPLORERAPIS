import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';

// Load environment variables
config();

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Seed: Contratos de Vesting Vottun
  console.log('  📝 Seeding Vesting Contracts...');
  await prisma.knownAddress.createMany({
    data: [
      {
        address: '0xa699Cf416FFe6063317442c3Fbd0C39742E971c5',
        name: 'Vottun World Vesting',
        type: 'VESTING',
        category: 'vottun',
        description: 'Contrato de vesting para Vottun World',
        color: '#3B82F6',
        tags: ['vesting', 'vottun', 'important', 'world']
      },
      {
        address: '0x3e0ef51811B647E00A85A7e5e495fA4763911982',
        name: 'Investors Vesting',
        type: 'VESTING',
        category: 'vottun',
        description: 'Contrato de vesting para inversores',
        color: '#8B5CF6',
        tags: ['vesting', 'vottun', 'investors']
      },
      {
        address: '0xE521B2929DD28a725603bCb6F4009FBb656C4b15',
        name: 'Marketing Vesting',
        type: 'VESTING',
        category: 'vottun',
        description: 'Contrato de vesting para marketing',
        color: '#EC4899',
        tags: ['vesting', 'vottun', 'marketing']
      },
      {
        address: '0x3a7cf4cCC76bb23Cf15845B0d4f05BafF1D478cF',
        name: 'Staking Vesting',
        type: 'VESTING',
        category: 'vottun',
        description: 'Contrato de vesting para staking',
        color: '#10B981',
        tags: ['vesting', 'vottun', 'staking']
      },
      {
        address: '0x417Fc9c343210AA52F0b19dbf4EecBD786139BC1',
        name: 'Liquidity Vesting',
        type: 'VESTING',
        category: 'vottun',
        description: 'Contrato de vesting para liquidez',
        color: '#06B6D4',
        tags: ['vesting', 'vottun', 'liquidity']
      },
      {
        address: '0xFC750D874077F8c90858cC132e0619CE7571520b',
        name: 'Promos Vesting',
        type: 'VESTING',
        category: 'vottun',
        description: 'Contrato de vesting para promociones',
        color: '#F59E0B',
        tags: ['vesting', 'vottun', 'promos']
      },
      {
        address: '0xde68AD324aafD9F2b6946073C90ED5e61D5d51B8',
        name: 'Team Vesting',
        type: 'VESTING',
        category: 'vottun',
        description: 'Contrato de vesting para el equipo',
        color: '#6366F1',
        tags: ['vesting', 'vottun', 'team']
      },
      {
        address: '0xC4CE5cFea2B6e32Ad41973348AC70EB3b00D8e6d',
        name: 'Reserve Vesting',
        type: 'VESTING',
        category: 'vottun',
        description: 'Contrato de vesting para reserva',
        color: '#8B5CF6',
        tags: ['vesting', 'vottun', 'reserve']
      },
    ],
    skipDuplicates: true,
  });

  // Seed: Token VTN
  console.log('  🪙 Seeding Token Contracts...');
  await prisma.knownAddress.createMany({
    data: [
      {
        address: '0xA9bc478A44a8c8FE6fd505C1964dEB3cEe3b7abC',
        name: 'Vottun Token (VTN)',
        type: 'TOKEN',
        category: 'vottun',
        description: 'Token principal de Vottun en Base Network',
        color: '#3B82F6',
        tags: ['token', 'vottun', 'vtn', 'main']
      },
    ],
    skipDuplicates: true,
  });

  // Seed: Exchanges Conocidos
  console.log('  🏦 Seeding Exchange Addresses...');
  await prisma.knownAddress.createMany({
    data: [
      {
        address: '0x3cd751e6b0078be393132286c442345e5dc49699',
        name: 'Coinbase',
        type: 'EXCHANGE',
        category: 'cex',
        description: 'Exchange centralizado Coinbase',
        color: '#0052FF',
        tags: ['exchange', 'cex', 'major', 'coinbase']
      },
      {
        address: '0x71660c4005ba85c37ccec55d0c4493e66fe775d3',
        name: 'Coinbase 2',
        type: 'EXCHANGE',
        category: 'cex',
        description: 'Segundo wallet de Coinbase',
        color: '#0052FF',
        tags: ['exchange', 'cex', 'major', 'coinbase']
      },
      {
        address: '0x503828976d22510aad0201ac7ec88293211d23da',
        name: 'Coinbase 3',
        type: 'EXCHANGE',
        category: 'cex',
        description: 'Tercer wallet de Coinbase',
        color: '#0052FF',
        tags: ['exchange', 'cex', 'major', 'coinbase']
      },
      {
        address: '0x0d0707963952f2fba59dd06f2b425ace40b492fe',
        name: 'Gate.io',
        type: 'EXCHANGE',
        category: 'cex',
        description: 'Exchange centralizado Gate.io',
        color: '#2354E6',
        tags: ['exchange', 'cex', 'gateio']
      },
    ],
    skipDuplicates: true,
  });

  const count = await prisma.knownAddress.count();
  console.log(`✅ Seeded ${count} known addresses`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error('❌ Error seeding database:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
