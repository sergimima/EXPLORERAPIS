import { ethers } from 'ethers';

// Función auxiliar para procesar beneficiarios individualmente
export async function processBeneficiariesIndividually(
  beneficiaries: string[],
  contract: ethers.Contract,
  contractABI: any[],
  result: any,
  tokenDecimals: number
): Promise<void> {
  // Obtener información detallada de cada beneficiario si es posible
  for (const beneficiary of beneficiaries) {
    try {
      let scheduleInfo: any = {
        address: beneficiary,
        amount: '0',
        claimed: '0',
        remaining: '0',
        releasable: '0',
        startTime: 0,
        endTime: 0
      };
      
      // Intentar obtener información del vesting usando métodos alternativos
      if (contractABI.some((fn: any) => typeof fn === 'object' && (fn.name === 'vestingAmount' || fn.name === 'getVestingAmount'))) {
        try {
          const vestingAmountMethod = contractABI.some((fn: any) => typeof fn === 'object' && fn.name === 'vestingAmount') ? 'vestingAmount' : 'getVestingAmount';
          const releasedMethod = contractABI.some((fn: any) => typeof fn === 'object' && fn.name === 'released') ? 'released' : 'getVestingReleased';
          
          const amount = await contract[vestingAmountMethod](beneficiary);
          scheduleInfo.amount = ethers.formatUnits(amount, tokenDecimals);
          
          if (contractABI.some((fn: any) => typeof fn === 'object' && fn.name === releasedMethod)) {
            const released = await contract[releasedMethod](beneficiary);
            scheduleInfo.claimed = ethers.formatUnits(released, tokenDecimals);
            scheduleInfo.remaining = ethers.formatUnits(amount - released, tokenDecimals);
          }
          
          if (contractABI.some((fn: any) => typeof fn === 'object' && (fn.name === 'vestingStart' || fn.name === 'getVestingStart'))) {
            const startMethod = contractABI.some((fn: any) => typeof fn === 'object' && fn.name === 'vestingStart') ? 'vestingStart' : 'getVestingStart';
            scheduleInfo.startTime = Number(await contract[startMethod](beneficiary));
          }
          
          if (contractABI.some((fn: any) => typeof fn === 'object' && (fn.name === 'vestingDuration' || fn.name === 'getVestingDuration'))) {
            const durationMethod = contractABI.some((fn: any) => typeof fn === 'object' && fn.name === 'vestingDuration') ? 'vestingDuration' : 'getVestingDuration';
            const duration = Number(await contract[durationMethod](beneficiary));
            scheduleInfo.endTime = scheduleInfo.startTime + duration;
          }
          
          // Calcular tokens liberables
          if (scheduleInfo.startTime > 0 && scheduleInfo.endTime > 0) {
            const currentTime = Math.floor(Date.now() / 1000);
            if (currentTime > scheduleInfo.startTime) {
              const totalAmount = parseFloat(scheduleInfo.amount);
              const claimed = parseFloat(scheduleInfo.claimed);
              const totalDuration = scheduleInfo.endTime - scheduleInfo.startTime;
              const elapsed = Math.min(currentTime - scheduleInfo.startTime, totalDuration);
              const percentComplete = elapsed / totalDuration;
              const shouldBeReleased = totalAmount * percentComplete;
              const releasable = Math.max(0, shouldBeReleased - claimed);
              scheduleInfo.releasable = releasable.toString();
            }
          }
          
          result.beneficiaries.push(scheduleInfo);
        } catch (e) {
          console.warn(`Error al obtener información de vesting para ${beneficiary}:`, e);
          result.beneficiaries.push({ address: beneficiary });
        }
      } else {
        // Si no podemos obtener información detallada, al menos guardamos la dirección
        result.beneficiaries.push({ address: beneficiary });
      }
    } catch (e) {
      console.warn(`Error al procesar beneficiario ${beneficiary}:`, e);
      result.beneficiaries.push({ address: beneficiary });
    }
  }
  
  // Actualizar el número total de schedules creados
  result.totalSchedulesCreated = result.beneficiaries.length;
  console.log("Total de schedules creados:", result.totalSchedulesCreated);
}

// Función para calcular tokens liberables basado en el tiempo
export function calculateReleasableTokens(
  beneficiaries: any[],
  currentTime: number = Math.floor(Date.now() / 1000)
): number {
  let totalReleasable = 0;
  
  for (const beneficiary of beneficiaries) {
    if (beneficiary.startTime && beneficiary.endTime && beneficiary.amount) {
      const startTime = beneficiary.startTime;
      const endTime = beneficiary.endTime;
      const totalAmount = parseFloat(beneficiary.amount);
      const claimed = parseFloat(beneficiary.claimed || '0');
      
      // Si el vesting ya comenzó
      if (currentTime > startTime) {
        // Calcular el porcentaje de tiempo transcurrido
        const totalDuration = endTime - startTime;
        const elapsed = Math.min(currentTime - startTime, totalDuration);
        const percentComplete = elapsed / totalDuration;
        
        // Calcular cuánto debería estar liberado
        const shouldBeReleased = totalAmount * percentComplete;
        const releasable = Math.max(0, shouldBeReleased - claimed);
        
        // Actualizar el valor de tokens liberables para este beneficiario
        beneficiary.releasable = releasable.toString();
        totalReleasable += releasable;
        
        console.log(`Estimación para ${beneficiary.address}: Total=${totalAmount}, Reclamado=${claimed}, Liberado=${shouldBeReleased}, Liberables=${releasable}`);
      }
    }
  }
  
  return totalReleasable;
}
