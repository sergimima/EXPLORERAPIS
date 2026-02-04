import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getTenantContext } from '@/lib/tenant-context';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const action = searchParams.get('action');
  const contractAddress = searchParams.get('contractAddress');
  const tokenAddress = searchParams.get('tokenAddress');
  const network = searchParams.get('network') || 'base';

  // Validate tenant context
  const tenantContext = await getTenantContext();
  if (!tenantContext) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }
  if (!tenantContext.activeToken) {
    return NextResponse.json({ error: 'No hay token configurado' }, { status: 400 });
  }

  const tokenId = tenantContext.activeToken.id;

  if (!contractAddress || !tokenAddress) {
    return NextResponse.json(
      { error: 'contractAddress and tokenAddress are required' },
      { status: 400 }
    );
  }

  try {
    if (action === 'getTransfers') {
      // Obtener transferencias cacheadas del vesting (filtrado por tokenId)
      const transfers = await prisma.vestingTransferCache.findMany({
        where: {
          tokenId,
          vestingContract: contractAddress.toLowerCase(),
          tokenAddress: tokenAddress.toLowerCase(),
          network: network
        },
        orderBy: { timestamp: 'desc' }
      });

      const formatted = transfers.map(t => ({
        address: t.tokenAddress,
        from_address: t.from,
        to_address: t.to,
        value: t.value,
        block_number: t.blockNumber.toString(),
        block_timestamp: new Date(Number(t.timestamp) * 1000).toISOString(),
        transaction_hash: t.hash
      }));

      return NextResponse.json({ transfers: formatted });
    }

    if (action === 'getLastTimestamp') {
      // Obtener último timestamp del vesting (filtrado por tokenId)
      const lastTransfer = await prisma.vestingTransferCache.findFirst({
        where: {
          tokenId,
          vestingContract: contractAddress.toLowerCase(),
          tokenAddress: tokenAddress.toLowerCase(),
          network: network
        },
        orderBy: { timestamp: 'desc' }
      });

      return NextResponse.json({
        timestamp: lastTransfer ? lastTransfer.timestamp : null
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('[transfers-cache] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch cache data' },
      { status: 500 }
    );
  }
}

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
    const { transfers, contractAddress, tokenAddress, network } = body;

    if (!transfers || !Array.isArray(transfers) || !tokenAddress || !network) {
      return NextResponse.json(
        { error: 'Invalid request body' },
        { status: 400 }
      );
    }

    // Extract activeToken to avoid TypeScript errors in map
    const activeToken = tenantContext.activeToken;

    const transfersToSave = transfers.map((tx: any) => ({
      tokenId,
      hash: tx.transaction_hash,
      tokenAddress: tokenAddress.toLowerCase(),
      tokenSymbol: activeToken.symbol,
      tokenName: activeToken.name,
      decimals: activeToken.decimals,
      from: tx.from_address?.toLowerCase() || '',
      to: tx.to_address?.toLowerCase() || '',
      value: tx.value || '0',
      blockNumber: parseInt(tx.block_number) || 0,
      timestamp: Math.floor(new Date(tx.block_timestamp).getTime() / 1000),
      network: network,
      vestingContract: contractAddress.toLowerCase()
    }));

    await prisma.vestingTransferCache.createMany({
      data: transfersToSave,
      skipDuplicates: true
    });

    return NextResponse.json({
      success: true,
      saved: transfersToSave.length
    });
  } catch (error) {
    console.error('[transfers-cache] Error saving:', error);
    return NextResponse.json(
      { error: 'Failed to save transfers' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const contractAddress = searchParams.get('contractAddress');
  const tokenAddress = searchParams.get('tokenAddress');
  const network = searchParams.get('network') || 'base';

  // Validate tenant context
  const tenantContext = await getTenantContext();
  if (!tenantContext) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }
  if (!tenantContext.activeToken) {
    return NextResponse.json({ error: 'No hay token configurado' }, { status: 400 });
  }

  const tokenId = tenantContext.activeToken.id;

  if (!contractAddress || !tokenAddress) {
    return NextResponse.json(
      { error: 'contractAddress and tokenAddress are required' },
      { status: 400 }
    );
  }

  try {
    const deleted = await prisma.vestingTransferCache.deleteMany({
      where: {
        tokenId,
        vestingContract: contractAddress.toLowerCase(),
        tokenAddress: tokenAddress.toLowerCase(),
        network: network
      }
    });

    console.log(`[transfers-cache] Deleted ${deleted.count} cached transfers`);

    return NextResponse.json({
      success: true,
      deleted: deleted.count
    });
  } catch (error) {
    console.error('[transfers-cache] Error deleting:', error);
    return NextResponse.json(
      { error: 'Failed to delete cache' },
      { status: 500 }
    );
  }
}
