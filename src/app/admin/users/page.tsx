'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface UserStats {
  total: number;
  byRole: Record<string, number>;
  withoutOrganizations: number;
  verified: number;
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    fetchUsers();
  }, [debouncedSearch, roleFilter]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (debouncedSearch) params.set('search', debouncedSearch);
      if (roleFilter) params.set('role', roleFilter);
      const res = await fetch(`/api/admin/users?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users);
        setStats(data.stats);
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'SUPER_ADMIN':
        return 'bg-destructive/10 text-destructive';
      case 'ADMIN':
        return 'bg-warning/10 text-warning';
      case 'MEMBER':
        return 'bg-primary/10 text-primary';
      case 'VIEWER':
        return 'bg-muted text-muted-foreground';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (loading && users.length === 0) {
    return <div className="py-12 text-center text-muted-foreground">Cargando...</div>;
  }

  return (
    <div className="max-w-7xl">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-card-foreground">Users</h1>
          <p className="text-muted-foreground mt-1">Gestiona todos los usuarios del sistema</p>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-card rounded-lg shadow p-4 border border-border">
            <p className="text-sm text-muted-foreground mb-1">Total Usuarios</p>
            <p className="text-2xl font-bold text-card-foreground">{stats.total}</p>
          </div>
          <div className="bg-card rounded-lg shadow p-4 border border-border">
            <p className="text-sm text-muted-foreground mb-1">Super Admins</p>
            <p className="text-2xl font-bold text-destructive">{stats.byRole['SUPER_ADMIN'] || 0}</p>
          </div>
          <div className="bg-card rounded-lg shadow p-4 border border-border">
            <p className="text-sm text-muted-foreground mb-1">Admins</p>
            <p className="text-2xl font-bold text-warning">{stats.byRole['ADMIN'] || 0}</p>
          </div>
          <div className="bg-card rounded-lg shadow p-4 border border-border">
            <p className="text-sm text-muted-foreground mb-1">Members</p>
            <p className="text-2xl font-bold text-primary">{stats.byRole['MEMBER'] || 0}</p>
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="mb-6 flex flex-wrap gap-4 items-end">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-sm font-medium text-foreground mb-1">Buscar por email o nombre</label>
          <input
            type="text"
            placeholder="Email o nombre..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-4 py-2 border border-input rounded-lg bg-background text-foreground"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">Rol</label>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="px-4 py-2 border border-input rounded-lg bg-background text-foreground"
          >
            <option value="">Todos</option>
            <option value="SUPER_ADMIN">Super Admin</option>
            <option value="ADMIN">Admin</option>
            <option value="MEMBER">Member</option>
            <option value="VIEWER">Viewer</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-card rounded-lg shadow overflow-hidden border border-border">
        <table className="w-full">
          <thead className="bg-muted">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Email</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Nombre</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Rol</th>
              <th className="px-6 py-3 text-center text-xs font-medium text-muted-foreground uppercase">Orgs</th>
              <th className="px-6 py-3 text-center text-xs font-medium text-muted-foreground uppercase">Owner</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Creado</th>
              <th className="px-6 py-3 text-center text-xs font-medium text-muted-foreground uppercase">Verificado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {users.map((user) => (
              <tr key={user.id} className="hover:bg-muted/50">
                <td className="px-6 py-4">
                  <div className="font-medium text-card-foreground">{user.email}</div>
                </td>
                <td className="px-6 py-4">
                  <div className="text-sm text-card-foreground">{user.name || '-'}</div>
                </td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${getRoleColor(user.role)}`}>
                    {user.role}
                  </span>
                </td>
                <td className="px-6 py-4 text-center">
                  {user.organizationsCount > 0 ? (
                    <div className="flex flex-col items-center gap-1">
                      <span className="text-sm font-medium text-card-foreground">{user.organizationsCount}</span>
                      {user.organizations.length > 0 && (
                        <div className="text-xs text-muted-foreground max-w-[150px] truncate" title={user.organizations.map((o: any) => o.name).join(', ')}>
                          {user.organizations[0].name}
                          {user.organizations.length > 1 && ` +${user.organizations.length - 1}`}
                        </div>
                      )}
                    </div>
                  ) : (
                    <span className="text-sm text-muted-foreground">-</span>
                  )}
                </td>
                <td className="px-6 py-4 text-center">
                  {user.ownedOrganizationsCount > 0 ? (
                    <div className="flex flex-col items-center gap-1">
                      <span className="text-sm font-medium text-success">{user.ownedOrganizationsCount}</span>
                      {user.ownedOrganizations.length > 0 && (
                        <div className="text-xs text-muted-foreground max-w-[150px] truncate" title={user.ownedOrganizations.map((o: any) => o.name).join(', ')}>
                          {user.ownedOrganizations[0].name}
                          {user.ownedOrganizations.length > 1 && ` +${user.ownedOrganizations.length - 1}`}
                        </div>
                      )}
                    </div>
                  ) : (
                    <span className="text-sm text-muted-foreground">-</span>
                  )}
                </td>
                <td className="px-6 py-4 text-sm text-muted-foreground">
                  {formatDate(user.createdAt)}
                </td>
                <td className="px-6 py-4 text-center">
                  {user.emailVerified ? (
                    <span className="text-success text-xl" title="Email verificado">✓</span>
                  ) : (
                    <span className="text-muted-foreground text-xl" title="Email no verificado">○</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {users.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            No se encontraron usuarios
          </div>
        )}
      </div>
    </div>
  );
}
