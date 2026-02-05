import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import bcrypt from 'bcryptjs';

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
  console.log('🔐 Creating SUPER_ADMIN user...');

  // Check if user already exists
  const existingUser = await prisma.user.findUnique({
    where: { email: 'superadmin@tokenlens.com' }
  });

  if (existingUser) {
    console.log('⚠️  User superadmin@tokenlens.com already exists.');
    console.log(`   User ID: ${existingUser.id}`);
    console.log(`   Role: ${existingUser.role}`);

    // Update to SUPER_ADMIN if not already
    if (existingUser.role !== 'SUPER_ADMIN') {
      await prisma.user.update({
        where: { id: existingUser.id },
        data: { role: 'SUPER_ADMIN' }
      });
      console.log('✓ Updated role to SUPER_ADMIN');
    }

    return;
  }

  // Hash password
  const hashedPassword = await bcrypt.hash('super123', 10);

  // Create SUPER_ADMIN user (NO organizationId - platform admin)
  const user = await prisma.user.create({
    data: {
      email: 'superadmin@tokenlens.com',
      name: 'Super Admin',
      hashedPassword,
      role: 'SUPER_ADMIN',
      organizationId: null, // Platform admin has no organization
      emailVerified: new Date(),
    }
  });

  console.log(`✓ SUPER_ADMIN created: ${user.id}`);
  console.log(`   Email: ${user.email}`);
  console.log(`   Password: super123`);
  console.log(`   Role: ${user.role}`);
  console.log(`   Organization: NONE (platform-wide access)`);

  console.log('\n✅ SUPER_ADMIN user created successfully!');
  console.log('\n📝 Login credentials:');
  console.log('   URL: http://localhost:4200/auth/signin');
  console.log('   Email: superadmin@tokenlens.com');
  console.log('   Password: super123');
  console.log('\n🎯 Access (panel a crear en Sprint 4.2-4.3):');
  console.log('   - /admin/dashboard     → Platform statistics (MRR, orgs, users)');
  console.log('   - /admin/organizations → Manage all organizations + assign plans');
  console.log('   - /admin/plans         → Create/edit subscription plans');
  console.log('   - /admin/settings      → Configure global API keys');
  console.log('\n💡 Comparison:');
  console.log('   - admin@vottun.com          → ADMIN of Vottun org only');
  console.log('   - superadmin@tokenlens.com  → SUPER_ADMIN of entire platform');
}

main()
  .catch((e) => {
    console.error('❌ Error creating SUPER_ADMIN:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
