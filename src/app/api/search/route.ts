import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getTenantContext } from '@/lib/tenant-context';

export const dynamic = 'force-dynamic';

interface SearchResult {
  type: 'address' | 'transaction' | 'token';
  value: string;
  label?: string;
  description?: string;
}

export async function GET(request: NextRequest) {
  try {
    // Validar tenant context
    const tenantContext = await getTenantContext();

    if (!tenantContext) {
      return NextResponse.json(
        { error: 'No autenticado' },
        { status: 401 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q');

    if (!query || query.trim().length < 3) {
      return NextResponse.json({ results: [] });
    }

    const results: SearchResult[] = [];
    const queryLower = query.toLowerCase().trim();
    const tokenId = tenantContext.activeToken?.id;

    // 1. Buscar en KnownAddress (direcciones etiquetadas) - filtrado por tokenId
    try {
      const knownAddresses = await prisma.knownAddress.findMany({
        where: {
          AND: [
            { tokenId: tokenId },
            {
              OR: [
                { address: { contains: queryLower, mode: 'insensitive' } },
                { name: { contains: queryLower, mode: 'insensitive' } },
                { description: { contains: queryLower, mode: 'insensitive' } },
                { category: { contains: queryLower, mode: 'insensitive' } },
              ],
            }
          ]
        },
        take: 5,
      });

      knownAddresses.forEach((addr) => {
        results.push({
          type: 'address',
          value: addr.address,
          label: addr.name,
          description: `${addr.type} - ${addr.description || addr.category || 'Sin descripción'}`,
        });
      });
    } catch (error) {
      console.error('Error buscando en KnownAddress:', error);
    }

    // 2. Detectar si es una dirección válida (0x...)
    if (/^0x[a-fA-F0-9]{40}$/.test(query)) {
      // Es una dirección completa
      const existingIndex = results.findIndex((r) => r.value.toLowerCase() === queryLower);
      if (existingIndex === -1) {
        results.unshift({
          type: 'address',
          value: query,
          label: 'Dirección Ethereum',
          description: 'Dirección completa (no etiquetada)',
        });
      }
    } else if (/^0x[a-fA-F0-9]+$/.test(query) && query.length < 42) {
      // Es un prefijo de dirección (búsqueda parcial)
      results.push({
        type: 'address',
        value: query,
        label: 'Buscar dirección',
        description: `Direcciones que empiezan con ${query}`,
      });
    }

    // 3. Detectar si es un hash de transacción (0x... con 64 caracteres hex)
    if (/^0x[a-fA-F0-9]{64}$/.test(query)) {
      results.unshift({
        type: 'transaction',
        value: query,
        label: 'Hash de Transacción',
        description: 'Ver en BaseScan',
      });
    }

    // 4. Buscar tokens de la organización
    try {
      const tokens = await prisma.token.findMany({
        where: {
          AND: [
            { organizationId: tenantContext.organizationId },
            {
              OR: [
                { address: { contains: queryLower, mode: 'insensitive' } },
                { symbol: { contains: queryLower, mode: 'insensitive' } },
              ],
            }
          ]
        },
        take: 3,
      });

      tokens.forEach((token) => {
        results.push({
          type: 'token',
          value: token.address,
          label: `${token.symbol}${token.decimals ? ` (${token.decimals} decimals)` : ''}`,
          description: 'Ver analytics del token',
        });
      });
    } catch (error) {
      console.error('Error buscando tokens:', error);
    }

    // 5. Buscar en TransferCache (direcciones que han hecho transfers) - filtrado por tokenId
    try {
      const transferAddresses = await prisma.transferCache.findMany({
        where: {
          AND: [
            { tokenId: tokenId },
            {
              OR: [
                { from: { contains: queryLower, mode: 'insensitive' } },
                { to: { contains: queryLower, mode: 'insensitive' } },
              ],
            }
          ]
        },
        select: {
          from: true,
          to: true,
        },
        distinct: ['from', 'to'],
        take: 3,
      });

      const uniqueAddresses = new Set<string>();
      transferAddresses.forEach((tx) => {
        if (tx.from.toLowerCase().includes(queryLower)) uniqueAddresses.add(tx.from);
        if (tx.to.toLowerCase().includes(queryLower)) uniqueAddresses.add(tx.to);
      });

      uniqueAddresses.forEach((addr) => {
        // No duplicar si ya existe
        if (!results.some((r) => r.value.toLowerCase() === addr.toLowerCase())) {
          results.push({
            type: 'address',
            value: addr,
            label: 'Dirección con actividad',
            description: 'Encontrada en transferencias recientes',
          });
        }
      });
    } catch (error) {
      console.error('Error buscando en TransferCache:', error);
    }

    // Limitar a 10 resultados
    const limitedResults = results.slice(0, 10);

    return NextResponse.json({
      results: limitedResults,
      query: query,
      count: limitedResults.length,
    });
  } catch (error: any) {
    console.error('Error en búsqueda global:', error);
    return NextResponse.json(
      { error: error.message || 'Error en búsqueda global', results: [] },
      { status: 500 }
    );
  }
}
