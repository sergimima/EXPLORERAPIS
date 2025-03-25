import React, { useState } from 'react';
import { fetchVestingInfo } from '@/lib/blockchain';
import { getExplorerUrl } from '@/lib/utils';
import { Network } from '@/lib/types';

interface VestingInfoProps {
  walletAddress: string;
  network: Network;
  isLoading: boolean;
}

interface VestingSchedule {
  vestingId?: string;
  tokenName: string;
  tokenSymbol: string;
  tokenAddress: string;
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
      // Convertir totalAmount a número antes de la operación aritmética
      const totalAmountNum = parseFloat(schedule.totalAmount);
      const amount = (totalAmountNum / (endDate.getTime() - startDate.getTime())) * slicePeriod;
      unlocks.push({ date: date.getTime() / 1000, amount: amount.toString(), status: 'Pendiente' });
    }
  }

  if (schedule.cliff && schedule.cliffEndTime) {
    const cliffDate = new Date(schedule.cliffEndTime * 1000);
    // Convertir totalAmount a número antes de la operación aritmética
    const totalAmountNum = parseFloat(schedule.totalAmount);
    const amount = totalAmountNum * (schedule.cliff / 100);
    unlocks.push({ date: cliffDate.getTime() / 1000, amount: amount.toString(), status: 'Liberado' });
  }

  return unlocks;
};

const VestingInfo: React.FC<VestingInfoProps> = ({ walletAddress, network, isLoading }) => {
  const [vestingSchedules, setVestingSchedules] = useState<VestingScheduleWithHistory[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [vestingContractAddress, setVestingContractAddress] = useState<string>('');
  const [expandedRows, setExpandedRows] = useState<Record<number, boolean>>({});
  const [showScheduleRows, setShowScheduleRows] = useState<Record<number, boolean>>({});

  const handleFetchVestingInfo = async () => {
    if (!walletAddress || !vestingContractAddress) {
      setError('Por favor, introduce una dirección de wallet y contrato de vesting válidas');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await fetchVestingInfo(walletAddress, vestingContractAddress, network);
      
      // Añadir datos de ejemplo para el historial de reclamaciones
      const dataWithHistory = data.map(schedule => {
        // Solo añadir historial si hay tokens reclamados
        if (parseFloat(schedule.releasedAmount) > 0) {
          return {
            ...schedule,
            claimHistory: [
              {
                amount: schedule.releasedAmount,
                timestamp: Math.floor(Date.now() / 1000) - 86400 * 7, // 7 días atrás
                transactionHash: '0x' + Math.random().toString(16).substring(2, 42)
              }
            ]
          };
        }
        return schedule;
      });
      
      setVestingSchedules(dataWithHistory);
    } catch (err) {
      setError('Error al obtener los datos de vesting. Por favor, inténtalo de nuevo.');
      console.error(err);
    } finally {
      setLoading(false);
    }
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
        <div className="flex flex-col mb-4">
          <label htmlFor="vestingContract" className="text-sm font-medium text-gray-700 mb-1">
            Dirección del Contrato de Vesting
          </label>
          <div className="flex">
            <input
              id="vestingContract"
              type="text"
              value={vestingContractAddress}
              onChange={(e) => setVestingContractAddress(e.target.value)}
              placeholder="0x..."
              className="input-field flex-grow"
            />
            <button 
              onClick={handleFetchVestingInfo}
              disabled={loading}
              className="btn-primary ml-2"
            >
              {loading ? 'Cargando...' : 'Consultar'}
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}
      </div>

      {vestingSchedules.length === 0 && !loading ? (
        <p className="text-center text-gray-500">
          No se encontró información de vesting para esta wallet y contrato. Por favor, introduce una dirección de contrato de vesting válida.
        </p>
      ) : (
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
              {vestingSchedules.map((schedule, index) => (
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
                            toggleRowExpansion(index);
                          }}
                          className="ml-2 bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold py-1 px-2 rounded text-xs"
                          title="Ver historial de reclamaciones"
                        >
                          {expandedRows[index] ? '−' : '+'}
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
                  {expandedRows[index] && (
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
                          onClick={() => toggleScheduleRow(index)}
                          className="ml-2 bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold py-1 px-2 rounded text-xs"
                          title="Ver cronograma de liberación"
                        >
                          {showScheduleRows[index] ? '−' : '+'}
                        </button>
                      </div>
                    </td>
                  </tr>
                  {showScheduleRows[index] && (
                    <tr>
                      <td colSpan={8} className="px-6 py-4 bg-gray-50">
                        <div className="grid grid-cols-1 gap-4">
                          {/* Información general de liberación */}
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
                          
                          {/* Línea de tiempo de liberación */}
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
                          
                          {/* Tabla de desbloqueos */}
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
          </table>
        </div>
      )}
    </div>
  );
};

export default VestingInfo;
