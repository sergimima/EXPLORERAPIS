import React, { useState, useEffect } from 'react';
import { fetchVestingInfo } from '@/lib/blockchain';
import { getExplorerUrl } from '@/lib/utils';
import { Network } from '@/lib/types';

interface VestingInfoProps {
  walletAddress: string;
  network: Network;
  isLoading: boolean;
  searchTriggered?: number;
  preloadedData?: any[]; // Datos precargados desde el componente principal
}

interface VestingSchedule {
  vestingId?: string;
  tokenName: string;
  tokenSymbol: string;
  tokenAddress: string;
  contractAddress?: string;
  totalAmount: string;
  vestedAmount: string;
  claimableAmount: string;
  remainingAmount: string;
  releasedAmount: string;
  startTime: number;
  endTime: number;
  nextUnlockTime?: number;
  nextUnlockAmount?: string;
  slicePeriodSeconds?: number;
  cliff?: number;
  cliffEndTime?: number;
}

interface ClaimHistoryItem {
  amount: string;
  timestamp: number;
  transactionHash?: string;
}

interface VestingScheduleWithHistory extends VestingSchedule {
  claimHistory?: ClaimHistoryItem[];
  contractName?: string;
  scheduleCount?: number;
  schedules?: VestingSchedule[];
}

const formatPeriod = (seconds: number) => {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secondsRemaining = seconds % 60;

  const parts = [];
  if (days > 0) parts.push(`${days} días`);
  if (hours > 0) parts.push(`${hours} horas`);
  if (minutes > 0) parts.push(`${minutes} minutos`);
  if (secondsRemaining > 0) parts.push(`${secondsRemaining} segundos`);

  return parts.join(', ');
};

const renderTimelineProgress = (schedule: VestingSchedule) => {
  const startDate = new Date(schedule.startTime * 1000);
  const endDate = new Date(schedule.endTime * 1000);
  const currentTime = new Date();

  const totalDuration = endDate.getTime() - startDate.getTime();
  const elapsedDuration = currentTime.getTime() - startDate.getTime();

  const progress = (elapsedDuration / totalDuration) * 100;

  return (
    <div className="w-full bg-primary" style={{ width: `${progress}%` }}></div>
  );
};

const generateUnlockSchedule = (schedule: VestingSchedule) => {
  const unlocks = [];

  if (schedule.slicePeriodSeconds) {
    const startDate = new Date(schedule.startTime * 1000);
    const endDate = new Date(schedule.endTime * 1000);
    const slicePeriod = schedule.slicePeriodSeconds * 1000;

    for (let date = startDate; date < endDate; date = new Date(date.getTime() + slicePeriod)) {
      const totalAmountNum = parseFloat(schedule.totalAmount);
      const amount = (totalAmountNum / (endDate.getTime() - startDate.getTime())) * slicePeriod;
      unlocks.push({ date: date.getTime() / 1000, amount: amount.toString(), status: 'Pendiente' });
    }
  }

  if (schedule.cliff && schedule.cliffEndTime) {
    const cliffDate = new Date(schedule.cliffEndTime * 1000);
    const totalAmountNum = parseFloat(schedule.totalAmount);
    const amount = totalAmountNum * (schedule.cliff / 100);
    unlocks.push({ date: cliffDate.getTime() / 1000, amount: amount.toString(), status: 'Liberado' });
  }

  return unlocks;
};

