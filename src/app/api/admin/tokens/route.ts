/**
 * API: Admin Tokens Management
 * GET /api/admin/tokens
 * Sprint 4.9: Panel global de tokens para SUPER_ADMIN
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireSuperAdmin } from '@/lib/auth-helpers';

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
    const search = searchParams.get('search'); // Buscar por symbol o address
    const organizationId = searchParams.get('organizationId'); // Filtrar por org
    const network = searchParams.get('network'); // Filtrar por red
    const sortBy = searchParams.get('sortBy') || 'createdAt'; // created, transfers, symbol
    const order = searchParams.get('order') || 'desc'; // asc, desc

    // Construir filtro
    const where: any = {};

    if (search) {
      where.OR = [
        { symbol: { contains: search, mode: 'insensitive' } },
        { address: { contains: search, mode: 'insensitive' } }
      ];
    }

    if (organizationId) {
      where.organizationId = organizationId;
    }

    if (network) {
      where.network = network;
    }

    // Obtener todos los tokens con stats
    const tokens = await prisma.token.findMany({
      where,
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            logoUrl: true
          }
        },
        _count: {
          select: {
            contracts: true,
            transferCache: true
          }
        },
        settings: {
          select: {
            customBasescanApiKey: true,
            customEtherscanApiKey: true,
            customMoralisApiKey: true,
            customQuiknodeUrl: true
          }
        }
      },
      orderBy: sortBy === 'symbol'
        ? { symbol: order as any }
        : sortBy === 'transfers'
        ? { transferCache: { _count: order as any } }
        : { createdAt: order as any }
    });

    // Calcular estadísticas globales
    const stats = {
      total: tokens.length,
      byNetwork: {
        base: tokens.filter(t => t.network === 'base').length,
        'base-testnet': tokens.filter(t => t.network === 'base-testnet').length,
        'base-sepolia': tokens.filter(t => t.network === 'base-sepolia').length
      },
      active: tokens.filter(t => t.isActive).length,
      verified: tokens.filter(t => t.isVerified).length,
      withCustomApis: tokens.filter(t =>
        t.settings && (
          !!t.settings.customBasescanApiKey ||
          !!t.settings.customEtherscanApiKey ||
          !!t.settings.customMoralisApiKey ||
          !!t.settings.customQuiknodeUrl
        )
      ).length
    };

    // Formatear respuesta
    const formattedTokens = tokens.map(token => {
      const hasCustomApis = token.settings && (
        !!token.settings.customBasescanApiKey ||
        !!token.settings.customEtherscanApiKey ||
        !!token.settings.customMoralisApiKey ||
        !!token.settings.customQuiknodeUrl
      );

      return {
        id: token.id,
        symbol: token.symbol,
        name: token.name,
        address: token.address,
        network: token.network,
        logoUrl: token.logoUrl,
        decimals: token.decimals,
        isActive: token.isActive,
        isVerified: token.isVerified,
        hasCustomApis,
        organization: token.organization,
        contractsCount: token._count.contracts,
        transfersCount: token._count.transferCache,
        createdAt: token.createdAt,
        updatedAt: token.updatedAt
      };
    });

    return NextResponse.json({
      stats,
      tokens: formattedTokens
    });

  } catch (error) {
    console.error('Error fetching tokens:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
