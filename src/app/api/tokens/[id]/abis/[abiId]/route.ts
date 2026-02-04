import { NextRequest, NextResponse } from 'next/server';
import { getTenantContext } from '@/lib/tenant-context';
import { prisma } from '@/lib/db';

/**
 * GET /api/tokens/[id]/abis/[abiId]
 * Obtener un ABI específico por ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; abiId: string }> }
) {
  const tenantContext = await getTenantContext();

  if (!tenantContext) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  const { id: tokenId, abiId } = await params;

  // Verificar que el token pertenece a la organización
  const token = await prisma.token.findFirst({
    where: {
      id: tokenId,
      organizationId: tenantContext.organizationId
    }
  });

  if (!token) {
    return NextResponse.json({ error: 'Token no encontrado' }, { status: 404 });
  }

  // Obtener el ABI específico
  const customAbi = await prisma.customAbi.findFirst({
    where: {
      id: abiId,
      tokenId: token.id
    }
  });

  if (!customAbi) {
    return NextResponse.json({ error: 'ABI no encontrado' }, { status: 404 });
  }

  return NextResponse.json({
    id: customAbi.id,
    contractAddress: customAbi.contractAddress,
    network: customAbi.network,
    abi: customAbi.abi,
    source: customAbi.source,
    createdAt: customAbi.createdAt,
    updatedAt: customAbi.updatedAt
  });
}

/**
 * DELETE /api/tokens/[id]/abis/[abiId]
 * Eliminar un ABI específico
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; abiId: string }> }
) {
  const tenantContext = await getTenantContext();

  if (!tenantContext) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  const { id: tokenId, abiId } = await params;

  // Verificar que el token pertenece a la organización
  const token = await prisma.token.findFirst({
    where: {
      id: tokenId,
      organizationId: tenantContext.organizationId
    }
  });

  if (!token) {
    return NextResponse.json({ error: 'Token no encontrado' }, { status: 404 });
  }

  // Verificar que el ABI pertenece al token
  const customAbi = await prisma.customAbi.findFirst({
    where: {
      id: abiId,
      tokenId: token.id
    }
  });

  if (!customAbi) {
    return NextResponse.json({ error: 'ABI no encontrado' }, { status: 404 });
  }

  // Eliminar el ABI
  await prisma.customAbi.delete({
    where: {
      id: abiId
    }
  });

  return NextResponse.json({
    message: 'ABI eliminado correctamente'
  });
}

/**
 * PUT /api/tokens/[id]/abis/[abiId]
 * Actualizar un ABI específico
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; abiId: string }> }
) {
  const tenantContext = await getTenantContext();

  if (!tenantContext) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  const { id: tokenId, abiId } = await params;

  // Verificar que el token pertenece a la organización
  const token = await prisma.token.findFirst({
    where: {
      id: tokenId,
      organizationId: tenantContext.organizationId
    }
  });

  if (!token) {
    return NextResponse.json({ error: 'Token no encontrado' }, { status: 404 });
  }

  // Verificar que el ABI pertenece al token
  const existingAbi = await prisma.customAbi.findFirst({
    where: {
      id: abiId,
      tokenId: token.id
    }
  });

  if (!existingAbi) {
    return NextResponse.json({ error: 'ABI no encontrado' }, { status: 404 });
  }

  let body;
  try {
    body = await request.json();
  } catch (error) {
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 });
  }

  const { abi, source } = body;

  // Validar que abi sea un array válido si se proporciona
  if (abi !== undefined && !Array.isArray(abi)) {
    return NextResponse.json(
      { error: 'El campo "abi" debe ser un array válido' },
      { status: 400 }
    );
  }

  // Validar formato básico del ABI si se proporciona
  if (abi) {
    try {
      JSON.stringify(abi);
    } catch (error) {
      return NextResponse.json(
        { error: 'El ABI no es un JSON válido' },
        { status: 400 }
      );
    }
  }

  // Actualizar el ABI
  const updatedAbi = await prisma.customAbi.update({
    where: {
      id: abiId
    },
    data: {
      ...(abi && { abi }),
      ...(source && { source })
    }
  });

  return NextResponse.json({
    message: 'ABI actualizado correctamente',
    customAbi: {
      id: updatedAbi.id,
      contractAddress: updatedAbi.contractAddress,
      network: updatedAbi.network,
      source: updatedAbi.source,
      createdAt: updatedAbi.createdAt,
      updatedAt: updatedAbi.updatedAt
    }
  });
}
