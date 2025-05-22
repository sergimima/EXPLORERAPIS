import { ethers } from 'ethers';

/**
 * Procesa la información de vesting para un beneficiario usando el método getVestingListByHolder
 * @param contract El contrato de vesting
 * @param beneficiaries Lista de direcciones de beneficiarios
 * @param contractABI ABI del contrato (opcional)
 * @param tokenDecimals Decimales del token
 * @returns Información de vesting para cada beneficiario
 */
export async function processVestingWithGetVestingListByHolder(
  contract: any,
  beneficiaries: string[],
  contractABI?: any[],
  tokenDecimals: number = 18
) {
  // Inicializar el objeto de resultado
  const result: any = {
    beneficiaries: [],
    totalSchedulesCreated: 0,
    releasableTokens: '0',
    totalVested: '0',
    totalReleased: '0',
    remainingToVest: '0',
    lockedTokens: '0',
    totalBeneficiaries: beneficiaries.length,
    validBeneficiaries: 0,
    errorBeneficiaries: 0
  };

  console.log("Usando getVestingListByHolder para obtener información exacta de vesting");
  
  // Variables para acumular totales
  let totalVestedAmount = 0;
  let totalReleasedAmount = 0;
  let totalReleasableAmount = 0;
  
  // Contador para beneficiarios con datos válidos
  let validBeneficiariesCount = 0;
  let errorBeneficiariesCount = 0;
  
  // Procesar beneficiarios en lotes para mostrar resultados parciales más rápido
  const BATCH_SIZE = 10; // Procesar 10 beneficiarios a la vez
  
  // Dividir los beneficiarios en lotes
  for (let i = 0; i < beneficiaries.length; i += BATCH_SIZE) {
    const batch = beneficiaries.slice(i, i + BATCH_SIZE);
    console.log(`Procesando lote de beneficiarios ${i+1} a ${Math.min(i+BATCH_SIZE, beneficiaries.length)} de ${beneficiaries.length}`);
    
    // Procesar cada beneficiario en el lote actual
    for (const beneficiary of batch) {
      try {
        console.log(`Procesando beneficiario: ${beneficiary}`);
        
        // Crear un timeout para evitar que la llamada se quede esperando indefinidamente
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Timeout al obtener vestings')), 15000);
        });
        
        // Intentar obtener la lista de vestings para este beneficiario
        let vestingList;
        try {
          vestingList = await Promise.race([
            contract.getVestingListByHolder(beneficiary),
            timeoutPromise
          ]);
        } catch (timeoutError) {
          console.warn(`Timeout al obtener vestings para ${beneficiary}:`, timeoutError);
          // Añadir beneficiario con error por timeout
          result.beneficiaries.push({ 
            address: beneficiary,
            error: 'Timeout al obtener vestings',
            hasError: true,
            totalAmount: "0",
            totalClaimed: "0",
            totalRemaining: "0",
            totalReleasable: "0"
          });
          errorBeneficiariesCount++;
          continue; // Saltar a la siguiente iteración
        }
        
        // Si no hay vestings, agregar el beneficiario con una marca especial
        if (!vestingList || vestingList.length === 0) {
          console.log(`No se encontraron vestings para ${beneficiary}`);
          result.beneficiaries.push({
            address: beneficiary,
            noVestings: true,
            totalAmount: "0",
            totalClaimed: "0",
            totalRemaining: "0",
            totalReleasable: "0"
          });
          continue;
        }
        
        // Si hay vestings para este beneficiario
        // Incrementar contador de beneficiarios válidos
        validBeneficiariesCount++;
        
        // Crear un objeto para almacenar la información agregada del beneficiario
        const aggregatedInfo: any = {
          address: beneficiary,
          totalAmount: 0,
          totalClaimed: 0,
          totalRemaining: 0,
          totalReleasable: 0,
          vestings: [] // Almacenar información detallada de cada vesting
        };
        
        // Procesar cada vesting
        for (let j = 0; j < vestingList.length; j++) {
          const vesting = vestingList[j];
          
          // Extraer la información del vesting
          const scheduleInfo: any = {
            address: beneficiary,
            scheduleId: j.toString(),
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
              // Usar directamente el cálculo basado en tiempo para evitar errores con computeVestingId
              const totalDuration = scheduleInfo.endTime - scheduleInfo.startTime;
              const elapsed = Math.min(currentTime - scheduleInfo.startTime, totalDuration);
              const percentComplete = elapsed / totalDuration;
              const shouldBeReleased = totalAmount * percentComplete;
              const releasable = Math.max(0, shouldBeReleased - claimed);
              scheduleInfo.releasable = releasable.toString();
            } else {
              scheduleInfo.releasable = '0';
            }
          }
          
          // Actualizar totales para este beneficiario
          aggregatedInfo.totalAmount += totalAmount;
          aggregatedInfo.totalClaimed += claimed;
          aggregatedInfo.totalRemaining += parseFloat(scheduleInfo.remaining);
          aggregatedInfo.totalReleasable += parseFloat(scheduleInfo.releasable);
          
          // Actualizar totales globales
          totalVestedAmount += totalAmount;
          totalReleasedAmount += claimed;
          totalReleasableAmount += parseFloat(scheduleInfo.releasable);
          
          // Añadir este vesting a la lista de vestings del beneficiario
          aggregatedInfo.vestings.push(scheduleInfo);
          
          console.log(`Vesting ${j} para ${beneficiary}: ${scheduleInfo.amount} tokens, liberables: ${scheduleInfo.releasable}`);
        }
        
        // Convertir los totales a strings
        aggregatedInfo.totalAmount = aggregatedInfo.totalAmount.toString();
        aggregatedInfo.totalClaimed = aggregatedInfo.totalClaimed.toString();
        aggregatedInfo.totalRemaining = aggregatedInfo.totalRemaining.toString();
        aggregatedInfo.totalReleasable = aggregatedInfo.totalReleasable.toString();
        
        // Añadir el beneficiario agregado a la lista
        result.beneficiaries.push(aggregatedInfo);
      } catch (e) {
        console.error(`Error al procesar beneficiario ${beneficiary}:`, e);
        // Añadir beneficiario con información mínima pero indicando que hubo un error
        result.beneficiaries.push({ 
          address: beneficiary,
          error: e instanceof Error ? e.message : 'Error desconocido',
          hasError: true,
          totalAmount: "0",
          totalClaimed: "0",
          totalRemaining: "0",
          totalReleasable: "0"
        });
        errorBeneficiariesCount++;
      }
    }
    
    // Actualizar el número total de schedules creados después de cada lote
    result.totalSchedulesCreated = result.beneficiaries.reduce((total: number, beneficiary: any) => 
      total + (beneficiary.vestings ? beneficiary.vestings.length : 0), 0);
    console.log("Total de schedules obtenidos hasta ahora:", result.totalSchedulesCreated);
    
    // Actualizar contadores de beneficiarios después de cada lote
    result.validBeneficiaries = validBeneficiariesCount;
    result.errorBeneficiaries = errorBeneficiariesCount;
    
    // Actualizar totales globales después de cada lote
    result.totalVested = totalVestedAmount.toString();
    result.totalReleased = totalReleasedAmount.toString();
    result.remainingToVest = (totalVestedAmount - totalReleasedAmount).toString();
    result.lockedTokens = result.remainingToVest;
    
    if (totalReleasableAmount > 0) {
      result.releasableTokens = totalReleasableAmount.toString();
    }
  }
  
  // Actualizar el número total de schedules creados al final
  console.log("Total final de schedules obtenidos:", result.totalSchedulesCreated);
  
  // Establecer explícitamente el número total de beneficiarios
  result.totalBeneficiaries = beneficiaries.length;
  console.log(`Beneficiarios totales: ${result.totalBeneficiaries}, válidos: ${result.validBeneficiaries}, con error: ${result.errorBeneficiaries}`);
  
  // Actualizar totales globales finales
  if (totalReleasableAmount > 0) {
    console.log("Total de tokens liberables:", result.releasableTokens);
  }
  
  return result;
}
