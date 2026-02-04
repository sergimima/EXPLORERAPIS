import { NextRequest, NextResponse } from 'next/server';
import { getTenantContext } from '@/lib/tenant-context';
import { prisma } from '@/lib/db';

/**
 * GET /api/tokens/[id]/abis
 * Listar todos los ABIs del token (token + contratos de vesting)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const tenantContext = await getTenantContext();

  if (!tenantContext) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  const { id: tokenId } = await params;

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
    abis: abis.map(abi => {
      // Calcular contadores de métodos y eventos
      const abiArray = Array.isArray(abi.abi) ? abi.abi : [];
      const methodCount = abiArray.filter((item: any) => item.type === 'function').length;
      const eventCount = abiArray.filter((item: any) => item.type === 'event').length;

      return {
        id: abi.id,
        contractAddress: abi.contractAddress,
        network: abi.network,
        source: abi.source,
        createdAt: abi.createdAt,
        updatedAt: abi.updatedAt,
        abi: abi.abi, // Incluir ABI completo
        methodCount,
        eventCount
      };
    })
  });
}

/**
 * POST /api/tokens/[id]/abis
 * Crear un nuevo ABI para un contrato específico
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const tenantContext = await getTenantContext();

  if (!tenantContext) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  const { id: tokenId } = await params;

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

  const { contractAddress, network, abi, source = 'UPLOADED', autoDetect } = body;

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

  let finalAbi = abi;
  let finalSource = source;

  // Si autoDetect está activo, obtener ABI desde BaseScan
  if (autoDetect) {
    try {
      const { getContractABI } = await import('@/lib/blockchain');
      const detectedAbi = await getContractABI(contractAddress, network);

      if (!detectedAbi || !Array.isArray(detectedAbi)) {
        return NextResponse.json(
          { error: 'No se pudo detectar el ABI desde BaseScan' },
          { status: 400 }
        );
      }

      finalAbi = detectedAbi;
      finalSource = 'BASESCAN';
    } catch (error: any) {
      return NextResponse.json(
        { error: `Error al detectar ABI: ${error.message}` },
        { status: 500 }
      );
    }
  } else {
    // Validar que abi sea un array válido (solo si no es autoDetect)
    if (!finalAbi || !Array.isArray(finalAbi)) {
      return NextResponse.json(
        { error: 'El campo "abi" debe ser un array válido' },
        { status: 400 }
      );
    }

    // Validar formato básico del ABI
    try {
      JSON.stringify(finalAbi);
    } catch (error) {
      return NextResponse.json(
        { error: 'El ABI no es un JSON válido' },
        { status: 400 }
      );
    }
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
      abi: finalAbi,
      source: finalSource
    },
    update: {
      abi: finalAbi,
      source: finalSource
    }
  });

  // Calcular contadores
  const abiArray = Array.isArray(customAbi.abi) ? customAbi.abi : [];
  const methodCount = abiArray.filter((item: any) => item.type === 'function').length;
  const eventCount = abiArray.filter((item: any) => item.type === 'event').length;

  return NextResponse.json({
    message: 'ABI guardado correctamente',
    customAbi: {
      id: customAbi.id,
      contractAddress: customAbi.contractAddress,
      network: customAbi.network,
      source: customAbi.source,
      createdAt: customAbi.createdAt,
      updatedAt: customAbi.updatedAt,
      methodCount,
      eventCount
    }
  });
}
