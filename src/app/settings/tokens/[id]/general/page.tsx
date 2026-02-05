'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { toast } from 'sonner';
import LogoUpload from '@/components/LogoUpload';

export default function GeneralSettingsPage() {
  const params = useParams();
  const tokenId = params.id as string;

  const [token, setToken] = useState<any>(null);
  const [settings, setSettings] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchData();
  }, [tokenId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/tokens/${tokenId}`);
      const data = await res.json();
      setToken(data);
      setSettings(data.settings || {});
    } catch (error) {
      console.error('Error fetching token:', error);
    }
    setLoading(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetch(`/api/tokens/${tokenId}/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });
      toast.success('Configuración guardada correctamente');
    } catch (error: any) {
      toast.error('Error al guardar: ' + (error.message || 'Error desconocido'));
    }
    setSaving(false);
  };

  if (loading) {
    return <div className="text-muted-foreground">Cargando...</div>;
  }

  return (
    <div className="max-w-3xl space-y-6">
      {/* Logo del Token */}
      <div className="bg-card rounded-lg shadow p-6 border border-border">
        <h2 className="text-xl font-semibold mb-4">Logo del Token</h2>
        <LogoUpload
          type="token"
          currentLogoUrl={token?.logoUrl}
          name={token?.symbol || token?.name || 'Token'}
          tokenId={tokenId}
          onUploadSuccess={(logoUrl) => {
            setToken({ ...token, logoUrl });
            toast.success('Logo actualizado correctamente');
          }}
          onDeleteSuccess={() => {
            setToken({ ...token, logoUrl: null });
            toast.success('Logo eliminado correctamente');
          }}
        />
      </div>

      {/* Analytics Settings */}
      <div className="bg-card rounded-lg shadow p-6 border border-border">
        <h2 className="text-xl font-semibold mb-4">Analytics</h2>
        <p className="text-sm text-muted-foreground mb-6">
          Configuración de métricas y comportamiento del analytics dashboard
        </p>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">
              Whale Threshold
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={settings.whaleThreshold || '10000'}
                onChange={(e) => setSettings({ ...settings, whaleThreshold: e.target.value })}
                className="flex-1 px-3 py-2 border border-input rounded focus:ring-2 focus:ring-primary focus:border-transparent bg-background text-foreground"
              />
              <span className="text-muted-foreground font-medium">{token?.symbol}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Transfers mayores a este monto se consideran "ballenas"
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Duración de Caché (minutos)
            </label>
            <input
              type="number"
              value={settings.cacheDurationMinutes || 5}
              onChange={(e) => setSettings({ ...settings, cacheDurationMinutes: parseInt(e.target.value) })}
              className="w-full px-3 py-2 border border-input rounded focus:ring-2 focus:ring-primary focus:border-transparent bg-background text-foreground"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Tiempo que se mantienen los datos en caché antes de actualizar
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Máximo de Transfers a Fetchear
            </label>
            <input
              type="number"
              value={settings.maxTransfersToFetch || 10000}
              onChange={(e) => setSettings({ ...settings, maxTransfersToFetch: parseInt(e.target.value) })}
              className="w-full px-3 py-2 border border-input rounded focus:ring-2 focus:ring-primary focus:border-transparent bg-background text-foreground"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Límite de transfers a obtener por petición a la API
            </p>
          </div>
        </div>
      </div>

      {/* Exchange Addresses */}
      <div className="bg-card rounded-lg shadow p-6 border border-border">
        <h2 className="text-xl font-semibold mb-4">
          Exchanges Conocidos
        </h2>
        <p className="text-sm text-muted-foreground mb-4">
          Agrega addresses de exchanges para trackear flujos CEX
        </p>

        <div>
          <label className="block text-sm font-medium mb-1">
            Addresses (una por línea)
          </label>
          <textarea
            value={(settings.customExchangeAddresses || []).join('\n')}
            onChange={(e) => setSettings({
              ...settings,
              customExchangeAddresses: e.target.value.split('\n').filter(a => a.trim())
            })}
            placeholder="0x3cd751e6b0078be393132286c442345e5dc49699&#10;0x71660c4005ba85c37ccec55d0c4493e66fe775d3"
            className="w-full px-3 py-2 border border-input rounded font-mono text-sm bg-background text-foreground focus:ring-2 focus:ring-primary focus:border-transparent"
            rows={5}
          />
          <p className="text-xs text-muted-foreground mt-1">
            Usa addresses en formato 0x... para identificar exchanges en el analytics
          </p>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
        >
          {saving ? 'Guardando...' : 'Guardar Cambios'}
        </button>
      </div>
    </div>
  );
}
