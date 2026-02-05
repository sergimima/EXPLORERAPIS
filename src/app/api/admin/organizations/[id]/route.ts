import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireSuperAdmin } from '@/lib/auth-helpers';

/**
 * GET /api/admin/organizations/[id]
 *
 * Obtiene detalle de una organización específica
 * Solo accesible para SUPER_ADMIN
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const session = await requireSuperAdmin();
  if (!session) {
    return NextResponse.json(
      { error: 'Forbidden: SUPER_ADMIN required' },
      { status: 403 }
    );
  }

  try {
    const { id: organizationId } = await context.params;

    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
      include: {
        subscription: {
          include: {
            planRelation: true
          }
        },
        members: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                role: true,
                createdAt: true
              }
            }
          }
        },
        tokens: {
          include: {
            settings: true
          }
        },
        users: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true
          }
        }
      }
    });

    if (!organization) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      );
    }

    // Transform tokens to only indicate if custom API keys exist (not expose actual keys)
    // Schema uses customBasescanApiKey, customEtherscanApiKey, etc.
    const transformedOrganization = {
      ...organization,
      tokens: organization.tokens.map(token => ({
        ...token,
        settings: token.settings ? {
          basescanApiKey: !!token.settings.customBasescanApiKey,
          etherscanApiKey: !!token.settings.customEtherscanApiKey,
          moralisApiKey: !!token.settings.customMoralisApiKey,
          quiknodeUrl: !!token.settings.customQuiknodeUrl
        } : null
      }))
    };

    return NextResponse.json({ organization: transformedOrganization });

  } catch (error) {
    console.error('Error fetching organization:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/organizations/[id]
 *
 * Actualiza una organización (principalmente para asignar planes)
 * Solo accesible para SUPER_ADMIN
 */
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const session = await requireSuperAdmin();
  if (!session) {
    return NextResponse.json(
      { error: 'Forbidden: SUPER_ADMIN required' },
      { status: 403 }
    );
  }

  try {
    const { id: organizationId } = await context.params;
    const body = await request.json();
    const { planId } = body;

    if (!planId) {
      return NextResponse.json(
        { error: 'planId is required' },
        { status: 400 }
      );
    }

    // Verificar que el plan existe
    const plan = await prisma.plan.findUnique({
      where: { id: planId }
    });

    if (!plan) {
      return NextResponse.json(
        { error: 'Plan not found' },
        { status: 404 }
      );
    }

    // Verificar que la organización existe
    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
      include: {
        subscription: true
      }
    });

    if (!organization) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      );
    }

    // Si no tiene subscription, crear una
    if (!organization.subscription) {
      const newSubscription = await prisma.subscription.create({
        data: {
          organizationId,
          planId,
          plan: plan.slug === 'free' ? 'FREE' : plan.slug === 'pro' ? 'PRO' : 'ENTERPRISE',
          status: 'ACTIVE',
          tokensLimit: plan.tokensLimit,
          apiCallsLimit: plan.apiCallsLimit,
          transfersLimit: plan.transfersLimit,
          membersLimit: plan.membersLimit,
          billingCycleStart: new Date()
        },
        include: {
          planRelation: true
        }
      });

      return NextResponse.json({
        success: true,
        subscription: newSubscription,
        message: `Plan "${plan.name}" assigned successfully`
      });
    }

    // Actualizar subscription existente
    const updatedSubscription = await prisma.subscription.update({
      where: { id: organization.subscription.id },
      data: {
        planId,
        tokensLimit: plan.tokensLimit,
        apiCallsLimit: plan.apiCallsLimit,
        transfersLimit: plan.transfersLimit,
        membersLimit: plan.membersLimit
      },
      include: {
        planRelation: true
      }
    });

    return NextResponse.json({
      success: true,
      subscription: updatedSubscription,
      message: `Plan changed to "${plan.name}" successfully`
    });

  } catch (error) {
    console.error('Error updating organization:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
