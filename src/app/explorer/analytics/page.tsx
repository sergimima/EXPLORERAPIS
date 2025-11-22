'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import EditAddressModal from '@/components/EditAddressModal';
import AdvancedFilters, { AdvancedFiltersState, defaultFilters } from '@/components/AdvancedFilters';

// Import charts with dynamic loading to avoid SSR issues
const HolderDistributionChart = dynamic(() => import('@/components/charts/HolderDistributionChart'), { ssr: false });
const WhaleTimelineChart = dynamic(() => import('@/components/charts/WhaleTimelineChart'), { ssr: false });
const ExchangeFlowChart = dynamic(() => import('@/components/charts/ExchangeFlowChart'), { ssr: false });

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

interface PriceData {
  price: number;
  priceChange24h?: number;
  priceChange7d?: number;
}

interface PoolData {
  liquidity: number;
  volume24h: number;
  priceChange24h?: number;
  pairAddress: string;
  dexName: string;
}

interface LiquidityData {
  total: number;
  pools: PoolData[];
  fdv?: number;
}

interface Alert {
  type: 'whale_move' | 'accumulation' | 'distribution' | 'liquidity_change' | 'exchange_flow';
  severity: 'low' | 'medium' | 'high';
  message: string;
  timestamp: number;
  data?: any;
}

interface Statistics {
  totalTransfers: number;
  totalVolume: string;
  uniqueAddresses: number;
  averageTransferSize: string;
  largeTransferCount: number;
  largeTransferThreshold: string;
  netFlowToExchanges: string;
  topHoldersConcentration: string;
}

interface AnalyticsData {
  transfers: TokenTransfer[];
  largeTransfers: TokenTransfer[];
  topHolders: HolderInfo[];
  priceData: PriceData;
  liquidityData: LiquidityData | null;
  alerts: Alert[];
  statistics: Statistics;
  timeRange: {
    from: number;
    to: number;
  };
}

interface TokenAnalyticsProps {
  onNavigateToWallet?: (address: string) => void;
}

