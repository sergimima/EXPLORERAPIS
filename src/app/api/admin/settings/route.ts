import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireSuperAdmin } from '@/lib/auth-helpers';

/**
 * GET /api/admin/settings
 *
 * Obtiene la configuración global del sistema
 * Solo accesible para SUPER_ADMIN
 */
export async function GET(request: NextRequest) {
  const session = await requireSuperAdmin();
  if (!session) {
    return NextResponse.json(
      { error: 'Forbidden: SUPER_ADMIN required' },
      { status: 403 }
    );
  }

  try {
    // SystemSettings es singleton con id = "system"
    let settings = await prisma.systemSettings.findUnique({
      where: { id: 'system' }
    });

    // Si no existe, crear con valores por defecto
    if (!settings) {
      settings = await prisma.systemSettings.create({
        data: {
          id: 'system',
          appName: 'TokenLens',
          appUrl: process.env.NEXTAUTH_URL || 'http://localhost:4200',
          supportEmail: 'support@tokenlens.com'
        }
      });
    }

    // Ocultar valores sensibles (API keys) en la respuesta
    const safeSettings = {
      ...settings,
      defaultBasescanApiKey: settings.defaultBasescanApiKey ? '***hidden***' : null,
      defaultEtherscanApiKey: settings.defaultEtherscanApiKey ? '***hidden***' : null,
      defaultMoralisApiKey: settings.defaultMoralisApiKey ? '***hidden***' : null,
      defaultQuiknodeUrl: settings.defaultQuiknodeUrl ? '***hidden***' : null,
      resendApiKey: settings.resendApiKey ? '***hidden***' : null,
      stripeSecretKey: settings.stripeSecretKey ? '***hidden***' : null,
      stripeWebhookSecret: settings.stripeWebhookSecret ? '***hidden***' : null,
      cloudinaryApiKey: settings.cloudinaryApiKey ? '***hidden***' : null,
      cloudinaryApiSecret: settings.cloudinaryApiSecret ? '***hidden***' : null
    };

    return NextResponse.json({ settings: safeSettings });

  } catch (error) {
    console.error('Error fetching settings:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/settings
 *
 * Actualiza la configuración global del sistema
 * Solo accesible para SUPER_ADMIN
 */
export async function PUT(request: NextRequest) {
  const session = await requireSuperAdmin();
  if (!session) {
    return NextResponse.json(
      { error: 'Forbidden: SUPER_ADMIN required' },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();

    // Construir objeto de actualización (solo campos proporcionados)
    const updateData: any = {
      updatedBy: session.user.id
    };

    // API Keys
    if (body.defaultBasescanApiKey !== undefined) {
      updateData.defaultBasescanApiKey = body.defaultBasescanApiKey || null;
    }
    if (body.defaultEtherscanApiKey !== undefined) {
      updateData.defaultEtherscanApiKey = body.defaultEtherscanApiKey || null;
    }
    if (body.defaultMoralisApiKey !== undefined) {
      updateData.defaultMoralisApiKey = body.defaultMoralisApiKey || null;
    }
    if (body.defaultQuiknodeUrl !== undefined) {
      updateData.defaultQuiknodeUrl = body.defaultQuiknodeUrl || null;
    }

    // Email (Resend)
    if (body.resendApiKey !== undefined) {
      updateData.resendApiKey = body.resendApiKey || null;
    }
    if (body.resendFromEmail !== undefined) {
      updateData.resendFromEmail = body.resendFromEmail || null;
    }
    if (body.resendFromName !== undefined) {
      updateData.resendFromName = body.resendFromName || null;
    }

    // Stripe
    if (body.stripePublicKey !== undefined) {
      updateData.stripePublicKey = body.stripePublicKey || null;
    }
    if (body.stripeSecretKey !== undefined) {
      updateData.stripeSecretKey = body.stripeSecretKey || null;
    }
    if (body.stripeWebhookSecret !== undefined) {
      updateData.stripeWebhookSecret = body.stripeWebhookSecret || null;
    }

    // Cloudinary (no sobrescribir si viene ***hidden*** = usuario no cambió)
    if (body.cloudinaryCloudName !== undefined) {
      updateData.cloudinaryCloudName = body.cloudinaryCloudName || null;
    }
    if (body.cloudinaryApiKey !== undefined && body.cloudinaryApiKey !== '***hidden***') {
      updateData.cloudinaryApiKey = body.cloudinaryApiKey || null;
    }
    if (body.cloudinaryApiSecret !== undefined && body.cloudinaryApiSecret !== '***hidden***') {
      updateData.cloudinaryApiSecret = body.cloudinaryApiSecret || null;
    }

    // General
    if (body.appName !== undefined) {
      updateData.appName = body.appName;
    }
    if (body.appUrl !== undefined) {
      updateData.appUrl = body.appUrl;
    }
    if (body.supportEmail !== undefined) {
      updateData.supportEmail = body.supportEmail || null;
    }

    // Actualizar (upsert para asegurar que existe)
    const settings = await prisma.systemSettings.upsert({
      where: { id: 'system' },
      update: updateData,
      create: {
        id: 'system',
        appName: body.appName || 'TokenLens',
        appUrl: body.appUrl || 'http://localhost:4200',
        ...updateData
      }
    });

    // Ocultar valores sensibles en la respuesta
    const safeSettings = {
      ...settings,
      defaultBasescanApiKey: settings.defaultBasescanApiKey ? '***hidden***' : null,
      defaultEtherscanApiKey: settings.defaultEtherscanApiKey ? '***hidden***' : null,
      defaultMoralisApiKey: settings.defaultMoralisApiKey ? '***hidden***' : null,
      defaultQuiknodeUrl: settings.defaultQuiknodeUrl ? '***hidden***' : null,
      resendApiKey: settings.resendApiKey ? '***hidden***' : null,
      stripeSecretKey: settings.stripeSecretKey ? '***hidden***' : null,
      stripeWebhookSecret: settings.stripeWebhookSecret ? '***hidden***' : null,
      cloudinaryApiKey: settings.cloudinaryApiKey ? '***hidden***' : null,
      cloudinaryApiSecret: settings.cloudinaryApiSecret ? '***hidden***' : null
    };

    return NextResponse.json({
      success: true,
      settings: safeSettings,
      message: 'Settings updated successfully'
    });

  } catch (error) {
    console.error('Error updating settings:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
