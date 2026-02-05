import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireSuperAdmin } from '@/lib/auth-helpers';

/**
 * POST /api/admin/plans/reorder
 *
 * Reordena los planes por sortOrder
 * Body: { order: string[] } - array de IDs en el nuevo orden (index = sortOrder)
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
    const { order } = body as { order: string[] };

    if (!Array.isArray(order) || order.length === 0) {
      return NextResponse.json(
        { error: 'order must be a non-empty array of plan IDs' },
        { status: 400 }
      );
    }

    await prisma.$transaction(
      order.map((planId, index) =>
        prisma.plan.update({
          where: { id: planId },
          data: { sortOrder: index }
        })
      )
    );

    return NextResponse.json({
      success: true,
      message: 'Plans reordered successfully'
    });
  } catch (error) {
    console.error('Error reordering plans:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
