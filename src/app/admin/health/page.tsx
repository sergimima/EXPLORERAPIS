'use client';

import { useState, useEffect } from 'react';

interface ServiceResult {
  status: 'ok' | 'error' | 'skipped';
  ms?: number;
  message?: string;
}

interface HealthResponse {
  status: 'healthy' | 'degraded';
  timestamp: string;
  services: Record<string, ServiceResult>;
}

const SERVICE_LABELS: Record<string, { name: string; description: string }> = {
  database: {
    name: 'Database (PostgreSQL)',
    description: 'Conexión a la base de datos'
  },
  basescan: {
    name: 'BaseScan API',
    description: 'Explorador de bloques Base (ABIs, contratos)'
  },
  routescan: {
    name: 'Routescan API',
    description: 'API para transferencias y datos on-chain en Base'
  },
  moralis: {
    name: 'Moralis API',
    description: 'Holders, transfers y datos token (opcional)'
  }
};

export default function AdminHealthPage() {
  const [data, setData] = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHealth = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/health');
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      const json = await res.json();
      setData(json);
    } catch (err: any) {
      setError(err.message || 'Error al obtener estado');
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();
    const interval = setInterval(fetchHealth, 60000); // Refresh cada 60s
    return () => clearInterval(interval);
  }, []);

  if (loading && !data) {
    return (
      <div className="max-w-4xl">
        <h1 className="text-3xl font-bold text-card-foreground mb-2">Health Check</h1>
        <p className="text-muted-foreground mb-8">
          Estado de los servicios externos e infraestructura
        </p>
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl">
      <div className="flex justify-between items-start mb-8">
        <div>
          <h1 className="text-3xl font-bold text-card-foreground mb-2">Health Check</h1>
          <p className="text-muted-foreground">
            Estado de los servicios externos e infraestructura
          </p>
        </div>
        <button
          onClick={fetchHealth}
          disabled={loading}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 disabled:opacity-50"
        >
          {loading ? 'Comprobando...' : 'Actualizar'}
        </button>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-destructive/10 border border-destructive/30 rounded-lg text-destructive">
          {error}
        </div>
      )}

      {data && (
        <>
          {/* Status global */}
          <div
            className={`mb-8 p-4 rounded-lg border ${
              data.status === 'healthy'
                ? 'bg-success/10 border-success/30 text-success'
                : 'bg-warning/10 border-warning/30 text-warning'
            }`}
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">
                {data.status === 'healthy' ? '✅' : '⚠️'}
              </span>
              <div>
                <div className="font-bold">
                  {data.status === 'healthy'
                    ? 'Todos los servicios operativos'
                    : 'Algunos servicios con problemas'}
                </div>
                <div className="text-sm opacity-90">
                  Última comprobación: {new Date(data.timestamp).toLocaleString('es-ES')}
                </div>
              </div>
            </div>
          </div>

          {/* Servicios */}
          <div className="space-y-4">
            {Object.entries(data.services).map(([key, result]) => {
              const label = SERVICE_LABELS[key] || {
                name: key,
                description: ''
              };
              return (
                <div
                  key={key}
                  className="bg-card rounded-lg border border-border p-6 flex items-start justify-between gap-4"
                >
                  <div>
                    <div className="font-medium text-card-foreground flex items-center gap-2">
                      <span
                        className={`inline-block w-3 h-3 rounded-full ${
                          result.status === 'ok'
                            ? 'bg-success'
                            : result.status === 'error'
                            ? 'bg-destructive'
                            : 'bg-muted'
                        }`}
                      />
                      {label.name}
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">
                      {label.description}
                    </div>
                    {result.message && (
                      <div
                        className={`text-sm mt-2 ${
                          result.status === 'error'
                            ? 'text-destructive'
                            : 'text-muted-foreground'
                        }`}
                      >
                        {result.message}
                      </div>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    {result.status === 'ok' && result.ms != null && (
                      <span className="text-sm text-muted-foreground">
                        {result.ms} ms
                      </span>
                    )}
                    {result.status === 'skipped' && (
                      <span className="text-xs text-muted-foreground px-2 py-1 bg-muted rounded">
                        No configurado
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
