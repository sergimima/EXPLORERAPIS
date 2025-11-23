import { NextRequest, NextResponse } from 'next/server';
import { ethers } from 'ethers';
import { prisma } from '@/lib/db';
import { getContractABI } from '@/lib/blockchain';
import { VESTING_CONTRACT_ABIS } from '@/lib/contractAbis';

const NETWORKS: { [key: string]: { rpcUrl: string } } = {
  'base': {
    rpcUrl: process.env.NEXT_PUBLIC_BASE_RPC_URL || 'https://mainnet.base.org'
  },
  'base-testnet': {
    rpcUrl: process.env.NEXT_PUBLIC_BASE_TESTNET_RPC_URL || 'https://goerli.base.org'
  },
  'base-sepolia': {
    rpcUrl: process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org'
  }
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { vestingContract, beneficiaryAddress, network, tokenAddress, tokenSymbol, tokenName } = body;

    if (!vestingContract || !beneficiaryAddress) {
      return NextResponse.json(
        { error: 'vestingContract and beneficiaryAddress are required' },
        { status: 400 }
      );
    }

    const networkConfig = NETWORKS[network || 'base'];
    if (!networkConfig) {
      return NextResponse.json({ error: 'Invalid network' }, { status: 400 });
    }

    console.log(`🔄 Actualizando beneficiario ${beneficiaryAddress} del contrato ${vestingContract}`);

    // Obtener ABI del contrato (primero de la caché hardcodeada, luego de BaseScan)
    const normalizedContract = vestingContract.toLowerCase();
    let contractABI = VESTING_CONTRACT_ABIS[normalizedContract];

    if (!contractABI) {
      console.log('ABI no encontrado en caché, consultando BaseScan...');
      contractABI = await getContractABI(vestingContract, network || 'base');
    } else {
      console.log('✓ ABI encontrado en caché hardcodeada');
    }

    if (!contractABI || !Array.isArray(contractABI)) {
      return NextResponse.json(
        { error: 'Could not fetch contract ABI from BaseScan' },
        { status: 500 }
      );
    }

    // Verificar si tiene getVestingListByHolder
    const hasGetVestingListByHolder = contractABI.some((fn: any) =>
      typeof fn === 'object' && fn.name === 'getVestingListByHolder'
    );

    if (!hasGetVestingListByHolder) {
      return NextResponse.json(
        { error: 'Contract does not have getVestingListByHolder method' },
        { status: 400 }
      );
    }

    // Crear provider y contrato
    const provider = new ethers.JsonRpcProvider(networkConfig.rpcUrl);
    const contract = new ethers.Contract(vestingContract, contractABI, provider);

    // Llamar a getVestingListByHolder
    const vestingList = await contract.getVestingListByHolder(beneficiaryAddress);

    let vestings: any[] = [];
    let totalAmount = '0';
    let totalReleased = '0';
    let totalRemaining = '0';

    if (vestingList && vestingList.length > 0) {
      vestings = vestingList.map((v: any) => ({
        scheduleId: v.scheduleId || '',
        phase: v.phase || '',
        cliff: Number(v.cliff || 0),
        start: Number(v.start || 0),
        duration: Number(v.duration || 0),
        amountTotal: ethers.formatUnits(v.amountTotal || 0, 18),
        claimFrequencyInSeconds: Number(v.claimFrequencyInSeconds || 0),
        lastClaimDate: Number(v.lastClaimDate || 0),
        released: ethers.formatUnits(v.released || 0, 18),
        revoked: v.revoked || false
      }));

      // Calcular totales
      totalAmount = vestings.reduce((sum, v) => sum + parseFloat(v.amountTotal), 0).toString();
      totalReleased = vestings.reduce((sum, v) => sum + parseFloat(v.released), 0).toString();
      totalRemaining = (parseFloat(totalAmount) - parseFloat(totalReleased)).toString();
    }

    console.log(`✓ Obtenidos ${vestings.length} vestings para ${beneficiaryAddress}`);

    // Actualizar en BD - primero borrar el existente
    await prisma.vestingBeneficiaryCache.deleteMany({
      where: {
        vestingContract: vestingContract.toLowerCase(),
        beneficiaryAddress: beneficiaryAddress.toLowerCase(),
        network: network || 'base'
      }
    });

    // Crear nuevo registro con vestings actualizados
    await prisma.vestingBeneficiaryCache.create({
      data: {
        vestingContract: vestingContract.toLowerCase(),
        beneficiaryAddress: beneficiaryAddress.toLowerCase(),
        network: network || 'base',
        tokenAddress: tokenAddress.toLowerCase(),
        tokenSymbol: tokenSymbol,
        tokenName: tokenName,
        totalAmount: totalAmount,
        vestedAmount: '0', // Se puede calcular si es necesario
        releasedAmount: totalReleased,
        claimableAmount: '0', // Se puede calcular si es necesario
        remainingAmount: totalRemaining,
        startTime: vestings.length > 0 ? Math.min(...vestings.map(v => v.start)) : 0,
        endTime: vestings.length > 0 ? Math.max(...vestings.map(v => v.start + v.duration)) : 0,
        vestings: vestings.length > 0 ? {
          create: vestings.map((v: any) => ({
            scheduleId: v.scheduleId,
            phase: v.phase,
            cliff: v.cliff,
            start: v.start,
            duration: v.duration,
            amountTotal: v.amountTotal,
            claimFrequencyInSeconds: v.claimFrequencyInSeconds,
            lastClaimDate: v.lastClaimDate,
            released: v.released,
            revoked: v.revoked
          }))
        } : undefined
      }
    });

    console.log(`✓ Beneficiario ${beneficiaryAddress} actualizado en BD`);

    return NextResponse.json({
      success: true,
      beneficiaryAddress,
      vestingsCount: vestings.length,
      totalAmount,
      totalReleased,
      totalRemaining
    });
  } catch (error) {
    console.error('[refresh-single-beneficiary] Error completo:', error);
    console.error('[refresh-single-beneficiary] Stack:', error instanceof Error ? error.stack : 'No stack');
    return NextResponse.json(
      {
        error: 'Failed to refresh beneficiary',
        details: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}
