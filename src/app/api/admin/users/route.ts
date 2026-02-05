import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireSuperAdmin } from '@/lib/auth-helpers';

/**
 * GET /api/admin/users
 *
 * Lista todos los usuarios del sistema con sus organizaciones
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
    const roleFilter = searchParams.get('role'); // "SUPER_ADMIN", "ADMIN", "MEMBER", "VIEWER"
    const search = searchParams.get('search'); // búsqueda por email/nombre

    // Construir filtro base
    const where: any = {};

    // Filtro por rol
    if (roleFilter) {
      where.role = roleFilter;
    }

    // Filtro por email o nombre
    if (search) {
      where.OR = [
        {
          email: {
            contains: search,
            mode: 'insensitive'
          }
        },
        {
          name: {
            contains: search,
            mode: 'insensitive'
          }
        }
      ];
    }

    // Obtener todos los usuarios con sus relaciones
    const users = await prisma.user.findMany({
      where,
      include: {
        memberships: {
          include: {
            organization: {
              select: {
                id: true,
                name: true,
                slug: true
              }
            }
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Obtener organizaciones donde el usuario es owner
    const userIds = users.map(u => u.id);
    const ownedOrganizations = await prisma.organization.findMany({
      where: {
        ownerId: { in: userIds }
      },
      select: {
        id: true,
        name: true,
        slug: true,
        ownerId: true
      }
    });

    // Agrupar organizaciones por ownerId
    const orgsByOwner = ownedOrganizations.reduce((acc, org) => {
      if (!acc[org.ownerId]) {
        acc[org.ownerId] = [];
      }
      acc[org.ownerId].push({
        id: org.id,
        name: org.name,
        slug: org.slug
      });
      return acc;
    }, {} as Record<string, Array<{ id: string; name: string; slug: string }>>);

    // Formatear respuesta
    const formattedUsers = users.map(user => {
      const userOwnedOrgs = orgsByOwner[user.id] || [];

      return {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        image: user.image,
        emailVerified: user.emailVerified,
        organizationsCount: user.memberships.length,
        ownedOrganizationsCount: userOwnedOrgs.length,
        organizations: user.memberships.map(m => ({
          id: m.organization.id,
          name: m.organization.name,
          slug: m.organization.slug,
          memberRole: m.role,
          joinedAt: m.joinedAt
        })),
        ownedOrganizations: userOwnedOrgs,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      };
    });

    // Calcular estadísticas globales
    const stats = {
      total: formattedUsers.length,
      byRole: formattedUsers.reduce((acc, user) => {
        acc[user.role] = (acc[user.role] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      withoutOrganizations: formattedUsers.filter(u => u.organizationsCount === 0).length,
      verified: formattedUsers.filter(u => u.emailVerified).length
    };

    return NextResponse.json({
      users: formattedUsers,
      stats
    });

  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
