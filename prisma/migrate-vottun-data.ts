import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

// Create pool and adapter
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({
  adapter,
  log: ['query', 'error', 'warn'],
});

async function main() {
  console.log('Starting Vottun data migration...');
  console.log('⚠️  Asegúrate de haber hecho BACKUP de la BD antes de continuar.\n');

  // 0. Resolver ownerId: usar primer SUPER_ADMIN o env OWNER_ID
  const ownerIdFromEnv = process.env.OWNER_ID;
  let ownerId: string;

  if (ownerIdFromEnv) {
    ownerId = ownerIdFromEnv;
    console.log(`Using OWNER_ID from env: ${ownerId}`);
  } else {
    const superAdmin = await prisma.user.findFirst({
      where: { role: 'SUPER_ADMIN' },
      select: { id: true },
    });
    const anyAdmin = superAdmin ?? (await prisma.user.findFirst({
      where: { role: 'ADMIN' },
      select: { id: true },
    }));
    const anyUser = anyAdmin ?? (await prisma.user.findFirst({ select: { id: true } }));

    if (!anyUser) {
      throw new Error(
        'No hay usuarios en la BD. Crea primero un usuario (ej: SUPER_ADMIN) o pasa OWNER_ID=userId en el entorno.'
      );
    }
    ownerId = anyUser.id;
    console.log(`Using owner: ${ownerId}`);
  }

  // 1. Create Vottun organization
  console.log('Creating Vottun organization...');
  const org = await prisma.organization.upsert({
    where: { slug: 'vottun' },
    update: {},
    create: {
      name: 'Vottun',
      slug: 'vottun',
      ownerId,
      website: 'https://vottun.com',
    },
  });
  console.log(`✓ Organization created: ${org.id}`);

  // 2. Create Vottun Token (VTN)
  console.log('Creating VTN token...');
  const token = await prisma.token.upsert({
    where: {
      organizationId_address_network: {
        organizationId: org.id,
        address: '0xA9bc478A44a8c8FE6fd505C1964dEB3cEe3b7abC',
        network: 'base',
      },
    },
    update: {},
    create: {
      organizationId: org.id,
      address: '0xA9bc478A44a8c8FE6fd505C1964dEB3cEe3b7abC',
      symbol: 'VTN',
      name: 'Vottun Token',
      decimals: 18,
      network: 'base',
      isActive: true,
      isVerified: true,
    },
  });
  console.log(`✓ Token created: ${token.id}`);

  // 3. Update existing KnownAddress rows
  console.log('Updating KnownAddress rows...');
  const knownAddressResult = await prisma.knownAddress.updateMany({
    where: { tokenId: null as any },
    data: { tokenId: token.id },
  });
  console.log(`✓ Updated ${knownAddressResult.count} KnownAddress rows`);

  // 4. Update existing TransferCache rows
  console.log('Updating TransferCache rows...');
  const transferCacheResult = await prisma.transferCache.updateMany({
    where: { tokenId: null as any },
    data: { tokenId: token.id },
  });
  console.log(`✓ Updated ${transferCacheResult.count} TransferCache rows`);

  // 5. Update existing HolderSnapshot rows
  console.log('Updating HolderSnapshot rows...');
  const holderSnapshotResult = await prisma.holderSnapshot.updateMany({
    where: { tokenId: null as any },
    data: { tokenId: token.id },
  });
  console.log(`✓ Updated ${holderSnapshotResult.count} HolderSnapshot rows`);

  // 6. Update existing VestingCache rows
  console.log('Updating VestingCache rows...');
  const vestingCacheResult = await prisma.vestingCache.updateMany({
    where: { tokenId: null as any },
    data: { tokenId: token.id },
  });
  console.log(`✓ Updated ${vestingCacheResult.count} VestingCache rows`);

  // 7. Update existing VestingTransferCache rows
  console.log('Updating VestingTransferCache rows...');
  const vestingTransferCacheResult = await prisma.vestingTransferCache.updateMany({
    where: { tokenId: null as any },
    data: { tokenId: token.id },
  });
  console.log(`✓ Updated ${vestingTransferCacheResult.count} VestingTransferCache rows`);

  // 8. Update existing VestingBeneficiaryCache rows
  console.log('Updating VestingBeneficiaryCache rows...');
  const vestingBeneficiaryCacheResult = await prisma.vestingBeneficiaryCache.updateMany({
    where: { tokenId: null as any },
    data: { tokenId: token.id },
  });
  console.log(`✓ Updated ${vestingBeneficiaryCacheResult.count} VestingBeneficiaryCache rows`);

  // 9. Update existing TokenSupplyCache rows (tokenAddress match VTN)
  const vtnAddress = '0xA9bc478A44a8c8FE6fd505C1964dEB3cEe3b7abC';
  const vtnAddressLower = vtnAddress.toLowerCase();
  console.log('Updating TokenSupplyCache rows for VTN...');
  const tokenSupplyResult = await prisma.tokenSupplyCache.updateMany({
    where: {
      tokenId: null as any,
      OR: [
        { tokenAddress: vtnAddress },
        { tokenAddress: vtnAddressLower },
      ],
      network: 'base',
    },
    data: { tokenId: token.id },
  });
  console.log(`✓ Updated ${tokenSupplyResult.count} TokenSupplyCache rows`);

  // 10. Create default subscription for Vottun
  console.log('Creating default subscription...');
  await prisma.subscription.upsert({
    where: { organizationId: org.id },
    update: {},
    create: {
      organizationId: org.id,
      plan: 'FREE',
      status: 'ACTIVE',
      apiCallsLimit: 10000, // Higher limit for Vottun
      tokensLimit: 10, // Allow multiple tokens
    },
  });
  console.log('✓ Subscription created');

  console.log('\n✅ Migration completed successfully!');
  console.log(`Organization ID: ${org.id}`);
  console.log(`Token ID: ${token.id}`);
}

main()
  .catch((e) => {
    console.error('❌ Migration failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
