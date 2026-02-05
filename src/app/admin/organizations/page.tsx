'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Avatar from '@/components/Avatar';

export default function OrganizationsPage() {
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [planFilter, setPlanFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Debounce search para no hacer fetch en cada tecla
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    fetchOrganizations();
  }, [debouncedSearch, planFilter, statusFilter]);

  const fetchOrganizations = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (debouncedSearch) params.set('search', debouncedSearch);
      if (planFilter) params.set('plan', planFilter);
      if (statusFilter) params.set('status', statusFilter);
      const res = await fetch(`/api/admin/organizations?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setOrganizations(data.organizations);
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading && organizations.length === 0) {
    return <div className="py-12 text-center text-muted-foreground">Cargando...</div>;
  }

  return (
    <div className="max-w-7xl">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-card-foreground">Organizations</h1>
          <p className="text-muted-foreground mt-1">Gestiona todas las organizaciones</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="mb-6 flex flex-wrap gap-4 items-end">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-sm font-medium text-foreground mb-1">Buscar por nombre</label>
          <input
            type="text"
            placeholder="Nombre de organización..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-4 py-2 border border-input rounded-lg bg-background text-foreground"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">Plan</label>
          <select
            value={planFilter}
            onChange={(e) => setPlanFilter(e.target.value)}
            className="px-4 py-2 border border-input rounded-lg bg-background text-foreground"
          >
            <option value="">Todos</option>
            <option value="free">Free</option>
            <option value="pro">Pro</option>
            <option value="enterprise">Enterprise</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">Estado</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 border border-input rounded-lg bg-background text-foreground"
          >
            <option value="">Todos</option>
            <option value="ACTIVE">Activo</option>
            <option value="CANCELED">Cancelado</option>
            <option value="PAST_DUE">Past Due</option>
            <option value="TRIALING">Trial</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-card rounded-lg shadow overflow-hidden border border-border">
        <table className="w-full">
          <thead className="bg-muted">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Plan</th>
              <th className="px-6 py-3 text-center text-xs font-medium text-muted-foreground uppercase">APIs</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Tokens</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Members</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Estado</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">MRR</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {organizations.map((org) => (
              <tr key={org.id} className="hover:bg-muted/50">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <Avatar src={org.logoUrl} name={org.name} size="sm" />
                    <div>
                      <div className="font-medium">{org.name}</div>
                      <div className="text-xs text-muted-foreground">{org.slug}</div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className="px-2 py-1 bg-primary/10 text-primary rounded text-xs">
                    {org.subscription?.plan?.name || 'None'}
                  </span>
                </td>
                <td className="px-6 py-4 text-center">
                  {org.hasCustomApis && (
                    <span className="inline-flex items-center justify-center" title="Usa Custom API Keys">
                      🔑
                    </span>
                  )}
                </td>
                <td className="px-6 py-4 text-sm">{org.tokensCount ?? 0}</td>
                <td className="px-6 py-4 text-sm">{org.membersCount}</td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 rounded text-xs ${
                    org.subscription?.status === 'ACTIVE' ? 'bg-success/10 text-success' :
                    org.subscription?.status === 'CANCELED' ? 'bg-destructive/10 text-destructive' :
                    org.subscription?.status === 'PAST_DUE' ? 'bg-warning/10 text-warning' :
                    'bg-muted text-muted-foreground'
                  }`}>
                    {org.subscription?.status || '-'}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm">${org.mrr ?? 0}/mo</td>
                <td className="px-6 py-4">
                  <Link
                    href={`/admin/organizations/${org.id}`}
                    className="text-primary hover:underline text-sm"
                  >
                    Ver detalle →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
