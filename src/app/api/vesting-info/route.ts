import { NextRequest, NextResponse } from 'next/server';
import { prisma, serializeBigInt } from '@/lib/db';
import { fetchVestingInfo } from '@/lib/blockchain';
import { getTenantContext, getApiKeys } from '@/lib/tenant-context';

export async function GET(request: NextRequest) {
  // Validate tenant context
  const tenantContext = await getTenantContext();
  if (!tenantContext) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }
  if (!tenantContext.activeToken) {
    return NextResponse.json({ error: 'No hay token configurado' }, { status: 400 });
  }

  const tokenId = tenantContext.activeToken.id;

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

    // Fetch active vesting contracts from database
    const vestingContracts = await prisma.contract.findMany({
      where: {
        tokenId,
        network,
        isActive: true,
        category: 'VESTING'
      },
      orderBy: {
        createdAt: 'asc'
      }
    });

    console.log(`[vesting-info] Found ${vestingContracts.length} active vesting contracts for token`);

    if (vestingContracts.length === 0) {
      return NextResponse.json({
        success: true,
        wallet: walletAddress,
        network,
        vestingSchedules: [],
        fromCache: false,
        debugLog: ['No active vesting contracts configured for this token']
      });
    }

    const results = [];
    const debugLog: string[] = [];

    for (const contract of vestingContracts) {
      const contractAddress = contract.address;

      // 1. Si NO es force refresh, buscar primero en BD
      if (!forceRefresh) {
        const cached = await prisma.vestingBeneficiaryCache.findFirst({
          where: {
            tokenId,
            vestingContract: contractAddress.toLowerCase(),
            beneficiaryAddress: walletAddress.toLowerCase(),
            network
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
      if (results.length > 0) {
        await new Promise(resolve => setTimeout(resolve, 1500));
      }
      console.log(`[vesting-info] 🔍 Fetching from blockchain for ${contract.name} (${contractAddress})`);
      try {
        const apiKeys = getApiKeys(tenantContext);
        const vestingData = await fetchVestingInfo(walletAddress, contractAddress, network, apiKeys);

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
          const existingCache = await prisma.vestingBeneficiaryCache.findFirst({
            where: {
              tokenId,
              vestingContract: contractAddress.toLowerCase(),
              beneficiaryAddress: walletAddress.toLowerCase(),
              network
            }
          });

          if (existingCache) {
            await prisma.vestingBeneficiaryCache.update({
              where: { id: existingCache.id },
              data: {
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
              }
            });
          } else {
            await prisma.vestingBeneficiaryCache.create({
              data: {
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
                tokenId,
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
          }
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
