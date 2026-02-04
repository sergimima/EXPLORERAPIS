'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';

export default function SupplySettingsPage() {
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
      alert('Configuración de supply guardada correctamente!');
    } catch (error: any) {
      alert('Error al guardar: ' + error.message);
    }
    setSaving(false);
  };

  if (loading) {
    return <div className="text-gray-500">Cargando...</div>;
  }

  const supplyMethod = settings.supplyMethod || 'API';

  return (
    <div className="max-w-3xl space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold mb-2">Configuración de Supply</h2>
        <p className="text-gray-600">
          Define cómo obtener el supply del token (total, circulante, locked)
        </p>
      </div>

      {/* Supply Method Selection */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">Método de Obtención</h3>

        <div className="space-y-3">
          <label className="flex items-start gap-3 p-4 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
            <input
              type="radio"
              checked={supplyMethod === 'API'}
              onChange={() => setSettings({ ...settings, supplyMethod: 'API' })}
              className="mt-1 w-4 h-4"
            />
            <div className="flex-1">
              <div className="font-medium">API Externa</div>
              <p className="text-sm text-gray-600">
                Obtener supply desde endpoints HTTP configurables
              </p>
            </div>
          </label>

          <label className="flex items-start gap-3 p-4 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
            <input
              type="radio"
              checked={supplyMethod === 'ONCHAIN'}
              onChange={() => setSettings({ ...settings, supplyMethod: 'ONCHAIN' })}
              className="mt-1 w-4 h-4"
            />
            <div className="flex-1">
              <div className="font-medium">On-Chain</div>
              <p className="text-sm text-gray-600">
                Calcular supply directamente desde el contrato ERC20
              </p>
            </div>
          </label>
        </div>
      </div>

      {/* API Configuration */}
      {supplyMethod === 'API' && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">Configuración de API</h3>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                URL Total Supply
              </label>
              <input
                type="url"
                value={settings.supplyApiTotalUrl || ''}
                onChange={(e) => setSettings({ ...settings, supplyApiTotalUrl: e.target.value })}
                placeholder="https://api.example.com/v1/total-supply"
                className="w-full px-3 py-2 border rounded font-mono text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-500 mt-1">
                Endpoint que devuelve {`{ "totalSupply": "1000000" }`}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                URL Circulating Supply
              </label>
              <input
                type="url"
                value={settings.supplyApiCirculatingUrl || ''}
                onChange={(e) => setSettings({ ...settings, supplyApiCirculatingUrl: e.target.value })}
                placeholder="https://api.example.com/v1/circulating-supply"
                className="w-full px-3 py-2 border rounded font-mono text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-500 mt-1">
                Endpoint que devuelve {`{ "circulatingSupply": "800000" }`}
              </p>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-4">
            <p className="text-sm text-blue-800">
              💡 <strong>Legacy Fallback:</strong> Si dejas estos campos vacíos, se usará la API de Vottun por defecto
            </p>
          </div>
        </div>
      )}

      {/* On-Chain Info */}
      {supplyMethod === 'ONCHAIN' && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-6">
          <div className="flex gap-3">
            <div className="text-2xl">✅</div>
            <div className="flex-1">
              <p className="font-medium text-green-900 mb-2">
                Cálculo On-Chain Activado
              </p>
              <p className="text-sm text-green-800 mb-2">
                El supply se calculará directamente desde el contrato ERC20 usando el método{' '}
                <code className="bg-green-100 px-1.5 py-0.5 rounded font-mono text-xs">totalSupply()</code>
              </p>
              <p className="text-xs text-green-700">
                <strong>Nota:</strong> El circulating supply será igual al total supply.
                Para calcular locked supply con precisión, necesitarás configurar contratos de vesting en la sección "Contratos".
              </p>
            </div>
          </div>
        </div>
      )}

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
