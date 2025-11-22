import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const vestingContract = searchParams.get('vestingContract');
  const network = searchParams.get('network') || 'base';

  if (!vestingContract) {
    return NextResponse.json(
      { error: 'vestingContract is required' },
      { status: 400 }
    );
  }

  try {
    const beneficiaries = await prisma.vestingBeneficiaryCache.findMany({
      where: {
        vestingContract: vestingContract.toLowerCase(),
        network: network
      },
      orderBy: { updatedAt: 'desc' }
    });

    // Obtener la fecha de última actualización
    const lastUpdate = beneficiaries.length > 0
      ? beneficiaries[0].updatedAt
      : null;

    return NextResponse.json({
      beneficiaries,
      lastUpdate,
      count: beneficiaries.length
    });
  } catch (error) {
    console.error('[vesting-beneficiaries] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch beneficiaries' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { vestingContract, beneficiaries, network, tokenAddress, tokenSymbol, tokenName } = body;

    if (!vestingContract || !beneficiaries || !Array.isArray(beneficiaries)) {
      return NextResponse.json(
        { error: 'Invalid request body' },
        { status: 400 }
      );
    }

    // Primero borrar beneficiarios existentes de este vesting
    await prisma.vestingBeneficiaryCache.deleteMany({
      where: {
        vestingContract: vestingContract.toLowerCase(),
        network: network || 'base'
      }
    });

    // Guardar nuevos beneficiarios
    const beneficiariesToSave = beneficiaries.map((b: any) => ({
      vestingContract: vestingContract.toLowerCase(),
      beneficiaryAddress: b.beneficiaryAddress?.toLowerCase() || '',
      network: network || 'base',
      tokenAddress: tokenAddress.toLowerCase(),
      tokenSymbol: tokenSymbol,
      tokenName: tokenName,
      totalAmount: b.totalAmount || '0',
      vestedAmount: b.vestedAmount || '0',
      releasedAmount: b.releasedAmount || '0',
      claimableAmount: b.claimableAmount || '0',
      remainingAmount: b.remainingAmount || '0',
      startTime: b.startTime || 0,
      endTime: b.endTime || 0
    }));

    await prisma.vestingBeneficiaryCache.createMany({
      data: beneficiariesToSave,
      skipDuplicates: true
    });

    return NextResponse.json({
      success: true,
      saved: beneficiariesToSave.length
    });
  } catch (error) {
    console.error('[vesting-beneficiaries] Error saving:', error);
    return NextResponse.json(
      { error: 'Failed to save beneficiaries' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const vestingContract = searchParams.get('vestingContract');
  const network = searchParams.get('network') || 'base';

  if (!vestingContract) {
    return NextResponse.json(
      { error: 'vestingContract is required' },
      { status: 400 }
    );
  }

  try {
    const deleted = await prisma.vestingBeneficiaryCache.deleteMany({
      where: {
        vestingContract: vestingContract.toLowerCase(),
        network: network
      }
    });

    console.log(`[vesting-beneficiaries] Deleted ${deleted.count} cached beneficiaries`);

    return NextResponse.json({
      success: true,
      deleted: deleted.count
    });
  } catch (error) {
    console.error('[vesting-beneficiaries] Error deleting:', error);
    return NextResponse.json(
      { error: 'Failed to delete beneficiaries' },
      { status: 500 }
    );
  }
}
