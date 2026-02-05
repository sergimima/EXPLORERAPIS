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
      <div className="bg-accent border border-border rounded-lg p-8 text-center">
        <div className="text-5xl mb-4">📊</div>
        <h3 className="text-lg font-semibold text-card-foreground mb-2">
          Vista General del Token
        </h3>
        <p className="text-muted-foreground mb-4">
          Selecciona un token para ver sus métricas principales
        </p>
        <a
          href="/settings/tokens"
          className="inline-block px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 font-medium"
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
          <div key={i} className="bg-card p-6 rounded-lg shadow-md animate-pulse border border-border">
            <div className="h-4 bg-muted rounded w-1/2 mb-4"></div>
            <div className="h-8 bg-muted rounded w-3/4"></div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-primary rounded-lg p-6 text-primary-foreground">
        <h2 className="text-2xl font-bold mb-2">{activeToken.symbol}</h2>
        <p className="text-white/90">{activeToken.name}</p>
        <p className="text-xs text-white/70 font-mono mt-2">{activeToken.address}</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Supply Card */}
        <div className="bg-card p-6 rounded-lg shadow-md border border-border border-l-4 border-l-primary">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-muted-foreground">Token Supply</h3>
            <span className="text-2xl">💰</span>
          </div>
          <div className="space-y-2">
            <div>
              <p className="text-xs text-muted-foreground">Total</p>
              <p className="text-xl font-bold text-card-foreground">
                {(Number(data?.supply.total) / 1e18).toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 pt-2 border-t">
              <div>
                <p className="text-xs text-muted-foreground">Circulante</p>
                <p className="text-sm font-semibold text-success">
                  {(Number(data?.supply.circulating) / 1e18).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Bloqueado</p>
                <p className="text-sm font-semibold text-warning">
                  {(Number(data?.supply.locked) / 1e18).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Holders Card */}
        <div className="bg-card p-6 rounded-lg shadow-md border border-border border-l-4 border-l-success">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-muted-foreground">Holders</h3>
            <span className="text-2xl">👥</span>
          </div>
          <div>
            <p className="text-3xl font-bold text-card-foreground mb-2">
              {data?.holders.total.toLocaleString()}
            </p>
            <div className="text-sm text-muted-foreground">
              Top 10: <span className="font-semibold text-warning">{data?.holders.top10Percentage.toFixed(1)}%</span>
            </div>
          </div>
        </div>

        {/* Volume 24h Card */}
        <div className="bg-card p-6 rounded-lg shadow-md border border-border border-l-4 border-l-primary">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-muted-foreground">Volumen 24h</h3>
            <span className="text-2xl">📈</span>
          </div>
          <p className="text-3xl font-bold text-card-foreground">
            {(Number(data?.volume24h) / 1e18).toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </p>
          <p className="text-xs text-muted-foreground mt-1">{activeToken.symbol}</p>
        </div>
      </div>

      {/* Large Transfers */}
      <div className="bg-card p-6 rounded-lg shadow-md border border-border">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <span>🐋</span>
          Transferencias Grandes Recientes
        </h3>
        {data?.largeTransfers && data.largeTransfers.length > 0 ? (
          <div className="space-y-3">
            {data.largeTransfers.map((transfer, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 bg-muted rounded-lg hover:bg-muted/80 transition-colors">
                <div className="flex-1">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-mono text-xs text-muted-foreground">
                      {transfer.from.slice(0, 6)}...{transfer.from.slice(-4)}
                    </span>
                    <span className="text-muted-foreground">→</span>
                    <span className="font-mono text-xs text-muted-foreground">
                      {transfer.to.slice(0, 6)}...{transfer.to.slice(-4)}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {new Date(transfer.timestamp * 1000).toLocaleString()}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-card-foreground">
                    {(Number(transfer.value) / 1e18).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </p>
                  <p className="text-xs text-muted-foreground">{activeToken.symbol}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-center text-muted-foreground py-8">No hay transferencias grandes recientes</p>
        )}
      </div>

      {/* Vesting Status */}
      <div className="bg-card p-6 rounded-lg shadow-md border border-border">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <span>🔒</span>
          Estado de Vesting
        </h3>
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center p-4 bg-warning/10 rounded-lg">
            <p className="text-sm text-muted-foreground mb-1">Total Bloqueado</p>
            <p className="text-xl font-bold text-warning">
              {(Number(data?.vestingStats.totalLocked) / 1e18).toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </p>
          </div>
          <div className="text-center p-4 bg-success/10 rounded-lg">
            <p className="text-sm text-muted-foreground mb-1">Total Liberado</p>
            <p className="text-xl font-bold text-success">
              {(Number(data?.vestingStats.totalReleased) / 1e18).toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </p>
          </div>
          <div className="text-center p-4 bg-accent rounded-lg">
            <p className="text-sm text-muted-foreground mb-1">Contratos Activos</p>
            <p className="text-xl font-bold text-primary">
              {data?.vestingStats.activeContracts}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
