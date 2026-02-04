import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import bcrypt from 'bcrypt';

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
  console.log('🔐 Creating test user...');

  // Get Vottun organization ID
  const vottunOrg = await prisma.organization.findUnique({
    where: { slug: 'vottun' }
  });

  if (!vottunOrg) {
    console.error('❌ Vottun organization not found. Run migrate-vottun-data.ts first.');
    process.exit(1);
  }

  console.log(`✓ Found Vottun organization: ${vottunOrg.id}`);

  // Check if user already exists
  const existingUser = await prisma.user.findUnique({
    where: { email: 'admin@vottun.com' }
  });

  if (existingUser) {
    console.log('⚠️  User admin@vottun.com already exists. Skipping.');
    console.log(`   User ID: ${existingUser.id}`);
    return;
  }

  // Hash password
  const hashedPassword = await bcrypt.hash('admin123', 10);

  // Create user
  const user = await prisma.user.create({
    data: {
      email: 'admin@vottun.com',
      name: 'Vottun Admin',
      hashedPassword,
      role: 'ADMIN',
      organizationId: vottunOrg.id,
      emailVerified: new Date(),
    }
  });

  console.log(`✓ User created: ${user.id}`);
  console.log(`   Email: ${user.email}`);
  console.log(`   Password: admin123`);
  console.log(`   Role: ${user.role}`);

  // Create organization member entry
  await prisma.organizationMember.create({
    data: {
      organizationId: vottunOrg.id,
      userId: user.id,
      role: 'ADMIN',
      joinedAt: new Date(),
    }
  });

  console.log('✓ Organization member created');

  // Update organization owner if it's 'system'
  if (vottunOrg.ownerId === 'system') {
    await prisma.organization.update({
      where: { id: vottunOrg.id },
      data: { ownerId: user.id }
    });
    console.log('✓ Organization owner updated');
  }

  console.log('\n✅ Test user created successfully!');
  console.log('\n📝 Login credentials:');
  console.log('   URL: http://localhost:4200/auth/signin');
  console.log('   Email: admin@vottun.com');
  console.log('   Password: admin123');
}

main()
  .catch((e) => {
    console.error('❌ Error creating user:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
