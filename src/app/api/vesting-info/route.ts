import { NextRequest, NextResponse } from 'next/server';
import { prisma, serializeBigInt } from '@/lib/db';
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
  { name: 'Reserve', address: '0xC4CE5cFea2B6e32Ad41973348AC70EB3b00D8e6d' },
  { name: 'ToCheck1', address: '0x7BBDa50bE87DFf935782C80D4222D46490F242A1' },
  { name: 'ToCheck2', address: '0x1808CF66F69DC1B8217d1C655fBD134B213AE358' }
];

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  let walletAddress = searchParams.get('wallet');
  const network = searchParams.get('network') || 'base';
  const forceRefresh = searchParams.get('force') === 'true';

  if (!walletAddress) {
    return NextResponse.json(
      { error: 'Wallet address is required' },
      { status: 400 }
    );
  }

  // Sanitizar: extraer dirección 0x... si viene con prefijo como "wallet: 0x..."
  const addressMatch = walletAddress.match(/(0x[a-fA-F0-9]{40})/);
  if (addressMatch) {
    walletAddress = addressMatch[1];
  }

  try {
    console.log(`[vesting-info] Fetching vesting info for wallet ${walletAddress}, force=${forceRefresh}`);

    const results = [];
    const debugLog: string[] = [];

    for (const contract of VESTING_CONTRACTS) {
      const contractAddress = contract.address;

      // 1. Si NO es force refresh, buscar primero en BD
      if (!forceRefresh) {
        const cached = await prisma.vestingBeneficiaryCache.findUnique({
          where: {
            vestingContract_beneficiaryAddress_network: {
              vestingContract: contractAddress.toLowerCase(),
              beneficiaryAddress: walletAddress.toLowerCase(),
              network
            }
          },
          include: {
            vestings: true // Incluir todos los schedules
          }
        });

        // 2. Si existe en BD, usar esos datos
        if (cached) {
          console.log(`[vesting-info] ✅ Using DB data for ${contract.name} (${cached.vestings.length} schedules)`);

          const serializedCached = serializeBigInt(cached);

          results.push({
            contractName: contract.name,
            contractAddress,
            vestingContractAddress: contractAddress,
            tokenName: serializedCached.tokenName,
            tokenSymbol: serializedCached.tokenSymbol,
            tokenAddress: serializedCached.tokenAddress,
            totalAmount: serializedCached.totalAmount,
            vestedAmount: serializedCached.vestedAmount,
            claimableAmount: serializedCached.claimableAmount,
            remainingAmount: serializedCached.remainingAmount,
            releasedAmount: serializedCached.releasedAmount,
            startTime: serializedCached.startTime,
            endTime: serializedCached.endTime,
            vestingId: `${walletAddress}-${contractAddress}`,
            scheduleCount: serializedCached.vestings.length,
            schedules: serializedCached.vestings.map((v: any) => ({
              startTime: v.start,
              endTime: v.start + v.duration,
              totalAmount: v.amountTotal,
              releasedAmount: v.released,
              claimableAmount: '0',
              remainingAmount: (parseFloat(v.amountTotal) - parseFloat(v.released)).toString(),
              phase: v.phase
            }))
          });
          continue;
        }
      }

      // 3. Si force refresh O no existe en BD, buscar en blockchain
      // Añadir delay entre llamadas para respetar rate limits del RPC
      if (results.length > 0 || VESTING_CONTRACTS.indexOf(contract) > 0) {
        await new Promise(resolve => setTimeout(resolve, 1500));
      }
      console.log(`[vesting-info] 🔍 Fetching from blockchain for ${contract.name} (${contractAddress})`);
      try {
        const vestingData = await fetchVestingInfo(walletAddress, contractAddress, network);

        debugLog.push(`${contract.name}: ${vestingData?.length || 0} schedules encontrados`);

        if (!vestingData || vestingData.length === 0) {
          console.log(`[vesting-info] No vesting found for ${contract.name}`);
          continue;
        }

        // Agregar todos los schedules en un solo vesting
        const aggregatedVesting: any = {
          contractName: contract.name,
          contractAddress,
          tokenName: vestingData[0].tokenName,
          tokenSymbol: vestingData[0].tokenSymbol,
          tokenAddress: vestingData[0].tokenAddress,
          totalAmount: '0',
          vestedAmount: '0',
          claimableAmount: '0',
          remainingAmount: '0',
          releasedAmount: '0',
          startTime: Math.min(...vestingData.map(s => s.startTime)),
          endTime: Math.max(...vestingData.map(s => s.endTime)),
          vestingId: `${walletAddress}-${contractAddress}`,
          vestingContractAddress: contractAddress,
          scheduleCount: vestingData.length,
          schedules: []
        };

        // Sumar todos los valores de los schedules
        for (const schedule of vestingData) {
          aggregatedVesting.totalAmount = (
            parseFloat(aggregatedVesting.totalAmount) + parseFloat(schedule.totalAmount || '0')
          ).toString();
          aggregatedVesting.vestedAmount = (
            parseFloat(aggregatedVesting.vestedAmount) + parseFloat(schedule.vestedAmount || '0')
          ).toString();
          aggregatedVesting.claimableAmount = (
            parseFloat(aggregatedVesting.claimableAmount) + parseFloat(schedule.claimableAmount || '0')
          ).toString();
          aggregatedVesting.remainingAmount = (
            parseFloat(aggregatedVesting.remainingAmount) + parseFloat(schedule.remainingAmount || '0')
          ).toString();
          aggregatedVesting.releasedAmount = (
            parseFloat(aggregatedVesting.releasedAmount) + parseFloat(schedule.releasedAmount || '0')
          ).toString();

          // Guardar el schedule individual para mostrar detalles
          aggregatedVesting.schedules.push({
            startTime: schedule.startTime,
            endTime: schedule.endTime,
            totalAmount: schedule.totalAmount,
            releasedAmount: schedule.releasedAmount,
            claimableAmount: schedule.claimableAmount,
            remainingAmount: schedule.remainingAmount,
            phase: schedule.phase || 'Unknown'
          });
        }

        // Guardar en BD usando VestingBeneficiaryCache
        try {
          await prisma.vestingBeneficiaryCache.upsert({
            where: {
              vestingContract_beneficiaryAddress_network: {
                vestingContract: contractAddress.toLowerCase(),
                beneficiaryAddress: walletAddress.toLowerCase(),
                network
              }
            },
            update: {
              tokenAddress: aggregatedVesting.tokenAddress,
              tokenSymbol: aggregatedVesting.tokenSymbol,
              tokenName: aggregatedVesting.tokenName,
              totalAmount: aggregatedVesting.totalAmount,
              vestedAmount: aggregatedVesting.vestedAmount,
              releasedAmount: aggregatedVesting.releasedAmount,
              claimableAmount: aggregatedVesting.claimableAmount,
              remainingAmount: aggregatedVesting.remainingAmount,
              startTime: aggregatedVesting.startTime,
              endTime: aggregatedVesting.endTime,
              vestings: {
                deleteMany: {}, // Borrar schedules antiguos
                create: aggregatedVesting.schedules.map((s: any, idx: number) => ({
                  scheduleId: `schedule-${idx}`,
                  phase: s.phase,
                  cliff: 0,
                  start: s.startTime,
                  duration: s.endTime - s.startTime,
                  amountTotal: s.totalAmount,
                  claimFrequencyInSeconds: 0,
                  lastClaimDate: s.startTime,
                  released: s.releasedAmount,
                  revoked: false
                }))
              }
            },
            create: {
              vestingContract: contractAddress.toLowerCase(),
              beneficiaryAddress: walletAddress.toLowerCase(),
              network,
              tokenAddress: aggregatedVesting.tokenAddress,
              tokenSymbol: aggregatedVesting.tokenSymbol,
              tokenName: aggregatedVesting.tokenName,
              totalAmount: aggregatedVesting.totalAmount,
              vestedAmount: aggregatedVesting.vestedAmount,
              releasedAmount: aggregatedVesting.releasedAmount,
              claimableAmount: aggregatedVesting.claimableAmount,
              remainingAmount: aggregatedVesting.remainingAmount,
              startTime: aggregatedVesting.startTime,
              endTime: aggregatedVesting.endTime,
              vestings: {
                create: aggregatedVesting.schedules.map((s: any, idx: number) => ({
                  scheduleId: `schedule-${idx}`,
                  phase: s.phase,
                  cliff: 0,
                  start: s.startTime,
                  duration: s.endTime - s.startTime,
                  amountTotal: s.totalAmount,
                  claimFrequencyInSeconds: 0,
                  lastClaimDate: s.startTime,
                  released: s.releasedAmount,
                  revoked: false
                }))
              }
            }
          });
          console.log(`[vesting-info] 💾 Saved to DB: ${contract.name} with ${vestingData.length} schedules`);
        } catch (dbError) {
          console.error(`[vesting-info] ⚠️ Failed to save to DB for ${contract.name}:`, dbError);
          // Continuar aunque falle el guardado
        }

        results.push(aggregatedVesting);
        console.log(`[vesting-info] ✅ Aggregated ${vestingData.length} schedule(s) into 1 vesting for ${contract.name}`);
      } catch (error) {
        debugLog.push(`${contract.name}: ERROR - ${error instanceof Error ? error.message : String(error)}`);
        console.error(`[vesting-info] Error fetching vesting for ${contract.name}:`, error);
        // Continuar con el siguiente contrato
      }
    }

    return NextResponse.json({
      success: true,
      wallet: walletAddress,
      network,
      vestingSchedules: results,
      fromCache: !forceRefresh && results.length > 0,
      debugLog
    });
  } catch (error) {
    console.error('[vesting-info] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch vesting info' },
      { status: 500 }
    );
  }
}
