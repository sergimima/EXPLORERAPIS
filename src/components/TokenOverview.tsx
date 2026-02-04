'use client';

import { useState, useEffect } from 'react';
import { Network } from '@/lib/types';
import { useToken } from '@/contexts/TokenContext';

interface TokenOverviewProps {
  network: Network;
}

interface OverviewData {
  supply: {
    total: string;
    circulating: string;
    locked: string;
  };
  holders: {
    total: number;
    top10Percentage: number;
  };
  volume24h: string;
  largeTransfers: Array<{
    hash: string;
    from: string;
    to: string;
    value: string;
    timestamp: number;
  }>;
  vestingStats: {
    totalLocked: string;
    totalReleased: string;
    activeContracts: number;
  };
}

export default function TokenOverview({ network }: TokenOverviewProps) {
  const { activeToken } = useToken();
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!activeToken) return;

    const fetchOverviewData = async () => {
      setLoading(true);
      try {
        // Fetch supply data
        const supplyRes = await fetch(`/api/token-supply?tokenAddress=${activeToken.address}&network=${network}`);
        const supplyData = await supplyRes.json();

        // Fetch analytics for holders and volume
        const analyticsRes = await fetch(`/api/token-analytics?tokenAddress=${activeToken.address}&network=${network}&period=1`);
        const analyticsData = await analyticsRes.json();

        setData({
          supply: {
            total: supplyData.totalSupply || '0',
            circulating: supplyData.circulatingSupply || '0',
            locked: supplyData.lockedSupply || '0',
          },
          holders: {
            total: analyticsData.analytics?.uniqueAddresses || 0,
            top10Percentage: analyticsData.analytics?.holderConcentration?.top10Percentage || 0,
          },
          volume24h: analyticsData.analytics?.totalVolume || '0',
          largeTransfers: (analyticsData.analytics?.largeTransfers || []).slice(0, 5),
          vestingStats: {
            totalLocked: supplyData.lockedSupply || '0',
            totalReleased: '0', // TODO: Calculate from vesting data
            activeContracts: 0, // TODO: Get from database
          },
        });
      } catch (error) {
        console.error('Error fetching overview data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchOverviewData();
  }, [activeToken, network]);

  if (!activeToken) {
    return (
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-8 text-center">
        <div className="text-5xl mb-4">📊</div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          Vista General del Token
        </h3>
        <p className="text-gray-600 mb-4">
          Selecciona un token para ver sus métricas principales
        </p>
        <a
          href="/settings/tokens"
          className="inline-block px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
        >
          Configurar Token
        </a>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="bg-white p-6 rounded-lg shadow-md animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-1/2 mb-4"></div>
            <div className="h-8 bg-gray-200 rounded w-3/4"></div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg p-6 text-white">
        <h2 className="text-2xl font-bold mb-2">{activeToken.symbol}</h2>
        <p className="text-blue-100">{activeToken.name}</p>
        <p className="text-xs text-blue-200 font-mono mt-2">{activeToken.address}</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Supply Card */}
        <div className="bg-white p-6 rounded-lg shadow-md border-l-4 border-blue-500">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-gray-600">Token Supply</h3>
            <span className="text-2xl">💰</span>
          </div>
          <div className="space-y-2">
            <div>
              <p className="text-xs text-gray-500">Total</p>
              <p className="text-xl font-bold text-gray-900">
                {(Number(data?.supply.total) / 1e18).toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 pt-2 border-t">
              <div>
                <p className="text-xs text-gray-500">Circulante</p>
                <p className="text-sm font-semibold text-green-600">
                  {(Number(data?.supply.circulating) / 1e18).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Bloqueado</p>
                <p className="text-sm font-semibold text-orange-600">
                  {(Number(data?.supply.locked) / 1e18).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Holders Card */}
        <div className="bg-white p-6 rounded-lg shadow-md border-l-4 border-green-500">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-gray-600">Holders</h3>
            <span className="text-2xl">👥</span>
          </div>
          <div>
            <p className="text-3xl font-bold text-gray-900 mb-2">
              {data?.holders.total.toLocaleString()}
            </p>
            <div className="text-sm text-gray-600">
              Top 10: <span className="font-semibold text-orange-600">{data?.holders.top10Percentage.toFixed(1)}%</span>
            </div>
          </div>
        </div>

        {/* Volume 24h Card */}
        <div className="bg-white p-6 rounded-lg shadow-md border-l-4 border-purple-500">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-gray-600">Volumen 24h</h3>
            <span className="text-2xl">📈</span>
          </div>
          <p className="text-3xl font-bold text-gray-900">
            {(Number(data?.volume24h) / 1e18).toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </p>
          <p className="text-xs text-gray-500 mt-1">{activeToken.symbol}</p>
        </div>
      </div>

      {/* Large Transfers */}
      <div className="bg-white p-6 rounded-lg shadow-md">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <span>🐋</span>
          Transferencias Grandes Recientes
        </h3>
        {data?.largeTransfers && data.largeTransfers.length > 0 ? (
          <div className="space-y-3">
            {data.largeTransfers.map((transfer, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                <div className="flex-1">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-mono text-xs text-gray-600">
                      {transfer.from.slice(0, 6)}...{transfer.from.slice(-4)}
                    </span>
                    <span className="text-gray-400">→</span>
                    <span className="font-mono text-xs text-gray-600">
                      {transfer.to.slice(0, 6)}...{transfer.to.slice(-4)}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {new Date(transfer.timestamp * 1000).toLocaleString()}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-gray-900">
                    {(Number(transfer.value) / 1e18).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </p>
                  <p className="text-xs text-gray-500">{activeToken.symbol}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-center text-gray-500 py-8">No hay transferencias grandes recientes</p>
        )}
      </div>

      {/* Vesting Status */}
      <div className="bg-white p-6 rounded-lg shadow-md">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <span>🔒</span>
          Estado de Vesting
        </h3>
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center p-4 bg-orange-50 rounded-lg">
            <p className="text-sm text-gray-600 mb-1">Total Bloqueado</p>
            <p className="text-xl font-bold text-orange-600">
              {(Number(data?.vestingStats.totalLocked) / 1e18).toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </p>
          </div>
          <div className="text-center p-4 bg-green-50 rounded-lg">
            <p className="text-sm text-gray-600 mb-1">Total Liberado</p>
            <p className="text-xl font-bold text-green-600">
              {(Number(data?.vestingStats.totalReleased) / 1e18).toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </p>
          </div>
          <div className="text-center p-4 bg-blue-50 rounded-lg">
            <p className="text-sm text-gray-600 mb-1">Contratos Activos</p>
            <p className="text-xl font-bold text-blue-600">
              {data?.vestingStats.activeContracts}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
