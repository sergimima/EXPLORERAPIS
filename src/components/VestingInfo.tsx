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
    <div className="w-full bg-blue-600" style={{ width: `${progress}%` }}></div>
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

      if (!result.success || !result.vestingSchedules) {
        throw new Error('Respuesta inválida de la API');
      }

      const allSchedules: VestingScheduleWithHistory[] = [];
      const contractResults: Record<string, VestingScheduleWithHistory[]> = {};

      // Procesar los resultados de la API
      for (const vestingData of result.vestingSchedules) {
        const contractAddress = vestingData.vestingContractAddress;
        const statusMsg = `✅ Encontrado vesting en ${vestingData.contractName || contractAddress}`;
        console.log(statusMsg);
        setStatusMessages(prev => [...prev, statusMsg]);

        // Convertir formato de BD a formato de componente
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
      <div className="bg-white p-6 rounded-lg shadow-md">
        <div className="flex justify-center items-center h-40">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
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
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              title="Actualizar desde blockchain (fuerza búsqueda RPC)"
            >
              🔄 Actualizar
            </button>
          </div>
          
          {loading && (
            <div className="flex items-center">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600 mr-2"></div>
              <span className="text-sm text-gray-600">
                Comprobando contrato {processedContracts + 1} de {vestingContracts.length}: 
                <span className="font-mono ml-1">{currentContract}</span>
              </span>
            </div>
          )}
        </div>

        <div className="mb-4 p-3 bg-gray-50 rounded-md">
          <p className="text-sm text-gray-700">
            <strong>Wallet:</strong> {walletAddress || 'No especificada'}
          </p>
          <p className="text-sm text-gray-700">
            <strong>Red:</strong> {network || 'No especificada'}
          </p>
        </div>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}
        
        {loading && processedContracts > 0 && (
          <div className="w-full bg-gray-200 rounded-full h-2.5 mb-4">
            <div 
              className="bg-blue-600 h-2.5 rounded-full" 
              style={{ width: `${(processedContracts / vestingContracts.length) * 100}%` }}
            ></div>
          </div>
        )}
        
        {statusMessages.length > 0 && (
          <div className="mt-4 mb-4 p-3 bg-gray-50 rounded-md max-h-40 overflow-y-auto">
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
        <p className="text-center text-gray-500">
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
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Token</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Liberado</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reclamable</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reclamado</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Bloqueado</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Período</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Próximo Desbloqueo</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {schedules.map((schedule, index) => (
                      <React.Fragment key={index}>
                        <tr>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div className="ml-4">
                                <div className="text-sm font-medium text-gray-900">{schedule.tokenSymbol}</div>
                                <div className="text-sm text-gray-500">{schedule.tokenName}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">{schedule.totalAmount}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">{schedule.vestedAmount}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">{schedule.claimableAmount}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div className="text-sm text-gray-900">{schedule.releasedAmount}</div>
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleRowExpansion(contractIndex * 100 + index);
                                }}
                                className="ml-2 bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold py-1 px-2 rounded text-xs"
                                title="Ver historial de reclamaciones"
                              >
                                {expandedRows[contractIndex * 100 + index] ? '−' : '+'}
                              </button>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">{schedule.remainingAmount}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">
                              {new Date(schedule.startTime * 1000).toLocaleDateString()} - {new Date(schedule.endTime * 1000).toLocaleDateString()}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">
                              {schedule.nextUnlockTime ? (
                                <>
                                  {new Date(schedule.nextUnlockTime * 1000).toLocaleDateString()}: {schedule.nextUnlockAmount}
                                </>
                              ) : (
                                'No hay más desbloqueos'
                              )}
                            </div>
                          </td>
                        </tr>
                        {expandedRows[contractIndex * 100 + index] && (
                          <tr>
                            <td colSpan={8} className="px-6 py-4 bg-gray-50">
                              <div className="text-sm font-medium text-gray-900 mb-2">Historial de Reclamaciones</div>
                              {schedule.claimHistory && schedule.claimHistory.length > 0 ? (
                                <table className="min-w-full divide-y divide-gray-200 border">
                                  <thead className="bg-gray-100">
                                    <tr>
                                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha</th>
                                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cantidad</th>
                                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Transacción</th>
                                    </tr>
                                  </thead>
                                  <tbody className="bg-white divide-y divide-gray-200">
                                    {schedule.claimHistory.map((claim, claimIndex) => (
                                      <tr key={claimIndex}>
                                        <td className="px-4 py-2 whitespace-nowrap">
                                          <div className="text-sm text-gray-900">
                                            {new Date(claim.timestamp * 1000).toLocaleDateString()} {new Date(claim.timestamp * 1000).toLocaleTimeString()}
                                          </div>
                                        </td>
                                        <td className="px-4 py-2 whitespace-nowrap">
                                          <div className="text-sm text-gray-900">{claim.amount} {schedule.tokenSymbol}</div>
                                        </td>
                                        <td className="px-4 py-2 whitespace-nowrap">
                                          <div className="text-sm text-gray-900">
                                            {claim.transactionHash ? (
                                              <a
                                                href={`${getExplorerUrl(network)}/tx/${claim.transactionHash}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-blue-600 hover:text-blue-800"
                                              >
                                                {claim.transactionHash.substring(0, 8)}...{claim.transactionHash.substring(claim.transactionHash.length - 6)}
                                              </a>
                                            ) : (
                                              "No disponible"
                                            )}
                                          </div>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              ) : (
                                <div className="text-sm text-gray-500">No hay historial de reclamaciones disponible.</div>
                              )}
                            </td>
                          </tr>
                        )}
                        <tr>
                          <td colSpan={8} className="px-6 py-4 bg-gray-50">
                            <div className="flex items-center">
                              <div className="text-sm font-medium text-gray-900">Cronograma de Liberación</div>
                              <button 
                                onClick={() => toggleScheduleRow(contractIndex * 100 + index)}
                                className="ml-2 bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold py-1 px-2 rounded text-xs"
                                title="Ver cronograma de liberación"
                              >
                                {showScheduleRows[contractIndex * 100 + index] ? '−' : '+'}
                              </button>
                            </div>
                          </td>
                        </tr>
                        {showScheduleRows[contractIndex * 100 + index] && (
                          <tr>
                            <td colSpan={8} className="px-6 py-4 bg-gray-50">
                              <div className="grid grid-cols-1 gap-4">
                                <div className="bg-white p-4 rounded shadow-sm">
                                  <h4 className="text-md font-medium text-gray-900 mb-2">Detalles de Liberación</h4>
                                  <div className="grid grid-cols-2 gap-4">
                                    <div>
                                      <p className="text-sm text-gray-600">Período de liberación:</p>
                                      <p className="text-sm font-medium">
                                        {schedule.slicePeriodSeconds ? 
                                          formatPeriod(schedule.slicePeriodSeconds) : 
                                          'No especificado'}
                                      </p>
                                    </div>
                                    {schedule.cliff && schedule.cliffEndTime && (
                                      <div>
                                        <p className="text-sm text-gray-600">Período de cliff:</p>
                                        <p className="text-sm font-medium">
                                          Hasta {new Date(schedule.cliffEndTime * 1000).toLocaleDateString()}
                                          ({formatPeriod(schedule.cliff)})
                                        </p>
                                      </div>
                                    )}
                                  </div>
                                </div>
                                
                                <div className="bg-white p-4 rounded shadow-sm">
                                  <h4 className="text-md font-medium text-gray-900 mb-2">Línea de Tiempo</h4>
                                  <div className="relative pt-1">
                                    <div className="flex mb-2 items-center justify-between">
                                      <div>
                                        <span className="text-xs font-semibold inline-block py-1 px-2 uppercase rounded-full text-blue-600 bg-blue-200">
                                          Inicio: {new Date(schedule.startTime * 1000).toLocaleDateString()}
                                        </span>
                                      </div>
                                      <div>
                                        <span className="text-xs font-semibold inline-block py-1 px-2 uppercase rounded-full text-green-600 bg-green-200">
                                          Fin: {new Date(schedule.endTime * 1000).toLocaleDateString()}
                                        </span>
                                      </div>
                                    </div>
                                    <div className="overflow-hidden h-2 mb-4 text-xs flex rounded bg-gray-200">
                                      {renderTimelineProgress(schedule)}
                                    </div>
                                  </div>
                                </div>
                                
                                <div className="bg-white p-4 rounded shadow-sm">
                                  <h4 className="text-md font-medium text-gray-900 mb-2">Calendario de Desbloqueos</h4>
                                  {generateUnlockSchedule(schedule).length > 0 ? (
                                    <div className="overflow-x-auto">
                                      <table className="min-w-full divide-y divide-gray-200 border">
                                        <thead className="bg-gray-100">
                                          <tr>
                                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha</th>
                                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cantidad</th>
                                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
                                          </tr>
                                        </thead>
                                        <tbody className="bg-white divide-y divide-gray-200">
                                          {generateUnlockSchedule(schedule).map((unlock, unlockIndex) => (
                                            <tr key={unlockIndex}>
                                              <td className="px-4 py-2 whitespace-nowrap">
                                                <div className="text-sm text-gray-900">
                                                  {new Date(unlock.date * 1000).toLocaleDateString()}
                                                </div>
                                              </td>
                                              <td className="px-4 py-2 whitespace-nowrap">
                                                <div className="text-sm text-gray-900">{unlock.amount} {schedule.tokenSymbol}</div>
                                              </td>
                                              <td className="px-4 py-2 whitespace-nowrap">
                                                <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${unlock.status === 'Liberado' ? 'bg-green-100 text-green-800' : unlock.status === 'Pendiente' ? 'bg-yellow-100 text-yellow-800' : 'bg-blue-100 text-blue-800'}`}>
                                                  {unlock.status}
                                                </span>
                                              </td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  ) : (
                                    <div className="text-sm text-gray-500">No se pudo generar el calendario de desbloqueos con la información disponible.</div>
                                  )}
                                </div>
                              </div>
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
                      <tfoot className="bg-gray-100 font-medium">
                        <tr>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            <strong>TOTALES DEL CONTRATO</strong>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {totalAmount.toFixed(6)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {totalVestedAmount.toFixed(6)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {totalClaimableAmount.toFixed(6)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {totalReleasedAmount.toFixed(6)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
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
            <div className="mt-8 p-4 bg-blue-50 rounded-lg shadow">
              <h3 className="text-lg font-semibold mb-4">Totales Globales (Todos los Contratos)</h3>
              <div className="grid grid-cols-5 gap-4">
                <div className="bg-white p-4 rounded shadow-sm">
                  <div className="text-sm text-gray-600">Total</div>
                  <div className="text-xl font-bold text-gray-900">{totals?.totalAmount}</div>
                </div>
                <div className="bg-white p-4 rounded shadow-sm">
                  <div className="text-sm text-gray-600">Liberado</div>
                  <div className="text-xl font-bold text-gray-900">{totals?.totalVestedAmount}</div>
                </div>
                <div className="bg-white p-4 rounded shadow-sm">
                  <div className="text-sm text-gray-600">Reclamable</div>
                  <div className="text-xl font-bold text-gray-900">{totals?.totalClaimableAmount}</div>
                </div>
                <div className="bg-white p-4 rounded shadow-sm">
                  <div className="text-sm text-gray-600">Reclamado</div>
                  <div className="text-xl font-bold text-gray-900">{totals?.totalReleasedAmount}</div>
                </div>
                <div className="bg-white p-4 rounded shadow-sm">
                  <div className="text-sm text-gray-600">Bloqueado</div>
                  <div className="text-xl font-bold text-gray-900">{totals?.totalRemainingAmount}</div>
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
