import { ethers } from 'ethers';

/**
 * Procesa la información de vesting para un beneficiario usando el método getVestingListByHolder
 * @param contract El contrato de vesting
 * @param beneficiaries Lista de direcciones de beneficiarios
 * @param contractABI ABI del contrato
 * @param tokenDecimals Decimales del token
 * @returns Información de vesting para cada beneficiario
 */
export async function processVestingWithGetVestingListByHolder(
  contract: any,
  beneficiaries: string[],
  contractABI: any[],
  tokenDecimals: number
) {
  const result: any = {
    beneficiaries: [],
    totalSchedulesCreated: 0,
    releasableTokens: '0'
  };

  console.log("Usando getVestingListByHolder para obtener información exacta de vesting");
  
  // Procesar cada beneficiario
  for (const beneficiary of beneficiaries) {
    try {
      // Obtener la lista de vestings para este beneficiario
      const vestingList = await contract.getVestingListByHolder(beneficiary);
      console.log(`Vestings para ${beneficiary}:`, vestingList);
      
      // Si hay vestings para este beneficiario
      if (vestingList && vestingList.length > 0) {
        // Procesar cada vesting
        for (let i = 0; i < vestingList.length; i++) {
          const vesting = vestingList[i];
          
          // Extraer la información del vesting
          const scheduleInfo: any = {
            address: beneficiary,
            scheduleId: i.toString(),
            amount: ethers.formatUnits(vesting.amountTotal || BigInt(0), tokenDecimals),
            claimed: ethers.formatUnits(vesting.released || BigInt(0), tokenDecimals),
            startTime: Number(vesting.start || 0),
            endTime: Number(vesting.start || 0) + Number(vesting.duration || 0),
            cliff: Number(vesting.cliff || 0),
            isExact: true
          };
          
          // Calcular remaining
          const totalAmount = parseFloat(scheduleInfo.amount);
          const claimed = parseFloat(scheduleInfo.claimed);
          scheduleInfo.remaining = (totalAmount - claimed).toString();
          
          // Calcular liberables
          // Si el contrato proporciona directamente el valor de releasable, usarlo
          if (vesting.releasable) {
            scheduleInfo.releasable = ethers.formatUnits(vesting.releasable, tokenDecimals);
          } else {
            // Calcular liberables basado en el tiempo
            const currentTime = Math.floor(Date.now() / 1000);
            if (currentTime > scheduleInfo.startTime) {
              // Si hay un método para calcular el monto liberado
              if (contractABI.some((fn: any) => typeof fn === 'object' && fn.name === 'calculateVestedAmount')) {
                try {
                  // Obtener el ID del vesting
                  let vestingId;
                  if (vesting.id) {
                    vestingId = vesting.id;
                  } else if (contractABI.some((fn: any) => typeof fn === 'object' && fn.name === 'computeVestingId')) {
                    vestingId = await contract.computeVestingId(vesting);
                  } else if (contractABI.some((fn: any) => typeof fn === 'object' && fn.name === 'holderAddrToVestingsId')) {
                    vestingId = await contract.holderAddrToVestingsId(beneficiary, i);
                  }
                  
                  if (vestingId) {
                    const vestedAmount = await contract.calculateVestedAmount(vestingId, currentTime);
                    const releasable = parseFloat(ethers.formatUnits(vestedAmount, tokenDecimals)) - claimed;
                    scheduleInfo.releasable = Math.max(0, releasable).toString();
                  } else {
                    // Cálculo basado en tiempo si no podemos obtener el ID
                    const totalDuration = scheduleInfo.endTime - scheduleInfo.startTime;
                    const elapsed = Math.min(currentTime - scheduleInfo.startTime, totalDuration);
                    const percentComplete = elapsed / totalDuration;
                    const shouldBeReleased = totalAmount * percentComplete;
                    const releasable = Math.max(0, shouldBeReleased - claimed);
                    scheduleInfo.releasable = releasable.toString();
                  }
                } catch (e) {
                  console.warn(`Error al calcular tokens liberables para ${beneficiary}:`, e);
                  // Cálculo basado en tiempo como fallback
                  const totalDuration = scheduleInfo.endTime - scheduleInfo.startTime;
                  const elapsed = Math.min(currentTime - scheduleInfo.startTime, totalDuration);
                  const percentComplete = elapsed / totalDuration;
                  const shouldBeReleased = totalAmount * percentComplete;
                  const releasable = Math.max(0, shouldBeReleased - claimed);
                  scheduleInfo.releasable = releasable.toString();
                }
              } else {
                // Cálculo basado en tiempo
                const totalDuration = scheduleInfo.endTime - scheduleInfo.startTime;
                const elapsed = Math.min(currentTime - scheduleInfo.startTime, totalDuration);
                const percentComplete = elapsed / totalDuration;
                const shouldBeReleased = totalAmount * percentComplete;
                const releasable = Math.max(0, shouldBeReleased - claimed);
                scheduleInfo.releasable = releasable.toString();
              }
            } else {
              scheduleInfo.releasable = '0';
            }
          }
          
          // Añadir a la lista de beneficiarios
          result.beneficiaries.push(scheduleInfo);
          console.log(`Vesting ${i} para ${beneficiary}: ${scheduleInfo.amount} tokens, liberables: ${scheduleInfo.releasable}`);
        }
      } else {
        // Si no hay vestings, añadir solo la dirección
        result.beneficiaries.push({ address: beneficiary });
      }
    } catch (e) {
      console.warn(`Error al obtener vestings para ${beneficiary}:`, e);
      result.beneficiaries.push({ address: beneficiary });
    }
  }
  
  // Actualizar el número total de schedules creados
  result.totalSchedulesCreated = result.beneficiaries.length;
  console.log("Total de schedules obtenidos:", result.totalSchedulesCreated);
  
  // Calcular tokens liberables totales
  let totalReleasable = 0;
  for (const beneficiary of result.beneficiaries) {
    if (beneficiary.releasable) {
      totalReleasable += parseFloat(beneficiary.releasable);
    }
  }
  
  if (totalReleasable > 0) {
    result.releasableTokens = totalReleasable.toString();
    console.log("Total de tokens liberables:", result.releasableTokens);
  }
  
  return result;
}
