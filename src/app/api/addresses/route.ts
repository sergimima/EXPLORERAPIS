import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// GET: Obtener información de una address o todas las addresses conocidas
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const address = searchParams.get('address');

  try {
    // Si no se proporciona address, devolver todas las addresses conocidas
    if (!address) {
      const knownAddresses = await prisma.knownAddress.findMany({
        orderBy: {
          name: 'asc'
        }
      });
      return NextResponse.json({ knownAddresses });
    }

    // Si se proporciona address, buscar esa específica
    const knownAddress = await prisma.knownAddress.findUnique({
      where: {
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
    const body = await request.json();
    const { address, name, type, category, description, tags, color } = body;

    if (!address || !name) {
      return NextResponse.json(
        { error: 'Address and name are required' },
        { status: 400 }
      );
    }

    // Upsert: crear si no existe, actualizar si existe
    const knownAddress = await prisma.knownAddress.upsert({
      where: {
        address: address.toLowerCase(),
      },
      update: {
        name,
        type: type || 'UNKNOWN',
        category,
        description,
        tags: tags || [],
        color,
      },
      create: {
        address: address.toLowerCase(),
        name,
        type: type || 'UNKNOWN',
        category,
        description,
        tags: tags || [],
        color,
      },
    });

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
    await prisma.knownAddress.delete({
      where: {
        address: address.toLowerCase(),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting address:', error);
    return NextResponse.json(
      { error: 'Failed to delete address' },
      { status: 500 }
    );
  }
}
