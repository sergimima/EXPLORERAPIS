import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getTenantContext } from '@/lib/tenant-context';
import { prisma } from '@/lib/db';
import { ethers } from 'ethers';
import { checkTokenLimit } from '@/lib/limits';

export async function POST(request: NextRequest) {
  const tenantContext = await getTenantContext();

  if (!tenantContext) {
    const session = await getServerSession(authOptions);
    if (session?.user?.role === 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'SUPER_ADMIN no tiene organización. Usa el panel Admin para gestionar orgs.' }, { status: 403 });
    }
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  // Verificar límite de tokens del plan
  const limitCheck = await checkTokenLimit(tenantContext.organizationId);
  if (!limitCheck.allowed) {
    return NextResponse.json({ error: limitCheck.message }, { status: 403 });
  }

  const { address, network } = await request.json();

  // Validar que es una address válida
  if (!ethers.isAddress(address)) {
    return NextResponse.json({ error: 'Address inválida' }, { status: 400 });
  }

  // Verificar on-chain que existe y obtener metadata
  try {
    let rpcUrl = network === 'base'
      ? (process.env.NEXT_PUBLIC_QUICKNODE_URL || 'https://mainnet.base.org')
      : network === 'base-sepolia' ? 'https://sepolia.base.org' : 'https://goerli.base.org';

    if (network === 'base') {
      try {
        const systemSettings = await prisma.systemSettings.findUnique({ where: { id: 'system' } });
        if (systemSettings?.defaultQuiknodeUrl) rpcUrl = systemSettings.defaultQuiknodeUrl;
      } catch (err) {}
    }

    const provider = new ethers.JsonRpcProvider(rpcUrl);

    const ERC20_ABI = [
      'function symbol() view returns (string)',
      'function name() view returns (string)',
      'function decimals() view returns (uint8)'
    ];

    const contract = new ethers.Contract(address, ERC20_ABI, provider);

    const [symbol, name, decimals] = await Promise.all([
      contract.symbol(),
      contract.name(),
      contract.decimals()
    ]);

    // Crear token
    const token = await prisma.token.create({
      data: {
        organizationId: tenantContext.organizationId,
        address: address.toLowerCase(),
        symbol,
        name,
        decimals: Number(decimals),
        network,
        isVerified: true,
        createdBy: tenantContext.userId,
        settings: {
          create: {
            whaleThreshold: '10000' // Default
          }
        }
      },
      include: {
        settings: true
      }
    });

    return NextResponse.json(token);
  } catch (error: any) {
    console.error('Error verificando token:', error);
    return NextResponse.json(
      { error: 'No se pudo verificar el token. ¿Es un contrato ERC20 válido?' },
      { status: 400 }
    );
  }
}

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const tenantContext = await getTenantContext();

  // SUPER_ADMIN sin org: devolver [] para que la UI no muestre error
  if (!tenantContext) {
    if (session?.user?.role === 'SUPER_ADMIN') {
      return NextResponse.json([]);
    }
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  const tokens = await prisma.token.findMany({
    where: {
      organizationId: tenantContext.organizationId
    },
    include: {
      settings: true
    },
    orderBy: {
      createdAt: 'desc'
    }
  });

  return NextResponse.json(tokens);
}

export async function DELETE(request: NextRequest) {
  const tenantContext = await getTenantContext();

  if (!tenantContext) {
    const session = await getServerSession(authOptions);
    if (session?.user?.role === 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'SUPER_ADMIN no tiene organización' }, { status: 403 });
    }
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const tokenId = searchParams.get('id');

  if (!tokenId) {
    return NextResponse.json({ error: 'Token ID requerido' }, { status: 400 });
  }

  // Verificar que el token pertenece a la org
  const token = await prisma.token.findFirst({
    where: {
      id: tokenId,
      organizationId: tenantContext.organizationId
    }
  });

  if (!token) {
    return NextResponse.json({ error: 'Token no encontrado' }, { status: 404 });
  }

  // Eliminar (cascade eliminará settings y caché)
  await prisma.token.delete({
    where: { id: tokenId }
  });

  return NextResponse.json({ success: true });
}
