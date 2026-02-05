import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireSuperAdmin } from '@/lib/auth-helpers';

/**
 * GET /api/admin/organizations
 *
 * Lista todas las organizaciones con sus subscriptions, miembros y tokens
 * Solo accesible para SUPER_ADMIN
 */
export async function GET(request: NextRequest) {
  // Verificar permisos
  const session = await requireSuperAdmin();
  if (!session) {
    return NextResponse.json(
      { error: 'Forbidden: SUPER_ADMIN required' },
      { status: 403 }
    );
  }

  try {
    const searchParams = request.nextUrl.searchParams;
    const planFilter = searchParams.get('plan'); // "free", "pro", "enterprise"
    const statusFilter = searchParams.get('status'); // "ACTIVE", "CANCELED", etc.
    const search = searchParams.get('search'); // búsqueda por nombre

    // Construir filtro base
    const where: any = {};

    // Filtro por nombre
    if (search) {
      where.name = {
        contains: search,
        mode: 'insensitive'
      };
    }

    // Obtener todas las organizaciones con sus relaciones
    const organizations = await prisma.organization.findMany({
      where,
      include: {
        subscription: {
          include: {
            planRelation: true // Incluir el plan completo
          }
        },
        members: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                role: true
              }
            }
          }
        },
        tokens: {
          select: {
            id: true,
            name: true,
            symbol: true,
            address: true,
            isActive: true,
            settings: {
              select: {
                customBasescanApiKey: true,
                customEtherscanApiKey: true,
                customMoralisApiKey: true,
                customQuiknodeUrl: true
              }
            }
          }
        },
        users: {
          where: {
            role: { in: ['ADMIN', 'SUPER_ADMIN'] }
          },
          select: {
            id: true,
            name: true,
            email: true,
            role: true
          },
          take: 1 // Solo el owner
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Aplicar filtros adicionales en memoria (por plan y status)
    let filtered = organizations;

    if (planFilter) {
      filtered = filtered.filter(org => {
        const plan = org.subscription?.planRelation;
        return plan?.slug.toLowerCase() === planFilter.toLowerCase();
      });
    }

    if (statusFilter) {
      filtered = filtered.filter(org => {
        return org.subscription?.status === statusFilter;
      });
    }

    // Formatear respuesta
    const formattedOrgs = filtered.map(org => {
      const owner = org.users[0] || null;
      const subscription = org.subscription;
      const plan = subscription?.planRelation;

      // Calcular MRR (Monthly Recurring Revenue)
      const mrr = plan ? Number(plan.price) : 0;

      // Detectar si algún token tiene custom API keys
      const hasCustomApis = org.tokens.some(token =>
        token.settings && (
          !!token.settings.customBasescanApiKey ||
          !!token.settings.customEtherscanApiKey ||
          !!token.settings.customMoralisApiKey ||
          !!token.settings.customQuiknodeUrl
        )
      );

      return {
        id: org.id,
        name: org.name,
        slug: org.slug,
        logoUrl: org.logoUrl,
        website: org.website,
        ownerId: org.ownerId,
        owner: owner ? {
          id: owner.id,
          name: owner.name,
          email: owner.email,
          role: owner.role
        } : null,
        subscription: subscription ? {
          id: subscription.id,
          plan: {
            id: plan?.id,
            name: plan?.name,
            slug: plan?.slug,
            price: plan ? Number(plan.price) : 0
          },
          status: subscription.status,
          tokensCount: subscription.tokensCount,
          tokensLimit: subscription.tokensLimit,
          apiCallsThisMonth: subscription.apiCallsThisMonth,
          apiCallsLimit: subscription.apiCallsLimit,
          transfersLimit: subscription.transfersLimit,
          membersLimit: subscription.membersLimit,
          billingCycleStart: subscription.billingCycleStart,
          billingCycleEnd: subscription.billingCycleEnd,
          createdAt: subscription.createdAt
        } : null,
        membersCount: org.members.length,
        tokensCount: org.tokens.length,
        hasCustomApis,
        mrr,
        createdAt: org.createdAt,
        updatedAt: org.updatedAt
      };
    });

    // Calcular estadísticas globales
    const stats = {
      total: formattedOrgs.length,
      byPlan: formattedOrgs.reduce((acc, org) => {
        const planSlug = org.subscription?.plan.slug || 'none';
        acc[planSlug] = (acc[planSlug] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      byStatus: formattedOrgs.reduce((acc, org) => {
        const status = org.subscription?.status || 'none';
        acc[status] = (acc[status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      totalMrr: formattedOrgs.reduce((sum, org) => sum + org.mrr, 0)
    };

    return NextResponse.json({
      organizations: formattedOrgs,
      stats
    });

  } catch (error) {
    console.error('Error fetching organizations:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
