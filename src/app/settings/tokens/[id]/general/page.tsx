'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';

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
      alert('Configuración guardada correctamente!');
    } catch (error: any) {
      alert('Error al guardar: ' + error.message);
    }
    setSaving(false);
  };

  if (loading) {
    return <div className="text-gray-500">Cargando...</div>;
  }

  return (
    <div className="max-w-3xl space-y-6">
      {/* Analytics Settings */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Analytics</h2>
        <p className="text-sm text-gray-600 mb-6">
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
                className="flex-1 px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <span className="text-gray-500 dark:text-gray-400 font-medium">{token?.symbol}</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">
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
              className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <p className="text-xs text-gray-500 mt-1">
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
              className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <p className="text-xs text-gray-500 mt-1">
              Límite de transfers a obtener por petición a la API
            </p>
          </div>
        </div>
      </div>

      {/* Exchange Addresses */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">
          Exchanges Conocidos
        </h2>
        <p className="text-sm text-gray-600 mb-4">
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
            className="w-full px-3 py-2 border rounded font-mono text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            rows={5}
          />
          <p className="text-xs text-gray-500 mt-1">
            Usa addresses en formato 0x... para identificar exchanges en el analytics
          </p>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
        >
          {saving ? 'Guardando...' : 'Guardar Cambios'}
        </button>
      </div>
    </div>
  );
}
