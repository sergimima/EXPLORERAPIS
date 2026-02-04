'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';

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
      alert('API Keys guardadas correctamente!');
    } catch (error: any) {
      alert('Error al guardar: ' + error.message);
    }
    setSaving(false);
  };

  if (loading) {
    return <div className="text-muted-foreground">Cargando...</div>;
  }

  return (
    <div className="max-w-3xl space-y-6">
      {/* Header */}
      <div className="bg-accent border border-border rounded-lg p-4">
        <h2 className="text-xl font-semibold text-card-foreground mb-2">
          API Keys Personalizadas
        </h2>
        <p className="text-sm text-accent-foreground">
          Por defecto se usan las API keys del platform. Configura tus propias keys si tienes límites más altos o quieres mayor control.
        </p>
      </div>

      {/* API Keys */}
      <div className="bg-card rounded-lg shadow p-6 border border-border">
        <div className="space-y-6">
          {/* BaseScan */}
          <div>
            <label className="block text-sm font-medium mb-1">
              BaseScan API Key
            </label>
            <input
              type="password"
              value={settings.customBasescanApiKey || ''}
              onChange={(e) => setSettings({ ...settings, customBasescanApiKey: e.target.value })}
              placeholder="Si está vacío, usa la key del platform"
              className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
            <label className="block text-sm font-medium mb-1">
              Etherscan API Key
            </label>
            <input
              type="password"
              value={settings.customEtherscanApiKey || ''}
              onChange={(e) => setSettings({ ...settings, customEtherscanApiKey: e.target.value })}
              placeholder="Si está vacío, usa la key del platform"
              className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Usado para obtener transfers históricos en Base network
            </p>
          </div>

          {/* Moralis */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Moralis API Key
            </label>
            <input
              type="password"
              value={settings.customMoralisApiKey || ''}
              onChange={(e) => setSettings({ ...settings, customMoralisApiKey: e.target.value })}
              placeholder="Si está vacío, usa la key del platform"
              className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
            <label className="block text-sm font-medium mb-1">
              QuikNode URL (RPC)
            </label>
            <input
              type="url"
              value={settings.customQuiknodeUrl || ''}
              onChange={(e) => setSettings({ ...settings, customQuiknodeUrl: e.target.value })}
              placeholder="https://..."
              className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
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
        </div>
      </div>

      {/* Info Box */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <p className="text-sm text-warning-foreground">
          <strong>💡 Tip:</strong> Las API keys se almacenan de forma segura y solo se usan para este token.
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
