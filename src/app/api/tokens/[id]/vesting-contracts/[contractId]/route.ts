import { NextRequest, NextResponse } from 'next/server';
import { getTenantContext } from '@/lib/tenant-context';
import { prisma } from '@/lib/db';

/**
 * PATCH /api/tokens/[id]/vesting-contracts/[contractId]
 * Actualizar un vesting contract
 * Body: { name?, isActive?, category?, description? }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; contractId: string }> }
) {
  const tenantContext = await getTenantContext();

  if (!tenantContext) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  const { id: tokenId, contractId } = await params;

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

  // Verificar que el contrato existe y pertenece al token
  const existingContract = await prisma.contract.findFirst({
    where: {
      id: contractId,
      tokenId
    }
  });

  if (!existingContract) {
    return NextResponse.json(
      { error: 'Contrato no encontrado' },
      { status: 404 }
    );
  }

  let body;
  try {
    body = await request.json();
  } catch (error) {
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 });
  }

  const { name, isActive, category, description } = body;

  // Construir objeto de actualización solo con campos proporcionados
  const updateData: any = {};

  if (name !== undefined) {
    if (!name.trim()) {
      return NextResponse.json(
        { error: 'El campo "name" no puede estar vacío' },
        { status: 400 }
      );
    }
    updateData.name = name.trim();
  }

  if (isActive !== undefined) {
    if (typeof isActive !== 'boolean') {
      return NextResponse.json(
        { error: 'El campo "isActive" debe ser un booleano' },
        { status: 400 }
      );
    }
    updateData.isActive = isActive;
  }

  if (category !== undefined) {
    const validCategories = ['VESTING', 'STAKING', 'LIQUIDITY', 'DAO', 'TREASURY', 'MARKETING', 'TEAM', 'OTHER'] as const;
    const categoryValue = category?.trim()?.toUpperCase() || 'OTHER';
    updateData.category = validCategories.includes(categoryValue) ? categoryValue : 'OTHER';
  }

  if (description !== undefined) {
    updateData.description = description?.trim() || null;
  }

  // Si no hay campos para actualizar
  if (Object.keys(updateData).length === 0) {
    return NextResponse.json(
      { error: 'No se proporcionaron campos para actualizar' },
      { status: 400 }
    );
  }

  // Actualizar el contrato
  const updatedContract = await prisma.contract.update({
    where: {
      id: contractId
    },
    data: updateData
  });

  return NextResponse.json({
    message: 'Contrato actualizado correctamente',
    contract: updatedContract
  });
}

/**
 * DELETE /api/tokens/[id]/vesting-contracts/[contractId]
 * Eliminar un contrato
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; contractId: string }> }
) {
  const tenantContext = await getTenantContext();

  if (!tenantContext) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  const { id: tokenId, contractId } = await params;

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

  // Verificar que el contrato existe y pertenece al token
  const existingContract = await prisma.contract.findFirst({
    where: {
      id: contractId,
      tokenId
    }
  });

  if (!existingContract) {
    return NextResponse.json(
      { error: 'Contrato no encontrado' },
      { status: 404 }
    );
  }

  // Eliminar el contrato
  await prisma.contract.delete({
    where: {
      id: contractId
    }
  });

  return NextResponse.json({
    message: 'Vesting contract eliminado correctamente'
  });
}
