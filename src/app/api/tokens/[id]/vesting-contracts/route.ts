import { NextRequest, NextResponse } from 'next/server';
import { getTenantContext } from '@/lib/tenant-context';
import { prisma } from '@/lib/db';

/**
 * GET /api/tokens/[id]/vesting-contracts
 * Listar vesting contracts de un token
 * Query params:
 *   - active: true/false (filtrar por activos)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const tenantContext = await getTenantContext();

  if (!tenantContext) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  const tokenId = params.id;

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

  // Obtener query params
  const { searchParams } = new URL(request.url);
  const activeFilter = searchParams.get('active');

  // Construir where clause
  const where: any = {
    tokenId
  };

  if (activeFilter !== null) {
    where.isActive = activeFilter === 'true';
  }

  // Obtener vesting contracts
  const vestingContracts = await prisma.vestingContract.findMany({
    where,
    orderBy: {
      createdAt: 'desc'
    }
  });

  return NextResponse.json({
    contracts: vestingContracts,
    total: vestingContracts.length
  });
}

/**
 * POST /api/tokens/[id]/vesting-contracts
 * Crear un nuevo vesting contract
 * Body: { name, address, network?, category?, description? }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const tenantContext = await getTenantContext();

  if (!tenantContext) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  const tokenId = params.id;

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

  let body;
  try {
    body = await request.json();
  } catch (error) {
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 });
  }

  const {
    name,
    address,
    network = token.network, // Por defecto usar la red del token
    category,
    description
  } = body;

  // Validaciones
  if (!name || !name.trim()) {
    return NextResponse.json(
      { error: 'El campo "name" es requerido' },
      { status: 400 }
    );
  }

  if (!address || !address.trim()) {
    return NextResponse.json(
      { error: 'El campo "address" es requerido' },
      { status: 400 }
    );
  }

  // Validar formato de dirección (0x...)
  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
    return NextResponse.json(
      { error: 'Dirección de contrato inválida. Debe ser un address Ethereum válido (0x...)' },
      { status: 400 }
    );
  }

  // Verificar que no exista duplicado
  const existing = await prisma.vestingContract.findFirst({
    where: {
      tokenId,
      address: address.toLowerCase(),
      network
    }
  });

  if (existing) {
    return NextResponse.json(
      { error: 'Ya existe un vesting contract con esta dirección y red para este token' },
      { status: 409 }
    );
  }

  // Crear el vesting contract
  const vestingContract = await prisma.vestingContract.create({
    data: {
      tokenId,
      name: name.trim(),
      address: address.toLowerCase(),
      network,
      category: category?.trim() || null,
      description: description?.trim() || null,
      createdBy: tenantContext.userId
    }
  });

  return NextResponse.json({
    message: 'Vesting contract creado correctamente',
    contract: vestingContract
  }, { status: 201 });
}
