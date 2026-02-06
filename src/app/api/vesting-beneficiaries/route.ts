import { NextRequest, NextResponse } from 'next/server';
import { prisma, serializeBigInt } from '@/lib/db';

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
      include: {
        vestings: true  // Incluir schedules relacionados
      },
      orderBy: { updatedAt: 'desc' }
    });

    // Obtener la fecha de última actualización
    const lastUpdate = beneficiaries.length > 0
      ? beneficiaries[0].updatedAt
      : null;

    return NextResponse.json({
      beneficiaries: serializeBigInt(beneficiaries),
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

    // Primero borrar beneficiarios existentes de este vesting (cascade borrará schedules)
    await prisma.vestingBeneficiaryCache.deleteMany({
      where: {
        vestingContract: vestingContract.toLowerCase(),
        network: network || 'base'
      }
    });

    // Guardar nuevos beneficiarios CON sus schedules
    let totalSaved = 0;
    for (const b of beneficiaries) {
      const beneficiary = await prisma.vestingBeneficiaryCache.create({
        data: {
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
          endTime: b.endTime || 0,
          vestings: b.vestings && Array.isArray(b.vestings) ? {
            create: b.vestings.map((v: any) => ({
              scheduleId: v.scheduleId || '',
              phase: v.phase || '',
              cliff: v.cliff || 0,
              start: v.start || 0,
              duration: v.duration || 0,
              amountTotal: v.amount || v.amountTotal || '0',
              claimFrequencyInSeconds: v.slicePeriodSeconds || v.claimFrequencyInSeconds || 0,
              lastClaimDate: v.lastClaimDate || 0,
              released: v.released || v.claimed || '0',
              revoked: v.revoked || false
            }))
          } : undefined
        }
      });
      totalSaved++;
    }

    // Agregar totales de beneficiarios al caché del contrato
    try {
      const { getTenantContext } = await import('@/lib/tenant-context');
      const tenantContext = await getTenantContext();
      const tokenId = tenantContext?.activeToken?.id;

      if (tokenId) {
        let totalClaimable = 0;
        let totalVestedSum = 0;
        let totalReleasedSum = 0;
        let totalRemainingSum = 0;

        for (const b of beneficiaries) {
          totalClaimable += parseFloat(b.claimableAmount || '0');
          totalVestedSum += parseFloat(b.totalAmount || '0');
          totalReleasedSum += parseFloat(b.releasedAmount || '0');
          totalRemainingSum += parseFloat(b.remainingAmount || '0');
        }

        await prisma.vestingContractCache.upsert({
          where: {
            tokenId_contractAddress_network: {
              tokenId,
              contractAddress: vestingContract.toLowerCase(),
              network: network || 'base'
            }
          },
          create: {
            tokenId,
            contractAddress: vestingContract.toLowerCase(),
            network: network || 'base',
            releasableTokens: totalClaimable.toString(),
            totalBeneficiaries: beneficiaries.length,
            validBeneficiaries: totalSaved,
          },
          update: {
            releasableTokens: totalClaimable.toString(),
            ...(totalVestedSum > 0 ? { totalVested: totalVestedSum.toString() } : {}),
            ...(totalReleasedSum > 0 ? { totalReleased: totalReleasedSum.toString() } : {}),
            ...(totalRemainingSum > 0 ? { remainingToVest: totalRemainingSum.toString() } : {}),
            totalBeneficiaries: beneficiaries.length,
            validBeneficiaries: totalSaved,
            lastUpdate: new Date()
          }
        });
        console.log('[vesting-beneficiaries] ✓ VestingContractCache actualizado con totales de beneficiarios');
      }
    } catch (aggregateError) {
      console.warn('[vesting-beneficiaries] Error al actualizar cache de contrato:', aggregateError);
    }

    return NextResponse.json({
      success: true,
      saved: totalSaved
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
