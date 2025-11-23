import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { fetchVestingInfo } from '@/lib/blockchain';

// Lista de contratos de vesting predefinidos
const VESTING_CONTRACTS = [
  { name: 'Vottun World', address: '0xa699Cf416FFe6063317442c3Fbd0C39742E971c5' },
  { name: 'Investors', address: '0x3e0ef51811B647E00A85A7e5e495fA4763911982' },
  { name: 'Marketing', address: '0xE521B2929DD28a725603bCb6F4009FBb656C4b15' },
  { name: 'Staking', address: '0x3a7cf4cCC76bb23Cf15845B0d4f05BafF1D478cF' },
  { name: 'Liquidity', address: '0x417Fc9c343210AA52F0b19dbf4EecBD786139BC1' },
  { name: 'Promos', address: '0xFC750D874077F8c90858cC132e0619CE7571520b' },
  { name: 'Team', address: '0xde68AD324aafD9F2b6946073C90ED5e61D5d51B8' },
  { name: 'Reserve', address: '0xC4CE5cFea2B6e32Ad41973348AC70EB3b00D8e6d' }
];

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const walletAddress = searchParams.get('wallet');
  const network = searchParams.get('network') || 'base';
  const forceRefresh = searchParams.get('force') === 'true';

  if (!walletAddress) {
    return NextResponse.json(
      { error: 'Wallet address is required' },
      { status: 400 }
    );
  }

  try {
    console.log(`[vesting-info] Fetching vesting info for wallet ${walletAddress}, force=${forceRefresh}`);

    const results = [];

    for (const contract of VESTING_CONTRACTS) {
      const contractAddress = contract.address;

      // 1. Si NO es force refresh, buscar primero en BD
      if (!forceRefresh) {
        const cached = await prisma.vestingCache.findUnique({
          where: {
            walletAddress_vestingContractAddress_network: {
              walletAddress: walletAddress.toLowerCase(),
              vestingContractAddress: contractAddress.toLowerCase(),
              network
            }
          }
        });

        // 2. Si existe en BD, usar esos datos
        if (cached) {
          console.log(`[vesting-info] ✅ Using DB data for ${contract.name}`);
          results.push({
            contractName: contract.name,
            contractAddress,
            ...cached,
            vestingId: `${walletAddress}-${contractAddress}`
          });
          continue;
        }
      }

      // 3. Si force refresh O no existe en BD, buscar en blockchain
      console.log(`[vesting-info] 🔍 Fetching from blockchain for ${contract.name}`);
      try {
        const vestingData = await fetchVestingInfo(walletAddress, contractAddress, network);

        if (!vestingData || vestingData.length === 0) {
          console.log(`[vesting-info] No vesting found for ${contract.name}`);
          continue;
        }

        // Tomar el primer schedule (normalmente hay uno por beneficiario)
        const schedule = vestingData[0];

        // 4. Guardar/actualizar en BD (upsert)
        const saved = await prisma.vestingCache.upsert({
          where: {
            walletAddress_vestingContractAddress_network: {
              walletAddress: walletAddress.toLowerCase(),
              vestingContractAddress: contractAddress.toLowerCase(),
              network
            }
          },
          update: {
            tokenName: schedule.tokenName,
            tokenSymbol: schedule.tokenSymbol,
            tokenAddress: schedule.tokenAddress,
            totalAmount: schedule.totalAmount,
            vestedAmount: schedule.vestedAmount,
            claimableAmount: schedule.claimableAmount,
            remainingAmount: schedule.remainingAmount,
            releasedAmount: schedule.releasedAmount,
            startTime: schedule.startTime,
            endTime: schedule.endTime,
            nextUnlockTime: schedule.nextUnlockTime || null,
            nextUnlockAmount: schedule.nextUnlockAmount || null,
            slicePeriodSeconds: schedule.slicePeriodSeconds || null,
            cliff: schedule.cliff || null,
            cliffEndTime: schedule.cliffTime || null
          },
          create: {
            walletAddress: walletAddress.toLowerCase(),
            vestingContractAddress: contractAddress.toLowerCase(),
            network,
            tokenName: schedule.tokenName,
            tokenSymbol: schedule.tokenSymbol,
            tokenAddress: schedule.tokenAddress,
            totalAmount: schedule.totalAmount,
            vestedAmount: schedule.vestedAmount,
            claimableAmount: schedule.claimableAmount,
            remainingAmount: schedule.remainingAmount,
            releasedAmount: schedule.releasedAmount,
            startTime: schedule.startTime,
            endTime: schedule.endTime,
            nextUnlockTime: schedule.nextUnlockTime || null,
            nextUnlockAmount: schedule.nextUnlockAmount || null,
            slicePeriodSeconds: schedule.slicePeriodSeconds || null,
            cliff: schedule.cliff || null,
            cliffEndTime: schedule.cliffTime || null
          }
        });

        console.log(`[vesting-info] ✅ Saved to DB for ${contract.name}`);

        results.push({
          contractName: contract.name,
          contractAddress,
          ...saved,
          vestingId: `${walletAddress}-${contractAddress}`
        });
      } catch (error) {
        console.error(`[vesting-info] Error fetching vesting for ${contract.name}:`, error);
        // Continuar con el siguiente contrato
      }
    }

    return NextResponse.json({
      success: true,
      wallet: walletAddress,
      network,
      vestingSchedules: results,
      fromCache: !forceRefresh && results.length > 0
    });
  } catch (error) {
    console.error('[vesting-info] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch vesting info' },
      { status: 500 }
    );
  }
}