export default function TokenAnalytics({ onNavigateToWallet }: TokenAnalyticsProps = {}) {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState(7);
  const [threshold, setThreshold] = useState('10000');
  const [activeTab, setActiveTab] = useState<'overview' | 'charts' | 'whales' | 'holders' | 'activity' | 'known'>('overview');
  const [whaleSortBy, setWhaleSortBy] = useState<'amount' | 'date'>('date');

  // Estados para el modal de edición
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingAddress, setEditingAddress] = useState<string>('');
  const [editingName, setEditingName] = useState<string>('');
  const [editingData, setEditingData] = useState<any>(null);
  const [addressNames, setAddressNames] = useState<Map<string, string>>(new Map());

  // Estado para direcciones conocidas completas
  const [knownAddresses, setKnownAddresses] = useState<any[]>([]);

  // Estados para el caché y actualización
  const [lastUpdate, setLastUpdate] = useState<number>(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Estados para filtros avanzados
  const [advancedFilters, setAdvancedFilters] = useState<AdvancedFiltersState>(defaultFilters);
  const [appliedFilters, setAppliedFilters] = useState<AdvancedFiltersState>(defaultFilters);

  useEffect(() => {
    fetchAnalytics();
  }, [days, threshold]);

  // Cargar nombres guardados cuando cambian los datos (optimizado - solo BD)
  useEffect(() => {
    if (!data) return;

    // Estrategia optimizada: obtener TODAS las addresses conocidas de la BD de una vez
    // En lugar de consultar cada address individualmente
    (async () => {
      try {
        const response = await fetch('/api/addresses');
        if (response.ok) {
          const { knownAddresses: addresses } = await response.json();

          if (addresses && Array.isArray(addresses)) {
            const newNames = new Map<string, string>();
            addresses.forEach((ka: any) => {
              newNames.set(ka.address.toLowerCase(), ka.name);
            });
            setAddressNames(newNames);
            setKnownAddresses(addresses); // Guardar también las addresses completas
            console.log(`✅ Loaded ${newNames.size} known address names from DB`);
          }
        }
      } catch (error) {
        console.error('Error loading known addresses:', error);
      }
    })();
  }, [data]);

  const fetchAnalytics = async (forceRefresh: boolean = false) => {
    // Solo mostrar loading completo en la primera carga
    if (!data) {
      setLoading(true);
    } else {
      setIsRefreshing(true);
    }
    setError(null);

    try {
      const response = await fetch(`/api/token-analytics?days=${days}&threshold=${threshold}&forceRefresh=${forceRefresh}`);

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
      setLastUpdate(Date.now());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      console.error('Error fetching analytics:', err);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  const handleRefresh = () => {
    fetchAnalytics(true);
  };

  const formatTimeAgo = (timestamp: number): string => {
    if (timestamp === 0) return 'Nunca';

    const seconds = Math.floor((Date.now() - timestamp) / 1000);

    if (seconds < 60) return `hace ${seconds}s`;
    if (seconds < 3600) return `hace ${Math.floor(seconds / 60)}m`;
    if (seconds < 86400) return `hace ${Math.floor(seconds / 3600)}h`;
    return `hace ${Math.floor(seconds / 86400)}d`;
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

  // Función para abrir el modal de edición
  const handleEditAddress = (address: string, currentLabel?: string) => {
    setEditingAddress(address);
    setEditingName(addressNames.get(address.toLowerCase()) || currentLabel || '');
    setEditModalOpen(true);
  };

  // Función para guardar el nombre y actualizar la lista
  const handleSaveName = async (address: string, name: string) => {
    setAddressNames(prev => new Map(prev).set(address.toLowerCase(), name));

    // Recargar la lista de direcciones conocidas
    try {
      const response = await fetch('/api/addresses');
      if (response.ok) {
        const { knownAddresses: addresses } = await response.json();
        if (addresses && Array.isArray(addresses)) {
          setKnownAddresses(addresses);
          const newNames = new Map<string, string>();
          addresses.forEach((ka: any) => {
            newNames.set(ka.address.toLowerCase(), ka.name);
          });
          setAddressNames(newNames);
        }
      }
    } catch (error) {
      console.error('Error reloading known addresses:', error);
    }
  };

  // Handlers para direcciones conocidas
  const handleEditKnownAddress = (ka: any) => {
    setEditingAddress(ka.address);
    setEditingName(ka.name);
    setEditingData(ka);
    setEditModalOpen(true);
  };

  const handleDeleteKnownAddress = async (address: string) => {
    if (!confirm(`¿Eliminar la dirección ${address.slice(0, 6)}...${address.slice(-4)}?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/addresses?address=${address}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        // Actualizar lista local
        setKnownAddresses(prev => prev.filter(ka => ka.address.toLowerCase() !== address.toLowerCase()));
        setAddressNames(prev => {
          const newMap = new Map(prev);
          newMap.delete(address.toLowerCase());
          return newMap;
        });
      } else {
        alert('Error al eliminar la dirección');
      }
    } catch (error) {
      console.error('Error deleting address:', error);
      alert('Error al eliminar la dirección');
    }
  };

  const handleAddNewAddress = () => {
    setEditingAddress('');
    setEditingName('');
    setEditingData(null);
    setEditModalOpen(true);
  };

  // Handlers para filtros avanzados
  const handleApplyFilters = () => {
    setAppliedFilters(advancedFilters);
  };

  const handleResetFilters = () => {
    setAdvancedFilters(defaultFilters);
    setAppliedFilters(defaultFilters);
  };

  // Función para determinar el tipo de address
  const getAddressType = (address: string, transfer?: TokenTransfer): 'exchange' | 'contract' | 'wallet' => {
    const addr = address.toLowerCase();

    // Known exchanges
    const knownExchanges = [
      '0x3cd751e6b0078be393132286c442345e5dc49699', // Coinbase
      '0x71660c4005ba85c37ccec55d0c4493e66fe775d3', // Coinbase 2
      '0x503828976d22510aad0201ac7ec88293211d23da', // Coinbase 3
      '0x0d0707963952f2fba59dd06f2b425ace40b492fe', // Gate.io
    ];

    if (knownExchanges.includes(addr)) return 'exchange';

    // Check if it's a known contract from holders data
    if (data?.topHolders) {
      const holder = data.topHolders.find(h => h.address.toLowerCase() === addr);
      if (holder?.isContract) return 'contract';
      if (holder?.isExchange) return 'exchange';
    }

    return 'wallet';
  };

  // Función para filtrar transferencias
  const filterTransfers = (transfers: TokenTransfer[]): TokenTransfer[] => {
    return transfers.filter(transfer => {
      const fromType = getAddressType(transfer.from, transfer);
      const toType = getAddressType(transfer.to, transfer);

      // Filtro por tipo de address
      if (!appliedFilters.addressTypes.exchanges && (fromType === 'exchange' || toType === 'exchange')) return false;
      if (!appliedFilters.addressTypes.contracts && (fromType === 'contract' || toType === 'contract')) return false;
      if (!appliedFilters.addressTypes.wallets && (fromType === 'wallet' || toType === 'wallet')) return false;

      // Filtro por rango de montos
      const amount = parseFloat(transfer.valueFormatted);
      if (appliedFilters.amountRange.min && amount < parseFloat(appliedFilters.amountRange.min)) return false;
      if (appliedFilters.amountRange.max && amount > parseFloat(appliedFilters.amountRange.max)) return false;

      // Filtro por rango de fechas
      const transferDate = new Date(transfer.timestamp * 1000);
      if (appliedFilters.dateRange.from) {
        const fromDate = new Date(appliedFilters.dateRange.from);
        if (transferDate < fromDate) return false;
      }
      if (appliedFilters.dateRange.to) {
        const toDate = new Date(appliedFilters.dateRange.to);
        toDate.setHours(23, 59, 59, 999); // Include full day
        if (transferDate > toDate) return false;
      }

      // Filtro solo etiquetadas
      if (appliedFilters.onlyLabeled) {
        const hasLabel = addressNames.has(transfer.from.toLowerCase()) || addressNames.has(transfer.to.toLowerCase());
        if (!hasLabel) return false;
      }

      // Filtro de addresses excluidas
      if (appliedFilters.excludedAddresses.length > 0) {
        if (appliedFilters.excludedAddresses.includes(transfer.from.toLowerCase()) ||
            appliedFilters.excludedAddresses.includes(transfer.to.toLowerCase())) {
          return false;
        }
      }

      return true;
    });
  };

  // Aplicar filtros a los datos
  const filteredData = useMemo(() => {
    if (!data) return null;

    return {
      ...data,
      transfers: filterTransfers(data.transfers),
      largeTransfers: filterTransfers(data.largeTransfers),
    };
  }, [data, appliedFilters, addressNames]);

  // Componente para direcciones clicables
  const AddressLink = ({ address, label }: { address: string; label?: string }) => {
    // Siempre mostrar la dirección formateada, no el nombre
    const displayAddress = formatAddress(address);

    return (
      <div className="flex items-center gap-2">
        <a
          href={`https://basescan.org/address/${address}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:text-blue-800 hover:underline font-mono text-sm transition-colors cursor-pointer"
          title={`Ver ${address} en BaseScan`}
        >
          {displayAddress}
        </a>
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleEditAddress(address, label);
          }}
          className="text-gray-500 hover:text-blue-600 hover:bg-blue-50 p-1 rounded transition-colors"
          title="Editar nombre"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
          </svg>
        </button>
        {onNavigateToWallet ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onNavigateToWallet(address);
            }}
            className="text-green-600 hover:text-green-800 hover:bg-green-50 p-1 rounded transition-colors inline-flex"
            title="Ver tokens de esta wallet"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </button>
        ) : (
          <Link
            href={`/explorer/tokens?wallet=${address}`}
            className="text-green-600 hover:text-green-800 hover:bg-green-50 p-1 rounded transition-colors inline-flex"
            title="Ver tokens de esta wallet"
            onClick={(e) => e.stopPropagation()}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </Link>
        )}
      </div>
    );
  };

  // Ordenar transferencias grandes
  const sortedLargeTransfers = useMemo(() => {
    if (!filteredData?.largeTransfers) return [];

    const sorted = [...filteredData.largeTransfers].sort((a, b) => {
      if (whaleSortBy === 'date') {
        return b.timestamp - a.timestamp;
      }
      return parseFloat(b.valueFormatted) - parseFloat(a.valueFormatted);
    });

    return sorted;
  }, [filteredData, whaleSortBy]);

  if (loading && !data) {
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

      {/* Cache Info & Refresh Button */}
      <div className="bg-white rounded-lg shadow-md p-4 mb-6">
        <div className="flex justify-between items-center">
          <div className="text-sm text-gray-600">
            <span className="font-medium">Última actualización:</span> {formatTimeAgo(lastUpdate)}
          </div>
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
              isRefreshing
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            <svg
              className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`}
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            {isRefreshing ? 'Actualizando...' : 'Actualizar'}
          </button>
        </div>
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
              disabled={isRefreshing}
              className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
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
              disabled={isRefreshing}
              className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
              min="1000"
              step="1000"
            />
          </div>

          <button
            onClick={() => fetchAnalytics()}
            disabled={isRefreshing}
            className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isRefreshing && (
              <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            )}
            {isRefreshing ? 'Cargando...' : 'Actualizar'}
          </button>
        </div>
      </div>

      {/* Advanced Filters */}
      <AdvancedFilters
        filters={advancedFilters}
        onChange={setAdvancedFilters}
        onApply={handleApplyFilters}
        onReset={handleResetFilters}
      />

      {/* Price & Liquidity Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg shadow-md p-6 text-white">
          <h3 className="text-sm font-medium text-blue-100 mb-2">Precio VTN</h3>
          <p className="text-3xl font-bold">${data.priceData.price.toFixed(6)}</p>
          {data.liquidityData?.priceChange24h !== undefined && (
            <p className={`text-sm mt-2 ${data.liquidityData.priceChange24h >= 0 ? 'text-green-200' : 'text-red-200'}`}>
              {data.liquidityData.priceChange24h >= 0 ? '↗' : '↘'} {Math.abs(data.liquidityData.priceChange24h).toFixed(2)}% (24h)
            </p>
          )}
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-sm font-medium text-gray-600 mb-2">Liquidez Total</h3>
          {data.liquidityData ? (
            <>
              <p className="text-3xl font-bold text-green-600">${formatNumber(data.liquidityData.total)}</p>
              <div className="mt-3 space-y-1">
                {data.liquidityData.pools.map((pool) => (
                  <div key={pool.pairAddress} className="text-xs text-gray-600">
                    {pool.dexName}: ${formatNumber(pool.liquidity)}
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="text-lg text-gray-400">No disponible</p>
          )}
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-sm font-medium text-gray-600 mb-2">Net Flow a CEX</h3>
          <p className={`text-3xl font-bold ${parseFloat(data.statistics.netFlowToExchanges) > 0 ? 'text-red-600' : 'text-green-600'}`}>
            {parseFloat(data.statistics.netFlowToExchanges) > 0 ? '↗' : '↙'} {formatNumber(Math.abs(parseFloat(data.statistics.netFlowToExchanges)))} VTN
          </p>
          <p className="text-xs text-gray-500 mt-1">
            {parseFloat(data.statistics.netFlowToExchanges) > 0 ? 'Presión de venta' : 'Menos presión'}
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-sm font-medium text-gray-600 mb-2">Top 10 Concentración</h3>
          <p className="text-3xl font-bold text-purple-600">{data.statistics.topHoldersConcentration}%</p>
          <p className="text-xs text-gray-500 mt-1">del total supply</p>
        </div>
      </div>

      {/* Alerts Section */}
      {data.alerts && data.alerts.length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center">
            <span className="mr-2">🚨</span> Alertas Recientes
          </h3>
          <div className="space-y-3">
            {data.alerts.map((alert, index) => (
              <div
                key={index}
                className={`p-4 rounded-lg border-l-4 ${
                  alert.severity === 'high' ? 'bg-red-50 border-red-500' :
                  alert.severity === 'medium' ? 'bg-yellow-50 border-yellow-500' :
                  'bg-blue-50 border-blue-500'
                }`}
              >
                <div className="flex items-start justify-between">
                  <p className={`font-medium ${
                    alert.severity === 'high' ? 'text-red-800' :
                    alert.severity === 'medium' ? 'text-yellow-800' :
                    'text-blue-800'
                  }`}>
                    {alert.message}
                  </p>
                  <span className={`text-xs px-2 py-1 rounded ${
                    alert.severity === 'high' ? 'bg-red-200 text-red-800' :
                    alert.severity === 'medium' ? 'bg-yellow-200 text-yellow-800' :
                    'bg-blue-200 text-blue-800'
                  }`}>
                    {alert.severity === 'high' ? 'ALTA' : alert.severity === 'medium' ? 'MEDIA' : 'BAJA'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

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
              onClick={() => setActiveTab('charts')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'charts'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              📊 Gráficos
            </button>
            <button
              onClick={() => setActiveTab('whales')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'whales'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Movimientos Grandes ({filteredData?.largeTransfers.length || 0})
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
            <button
              onClick={() => setActiveTab('known')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'known'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              📋 Direcciones Conocidas
            </button>
          </nav>
        </div>

        <div className="p-6">
          {/* Charts Tab */}
          {activeTab === 'charts' && filteredData && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <HolderDistributionChart holders={data.topHolders} />
                <WhaleTimelineChart transfers={filteredData.transfers} threshold={parseInt(threshold)} />
              </div>
              <div>
                <ExchangeFlowChart transfers={filteredData.transfers} days={days} />
              </div>
            </div>
          )}

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
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rank</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Dirección</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nombre</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tipo</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Balance</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">%</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {data.topHolders.slice(0, 5).map((holder, index) => {
                        const savedName = addressNames.get(holder.address.toLowerCase());
                        return (
                          <tr key={holder.address} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                              #{index + 1}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <AddressLink address={holder.address} label={holder.label} />
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {savedName || '-'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex gap-1">
                                {holder.isExchange && (
                                  <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">CEX</span>
                                )}
                                {holder.isContract && (
                                  <span className="px-2 py-1 bg-purple-100 text-purple-800 text-xs rounded">Contrato</span>
                                )}
                                {!holder.isExchange && !holder.isContract && (
                                  <span className="px-2 py-1 bg-gray-100 text-gray-800 text-xs rounded">Wallet</span>
                                )}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-semibold">
                              {formatNumber(holder.balance)} VTN
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-600">
                              {holder.percentage}%
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
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
                        Nombre (From)
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Hacia
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Nombre (To)
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
                    {sortedLargeTransfers.map((transfer) => {
                      const fromName = addressNames.get(transfer.from.toLowerCase());
                      const toName = addressNames.get(transfer.to.toLowerCase());
                      return (
                        <tr key={transfer.hash} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                            {formatDate(transfer.timestamp)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <AddressLink address={transfer.from} />
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                            {fromName || '-'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <AddressLink address={transfer.to} />
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                            {toName || '-'}
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
                      );
                    })}
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
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Tipo
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Nombre
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
                    {data.topHolders.map((holder, index) => {
                      const savedName = addressNames.get(holder.address.toLowerCase());
                      return (
                        <tr key={holder.address} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            #{index + 1}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <AddressLink address={holder.address} label={undefined} />
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex gap-1">
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
                              {!holder.isExchange && !holder.isContract && (
                                <span className="px-2 py-1 bg-gray-100 text-gray-800 text-xs rounded">
                                  Wallet
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {savedName || holder.label || '-'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-semibold text-gray-900">
                            {formatNumber(holder.balance)} VTN
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-600">
                            {holder.percentage}%
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Activity Tab */}
          {activeTab === 'activity' && filteredData && (
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
                    {filteredData.transfers.slice(0, 50).map((transfer) => (
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

          {/* Known Addresses Tab */}
          {activeTab === 'known' && (
            <div>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">Direcciones Conocidas ({knownAddresses.length})</h3>
                <button
                  onClick={handleAddNewAddress}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 font-medium"
                >
                  ➕ Añadir Nueva Dirección
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Dirección</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nombre</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tipo</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Categoría</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tags</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {knownAddresses.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-6 py-4 text-center text-gray-500">
                          No hay direcciones conocidas guardadas
                        </td>
                      </tr>
                    ) : (
                      knownAddresses.map((ka) => (
                        <tr key={ka.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-mono">
                            <a
                              href={`https://basescan.org/address/${ka.address}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:text-blue-800"
                            >
                              {ka.address.slice(0, 6)}...{ka.address.slice(-4)}
                            </a>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {ka.name}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            <span className={`px-2 py-1 rounded text-xs ${
                              ka.type === 'CONTRACT' ? 'bg-purple-100 text-purple-800' :
                              ka.type === 'WALLET' ? 'bg-blue-100 text-blue-800' :
                              ka.type === 'EXCHANGE' ? 'bg-red-100 text-red-800' :
                              ka.type === 'VESTING' ? 'bg-green-100 text-green-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {ka.type}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {ka.category || '-'}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-500">
                            {ka.tags && ka.tags.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {ka.tags.map((tag: string, i: number) => (
                                  <span key={i} className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs">
                                    {tag}
                                  </span>
                                ))}
                              </div>
                            ) : '-'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleEditKnownAddress(ka)}
                                className="text-blue-600 hover:text-blue-800 font-medium"
                              >
                                ✏️ Editar
                              </button>
                              <button
                                onClick={() => handleDeleteKnownAddress(ka.address)}
                                className="text-red-600 hover:text-red-800 font-medium"
                              >
                                🗑️ Eliminar
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
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

      {/* Modal para editar nombre de address */}
      <EditAddressModal
        address={editingAddress}
        currentName={editingName}
        currentData={editingData}
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        onSave={handleSaveName}
      />
    </div>
  );
}
