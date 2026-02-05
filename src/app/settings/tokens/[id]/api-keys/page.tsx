'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { toast } from 'sonner';

export default function ApiKeysSettingsPage() {
  const params = useParams();
  const tokenId = params.id as string;

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
      toast.success('API Keys guardadas correctamente');
    } catch (error: any) {
      toast.error('Error al guardar: ' + (error.message || 'Error desconocido'));
    }
    setSaving(false);
  };

  if (loading) {
    return <div className="text-muted-foreground py-8">Cargando...</div>;
  }

  return (
    <div className="max-w-3xl space-y-6">
      {/* Header */}
      <div className="bg-accent border border-border rounded-lg p-4">
        <h2 className="text-xl font-semibold text-card-foreground mb-2">
          API Keys Personalizadas
        </h2>
        <p className="text-sm text-muted-foreground">
          Por defecto se usan las API keys del platform. Configura tus propias keys si tienes límites más altos o quieres mayor control.
        </p>
      </div>

      {/* API Keys */}
      <div className="bg-card rounded-lg shadow p-6 border border-border">
        <div className="space-y-6">
          {/* BaseScan */}
          <div>
            <label className="block text-sm font-medium mb-1 text-foreground">
              BaseScan API Key
            </label>
            <input
              type="password"
              value={settings.customBasescanApiKey || ''}
              onChange={(e) => setSettings({ ...settings, customBasescanApiKey: e.target.value })}
              placeholder="Si está vacío, usa la key del platform"
              className="w-full px-3 py-2 border border-input rounded-lg bg-background text-foreground focus:ring-2 focus:ring-primary focus:border-transparent"
            />
            <a
              href="https://basescan.org/apis"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary hover:opacity-80 mt-1 inline-block"
            >
              Obtener API key →
            </a>
          </div>

          {/* Etherscan */}
          <div>
            <label className="block text-sm font-medium mb-1 text-foreground">
              Etherscan API Key
            </label>
            <input
              type="password"
              value={settings.customEtherscanApiKey || ''}
              onChange={(e) => setSettings({ ...settings, customEtherscanApiKey: e.target.value })}
              placeholder="Si está vacío, usa la key del platform"
              className="w-full px-3 py-2 border border-input rounded-lg bg-background text-foreground focus:ring-2 focus:ring-primary focus:border-transparent"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Usado para obtener transfers históricos en Base network
            </p>
          </div>

          {/* Moralis */}
          <div>
            <label className="block text-sm font-medium mb-1 text-foreground">
              Moralis API Key
            </label>
            <input
              type="password"
              value={settings.customMoralisApiKey || ''}
              onChange={(e) => setSettings({ ...settings, customMoralisApiKey: e.target.value })}
              placeholder="Si está vacío, usa la key del platform"
              className="w-full px-3 py-2 border border-input rounded-lg bg-background text-foreground focus:ring-2 focus:ring-primary focus:border-transparent"
            />
            <a
              href="https://moralis.io"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary hover:opacity-80 mt-1 inline-block"
            >
              Obtener API key →
            </a>
          </div>

          {/* QuikNode */}
          <div>
            <label className="block text-sm font-medium mb-1 text-foreground">
              QuikNode URL (RPC)
            </label>
            <input
              type="url"
              value={settings.customQuiknodeUrl || ''}
              onChange={(e) => setSettings({ ...settings, customQuiknodeUrl: e.target.value })}
              placeholder="https://..."
              className="w-full px-3 py-2 border border-input rounded-lg bg-background text-foreground font-mono text-sm focus:ring-2 focus:ring-primary focus:border-transparent"
            />
            <a
              href="https://www.quicknode.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary hover:opacity-80 mt-1 inline-block"
            >
              Obtener endpoint →
            </a>
          </div>

          {/* Routescan */}
          <div>
            <label className="block text-sm font-medium mb-1 text-foreground">
              Routescan API Key
            </label>
            <input
              type="password"
              value={settings.customRoutescanApiKey || ''}
              onChange={(e) => setSettings({ ...settings, customRoutescanApiKey: e.target.value })}
              placeholder="Si está vacío, usa la key del platform"
              className="w-full px-3 py-2 border border-input rounded-lg bg-background text-foreground focus:ring-2 focus:ring-primary focus:border-transparent"
            />
            <a
              href="https://routescan.io/documentation/api-keys"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary hover:opacity-80 mt-1 inline-block"
            >
              Obtener API key →
            </a>
          </div>
        </div>
      </div>

      {/* Info Box */}
      <div className="bg-warning/10 border border-warning rounded-lg p-4">
        <p className="text-sm text-foreground">
          <strong className="text-warning">💡 Tip:</strong> Las API keys se almacenan de forma segura y solo se usan para este token.
          Si dejas los campos vacíos, se usarán las keys globales del platform (con rate limits compartidos).
        </p>
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
