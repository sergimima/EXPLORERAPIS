import { NextRequest, NextResponse } from 'next/server';
import { getTenantContext } from '@/lib/tenant-context';
import { prisma } from '@/lib/db';

/**
 * GET /api/tokens/[id]/abis
 * Listar todos los ABIs del token (token + contratos de vesting)
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

  // Obtener todos los ABIs del token
  const abis = await prisma.customAbi.findMany({
    where: {
      tokenId: token.id
    },
    orderBy: {
      createdAt: 'desc'
    }
  });

  return NextResponse.json({
    abis: abis.map(abi => ({
      id: abi.id,
      contractAddress: abi.contractAddress,
      network: abi.network,
      source: abi.source,
      createdAt: abi.createdAt,
      updatedAt: abi.updatedAt,
      // No incluir el ABI completo por defecto (puede ser muy grande)
      hasAbi: true
    }))
  });
}

/**
 * POST /api/tokens/[id]/abis
 * Crear un nuevo ABI para un contrato específico
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

  const { contractAddress, network, abi, source = 'UPLOADED' } = body;

  // Validar campos requeridos
  if (!contractAddress) {
    return NextResponse.json(
      { error: 'El campo "contractAddress" es requerido' },
      { status: 400 }
    );
  }

  if (!network) {
    return NextResponse.json(
      { error: 'El campo "network" es requerido' },
      { status: 400 }
    );
  }

  // Validar que abi sea un array válido
  if (!abi || !Array.isArray(abi)) {
    return NextResponse.json(
      { error: 'El campo "abi" debe ser un array válido' },
      { status: 400 }
    );
  }

  // Validar formato básico del ABI
  try {
    JSON.stringify(abi);
  } catch (error) {
    return NextResponse.json(
      { error: 'El ABI no es un JSON válido' },
      { status: 400 }
    );
  }

  // Normalizar dirección
  const normalizedAddress = contractAddress.toLowerCase();

  // Crear o actualizar el CustomAbi
  const customAbi = await prisma.customAbi.upsert({
    where: {
      tokenId_contractAddress_network: {
        tokenId: token.id,
        contractAddress: normalizedAddress,
        network
      }
    },
    create: {
      tokenId: token.id,
      contractAddress: normalizedAddress,
      network,
      abi,
      source
    },
    update: {
      abi,
      source
    }
  });

  return NextResponse.json({
    message: 'ABI guardado correctamente',
    customAbi: {
      id: customAbi.id,
      contractAddress: customAbi.contractAddress,
      network: customAbi.network,
      source: customAbi.source,
      createdAt: customAbi.createdAt,
      updatedAt: customAbi.updatedAt
    }
  });
}
