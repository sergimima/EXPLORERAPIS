/**
 * Admin Tokens Page
 * Global view of all tokens in the system
 * Sprint 4.9: Panel de tokens para SUPER_ADMIN
 */

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Avatar from '@/components/Avatar';

interface Token {
  id: string;
  symbol: string;
  name: string;
  address: string;
  network: string;
  logoUrl?: string;
  decimals: number;
  isActive: boolean;
  isVerified: boolean;
  hasCustomApis: boolean;
  organization: {
    id: string;
    name: string;
    logoUrl?: string;
  };
  contractsCount: number;
  transfersCount: number;
  createdAt: string;
}

interface Stats {
  total: number;
  byNetwork: {
    base: number;
    'base-testnet': number;
    'base-sepolia': number;
  };
  active: number;
  verified: number;
  withCustomApis: number;
}

export default function AdminTokensPage() {
  const [tokens, setTokens] = useState<Token[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [networkFilter, setNetworkFilter] = useState('');
  const [sortBy, setSortBy] = useState('createdAt');

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    fetchTokens();
  }, [debouncedSearch, networkFilter, sortBy]);

  const fetchTokens = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (debouncedSearch) params.set('search', debouncedSearch);
      if (networkFilter) params.set('network', networkFilter);
      if (sortBy) params.set('sortBy', sortBy);

      const res = await fetch(`/api/admin/tokens?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setTokens(data.tokens);
        setStats(data.stats);
      }
    } catch (error) {
      console.error('Error fetching tokens:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}k`;
    return num.toString();
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (loading && !stats) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
        Cargando tokens...
      </div>
    );
  }

  return (
    <div className="max-w-7xl">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-card-foreground">Tokens</h1>
        <p className="text-muted-foreground mt-1">Vista global de todos los tokens del sistema</p>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
          <div className="bg-card border border-border rounded-lg p-4 shadow">
            <div className="text-muted-foreground text-sm mb-1">Total Tokens</div>
            <div className="text-3xl font-bold text-card-foreground">{stats.total}</div>
          </div>
          <div className="bg-card border border-border rounded-lg p-4 shadow">
            <div className="text-muted-foreground text-sm mb-1">Base Mainnet</div>
            <div className="text-3xl font-bold text-primary">{stats.byNetwork.base}</div>
          </div>
          <div className="bg-card border border-border rounded-lg p-4 shadow">
            <div className="text-muted-foreground text-sm mb-1">Active</div>
            <div className="text-3xl font-bold text-success">{stats.active}</div>
          </div>
          <div className="bg-card border border-border rounded-lg p-4 shadow">
            <div className="text-muted-foreground text-sm mb-1">Verified</div>
            <div className="text-3xl font-bold text-accent">{stats.verified}</div>
          </div>
          <div className="bg-card border border-border rounded-lg p-4 shadow">
            <div className="text-muted-foreground text-sm mb-1">Custom APIs</div>
            <div className="text-3xl font-bold text-warning">{stats.withCustomApis}</div>
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="mb-6 flex flex-wrap gap-4 items-end">
        <div className="flex-1 min-w-[250px]">
          <label className="block text-sm font-medium text-foreground mb-1">
            Buscar por symbol o address
          </label>
          <input
            type="text"
            placeholder="VTN, USDC, 0x..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-4 py-2 border border-input rounded-lg bg-background text-foreground"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">Network</label>
          <select
            value={networkFilter}
            onChange={(e) => setNetworkFilter(e.target.value)}
            className="px-4 py-2 border border-input rounded-lg bg-background text-foreground"
          >
            <option value="">Todos</option>
            <option value="base">Base Mainnet</option>
            <option value="base-testnet">Base Testnet</option>
            <option value="base-sepolia">Base Sepolia</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">Ordenar por</label>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="px-4 py-2 border border-input rounded-lg bg-background text-foreground"
          >
            <option value="createdAt">Fecha creación</option>
            <option value="symbol">Symbol (A-Z)</option>
            <option value="transfers">Transfers</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-card rounded-lg shadow overflow-hidden border border-border">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                  Token
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                  Address
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                  Network
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                  Organization
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-muted-foreground uppercase">
                  Contracts
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-muted-foreground uppercase">
                  Transfers
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                  Created
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {tokens.map((token) => (
                <tr key={token.id} className="hover:bg-muted/50">
                  {/* Token */}
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <Avatar src={token.logoUrl} name={token.symbol} size="sm" />
                      <div>
                        <div className="font-medium text-card-foreground flex items-center gap-2">
                          {token.symbol}
                          {token.isVerified && (
                            <span title="Verified" className="text-accent">✓</span>
                          )}
                          {token.hasCustomApis && (
                            <span title="Custom API Keys" className="text-warning">🔑</span>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">{token.name}</div>
                      </div>
                    </div>
                  </td>

                  {/* Address */}
                  <td className="px-6 py-4">
                    <div className="font-mono text-xs text-muted-foreground">
                      {token.address.substring(0, 6)}...{token.address.substring(38)}
                    </div>
                  </td>

                  {/* Network */}
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      token.network === 'base'
                        ? 'bg-primary/10 text-primary'
                        : 'bg-muted text-muted-foreground'
                    }`}>
                      {token.network === 'base' ? 'Base' :
                       token.network === 'base-testnet' ? 'Testnet' : 'Sepolia'}
                    </span>
                  </td>

                  {/* Organization */}
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <Avatar
                        src={token.organization.logoUrl}
                        name={token.organization.name}
                        size="xs"
                      />
                      <span className="text-sm">{token.organization.name}</span>
                    </div>
                  </td>

                  {/* Contracts */}
                  <td className="px-6 py-4 text-center">
                    <span className="text-sm">{token.contractsCount}</span>
                  </td>

                  {/* Transfers */}
                  <td className="px-6 py-4 text-center">
                    <span className="text-sm font-medium">{formatNumber(token.transfersCount)}</span>
                  </td>

                  {/* Created */}
                  <td className="px-6 py-4">
                    <span className="text-xs text-muted-foreground">{formatDate(token.createdAt)}</span>
                  </td>

                  {/* Actions */}
                  <td className="px-6 py-4">
                    <Link
                      href={`/admin/organizations/${token.organization.id}`}
                      className="text-primary hover:underline text-sm"
                    >
                      Ver org →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Empty state */}
        {tokens.length === 0 && !loading && (
          <div className="py-12 text-center text-muted-foreground">
            <div className="text-4xl mb-4">🪙</div>
            <p>No se encontraron tokens con los filtros aplicados</p>
          </div>
        )}
      </div>
    </div>
  );
}
