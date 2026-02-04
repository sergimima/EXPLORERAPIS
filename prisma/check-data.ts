import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const knownAddresses = await prisma.knownAddress.count();
    console.log('KnownAddress count:', knownAddresses);

    const transferCache = await prisma.transferCache.count();
    console.log('TransferCache count:', transferCache);

    const holderSnapshots = await prisma.holderSnapshot.count();
    console.log('HolderSnapshot count:', holderSnapshots);

    const vestingCache = await prisma.vestingCache.count();
    console.log('VestingCache count:', vestingCache);

    const vestingTransferCache = await prisma.vestingTransferCache.count();
    console.log('VestingTransferCache count:', vestingTransferCache);

    const vestingBeneficiaryCache = await prisma.vestingBeneficiaryCache.count();
    console.log('VestingBeneficiaryCache count:', vestingBeneficiaryCache);
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
