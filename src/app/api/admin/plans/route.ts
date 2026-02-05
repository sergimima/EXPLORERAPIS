import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireSuperAdmin } from '@/lib/auth-helpers';

/**
 * GET /api/admin/plans
 *
 * Lista todos los planes con conteo de subscriptions
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
    const plans = await prisma.plan.findMany({
      include: {
        _count: {
          select: {
            subscriptions: true
          }
        }
      },
      orderBy: {
        sortOrder: 'asc'
      }
    });

    // Formatear respuesta
    const formattedPlans = plans.map(plan => ({
      id: plan.id,
      name: plan.name,
      slug: plan.slug,
      description: plan.description,
      price: Number(plan.price),
      currency: plan.currency,
      stripePriceId: plan.stripePriceId,
      tokensLimit: plan.tokensLimit,
      apiCallsLimit: plan.apiCallsLimit,
      transfersLimit: plan.transfersLimit,
      membersLimit: plan.membersLimit,
      features: plan.features,
      isActive: plan.isActive,
      isPublic: plan.isPublic,
      sortOrder: plan.sortOrder,
      subscriptionsCount: plan._count.subscriptions,
      createdAt: plan.createdAt,
      updatedAt: plan.updatedAt
    }));

    return NextResponse.json({
      plans: formattedPlans
    });

  } catch (error) {
    console.error('Error fetching plans:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/plans
 *
 * Crea un nuevo plan
 * Solo accesible para SUPER_ADMIN
 */
export async function POST(request: NextRequest) {
  const session = await requireSuperAdmin();
  if (!session) {
    return NextResponse.json(
      { error: 'Forbidden: SUPER_ADMIN required' },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const {
      name,
      slug,
      description,
      price,
      currency = 'USD',
      stripePriceId,
      tokensLimit,
      apiCallsLimit,
      transfersLimit,
      membersLimit,
      features,
      isPublic = true,
      isActive = true,
      sortOrder = 0
    } = body;

    // Validaciones básicas
    if (!name || !slug) {
      return NextResponse.json(
        { error: 'name and slug are required' },
        { status: 400 }
      );
    }

    if (tokensLimit === undefined || apiCallsLimit === undefined ||
        transfersLimit === undefined || membersLimit === undefined) {
      return NextResponse.json(
        { error: 'All limits are required (tokensLimit, apiCallsLimit, transfersLimit, membersLimit)' },
        { status: 400 }
      );
    }

    // Verificar si el slug ya existe
    const existing = await prisma.plan.findUnique({
      where: { slug }
    });

    if (existing) {
      return NextResponse.json(
        { error: `Plan with slug "${slug}" already exists` },
        { status: 409 }
      );
    }

    // Crear plan
    const newPlan = await prisma.plan.create({
      data: {
        name,
        slug,
        description,
        price: price || 0,
        currency,
        stripePriceId,
        tokensLimit,
        apiCallsLimit,
        transfersLimit,
        membersLimit,
        features: features || [],
        isPublic,
        isActive,
        sortOrder
      }
    });

    return NextResponse.json({
      success: true,
      plan: {
        ...newPlan,
        price: Number(newPlan.price)
      },
      message: `Plan "${newPlan.name}" created successfully`
    }, { status: 201 });

  } catch (error) {
    console.error('Error creating plan:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
