'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';

export default function OrganizationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [org, setOrg] = useState<any>(null);
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState('');

  useEffect(() => {
    fetchData();
  }, [params.id]);

  const fetchData = async () => {
    try {
      const [orgRes, plansRes] = await Promise.all([
        fetch(`/api/admin/organizations/${params.id}`),
        fetch('/api/admin/plans')
      ]);

      if (orgRes.ok) {
        const orgData = await orgRes.json();
        setOrg(orgData.organization);
        setSelectedPlan(orgData.organization.subscription?.planRelation?.id || '');
      }

      if (plansRes.ok) {
        const plansData = await plansRes.json();
        setPlans(plansData.plans);
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAssignPlan = async () => {
    if (!selectedPlan) return;

    try {
      const res = await fetch(`/api/admin/organizations/${params.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId: selectedPlan })
      });

      if (res.ok) {
        toast.success('Plan asignado correctamente');
        fetchData();
      } else {
        const err = await res.json();
        toast.error(err.error || 'Error al asignar plan');
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al asignar plan');
    }
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'ADMIN': return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
      case 'MEMBER': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'VIEWER': return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getUsagePercentage = (current: number, limit: number) => {
    if (limit === -1) return 0; // Unlimited
    return Math.min((current / limit) * 100, 100);
  };

  const getUsageColor = (percentage: number) => {
    if (percentage >= 90) return 'bg-red-500';
    if (percentage >= 70) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  if (loading) return <div className="py-12 text-center">Cargando...</div>;
  if (!org) return <div className="py-12 text-center">Organización no encontrada</div>;

  const subscription = org.subscription;
  const tokensUsage = getUsagePercentage(org.tokens.length, subscription?.tokensLimit || 0);
  const apiCallsUsage = getUsagePercentage(subscription?.apiCallsThisMonth || 0, subscription?.apiCallsLimit || 0);
  const membersUsage = getUsagePercentage(org.members.length, subscription?.membersLimit || 0);

  return (
    <div className="max-w-6xl">
      <button
        onClick={() => router.back()}
        className="mb-4 text-sm text-muted-foreground hover:text-foreground"
      >
        ← Volver
      </button>

      <div className="mb-6">
        <h1 className="text-3xl font-bold">{org.name}</h1>
        <p className="text-muted-foreground mt-1">
          Creada el {formatDate(org.createdAt)}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Info General */}
        <div className="bg-card rounded-lg shadow p-6">
          <h2 className="text-xl font-bold mb-4">📋 Información General</h2>
          <div className="space-y-3">
            <div>
              <p className="text-sm text-muted-foreground">Slug</p>
              <p className="font-medium">{org.slug}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Owner</p>
              <p className="font-medium">{org.users[0]?.email || 'N/A'}</p>
              <p className="text-xs text-muted-foreground">{org.users[0]?.name || ''}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Estado</p>
              <span className="inline-block px-2 py-1 rounded text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                {subscription?.status || 'ACTIVE'}
              </span>
            </div>
          </div>
        </div>

        {/* Plan y Suscripción */}
        <div className="bg-card rounded-lg shadow p-6">
          <h2 className="text-xl font-bold mb-4">💎 Plan y Suscripción</h2>
          {subscription && (
            <div className="space-y-3">
              <div>
                <p className="text-sm text-muted-foreground">Plan actual</p>
                <p className="font-medium text-lg">{subscription.planRelation?.name || 'N/A'}</p>
                <p className="text-sm text-muted-foreground">
                  ${subscription.planRelation?.price || 0}/mes
                </p>
              </div>
              <div className="pt-3 border-t">
                <label className="block text-sm font-medium mb-2">Cambiar plan:</label>
                <div className="flex gap-2">
                  <select
                    value={selectedPlan}
                    onChange={(e) => setSelectedPlan(e.target.value)}
                    className="flex-1 px-3 py-2 border border-border rounded-lg bg-background text-sm"
                  >
                    <option value="">Seleccionar...</option>
                    {plans.map((plan) => (
                      <option key={plan.id} value={plan.id}>
                        {plan.name} - ${plan.price}/mo
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={handleAssignPlan}
                    disabled={!selectedPlan || selectedPlan === subscription.planRelation?.id}
                    className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 disabled:opacity-50 text-sm"
                  >
                    Asignar
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Uso y Límites */}
      <div className="bg-card rounded-lg shadow p-6 mt-6">
        <h2 className="text-xl font-bold mb-4">📊 Uso actual vs Límites</h2>
        <div className="space-y-4">
          {/* Tokens */}
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="font-medium">Tokens configurados</span>
              <span className="text-muted-foreground">
                {org.tokens.length} / {subscription?.tokensLimit === -1 ? '∞' : subscription?.tokensLimit || 0}
              </span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div
                className={`h-2 rounded-full ${getUsageColor(tokensUsage)}`}
                style={{ width: `${subscription?.tokensLimit === -1 ? 0 : tokensUsage}%` }}
              />
            </div>
          </div>

          {/* API Calls */}
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="font-medium">API calls este mes</span>
              <span className="text-muted-foreground">
                {subscription?.apiCallsThisMonth || 0} / {subscription?.apiCallsLimit === -1 ? '∞' : subscription?.apiCallsLimit?.toLocaleString() || 0}
              </span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div
                className={`h-2 rounded-full ${getUsageColor(apiCallsUsage)}`}
                style={{ width: `${subscription?.apiCallsLimit === -1 ? 0 : apiCallsUsage}%` }}
              />
            </div>
          </div>

          {/* Members */}
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="font-medium">Miembros del equipo</span>
              <span className="text-muted-foreground">
                {org.members.length} / {subscription?.membersLimit === -1 ? '∞' : subscription?.membersLimit || 0}
              </span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div
                className={`h-2 rounded-full ${getUsageColor(membersUsage)}`}
                style={{ width: `${subscription?.membersLimit === -1 ? 0 : membersUsage}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        {/* Miembros */}
        <div className="bg-card rounded-lg shadow p-6">
          <h2 className="text-xl font-bold mb-4">👥 Miembros ({org.members.length})</h2>
          {org.members.length > 0 ? (
            <div className="space-y-3">
              {org.members.map((member: any) => (
                <div key={member.id} className="flex items-center justify-between p-3 border border-border rounded-lg">
                  <div className="flex-1">
                    <p className="font-medium">{member.user.name || 'Sin nombre'}</p>
                    <p className="text-sm text-muted-foreground">{member.user.email}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Unido el {formatDate(member.joinedAt)}
                    </p>
                  </div>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${getRoleColor(member.role)}`}>
                    {member.role}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-4">No hay miembros</p>
          )}
        </div>

        {/* Tokens */}
        <div className="bg-card rounded-lg shadow p-6">
          <h2 className="text-xl font-bold mb-4">🪙 Tokens ({org.tokens.length})</h2>
          {org.tokens.length > 0 ? (
            <div className="space-y-3">
              {org.tokens.map((token: any) => {
                const hasCustomKeys = token.settings && (
                  token.settings.basescanApiKey ||
                  token.settings.etherscanApiKey ||
                  token.settings.moralisApiKey ||
                  token.settings.quiknodeUrl
                );

                return (
                  <div key={token.id} className="p-3 border border-border rounded-lg">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{token.name || token.symbol}</p>
                          {hasCustomKeys && (
                            <span className="text-xs px-2 py-0.5 bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200 rounded flex items-center gap-1">
                              🔑 Custom APIs
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground font-mono mt-1">
                          {token.address.slice(0, 6)}...{token.address.slice(-4)}
                        </p>
                      </div>
                      <span className="text-xs px-2 py-1 bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 rounded">
                        {token.network}
                      </span>
                    </div>
                    <div className="mt-2 text-xs text-muted-foreground">
                      Decimals: {token.decimals} • Chain ID: {token.chainId}
                    </div>
                    {hasCustomKeys && (
                      <div className="mt-2 pt-2 border-t border-border">
                        <p className="text-xs text-muted-foreground mb-1">Custom API Keys configuradas:</p>
                        <div className="flex flex-wrap gap-1">
                          {token.settings.basescanApiKey && (
                            <span className="text-xs px-2 py-0.5 bg-gray-100 dark:bg-gray-800 rounded">
                              BaseScan
                            </span>
                          )}
                          {token.settings.etherscanApiKey && (
                            <span className="text-xs px-2 py-0.5 bg-gray-100 dark:bg-gray-800 rounded">
                              Etherscan
                            </span>
                          )}
                          {token.settings.moralisApiKey && (
                            <span className="text-xs px-2 py-0.5 bg-gray-100 dark:bg-gray-800 rounded">
                              Moralis
                            </span>
                          )}
                          {token.settings.quiknodeUrl && (
                            <span className="text-xs px-2 py-0.5 bg-gray-100 dark:bg-gray-800 rounded">
                              QuikNode
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-4">No hay tokens configurados</p>
          )}
        </div>
      </div>

      {/* Métricas */}
      <div className="bg-card rounded-lg shadow p-6 mt-6">
        <h2 className="text-xl font-bold mb-4">📈 Métricas de Uso</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
            <p className="text-sm text-muted-foreground mb-1">API Calls este mes</p>
            <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {subscription?.apiCallsThisMonth?.toLocaleString() || 0}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Límite: {subscription?.apiCallsLimit === -1 ? 'Ilimitado' : subscription?.apiCallsLimit?.toLocaleString() || 0}
            </p>
          </div>

          <div className="p-4 bg-green-50 dark:bg-green-950 rounded-lg">
            <p className="text-sm text-muted-foreground mb-1">Tokens Configurados</p>
            <p className="text-2xl font-bold text-green-600 dark:text-green-400">
              {org.tokens.length}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Límite: {subscription?.tokensLimit === -1 ? 'Ilimitado' : subscription?.tokensLimit || 0}
            </p>
          </div>

          <div className="p-4 bg-purple-50 dark:bg-purple-950 rounded-lg">
            <p className="text-sm text-muted-foreground mb-1">Miembros Activos</p>
            <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
              {org.members.length}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Límite: {subscription?.membersLimit === -1 ? 'Ilimitado' : subscription?.membersLimit || 0}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
