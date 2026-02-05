/**
 * Migración para Sprint 4.1: Admin Panel Setup
 *
 * Este script:
 * 1. Crea 3 planes por defecto (Free, Pro, Enterprise)
 * 2. Crea registro SystemSettings con valores por defecto
 * 3. Actualiza subscriptions existentes con planId
 */

import { config } from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

// Load environment variables
config();

// Setup connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({
  adapter,
  log: ['query', 'error', 'warn'],
});

async function main() {
  console.log('🚀 Iniciando migración de Admin Panel Setup...\n');

  // ========================================
  // 1. Crear planes por defecto
  // ========================================
  console.log('📦 Creando planes por defecto...');

  const freePlan = await prisma.plan.upsert({
    where: { slug: 'free' },
    update: {},
    create: {
      name: 'Free',
      slug: 'free',
      description: 'Plan gratuito para empezar. Perfecto para proyectos pequeños.',
      price: 0,
      currency: 'USD',
      tokensLimit: 1,
      apiCallsLimit: 10000,
      transfersLimit: 10000,
      membersLimit: 1,
      features: [],
      isActive: true,
      isPublic: true,
      sortOrder: 1,
    },
  });
  console.log(`✅ Plan creado: ${freePlan.name} (${freePlan.id})`);

  const proPlan = await prisma.plan.upsert({
    where: { slug: 'pro' },
    update: {},
    create: {
      name: 'Pro',
      slug: 'pro',
      description: 'Plan profesional con límites ampliados y features avanzadas.',
      price: 29,
      currency: 'USD',
      tokensLimit: 5,
      apiCallsLimit: 100000,
      transfersLimit: 100000,
      membersLimit: 5,
      features: ['webhooks', 'priority-support'],
      isActive: true,
      isPublic: true,
      sortOrder: 2,
    },
  });
  console.log(`✅ Plan creado: ${proPlan.name} (${proPlan.id})`);

  const enterprisePlan = await prisma.plan.upsert({
    where: { slug: 'enterprise' },
    update: {},
    create: {
      name: 'Enterprise',
      slug: 'enterprise',
      description: 'Plan enterprise con recursos ilimitados y soporte dedicado.',
      price: 99,
      currency: 'USD',
      tokensLimit: -1, // Ilimitado
      apiCallsLimit: -1,
      transfersLimit: -1,
      membersLimit: -1,
      features: ['webhooks', 'priority-support', 'white-label', 'dedicated-support'],
      isActive: true,
      isPublic: true,
      sortOrder: 3,
    },
  });
  console.log(`✅ Plan creado: ${enterprisePlan.name} (${enterprisePlan.id})\n`);

  // ========================================
  // 2. Crear SystemSettings
  // ========================================
  console.log('⚙️  Creando SystemSettings...');

  const systemSettings = await prisma.systemSettings.upsert({
    where: { id: 'system' },
    update: {},
    create: {
      id: 'system',
      appName: 'TokenLens',
      appUrl: process.env.NEXTAUTH_URL || 'http://localhost:4200',
      supportEmail: 'support@tokenlens.com',
      // API keys se dejan vacías, el SUPER_ADMIN las configurará desde UI
      defaultBasescanApiKey: process.env.NEXT_PUBLIC_BASESCAN_API_KEY || null,
      defaultEtherscanApiKey: process.env.NEXT_PUBLIC_ETHERSCAN_API_KEY || null,
      defaultMoralisApiKey: process.env.NEXT_PUBLIC_MORALIS_API_KEY || null,
      defaultQuiknodeUrl: process.env.NEXT_PUBLIC_QUICKNODE_URL || null,
      resendApiKey: process.env.RESEND_API_KEY || null,
      resendFromEmail: process.env.RESEND_FROM_EMAIL || 'noreply@tokenlens.com',
      resendFromName: 'TokenLens',
    },
  });
  console.log(`✅ SystemSettings creado (${systemSettings.id})\n`);

  // ========================================
  // 3. Actualizar subscriptions existentes
  // ========================================
  console.log('🔄 Actualizando subscriptions existentes...');

  // Mapeo de enum a planId
  const planMap = {
    FREE: freePlan.id,
    PRO: proPlan.id,
    ENTERPRISE: enterprisePlan.id,
  };

  const subscriptions = await prisma.subscription.findMany({
    where: { planId: null }, // Solo las que no tienen planId
  });

  console.log(`📋 Encontradas ${subscriptions.length} subscriptions sin planId`);

  for (const sub of subscriptions) {
    const planId = planMap[sub.plan as keyof typeof planMap];

    if (planId) {
      await prisma.subscription.update({
        where: { id: sub.id },
        data: {
          planId,
          // Actualizar límites desde el plan
          tokensLimit: sub.plan === 'FREE' ? 1 : sub.plan === 'PRO' ? 5 : -1,
          apiCallsLimit: sub.plan === 'FREE' ? 10000 : sub.plan === 'PRO' ? 100000 : -1,
          transfersLimit: sub.plan === 'FREE' ? 10000 : sub.plan === 'PRO' ? 100000 : -1,
          membersLimit: sub.plan === 'FREE' ? 1 : sub.plan === 'PRO' ? 5 : -1,
        },
      });
      console.log(`✅ Subscription actualizada: ${sub.id} → Plan ${sub.plan}`);
    }
  }

  console.log('\n✨ Migración completada exitosamente!\n');

  // Resumen
  console.log('📊 Resumen:');
  console.log(`   - Planes creados: 3 (Free, Pro, Enterprise)`);
  console.log(`   - SystemSettings: 1 registro`);
  console.log(`   - Subscriptions actualizadas: ${subscriptions.length}`);
  console.log('\n👉 Siguiente: Ejecutar seed-superadmin.ts para crear usuario SUPER_ADMIN\n');
}

main()
  .catch((e) => {
    console.error('❌ Error durante la migración:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
