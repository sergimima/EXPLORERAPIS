'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';

interface DashboardStats {
  totalOrganizations: number;
  totalUsers: number;
  totalMRR: number;
  planDistribution: Record<string, number>;
  recentOrganizations: Array<{
    id: string;
    name: string;
    plan: string;
    createdAt: string;
    membersCount: number;
  }>;
}

interface Alert {
  id: string;
  orgId: string;
  orgName: string;
  type: 'tokens' | 'api_calls' | 'members';
  current: number;
  limit: number;
  percentage: number;
}

interface ChartData {
  orgsByMonth: { month: string; count: number }[];
  cancelationsByMonth: { month: string; count: number }[];
  mrrByMonth: { month: string; mrr: number }[];
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [chartData, setChartData] = useState<ChartData | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
    fetchChartData();
  }, []);

  const fetchChartData = async () => {
    try {
      const res = await fetch('/api/admin/stats');
      if (res.ok) {
        const data = await res.json();
        setChartData(data);
      }
    } catch (error) {
      console.error('Error fetching chart data:', error);
    }
  };

  const fetchStats = async () => {
    try {
      const res = await fetch('/api/admin/organizations');
      if (res.ok) {
        const data = await res.json();

        // Calcular stats desde los datos de organizaciones
        const totalUsers = data.organizations.reduce((sum: number, org: any) =>
          sum + org.membersCount, 0
        );

        const recentOrgs = data.organizations
          .slice(0, 5)
          .map((org: any) => ({
            id: org.id,
            name: org.name,
            plan: org.subscription?.plan?.name || 'None',
            createdAt: org.createdAt,
            membersCount: org.membersCount
          }));

        // Generar alertas para orgs cerca de límites (80%+)
        const newAlerts: Alert[] = [];
        data.organizations.forEach((org: any) => {
          const sub = org.subscription;
          if (!sub) return;

          // Alert por tokens
          if (sub.tokensLimit > 0) {
            const tokensUsage = (org.tokensCount / sub.tokensLimit) * 100;
            if (tokensUsage >= 80) {
              newAlerts.push({
                id: `${org.id}-tokens`,
                orgId: org.id,
                orgName: org.name,
                type: 'tokens',
                current: org.tokensCount,
                limit: sub.tokensLimit,
                percentage: Math.round(tokensUsage)
              });
            }
          }

          // Alert por API calls
          if (sub.apiCallsLimit > 0) {
            const apiCallsUsage = (sub.apiCallsThisMonth / sub.apiCallsLimit) * 100;
            if (apiCallsUsage >= 80) {
              newAlerts.push({
                id: `${org.id}-api`,
                orgId: org.id,
                orgName: org.name,
                type: 'api_calls',
                current: sub.apiCallsThisMonth,
                limit: sub.apiCallsLimit,
                percentage: Math.round(apiCallsUsage)
              });
            }
          }

          // Alert por members
          if (sub.membersLimit > 0) {
            const membersUsage = (org.membersCount / sub.membersLimit) * 100;
            if (membersUsage >= 80) {
              newAlerts.push({
                id: `${org.id}-members`,
                orgId: org.id,
                orgName: org.name,
                type: 'members',
                current: org.membersCount,
                limit: sub.membersLimit,
                percentage: Math.round(membersUsage)
              });
            }
          }
        });

        setAlerts(newAlerts);

        setStats({
          totalOrganizations: data.stats.total,
          totalUsers,
          totalMRR: data.stats.totalMrr,
          planDistribution: data.stats.byPlan,
          recentOrganizations: recentOrgs
        });
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Cargando métricas...</p>
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="text-center py-12">
        <p className="text-destructive">Error al cargar métricas</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-card-foreground">Dashboard</h1>
        <p className="text-muted-foreground mt-2">
          Visión general de la plataforma
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {/* Total MRR */}
        <div className="bg-primary rounded-lg shadow-lg p-6 text-primary-foreground">
          <div className="flex items-center justify-between mb-2">
            <div className="text-white/90 text-sm font-medium">MRR Total</div>
            <div className="text-3xl">💰</div>
          </div>
          <div className="text-4xl font-bold">${stats.totalMRR.toFixed(0)}</div>
          <div className="text-primary-foreground/80 text-xs mt-2">Monthly Recurring Revenue</div>
        </div>

        {/* Total Organizations */}
        <div className="bg-primary rounded-lg shadow-lg p-6 text-primary-foreground">
          <div className="flex items-center justify-between mb-2">
            <div className="text-white/90 text-sm font-medium">Organizations</div>
            <div className="text-3xl">🏢</div>
          </div>
          <div className="text-4xl font-bold">{stats.totalOrganizations}</div>
          <div className="text-white/80 text-xs mt-2">Total organizations</div>
        </div>

        {/* Total Users */}
        <div className="bg-primary rounded-lg shadow-lg p-6 text-primary-foreground">
          <div className="flex items-center justify-between mb-2">
            <div className="text-white/90 text-sm font-medium">Users</div>
            <div className="text-3xl">👥</div>
          </div>
          <div className="text-4xl font-bold">{stats.totalUsers}</div>
          <div className="text-primary-foreground/80 text-xs mt-2">Total users</div>
        </div>

        {/* Active Plans */}
        <div className="bg-primary rounded-lg shadow-lg p-6 text-primary-foreground">
          <div className="flex items-center justify-between mb-2">
            <div className="text-white/90 text-sm font-medium">Active Plans</div>
            <div className="text-3xl">💳</div>
          </div>
          <div className="text-4xl font-bold">
            {Object.keys(stats.planDistribution).length}
          </div>
          <div className="text-primary-foreground/80 text-xs mt-2">Different plans in use</div>
        </div>
      </div>

      {/* Charts */}
      {chartData && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <div className="bg-card rounded-lg shadow-md p-6 border border-border">
            <h2 className="text-lg font-bold text-card-foreground mb-4">🆕 Nuevas organizaciones por mes</h2>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData.orgsByMonth}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="currentColor" />
                  <YAxis tick={{ fontSize: 11 }} stroke="currentColor" />
                  <Tooltip
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }}
                    labelStyle={{ color: 'hsl(var(--card-foreground))' }}
                  />
                  <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Organizaciones" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-card rounded-lg shadow-md p-6 border border-border">
            <h2 className="text-lg font-bold text-card-foreground mb-4">❌ Cancelaciones por mes</h2>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData.cancelationsByMonth}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="currentColor" />
                  <YAxis tick={{ fontSize: 11 }} stroke="currentColor" />
                  <Tooltip
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }}
                    labelStyle={{ color: 'hsl(var(--card-foreground))' }}
                  />
                  <Bar dataKey="count" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} name="Cancelaciones" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-card rounded-lg shadow-md p-6 border border-border">
            <h2 className="text-lg font-bold text-card-foreground mb-4">💰 Evolución del MRR</h2>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData.mrrByMonth}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="currentColor" />
                  <YAxis tick={{ fontSize: 11 }} stroke="currentColor" tickFormatter={(v) => `$${v}`} />
                  <Tooltip
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }}
                    labelStyle={{ color: 'hsl(var(--card-foreground))' }}
                    formatter={(value: number) => [`$${value.toFixed(2)}`, 'MRR']}
                  />
                  <Area
                    type="monotone"
                    dataKey="mrr"
                    stroke="hsl(var(--primary))"
                    fill="hsl(var(--primary))"
                    fillOpacity={0.2}
                    strokeWidth={2}
                    name="MRR"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* Plan Distribution */}
      <div className="bg-card rounded-lg shadow-md p-6 mb-8 border border-border">
        <h2 className="text-xl font-bold text-card-foreground mb-4">
          📊 Distribución de Planes
        </h2>
        <div className="space-y-3">
          {Object.entries(stats.planDistribution).map(([plan, count]) => {
            const total = stats.totalOrganizations;
            const percentage = total > 0 ? ((count / total) * 100).toFixed(1) : '0';
            return (
              <div key={plan}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-foreground capitalize">
                    {plan}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {count} ({percentage}%)
                  </span>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div
                    className="bg-primary h-2 rounded-full transition-all"
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Recent Organizations */}
      <div className="bg-card rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-card-foreground">
            🆕 Organizaciones Recientes
          </h2>
          <Link
            href="/admin/organizations"
            className="text-sm text-primary hover:underline"
          >
            Ver todas →
          </Link>
        </div>
        <div className="space-y-3">
          {stats.recentOrganizations.map((org) => (
            <Link
              key={org.id}
              href={`/admin/organizations/${org.id}`}
              className="flex items-center justify-between p-3 bg-muted rounded-lg hover:bg-accent transition-colors"
            >
              <div className="flex-1">
                <div className="font-medium text-foreground">{org.name}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  {org.membersCount} {org.membersCount === 1 ? 'member' : 'members'}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="px-3 py-1 bg-primary/10 text-primary rounded text-xs font-medium">
                  {org.plan}
                </span>
                <span className="text-xs text-muted-foreground">
                  {new Date(org.createdAt).toLocaleDateString('es-ES', {
                    day: '2-digit',
                    month: 'short'
                  })}
                </span>
              </div>
            </Link>
          ))}
        </div>

        {stats.recentOrganizations.length === 0 && (
          <div className="text-center text-muted-foreground py-8">
            No hay organizaciones aún
          </div>
        )}
      </div>

      {/* Alertas */}
      {alerts.length > 0 && (
        <div className="bg-card rounded-lg shadow-md p-6 mt-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-card-foreground flex items-center gap-2">
              ⚠️ Alertas - Organizaciones cerca de límites
            </h2>
            <span className="px-3 py-1 bg-warning/10 text-warning rounded-full text-sm font-medium">
              {alerts.length} {alerts.length === 1 ? 'alerta' : 'alertas'}
            </span>
          </div>
          <div className="space-y-3">
            {alerts.map((alert) => {
              const getAlertInfo = () => {
                switch (alert.type) {
                  case 'tokens':
                    return { label: 'Tokens', icon: '🪙', color: 'bg-yellow-50 border-yellow-200 dark:bg-yellow-950 dark:border-yellow-800' };
                  case 'api_calls':
                    return { label: 'API Calls', icon: '📡', color: 'bg-orange-50 border-orange-200 dark:bg-orange-950 dark:border-orange-800' };
                  case 'members':
                    return { label: 'Members', icon: '👥', color: 'bg-red-50 border-red-200 dark:bg-red-950 dark:border-red-800' };
                }
              };
              const info = getAlertInfo();

              return (
                <Link
                  key={alert.id}
                  href={`/admin/organizations/${alert.orgId}`}
                  className={`block p-4 border rounded-lg hover:shadow-md transition-shadow ${info.color}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1">
                      <span className="text-2xl">{info.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-card-foreground truncate">
                          {alert.orgName}
                        </div>
                        <div className="text-sm text-muted-foreground mt-1">
                          {info.label}: {alert.current.toLocaleString()} / {alert.limit.toLocaleString()}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <div className={`text-2xl font-bold ${
                          alert.percentage >= 90 ? 'text-red-600 dark:text-red-400' : 'text-yellow-600 dark:text-yellow-400'
                        }`}>
                          {alert.percentage}%
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {alert.percentage >= 90 ? 'Crítico' : 'Advertencia'}
                        </div>
                      </div>
                      <svg className="w-5 h-5 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
          <div className="mt-4 p-3 bg-accent rounded-lg text-sm text-muted-foreground">
            💡 <strong>Tip:</strong> Contacta a estas organizaciones para ofrecer un upgrade de plan antes de que alcancen el límite.
          </div>
        </div>
      )}
    </div>
  );
}
