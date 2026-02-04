import { NextRequest, NextResponse } from 'next/server';
import { getTenantContext } from '@/lib/tenant-context';
import { prisma } from '@/lib/db';

// ABI estándar de ERC20
const STANDARD_ERC20_ABI = [
  {
    constant: true,
    inputs: [],
    name: 'name',
    outputs: [{ name: '', type: 'string' }],
    type: 'function'
  },
  {
    constant: true,
    inputs: [],
    name: 'symbol',
    outputs: [{ name: '', type: 'string' }],
    type: 'function'
  },
  {
    constant: true,
    inputs: [],
    name: 'decimals',
    outputs: [{ name: '', type: 'uint8' }],
    type: 'function'
  },
  {
    constant: true,
    inputs: [],
    name: 'totalSupply',
    outputs: [{ name: '', type: 'uint256' }],
    type: 'function'
  },
  {
    constant: true,
    inputs: [{ name: '_owner', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: 'balance', type: 'uint256' }],
    type: 'function'
  },
  {
    constant: false,
    inputs: [
      { name: '_to', type: 'address' },
      { name: '_value', type: 'uint256' }
    ],
    name: 'transfer',
    outputs: [{ name: '', type: 'bool' }],
    type: 'function'
  },
  {
    constant: false,
    inputs: [
      { name: '_from', type: 'address' },
      { name: '_to', type: 'address' },
      { name: '_value', type: 'uint256' }
    ],
    name: 'transferFrom',
    outputs: [{ name: '', type: 'bool' }],
    type: 'function'
  },
  {
    constant: false,
    inputs: [
      { name: '_spender', type: 'address' },
      { name: '_value', type: 'uint256' }
    ],
    name: 'approve',
    outputs: [{ name: '', type: 'bool' }],
    type: 'function'
  },
  {
    constant: true,
    inputs: [
      { name: '_owner', type: 'address' },
      { name: '_spender', type: 'address' }
    ],
    name: 'allowance',
    outputs: [{ name: '', type: 'uint256' }],
    type: 'function'
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'from', type: 'address' },
      { indexed: true, name: 'to', type: 'address' },
      { indexed: false, name: 'value', type: 'uint256' }
    ],
    name: 'Transfer',
    type: 'event'
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'owner', type: 'address' },
      { indexed: true, name: 'spender', type: 'address' },
      { indexed: false, name: 'value', type: 'uint256' }
    ],
    name: 'Approval',
    type: 'event'
  }
];

/**
 * GET /api/tokens/[id]/abi
 * Obtener el ABI del token (custom o estándar ERC20)
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

  // Buscar ABI custom del token (contractAddress = token.address)
  const customAbi = await prisma.customAbi.findUnique({
    where: {
      tokenId_contractAddress_network: {
        tokenId: token.id,
        contractAddress: token.address.toLowerCase(),
        network: token.network
      }
    }
  });

  // Si hay ABI custom, devolverlo
  if (customAbi) {
    return NextResponse.json({
      abi: customAbi.abi,
      source: customAbi.source,
      createdAt: customAbi.createdAt,
      updatedAt: customAbi.updatedAt
    });
  }

  // Si no, devolver ABI estándar ERC20
  return NextResponse.json({
    abi: STANDARD_ERC20_ABI,
    source: 'STANDARD',
    createdAt: null,
    updatedAt: null
  });
}

/**
 * POST /api/tokens/[id]/abi
 * Subir un ABI custom en formato JSON
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

  const { abi, source = 'UPLOADED' } = body;

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

  // Crear o actualizar el CustomAbi del token
  const customAbi = await prisma.customAbi.upsert({
    where: {
      tokenId_contractAddress_network: {
        tokenId: token.id,
        contractAddress: token.address.toLowerCase(),
        network: token.network
      }
    },
    create: {
      tokenId: token.id,
      contractAddress: token.address.toLowerCase(),
      network: token.network,
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
      source: customAbi.source,
      createdAt: customAbi.createdAt,
      updatedAt: customAbi.updatedAt
    }
  });
}

/**
 * DELETE /api/tokens/[id]/abi
 * Eliminar el ABI custom y volver al estándar ERC20
 */
export async function DELETE(
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

  // Eliminar el CustomAbi del token si existe
  try {
    await prisma.customAbi.delete({
      where: {
        tokenId_contractAddress_network: {
          tokenId: token.id,
          contractAddress: token.address.toLowerCase(),
          network: token.network
        }
      }
    });

    return NextResponse.json({
      message: 'ABI custom eliminado. Ahora se usará el ABI estándar ERC20.'
    });
  } catch (error) {
    // Si no existe, no hay problema
    return NextResponse.json({
      message: 'No había ABI custom configurado. Ya se está usando el ABI estándar.'
    });
  }
}
