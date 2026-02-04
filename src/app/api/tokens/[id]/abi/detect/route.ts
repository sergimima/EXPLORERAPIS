import { NextRequest, NextResponse } from 'next/server';
import { getTenantContext, getApiKeys } from '@/lib/tenant-context';
import { prisma } from '@/lib/db';
import axios from 'axios';

/**
 * POST /api/tokens/[id]/abi/detect
 * Auto-detectar ABI desde BaseScan para un token verificado
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

  // Obtener el token con su información
  const token = await prisma.token.findFirst({
    where: {
      id: tokenId,
      organizationId: tenantContext.organizationId
    },
    include: {
      settings: true
    }
  });

  if (!token) {
    return NextResponse.json({ error: 'Token no encontrado' }, { status: 404 });
  }

  // Obtener API keys (custom o globales)
  const apiKeys = await getApiKeys(tenantContext);

  // Determinar la URL del explorador según la red
  let explorerApiUrl: string;
  switch (token.network) {
    case 'base':
      explorerApiUrl = 'https://api.basescan.org/api';
      break;
    case 'base-testnet':
      explorerApiUrl = 'https://api-goerli.basescan.org/api';
      break;
    case 'base-sepolia':
      explorerApiUrl = 'https://api-sepolia.basescan.org/api';
      break;
    default:
      return NextResponse.json(
        { error: `Red no soportada: ${token.network}` },
        { status: 400 }
      );
  }

  try {
    // Llamar a BaseScan API para obtener el ABI
    const response = await axios.get(explorerApiUrl, {
      params: {
        module: 'contract',
        action: 'getabi',
        address: token.address,
        apikey: apiKeys.basescanApiKey
      }
    });

    if (response.data.status !== '1') {
      return NextResponse.json(
        {
          error: 'No se pudo obtener el ABI desde BaseScan',
          details: response.data.result || 'Contrato no verificado o dirección inválida'
        },
        { status: 400 }
      );
    }

    // Parsear el ABI (viene como string)
    let abi;
    try {
      abi = JSON.parse(response.data.result);
    } catch (error) {
      return NextResponse.json(
        { error: 'El ABI devuelto por BaseScan no es válido' },
        { status: 500 }
      );
    }

    // Validar que sea un array
    if (!Array.isArray(abi)) {
      return NextResponse.json(
        { error: 'El ABI devuelto no es un array válido' },
        { status: 500 }
      );
    }

    // Guardar el ABI en la base de datos
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
        source: 'BASESCAN'
      },
      update: {
        abi,
        source: 'BASESCAN'
      }
    });

    return NextResponse.json({
      message: 'ABI detectado y guardado correctamente desde BaseScan',
      customAbi: {
        id: customAbi.id,
        source: customAbi.source,
        methodCount: abi.filter((item: any) => item.type === 'function').length,
        eventCount: abi.filter((item: any) => item.type === 'event').length,
        createdAt: customAbi.createdAt,
        updatedAt: customAbi.updatedAt
      }
    });
  } catch (error: any) {
    console.error('Error al detectar ABI desde BaseScan:', error);

    return NextResponse.json(
      {
        error: 'Error al conectar con BaseScan API',
        details: error.message
      },
      { status: 500 }
    );
  }
}
