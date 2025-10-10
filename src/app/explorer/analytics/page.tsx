'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';

const VTN_TOKEN_ADDRESS = '0xA9bc478A44a8c8FE6fd505C1964dEB3cEe3b7abC';

interface TokenTransfer {
  hash: string;
  from: string;
  to: string;
  value: string;
  valueFormatted: string;
  timestamp: number;
  blockNumber: number;
  isLargeTransfer: boolean;
}

interface HolderInfo {
  address: string;
  balance: string;
  percentage: string;
  isExchange: boolean;
  isContract: boolean;
  label?: string;
}

interface Statistics {
  totalTransfers: number;
  totalVolume: string;
  uniqueAddresses: number;
  averageTransferSize: string;
  largeTransferCount: number;
  largeTransferThreshold: string;
}

interface AnalyticsData {
  transfers: TokenTransfer[];
  largeTransfers: TokenTransfer[];
  topHolders: HolderInfo[];
  statistics: Statistics;
  timeRange: {
    from: number;
    to: number;
  };
}

export default function TokenAnalytics() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState(7);
  const [threshold, setThreshold] = useState('10000');
  const [activeTab, setActiveTab] = useState<'overview' | 'whales' | 'holders' | 'activity'>('overview');
  const [whaleSortBy, setWhaleSortBy] = useState<'amount' | 'date'>('date');

  useEffect(() => {
    fetchAnalytics();
  }, [days, threshold]);

  const fetchAnalytics = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/token-analytics?days=${days}&threshold=${threshold}`);

      if (!response.ok) {
        throw new Error('Failed to fetch analytics data');
      }

      const analyticsData = await response.json();

      // Deduplicar transferencias grandes por hash
      if (analyticsData.largeTransfers) {
        const uniqueTransfers = new Map();
        analyticsData.largeTransfers.forEach((transfer: TokenTransfer) => {
          uniqueTransfers.set(transfer.hash, transfer);
        });
        analyticsData.largeTransfers = Array.from(uniqueTransfers.values());
        console.log('✅ Transferencias grandes únicas:', analyticsData.largeTransfers.length);
      }

      setData(analyticsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      console.error('Error fetching analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString();
  };

  const formatNumber = (num: string | number) => {
    const n = typeof num === 'string' ? parseFloat(num) : num;
    return new Intl.NumberFormat('en-US', {
      maximumFractionDigits: 2,
      minimumFractionDigits: 0,
    }).format(n);
  };

  // Componente para direcciones clicables
  const AddressLink = ({ address, label }: { address: string; label?: string }) => (
    <a
      href={`https://basescan.org/address/${address}`}
      target="_blank"
      rel="noopener noreferrer"
      className="text-blue-600 hover:text-blue-800 hover:underline font-mono text-sm transition-colors cursor-pointer"
      title={`Ver ${address} en BaseScan`}
    >
      {label || formatAddress(address)}
    </a>
  );

  // Ordenar transferencias grandes
  const sortedLargeTransfers = useMemo(() => {
    if (!data?.largeTransfers) return [];

    const sorted = [...data.largeTransfers].sort((a, b) => {
      if (whaleSortBy === 'date') {
        return b.timestamp - a.timestamp;
      }
      return parseFloat(b.valueFormatted) - parseFloat(a.valueFormatted);
    });

    return sorted;
  }, [data, whaleSortBy]);

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
            <p className="text-gray-600">Cargando análisis del token...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-red-800 mb-2">Error</h2>
          <p className="text-red-600">{error}</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Análisis de Token VTN</h1>
        <p className="text-gray-600">
          Token: <a
            href={`https://basescan.org/token/${VTN_TOKEN_ADDRESS}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline font-mono"
          >
            {VTN_TOKEN_ADDRESS}
          </a>
        </p>
      </div>

      {/* Controls */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Período de análisis
            </label>
            <select
              value={days}
              onChange={(e) => setDays(parseInt(e.target.value))}
              className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="1">Último día</option>
              <option value="7">Última semana</option>
              <option value="30">Último mes</option>
              <option value="90">Últimos 3 meses</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Umbral para transferencias grandes (VTN)
            </label>
            <input
              type="number"
              value={threshold}
              onChange={(e) => setThreshold(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              min="1000"
              step="1000"
            />
          </div>

          <button
            onClick={fetchAnalytics}
            className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            Actualizar
          </button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-sm font-medium text-gray-600 mb-2">Total Transferencias</h3>
          <p className="text-3xl font-bold text-blue-600">{formatNumber(data.statistics.totalTransfers)}</p>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-sm font-medium text-gray-600 mb-2">Volumen Total</h3>
          <p className="text-3xl font-bold text-green-600">{formatNumber(data.statistics.totalVolume)} VTN</p>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-sm font-medium text-gray-600 mb-2">Direcciones Únicas</h3>
          <p className="text-3xl font-bold text-purple-600">{formatNumber(data.statistics.uniqueAddresses)}</p>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-sm font-medium text-gray-600 mb-2">Transferencias Grandes</h3>
          <p className="text-3xl font-bold text-orange-600">{formatNumber(data.statistics.largeTransferCount)}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow-md mb-6">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6" aria-label="Tabs">
            <button
              onClick={() => setActiveTab('overview')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'overview'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Resumen
            </button>
            <button
              onClick={() => setActiveTab('whales')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'whales'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Movimientos Grandes ({data.largeTransfers.length})
            </button>
            <button
              onClick={() => setActiveTab('holders')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'holders'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Top Holders
            </button>
            <button
              onClick={() => setActiveTab('activity')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'activity'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Actividad Reciente
            </button>
          </nav>
        </div>

        <div className="p-6">
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold mb-4">Estadísticas del Período</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-sm text-gray-600">Transferencia Promedio</p>
                    <p className="text-xl font-semibold">{formatNumber(data.statistics.averageTransferSize)} VTN</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-sm text-gray-600">Umbral para Grandes Transferencias</p>
                    <p className="text-xl font-semibold">{formatNumber(data.statistics.largeTransferThreshold)} VTN</p>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-4">Distribución de Holders</h3>
                <div className="space-y-2">
                  {data.topHolders.slice(0, 5).map((holder, index) => (
                    <div key={holder.address} className="flex items-center justify-between bg-gray-50 rounded-lg p-3">
                      <div className="flex items-center space-x-3">
                        <span className="text-lg font-bold text-gray-400">#{index + 1}</span>
                        <div>
                          <div className="flex items-center space-x-2">
                            <AddressLink address={holder.address} label={holder.label} />
                            {holder.isExchange && (
                              <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">CEX</span>
                            )}
                            {holder.isContract && (
                              <span className="px-2 py-1 bg-purple-100 text-purple-800 text-xs rounded">Contrato</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">{formatNumber(holder.balance)} VTN</p>
                        <p className="text-sm text-gray-600">{holder.percentage}%</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Whales Tab */}
          {activeTab === 'whales' && (
            <div>
              <h3 className="text-lg font-semibold mb-4">
                Transferencias Grandes (≥ {formatNumber(threshold)} VTN)
              </h3>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors select-none"
                        onClick={() => setWhaleSortBy('date')}
                        title="Ordenar por fecha"
                      >
                        <div className="flex items-center space-x-1">
                          <span>Fecha</span>
                          <span className={whaleSortBy === 'date' ? 'text-blue-600' : 'text-gray-400'}>
                            {whaleSortBy === 'date' ? '▼' : '○'}
                          </span>
                        </div>
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Desde
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Hacia
                      </th>
                      <th
                        className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors select-none"
                        onClick={() => setWhaleSortBy('amount')}
                        title="Ordenar por cantidad"
                      >
                        <div className="flex items-center justify-end space-x-1">
                          <span>Cantidad</span>
                          <span className={whaleSortBy === 'amount' ? 'text-blue-600' : 'text-gray-400'}>
                            {whaleSortBy === 'amount' ? '▼' : '○'}
                          </span>
                        </div>
                      </th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Transacción
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {sortedLargeTransfers.map((transfer) => (
                      <tr key={transfer.hash} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {formatDate(transfer.timestamp)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <AddressLink address={transfer.from} />
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <AddressLink address={transfer.to} />
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <span className="font-semibold text-orange-600">
                            {formatNumber(transfer.valueFormatted)} VTN
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <a
                            href={`https://basescan.org/tx/${transfer.hash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-800 hover:underline text-sm transition-colors"
                          >
                            Ver
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Holders Tab */}
          {activeTab === 'holders' && (
            <div>
              <h3 className="text-lg font-semibold mb-4">Top 20 Holders</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Rank
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Dirección
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Balance
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        % del Supply
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {data.topHolders.map((holder, index) => (
                      <tr key={holder.address} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          #{index + 1}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center space-x-2">
                            <AddressLink address={holder.address} label={holder.label} />
                            {holder.isExchange && (
                              <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                                CEX
                              </span>
                            )}
                            {holder.isContract && (
                              <span className="px-2 py-1 bg-purple-100 text-purple-800 text-xs rounded">
                                Contrato
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-semibold text-gray-900">
                          {formatNumber(holder.balance)} VTN
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-600">
                          {holder.percentage}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Activity Tab */}
          {activeTab === 'activity' && (
            <div>
              <h3 className="text-lg font-semibold mb-4">Actividad Reciente (Últimas 50)</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Fecha
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Desde
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Hacia
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Cantidad
                      </th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Tx
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {data.transfers.slice(0, 50).map((transfer) => (
                      <tr key={transfer.hash} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {formatDate(transfer.timestamp)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <AddressLink address={transfer.from} />
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <AddressLink address={transfer.to} />
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <span className={`font-semibold ${transfer.isLargeTransfer ? 'text-orange-600' : 'text-gray-900'}`}>
                            {formatNumber(transfer.valueFormatted)} VTN
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <a
                            href={`https://basescan.org/tx/${transfer.hash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-800 hover:underline text-sm transition-colors"
                          >
                            Ver
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Info Footer */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-800">
          <strong>Nota:</strong> Este análisis se basa en datos de la blockchain y puede no reflejar el precio exacto del token en CEX.
          Los movimientos grandes y cambios en la distribución de holders pueden correlacionarse con cambios de precio,
          pero otros factores externos (noticias, mercado general, volumen CEX) también influyen significativamente.
        </p>
      </div>
    </div>
  );
}
