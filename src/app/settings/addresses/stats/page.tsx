'use client';

import { useState, useEffect } from 'react';

interface Stats {
  total: number;
  byType: Record<string, number>;
  recent: Array<{
    id: string;
    address: string;
    name: string;
    type: string;
    createdAt: string;
  }>;
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/addresses');
      if (response.ok) {
        const data = await response.json();
        const addresses = data.addresses || [];

        // Calcular stats
        const byType: Record<string, number> = {};
        addresses.forEach((addr: any) => {
          byType[addr.type] = (byType[addr.type] || 0) + 1;
        });

        // Ordenar por fecha de creación
        const sorted = [...addresses].sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );

        setStats({
          total: addresses.length,
          byType,
          recent: sorted.slice(0, 5),
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
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-muted-foreground">Cargando estadísticas...</div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="text-center text-muted-foreground">
        No se pudieron cargar las estadísticas
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-card-foreground">📊 Dashboard Admin</h1>
        <p className="text-muted-foreground mt-1">Estadísticas del sistema</p>
      </div>

      {/* Cards de estadísticas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-primary rounded-lg shadow-lg p-6 text-primary-foreground">
          <div className="flex items-center justify-between mb-2">
            <div className="text-white/90 text-sm font-medium">
              Total Addresses
            </div>
            <div className="text-3xl">📝</div>
          </div>
          <div className="text-4xl font-bold">{stats.total}</div>
          <div className="text-primary-foreground/80 text-xs mt-2">Etiquetadas en el sistema</div>
        </div>

        <div className="bg-primary rounded-lg shadow-lg p-6 text-primary-foreground">
          <div className="flex items-center justify-between mb-2">
            <div className="text-muted-foreground text-sm font-medium">Tipos Únicos</div>
            <div className="text-3xl">🏷️</div>
          </div>
          <div className="text-4xl font-bold">
            {Object.keys(stats.byType).length}
          </div>
          <div className="text-white/80 text-xs mt-2">
            Categorías diferentes
          </div>
        </div>

        <div className="bg-primary rounded-lg shadow-lg p-6 text-primary-foreground">
          <div className="flex items-center justify-between mb-2">
            <div className="text-primary-foreground/90 text-sm font-medium">
              Añadidas Hoy
            </div>
            <div className="text-3xl">⏰</div>
          </div>
          <div className="text-4xl font-bold">
            {
              stats.recent.filter((addr) => {
                const date = new Date(addr.createdAt);
                const today = new Date();
                return date.toDateString() === today.toDateString();
              }).length
            }
          </div>
          <div className="text-primary-foreground/80 text-xs mt-2">Últimas 24 horas</div>
        </div>
      </div>

      {/* Distribución por tipo */}
      <div className="bg-card rounded-lg shadow-md p-6 mb-8">
        <h2 className="text-xl font-bold text-card-foreground mb-4">
          📈 Distribución por Tipo
        </h2>
        <div className="space-y-3">
          {Object.entries(stats.byType)
            .sort((a, b) => b[1] - a[1])
            .map(([type, count]) => {
              const percentage = ((count / stats.total) * 100).toFixed(1);
              return (
                <div key={type}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-foreground">
                      {type}
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

      {/* Addresses recientes */}
      <div className="bg-card rounded-lg shadow-md p-6">
        <h2 className="text-xl font-bold text-card-foreground mb-4">
          🕐 Addresses Recientes
        </h2>
        <div className="space-y-3">
          {stats.recent.map((addr) => (
            <div
              key={addr.id}
              className="flex items-center justify-between p-3 bg-muted rounded-lg hover:bg-muted/80 transition-colors"
            >
              <div className="flex-1">
                <div className="font-medium text-muted-foreground900">{addr.name}</div>
                <div className="text-xs text-muted-foreground font-mono mt-1">
                  {addr.address.slice(0, 20)}...
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="px-3 py-1 bg-accent text-accent-foreground rounded text-xs font-medium">
                  {addr.type}
                </span>
                <span className="text-xs text-muted-foreground">
                  {new Date(addr.createdAt).toLocaleDateString('es-ES', {
                    day: '2-digit',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
            </div>
          ))}
        </div>

        {stats.recent.length === 0 && (
          <div className="text-center text-muted-foreground py-8">
            No hay addresses recientes
          </div>
        )}
      </div>
    </div>
  );
}
