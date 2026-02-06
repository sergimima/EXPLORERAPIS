import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getTenantContext } from '@/lib/tenant-context';

// GET: Obtener información de una address o todas las addresses conocidas
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const address = searchParams.get('address');

  try {
    // Validate tenant context
    const tenantContext = await getTenantContext();
    if (!tenantContext) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }
    if (!tenantContext.activeToken) {
      return NextResponse.json({ error: 'No hay token configurado' }, { status: 400 });
    }

    const tokenId = tenantContext.activeToken.id;

    // Si no se proporciona address, devolver todas las addresses conocidas del token
    if (!address) {
      const knownAddresses = await prisma.knownAddress.findMany({
        where: { tokenId },
        orderBy: { name: 'asc' }
      });
      return NextResponse.json({ knownAddresses });
    }

    // Si se proporciona address, buscar esa específica para el token actual
    const knownAddress = await prisma.knownAddress.findFirst({
      where: {
        tokenId,
        address: address.toLowerCase(),
      },
    });

    return NextResponse.json({ knownAddress });
  } catch (error) {
    console.error('Error fetching address:', error);
    return NextResponse.json(
      { error: 'Failed to fetch address' },
      { status: 500 }
    );
  }
}

// POST: Crear o actualizar nombre de una address
export async function POST(request: NextRequest) {
  try {
    // Validate tenant context
    const tenantContext = await getTenantContext();
    if (!tenantContext) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }
    if (!tenantContext.activeToken) {
      return NextResponse.json({ error: 'No hay token configurado' }, { status: 400 });
    }

    const tokenId = tenantContext.activeToken.id;

    const body = await request.json();
    const { address, name, type, category, description, tags, color, isFavorite } = body;

    if (!address || !name) {
      return NextResponse.json(
        { error: 'Address and name are required' },
        { status: 400 }
      );
    }

    // Buscar address existente para el token actual
    const existingAddress = await prisma.knownAddress.findFirst({
      where: {
        tokenId,
        address: address.toLowerCase(),
      },
    });

    let knownAddress;
    if (existingAddress) {
      // Actualizar address existente
      knownAddress = await prisma.knownAddress.update({
        where: {
          id: existingAddress.id,
        },
        data: {
          name,
          type: type || 'UNKNOWN',
          category,
          description,
          tags: tags || [],
          color,
          ...(isFavorite !== undefined && { isFavorite }),
        },
      });
    } else {
      // Crear nueva address para el token actual
      knownAddress = await prisma.knownAddress.create({
        data: {
          tokenId,
          address: address.toLowerCase(),
          name,
          type: type || 'UNKNOWN',
          category,
          description,
          tags: tags || [],
          color,
          ...(isFavorite !== undefined && { isFavorite }),
        },
      });
    }

    return NextResponse.json({ success: true, knownAddress });
  } catch (error) {
    console.error('Error saving address:', error);
    return NextResponse.json(
      { error: 'Failed to save address' },
      { status: 500 }
    );
  }
}

// DELETE: Eliminar una address
export async function DELETE(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const address = searchParams.get('address');

  if (!address) {
    return NextResponse.json({ error: 'Address is required' }, { status: 400 });
  }

  try {
    // Validate tenant context
    const tenantContext = await getTenantContext();
    if (!tenantContext) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }
    if (!tenantContext.activeToken) {
      return NextResponse.json({ error: 'No hay token configurado' }, { status: 400 });
    }

    const tokenId = tenantContext.activeToken.id;

    // Buscar y eliminar address del token actual
    const existingAddress = await prisma.knownAddress.findFirst({
      where: {
        tokenId,
        address: address.toLowerCase(),
      },
    });

    if (existingAddress) {
      await prisma.knownAddress.delete({
        where: {
          id: existingAddress.id,
        },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting address:', error);
    return NextResponse.json(
      { error: 'Failed to delete address' },
      { status: 500 }
    );
  }
}
