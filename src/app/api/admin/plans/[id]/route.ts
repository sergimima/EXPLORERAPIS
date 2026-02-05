import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireSuperAdmin } from '@/lib/auth-helpers';

/**
 * GET /api/admin/plans/[id]
 *
 * Obtiene un plan específico
 * Solo accesible para SUPER_ADMIN
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await requireSuperAdmin();
  if (!session) {
    return NextResponse.json(
      { error: 'Forbidden: SUPER_ADMIN required' },
      { status: 403 }
    );
  }

  try {
    const planId = params.id;

    const plan = await prisma.plan.findUnique({
      where: { id: planId },
      include: {
        _count: {
          select: {
            subscriptions: true
          }
        }
      }
    });

    if (!plan) {
      return NextResponse.json(
        { error: 'Plan not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      plan: {
        ...plan,
        price: Number(plan.price),
        subscriptionsCount: plan._count.subscriptions
      }
    });

  } catch (error) {
    console.error('Error fetching plan:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/plans/[id]
 *
 * Actualiza un plan existente
 * Solo accesible para SUPER_ADMIN
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await requireSuperAdmin();
  if (!session) {
    return NextResponse.json(
      { error: 'Forbidden: SUPER_ADMIN required' },
      { status: 403 }
    );
  }

  try {
    const planId = params.id;
    const body = await request.json();

    // Verificar que el plan existe
    const existingPlan = await prisma.plan.findUnique({
      where: { id: planId }
    });

    if (!existingPlan) {
      return NextResponse.json(
        { error: 'Plan not found' },
        { status: 404 }
      );
    }

    // Si se está cambiando el slug, verificar que no exista otro plan con ese slug
    if (body.slug && body.slug !== existingPlan.slug) {
      const duplicateSlug = await prisma.plan.findUnique({
        where: { slug: body.slug }
      });

      if (duplicateSlug) {
        return NextResponse.json(
          { error: `Plan with slug "${body.slug}" already exists` },
          { status: 409 }
        );
      }
    }

    // Actualizar plan
    const updatedPlan = await prisma.plan.update({
      where: { id: planId },
      data: {
        name: body.name,
        slug: body.slug,
        description: body.description,
        price: body.price !== undefined ? body.price : undefined,
        currency: body.currency,
        stripePriceId: body.stripePriceId,
        tokensLimit: body.tokensLimit,
        apiCallsLimit: body.apiCallsLimit,
        transfersLimit: body.transfersLimit,
        membersLimit: body.membersLimit,
        features: body.features,
        isPublic: body.isPublic,
        isActive: body.isActive,
        sortOrder: body.sortOrder
      }
    });

    // Si se actualizaron los límites, actualizar todas las subscriptions que usan este plan
    if (
      body.tokensLimit !== undefined ||
      body.apiCallsLimit !== undefined ||
      body.transfersLimit !== undefined ||
      body.membersLimit !== undefined
    ) {
      await prisma.subscription.updateMany({
        where: { planId },
        data: {
          tokensLimit: updatedPlan.tokensLimit,
          apiCallsLimit: updatedPlan.apiCallsLimit,
          transfersLimit: updatedPlan.transfersLimit,
          membersLimit: updatedPlan.membersLimit
        }
      });
    }

    return NextResponse.json({
      success: true,
      plan: {
        ...updatedPlan,
        price: Number(updatedPlan.price)
      },
      message: `Plan "${updatedPlan.name}" updated successfully`
    });

  } catch (error) {
    console.error('Error updating plan:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/plans/[id]
 *
 * Elimina un plan (solo si no tiene subscriptions activas)
 * Solo accesible para SUPER_ADMIN
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await requireSuperAdmin();
  if (!session) {
    return NextResponse.json(
      { error: 'Forbidden: SUPER_ADMIN required' },
      { status: 403 }
    );
  }

  try {
    const planId = params.id;

    // Verificar que el plan existe
    const plan = await prisma.plan.findUnique({
      where: { id: planId },
      include: {
        _count: {
          select: {
            subscriptions: true
          }
        }
      }
    });

    if (!plan) {
      return NextResponse.json(
        { error: 'Plan not found' },
        { status: 404 }
      );
    }

    // No permitir eliminar si hay subscriptions activas
    if (plan._count.subscriptions > 0) {
      return NextResponse.json(
        {
          error: `Cannot delete plan "${plan.name}" because it has ${plan._count.subscriptions} active subscription(s)`,
          subscriptionsCount: plan._count.subscriptions
        },
        { status: 400 }
      );
    }

    // Eliminar plan
    await prisma.plan.delete({
      where: { id: planId }
    });

    return NextResponse.json({
      success: true,
      message: `Plan "${plan.name}" deleted successfully`
    });

  } catch (error) {
    console.error('Error deleting plan:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