const VestingInfo: React.FC<VestingInfoProps> = ({ 
  walletAddress, 
  network, 
  isLoading, 
  searchTriggered = 0,
  preloadedData 
}) => {
  const [vestingSchedules, setVestingSchedules] = useState<VestingScheduleWithHistory[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedRows, setExpandedRows] = useState<Record<number, boolean>>({});
  const [showScheduleRows, setShowScheduleRows] = useState<Record<number, boolean>>({});
  const [vestingContractsByResults, setVestingContractsByResults] = useState<Record<string, VestingScheduleWithHistory[]>>({});
  const [currentContract, setCurrentContract] = useState<string | null>(null);
  const [processedContracts, setProcessedContracts] = useState<number>(0);
  const [statusMessages, setStatusMessages] = useState<string[]>([]);

  // Efecto para verificar la dirección de wallet recibida
  useEffect(() => {
    console.log("VestingInfo recibió wallet:", walletAddress);
    console.log("VestingInfo recibió network:", network);
    
    // Limpiar datos cuando cambia la wallet o la red
    if (walletAddress) {
      setVestingSchedules([]);
      setVestingContractsByResults({});
      setStatusMessages(["Datos limpiados. Pulse 'Buscar Información de Vesting' para cargar los datos."]);
    }
  }, [walletAddress, network]);

  // Efecto para usar datos precargados si están disponibles
  useEffect(() => {
    if (preloadedData && preloadedData.length > 0) {
      console.log("Usando datos precargados en VestingInfo:", preloadedData.length, "schedules");
      
      // Convertir los datos precargados al formato esperado
      const formattedData = preloadedData.map(schedule => {
        // Asegurarse de que tiene el formato correcto de VestingScheduleWithHistory
        if (!schedule.contractAddress) {
          return {
            ...schedule,
            contractAddress: "desconocido", // Valor por defecto si no existe
            claimHistory: schedule.claimHistory || []
          };
        }
        return schedule;
      });
      
      setVestingSchedules(formattedData);
      
      // Organizar por contrato
      const byContract: Record<string, VestingScheduleWithHistory[]> = {};
      formattedData.forEach(schedule => {
        const contract = schedule.contractAddress || "desconocido";
        if (!byContract[contract]) {
          byContract[contract] = [];
        }
        byContract[contract].push(schedule);
      });
      
      setVestingContractsByResults(byContract);
      setError(null);
      setStatusMessages(["Datos cargados desde el componente principal"]);
    }
  }, [preloadedData]);

  const vestingContracts = [
    "0xa699Cf416FFe6063317442c3Fbd0C39742E971c5",
    "0x3e0ef51811B647E00A85A7e5e495fA4763911982",
    "0xE521B2929DD28a725603bCb6F4009FBb656C4b15",
    "0x3a7cf4cCC76bb23Cf15845B0d4f05BafF1D478cF",
    "0x417Fc9c343210AA52F0b19dbf4EecBD786139BC1",
    "0xFC750D874077F8c90858cC132e0619CE7571520b",
    "0xde68AD324aafD9F2b6946073C90ED5e61D5d51B8",
    "0xC4CE5cFea2B6e32Ad41973348AC70EB3b00D8e6d",
    "0x7BBDa50bE87DFf935782C80D4222D46490F242A1",
    "0x1808CF66F69DC1B8217d1C655fBD134B213AE358"
  ];

  const calculateTotals = () => {
    if (vestingSchedules.length === 0) return null;
    
    let totalAmount = 0;
    let totalVestedAmount = 0;
    let totalClaimableAmount = 0;
    let totalReleasedAmount = 0;
    let totalRemainingAmount = 0;
    
    vestingSchedules.forEach(schedule => {
      totalAmount += parseFloat(schedule.totalAmount) || 0;
      totalVestedAmount += parseFloat(schedule.vestedAmount) || 0;
      totalClaimableAmount += parseFloat(schedule.claimableAmount) || 0;
      totalReleasedAmount += parseFloat(schedule.releasedAmount) || 0;
      totalRemainingAmount += parseFloat(schedule.remainingAmount) || 0;
    });
    
    return {
      totalAmount: totalAmount.toFixed(6),
      totalVestedAmount: totalVestedAmount.toFixed(6),
      totalClaimableAmount: totalClaimableAmount.toFixed(6),
      totalReleasedAmount: totalReleasedAmount.toFixed(6),
      totalRemainingAmount: totalRemainingAmount.toFixed(6)
    };
  };
  
  const totals = calculateTotals();

  const fetchVestingData = async (forceRefresh: boolean = false) => {
    if (!walletAddress) {
      const errorMsg = 'Por favor, introduce una dirección de wallet válida';
      setError(errorMsg);
      console.error(errorMsg);
      return;
    }

    // Normalizar la dirección de wallet (convertir a minúsculas)
    const normalizedWalletAddress = walletAddress.toLowerCase();
    console.log(`Iniciando búsqueda de vesting para wallet: ${normalizedWalletAddress} en red: ${network}, force=${forceRefresh}`);
    setLoading(true);
    setError(null);
    setVestingSchedules([]);
    setVestingContractsByResults({});
    setProcessedContracts(0);
    setStatusMessages([`Iniciando búsqueda para wallet: ${normalizedWalletAddress}${forceRefresh ? ' (actualizando desde blockchain)' : ''}`]);

    try {
      // Usar API con caché en lugar de llamadas directas a blockchain
      const response = await fetch(`/api/vesting-info?wallet=${normalizedWalletAddress}&network=${network}&force=${forceRefresh}`);

      if (!response.ok) {
        throw new Error('Error al obtener información de vesting');
      }

      const result = await response.json();
      console.log('[VestingInfo] API response:', result);
      if (result.debugLog) {
        console.log('[VestingInfo] Debug por contrato:', result.debugLog);
      }

      if (!result.success || !result.vestingSchedules) {
        throw new Error('Respuesta inválida de la API');
      }

      const allSchedules: VestingScheduleWithHistory[] = [];
      const contractResults: Record<string, VestingScheduleWithHistory[]> = {};

      // Procesar los resultados de la API
      for (const vestingData of result.vestingSchedules) {
        const contractAddress = vestingData.vestingContractAddress;

        // Check if this vesting has schedules array (new aggregated format)
        if (vestingData.schedules && Array.isArray(vestingData.schedules) && vestingData.schedules.length > 0) {
          const statusMsg = `✅ Encontrado vesting en ${vestingData.contractName || contractAddress} con ${vestingData.schedules.length} schedules`;
          console.log(statusMsg);
          setStatusMessages(prev => [...prev, statusMsg]);

          // Store aggregated vesting with schedules array
          const vesting: any = {
            tokenName: vestingData.tokenName,
            tokenSymbol: vestingData.tokenSymbol,
            tokenAddress: vestingData.tokenAddress,
            totalAmount: vestingData.totalAmount,
            vestedAmount: vestingData.vestedAmount,
            claimableAmount: vestingData.claimableAmount,
            remainingAmount: vestingData.remainingAmount,
            releasedAmount: vestingData.releasedAmount,
            startTime: vestingData.startTime,
            endTime: vestingData.endTime,
            vestingId: vestingData.vestingId,
            contractAddress: contractAddress,
            contractName: vestingData.contractName,
            schedules: vestingData.schedules, // Keep schedules array
            scheduleCount: vestingData.schedules.length,
            claimHistory: []
          };

          allSchedules.push(vesting);

          // Agrupar por contrato
          if (!contractResults[contractAddress]) {
            contractResults[contractAddress] = [];
          }
          contractResults[contractAddress].push(vesting);
        } else {
          // Old format: single schedule without schedules array
          const statusMsg = `✅ Encontrado vesting en ${vestingData.contractName || contractAddress}`;
          console.log(statusMsg);
          setStatusMessages(prev => [...prev, statusMsg]);

          const schedule: VestingScheduleWithHistory = {
            tokenName: vestingData.tokenName,
            tokenSymbol: vestingData.tokenSymbol,
            tokenAddress: vestingData.tokenAddress,
            totalAmount: vestingData.totalAmount,
            vestedAmount: vestingData.vestedAmount,
            claimableAmount: vestingData.claimableAmount,
            remainingAmount: vestingData.remainingAmount,
            releasedAmount: vestingData.releasedAmount,
            startTime: vestingData.startTime,
            endTime: vestingData.endTime,
            nextUnlockTime: vestingData.nextUnlockTime || undefined,
            nextUnlockAmount: vestingData.nextUnlockAmount || undefined,
            slicePeriodSeconds: vestingData.slicePeriodSeconds || undefined,
            cliff: vestingData.cliff || undefined,
            cliffEndTime: vestingData.cliffEndTime || undefined,
            vestingId: vestingData.vestingId,
            contractAddress: contractAddress,
            claimHistory: parseFloat(vestingData.releasedAmount) > 0 ? [{
              amount: vestingData.releasedAmount,
              timestamp: Date.now() / 1000,
              transactionHash: undefined
            }] : []
          };

          allSchedules.push(schedule);

          // Agrupar por contrato
          if (!contractResults[contractAddress]) {
            contractResults[contractAddress] = [];
          }
          contractResults[contractAddress].push(schedule);
        }
      }

      // Actualizar estados
      setVestingSchedules(allSchedules);
      setVestingContractsByResults(contractResults);
      setProcessedContracts(result.vestingSchedules.length);
      setCurrentContract(null);

      const finalMsg = `Búsqueda completada. Encontrados ${allSchedules.length} schedules en total${result.fromCache ? ' (desde BD)' : ' (desde blockchain)'}.`;
      console.log(finalMsg);
      setStatusMessages(prev => [...prev, finalMsg]);
      
      if (allSchedules.length === 0) {
        // Mensaje más detallado cuando no se encuentran vestings
        setError(`No se encontró información de vesting para la wallet ${normalizedWalletAddress} en ninguno de los contratos. Esto puede deberse a que la wallet no tiene vestings asignados o a que los contratos no reconocen esta dirección.`);
      }
    } catch (err) {
      const errorMsg = `Error general al obtener los datos de vesting: ${err instanceof Error ? err.message : String(err)}`;
      setError(errorMsg);
      console.error(errorMsg);
      setStatusMessages(prev => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  const handleFetchAllVestingInfo = async () => {
    // Si ya tenemos datos precargados, no necesitamos buscar de nuevo
    if (preloadedData && preloadedData.length > 0) {
      console.log("Usando datos precargados, no es necesario buscar de nuevo");
      return;
    }
    await fetchVestingData(false);
  };

  const handleRefreshVestingInfo = async () => {
    await fetchVestingData(true);
  };

  const toggleRowExpansion = (index: number) => {
    setExpandedRows(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  };

  const toggleScheduleRow = (index: number) => {
    setShowScheduleRows(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  };

  if (isLoading) {
    return (
      <div className="bg-card p-6 rounded-lg shadow-md border border-border">
        <div className="flex justify-center items-center h-40">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card p-6 rounded-lg shadow-md border border-border">
      <h2 className="text-xl font-semibold mb-4">Información de Vesting</h2>
      
      <div className="mb-6">
        <div className="flex justify-between items-center mb-4">
          <div className="flex gap-2">
            <button
              onClick={handleFetchAllVestingInfo}
              disabled={loading || !walletAddress}
              className="btn-primary"
            >
              {loading ? 'Cargando...' : 'Consultar Todos los Contratos de Vesting'}
            </button>

            <button
              onClick={handleRefreshVestingInfo}
              disabled={loading || !walletAddress}
              className="px-4 py-2 bg-success text-success-foreground rounded hover:opacity-90 disabled:bg-muted disabled:cursor-not-allowed transition-colors"
              title="Actualizar desde blockchain (fuerza búsqueda RPC)"
            >
              🔄 Actualizar
            </button>
          </div>
          
          {loading && (
            <div className="flex items-center">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600 mr-2"></div>
              <span className="text-sm text-muted-foreground">
                Comprobando contrato {processedContracts + 1} de {vestingContracts.length}: 
                <span className="font-mono ml-1">{currentContract}</span>
              </span>
            </div>
          )}
        </div>

        <div className="mb-4 p-3 bg-muted rounded-md">
          <p className="text-sm text-card-foreground">
            <strong>Wallet:</strong> {walletAddress || 'No especificada'}
          </p>
          <p className="text-sm text-card-foreground">
            <strong>Red:</strong> {network || 'No especificada'}
          </p>
        </div>

        {error && (
          <div className="bg-destructive/10 border border-destructive text-destructive px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}
        
        {loading && processedContracts > 0 && (
          <div className="w-full bg-muted rounded-full h-2.5 mb-4">
            <div 
              className="bg-primary h-2.5 rounded-full" 
              style={{ width: `${(processedContracts / vestingContracts.length) * 100}%` }}
            ></div>
          </div>
        )}
        
        {statusMessages.length > 0 && (
          <div className="mt-4 mb-4 p-3 bg-muted rounded-md max-h-40 overflow-y-auto">
            <h3 className="text-sm font-medium mb-2">Log de operaciones:</h3>
            <ul className="text-xs space-y-1">
              {statusMessages.map((msg, index) => (
                <li key={index} className="font-mono">{msg}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {vestingSchedules.length === 0 && !loading ? (
        <p className="text-center text-muted-foreground">
          No se encontró información de vesting para esta wallet. Haz clic en "Consultar Todos los Contratos de Vesting" para buscar.
        </p>
      ) : (
        <div>
          {Object.entries(vestingContractsByResults).map(([contractAddress, schedules], contractIndex) => (
            <div key={contractIndex} className="mb-8">
              <h3 className="text-lg font-medium mb-3">
                Contrato: <span className="font-mono text-sm">{contractAddress}</span>
              </h3>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-border">
                  <thead className="bg-muted">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Token</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Total</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Liberado</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Reclamable</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Reclamado</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Bloqueado</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Período</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Próximo Desbloqueo</th>
                    </tr>
                  </thead>
                  <tbody className="bg-card divide-y divide-border">
                    {schedules.map((vesting, index) => (
                      <React.Fragment key={index}>
                        {/* Main vesting row with aggregated totals */}
                        <tr className="bg-accent">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <button
                                onClick={() => toggleRowExpansion(contractIndex * 100 + index)}
                                className="mr-2 bg-primary hover:opacity-90 text-primary-foreground font-bold py-1 px-2 rounded text-xs"
                                title={expandedRows[contractIndex * 100 + index] ? "Ocultar schedules" : "Ver schedules"}
                              >
                                {expandedRows[contractIndex * 100 + index] ? '−' : '+'}
                              </button>
                              <div>
                                <div className="text-sm font-bold text-card-foreground">{vesting.tokenSymbol}</div>
                                <div className="text-sm text-muted-foreground">{vesting.tokenName}</div>
                                {vesting.scheduleCount && (
                                  <div className="text-xs text-primary font-medium">{vesting.scheduleCount} schedules</div>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-bold text-card-foreground">{vesting.totalAmount}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-bold text-card-foreground">{vesting.vestedAmount}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-bold text-card-foreground">{vesting.claimableAmount}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-bold text-card-foreground">{vesting.releasedAmount}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-bold text-card-foreground">{vesting.remainingAmount}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-card-foreground">
                              {new Date(vesting.startTime * 1000).toLocaleDateString()} - {new Date(vesting.endTime * 1000).toLocaleDateString()}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-card-foreground">
                              {vesting.contractName || 'Vesting'}
                            </div>
                          </td>
                        </tr>

                        {/* Expanded section showing individual schedules */}
                        {expandedRows[contractIndex * 100 + index] && vesting.schedules && vesting.schedules.length > 0 && (
                          <tr>
                            <td colSpan={8} className="px-6 py-4 bg-muted">
                              <div className="text-sm font-medium text-card-foreground mb-3">Schedules Individuales ({vesting.schedules.length})</div>
                              <table className="min-w-full divide-y divide-border border">
                                <thead className="bg-muted">
                                  <tr>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase">#</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase">Fase</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase">Total</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase">Reclamado</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase">Restante</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase">Inicio</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase">Fin</th>
                                  </tr>
                                </thead>
                                <tbody className="bg-card divide-y divide-border">
                                  {vesting.schedules.map((sched: any, schedIndex: number) => (
                                    <tr key={schedIndex}>
                                      <td className="px-4 py-2 whitespace-nowrap text-sm text-card-foreground">{schedIndex + 1}</td>
                                      <td className="px-4 py-2 whitespace-nowrap text-sm text-card-foreground">{sched.phase || 'N/A'}</td>
                                      <td className="px-4 py-2 whitespace-nowrap text-sm text-card-foreground">{sched.totalAmount}</td>
                                      <td className="px-4 py-2 whitespace-nowrap text-sm text-card-foreground">{sched.releasedAmount}</td>
                                      <td className="px-4 py-2 whitespace-nowrap text-sm text-card-foreground">{sched.remainingAmount}</td>
                                      <td className="px-4 py-2 whitespace-nowrap text-sm text-muted-foreground">
                                        {new Date(sched.startTime * 1000).toLocaleDateString()}
                                      </td>
                                      <td className="px-4 py-2 whitespace-nowrap text-sm text-muted-foreground">
                                        {new Date(sched.endTime * 1000).toLocaleDateString()}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                  </tbody>
                  {schedules.length > 0 && (() => {
                    let totalAmount = 0;
                    let totalVestedAmount = 0;
                    let totalClaimableAmount = 0;
                    let totalReleasedAmount = 0;
                    let totalRemainingAmount = 0;
                    
                    schedules.forEach(schedule => {
                      totalAmount += parseFloat(schedule.totalAmount) || 0;
                      totalVestedAmount += parseFloat(schedule.vestedAmount) || 0;
                      totalClaimableAmount += parseFloat(schedule.claimableAmount) || 0;
                      totalReleasedAmount += parseFloat(schedule.releasedAmount) || 0;
                      totalRemainingAmount += parseFloat(schedule.remainingAmount) || 0;
                    });
                    
                    return (
                      <tfoot className="bg-muted font-medium">
                        <tr>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-card-foreground">
                            <strong>TOTALES DEL CONTRATO</strong>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-card-foreground">
                            {totalAmount.toFixed(6)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-card-foreground">
                            {totalVestedAmount.toFixed(6)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-card-foreground">
                            {totalClaimableAmount.toFixed(6)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-card-foreground">
                            {totalReleasedAmount.toFixed(6)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-card-foreground">
                            {totalRemainingAmount.toFixed(6)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap"></td>
                          <td className="px-6 py-4 whitespace-nowrap"></td>
                        </tr>
                      </tfoot>
                    );
                  })()}
                </table>
              </div>
            </div>
          ))}
          
          {vestingSchedules.length > 0 && (
            <div className="mt-8 p-4 bg-accent rounded-lg shadow border border-border">
              <h3 className="text-lg font-semibold mb-4">Totales Globales (Todos los Contratos)</h3>
              <div className="grid grid-cols-5 gap-4">
                <div className="bg-white p-4 rounded shadow-sm">
                  <div className="text-sm text-muted-foreground">Total</div>
                  <div className="text-xl font-bold text-card-foreground">{totals?.totalAmount}</div>
                </div>
                <div className="bg-white p-4 rounded shadow-sm">
                  <div className="text-sm text-gray-600">Liberado</div>
                  <div className="text-xl font-bold text-card-foreground">{totals?.totalVestedAmount}</div>
                </div>
                <div className="bg-white p-4 rounded shadow-sm">
                  <div className="text-sm text-muted-foreground">Reclamable</div>
                  <div className="text-xl font-bold text-card-foreground">{totals?.totalClaimableAmount}</div>
                </div>
                <div className="bg-white p-4 rounded shadow-sm">
                  <div className="text-sm text-muted-foreground">Reclamado</div>
                  <div className="text-xl font-bold text-card-foreground">{totals?.totalReleasedAmount}</div>
                </div>
                <div className="bg-white p-4 rounded shadow-sm">
                  <div className="text-sm text-muted-foreground">Bloqueado</div>
                  <div className="text-xl font-bold text-card-foreground">{totals?.totalRemainingAmount}</div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default VestingInfo;
