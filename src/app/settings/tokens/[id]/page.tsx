'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

interface VestingContract {
  id: string;
  name: string;
  address: string;
  network: string;
  category?: string;
  description?: string;
  isActive: boolean;
}

export default function TokenSettingsPage() {
  const params = useParams();
  const router = useRouter();
  const tokenId = params.id as string;

  const [token, setToken] = useState<any>(null);
  const [settings, setSettings] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // ABI State
  const [abiSource, setAbiSource] = useState<'standard' | 'custom'>('standard');
  const [customAbi, setCustomAbi] = useState<any>(null);
  const [abiJson, setAbiJson] = useState('');
  const [abiLoading, setAbiLoading] = useState(false);
  const [detectingAbi, setDetectingAbi] = useState(false);

  // Vesting Contracts State
  const [vestingContracts, setVestingContracts] = useState<VestingContract[]>([]);
  const [vestingLoading, setVestingLoading] = useState(false);
  const [showAddVesting, setShowAddVesting] = useState(false);
  const [newVesting, setNewVesting] = useState({
    name: '',
    address: '',
    network: 'base',
    category: '',
    description: ''
  });

  useEffect(() => {
    fetchToken();
    fetchAbi();
    fetchVestingContracts();
  }, [tokenId]);

  const fetchToken = async () => {
    const res = await fetch(`/api/tokens/${tokenId}`);
    const data = await res.json();
    setToken(data);
    setSettings(data.settings || {});
    setLoading(false);
  };

  const fetchAbi = async () => {
    try {
      const res = await fetch(`/api/tokens/${tokenId}/abi`);
      const data = await res.json();

      if (data.source !== 'STANDARD') {
        setAbiSource('custom');
        setCustomAbi(data);
        setAbiJson(JSON.stringify(data.abi, null, 2));
      }
    } catch (error) {
      console.error('Error fetching ABI:', error);
    }
  };

  const fetchVestingContracts = async () => {
    setVestingLoading(true);
    try {
      const res = await fetch(`/api/tokens/${tokenId}/vesting-contracts`);
      const data = await res.json();
      setVestingContracts(data.contracts || []);
    } catch (error) {
      console.error('Error fetching vesting contracts:', error);
    }
    setVestingLoading(false);
  };

  const handleSave = async () => {
    setSaving(true);

    await fetch(`/api/tokens/${tokenId}/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings)
    });

    setSaving(false);
    alert('Configuración guardada!');
  };

  const handleSaveAbi = async () => {
    setAbiLoading(true);
    try {
      const abi = JSON.parse(abiJson);
      await fetch(`/api/tokens/${tokenId}/abi`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ abi, source: 'UPLOADED' })
      });
      alert('ABI guardado correctamente!');
      fetchAbi();
    } catch (error: any) {
      alert('Error al guardar ABI: ' + error.message);
    }
    setAbiLoading(false);
  };

  const handleDetectAbi = async () => {
    setDetectingAbi(true);
    try {
      const res = await fetch(`/api/tokens/${tokenId}/abi/detect`, {
        method: 'POST'
      });
      const data = await res.json();

      if (res.ok) {
        alert(`ABI detectado! ${data.customAbi.methodCount} métodos, ${data.customAbi.eventCount} eventos`);
        fetchAbi();
      } else {
        alert('Error: ' + data.error);
      }
    } catch (error: any) {
      alert('Error al detectar ABI: ' + error.message);
    }
    setDetectingAbi(false);
  };

  const handleDeleteAbi = async () => {
    if (!confirm('¿Volver al ABI estándar ERC20?')) return;

    setAbiLoading(true);
    try {
      await fetch(`/api/tokens/${tokenId}/abi`, {
        method: 'DELETE'
      });
      alert('ABI custom eliminado. Ahora se usa el ABI estándar.');
      setAbiSource('standard');
      setCustomAbi(null);
      setAbiJson('');
      fetchAbi();
    } catch (error: any) {
      alert('Error al eliminar ABI: ' + error.message);
    }
    setAbiLoading(false);
  };

  const handleAddVesting = async () => {
    if (!newVesting.name || !newVesting.address) {
      alert('Name y Address son requeridos');
      return;
    }

    try {
      const res = await fetch(`/api/tokens/${tokenId}/vesting-contracts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newVesting)
      });

      if (res.ok) {
        alert('Vesting contract agregado!');
        setShowAddVesting(false);
        setNewVesting({ name: '', address: '', network: 'base', category: '', description: '' });
        fetchVestingContracts();
      } else {
        const data = await res.json();
        alert('Error: ' + data.error);
      }
    } catch (error: any) {
      alert('Error: ' + error.message);
    }
  };

  const handleToggleVesting = async (contractId: string, isActive: boolean) => {
    try {
      await fetch(`/api/tokens/${tokenId}/vesting-contracts/${contractId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !isActive })
      });
      fetchVestingContracts();
    } catch (error: any) {
      alert('Error: ' + error.message);
    }
  };

  const handleDeleteVesting = async (contractId: string) => {
    if (!confirm('¿Eliminar este vesting contract?')) return;

    try {
      await fetch(`/api/tokens/${tokenId}/vesting-contracts/${contractId}`, {
        method: 'DELETE'
      });
      fetchVestingContracts();
    } catch (error: any) {
      alert('Error: ' + error.message);
    }
  };

  if (loading) return <div className="p-6">Cargando...</div>;

  return (
    <div className="max-w-4xl mx-auto p-6">
      <button
        onClick={() => router.back()}
        className="text-blue-600 hover:text-blue-700 mb-4"
      >
        ← Volver
      </button>

      <div className="flex items-center gap-3 mb-6">
        <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-xl">
          {token?.symbol.substring(0, 2)}
        </div>
        <div>
          <h1 className="text-3xl font-bold">{token?.symbol}</h1>
          <p className="text-gray-600">{token?.name}</p>
        </div>
      </div>

      <div className="space-y-6">
        {/* Analytics Settings */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Analytics</h2>

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
                  className="flex-1 px-3 py-2 border rounded"
                />
                <span className="text-gray-500">{token?.symbol}</span>
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
                className="w-full px-3 py-2 border rounded"
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
                className="w-full px-3 py-2 border rounded"
              />
              <p className="text-xs text-gray-500 mt-1">
                Límite de transfers a obtener por petición a la API
              </p>
            </div>
          </div>
        </div>

        {/* Custom API Keys */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">
            API Keys Personalizadas (Opcional)
          </h2>
          <p className="text-sm text-gray-600 mb-4">
            Por defecto se usan las API keys del platform. Configura tus propias keys si tienes límites más altos o quieres mayor control.
          </p>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                BaseScan API Key
              </label>
              <input
                type="password"
                value={settings.customBasescanApiKey || ''}
                onChange={(e) => setSettings({ ...settings, customBasescanApiKey: e.target.value })}
                placeholder="Si está vacío, usa la key del platform"
                className="w-full px-3 py-2 border rounded"
              />
              <a
                href="https://basescan.org/apis"
                target="_blank"
                className="text-xs text-blue-600 hover:text-blue-700"
              >
                Obtener API key →
              </a>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Etherscan API Key
              </label>
              <input
                type="password"
                value={settings.customEtherscanApiKey || ''}
                onChange={(e) => setSettings({ ...settings, customEtherscanApiKey: e.target.value })}
                placeholder="Si está vacío, usa la key del platform"
                className="w-full px-3 py-2 border rounded"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Moralis API Key
              </label>
              <input
                type="password"
                value={settings.customMoralisApiKey || ''}
                onChange={(e) => setSettings({ ...settings, customMoralisApiKey: e.target.value })}
                placeholder="Si está vacío, usa la key del platform"
                className="w-full px-3 py-2 border rounded"
              />
              <a
                href="https://moralis.io"
                target="_blank"
                className="text-xs text-blue-600 hover:text-blue-700"
              >
                Obtener API key →
              </a>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                QuikNode URL (RPC)
              </label>
              <input
                type="url"
                value={settings.customQuiknodeUrl || ''}
                onChange={(e) => setSettings({ ...settings, customQuiknodeUrl: e.target.value })}
                placeholder="Si está vacío, usa el endpoint del platform"
                className="w-full px-3 py-2 border rounded"
              />
              <a
                href="https://www.quicknode.com"
                target="_blank"
                className="text-xs text-blue-600 hover:text-blue-700"
              >
                Obtener endpoint →
              </a>
            </div>
          </div>
        </div>

        {/* Custom Exchange Addresses */}
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
              className="w-full px-3 py-2 border rounded font-mono text-sm"
              rows={5}
            />
          </div>
        </div>

        {/* Supply Configuration */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">
            Configuración de Supply
          </h2>
          <p className="text-sm text-gray-600 mb-4">
            Define cómo obtener el supply del token (total, circulante, locked)
          </p>

          <div className="space-y-4">
            {/* Supply Method */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Método de Obtención
              </label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    checked={(settings.supplyMethod || 'API') === 'API'}
                    onChange={() => setSettings({ ...settings, supplyMethod: 'API' })}
                    className="w-4 h-4"
                  />
                  <span>API Externa</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    checked={settings.supplyMethod === 'ONCHAIN'}
                    onChange={() => setSettings({ ...settings, supplyMethod: 'ONCHAIN' })}
                    className="w-4 h-4"
                  />
                  <span>On-Chain (Calcular desde blockchain)</span>
                </label>
              </div>
            </div>

            {/* API URLs (solo si method es API) */}
            {(settings.supplyMethod || 'API') === 'API' && (
              <>
                <div>
                  <label className="block text-sm font-medium mb-1">
                    URL Total Supply
                  </label>
                  <input
                    type="url"
                    value={settings.supplyApiTotalUrl || ''}
                    onChange={(e) => setSettings({ ...settings, supplyApiTotalUrl: e.target.value })}
                    placeholder="https://api.example.com/v1/total-supply"
                    className="w-full px-3 py-2 border rounded font-mono text-sm"
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
                    className="w-full px-3 py-2 border rounded font-mono text-sm"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Endpoint que devuelve {`{ "circulatingSupply": "800000" }`}
                  </p>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded p-3">
                  <p className="text-sm text-blue-800">
                    💡 <strong>Legacy Fallback:</strong> Si dejas estos campos vacíos, se usará la API de Vottun por defecto
                  </p>
                </div>
              </>
            )}

            {/* On-Chain Info */}
            {settings.supplyMethod === 'ONCHAIN' && (
              <div className="bg-green-50 border border-green-200 rounded p-3">
                <p className="text-sm text-green-800">
                  ✅ <strong>On-Chain:</strong> El supply se calculará directamente desde el contrato ERC20 usando el método <code className="bg-green-100 px-1 rounded">totalSupply()</code>
                </p>
                <p className="text-xs text-green-700 mt-2">
                  Nota: El circulating supply será igual al total supply. Para calcular locked supply con precision, necesitarás configurar contratos de vesting.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* ABI Section */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">ABI del Token</h2>
          <p className="text-sm text-gray-600 mb-4">
            Configura el ABI del contrato. Por defecto se usa el ABI estándar ERC20.
          </p>

          <div className="space-y-4">
            <div className="flex gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  checked={abiSource === 'standard'}
                  onChange={() => setAbiSource('standard')}
                  className="w-4 h-4"
                />
                <span>ABI Estándar ERC20</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  checked={abiSource === 'custom'}
                  onChange={() => setAbiSource('custom')}
                  className="w-4 h-4"
                />
                <span>ABI Custom</span>
              </label>
            </div>

            {abiSource === 'custom' && (
              <div className="space-y-3">
                <div className="flex gap-2">
                  <button
                    onClick={handleDetectAbi}
                    disabled={detectingAbi}
                    className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50 text-sm"
                  >
                    {detectingAbi ? 'Detectando...' : 'Auto-detectar desde BaseScan'}
                  </button>
                  {customAbi && (
                    <button
                      onClick={handleDeleteAbi}
                      className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 text-sm"
                    >
                      Volver a Estándar
                    </button>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">
                    ABI JSON
                  </label>
                  <textarea
                    value={abiJson}
                    onChange={(e) => setAbiJson(e.target.value)}
                    placeholder='[{"type": "function", "name": "transfer", ...}]'
                    className="w-full px-3 py-2 border rounded font-mono text-xs"
                    rows={10}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Pega el ABI en formato JSON
                  </p>
                </div>

                {customAbi && (
                  <div className="bg-green-50 border border-green-200 rounded p-3 text-sm">
                    <p className="font-medium text-green-800">ABI Custom Configurado</p>
                    <p className="text-green-700">
                      Origen: {customAbi.source} |
                      Actualizado: {new Date(customAbi.updatedAt).toLocaleDateString()}
                    </p>
                  </div>
                )}

                <button
                  onClick={handleSaveAbi}
                  disabled={abiLoading || !abiJson}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                >
                  {abiLoading ? 'Guardando...' : 'Guardar ABI'}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Vesting Contracts Section */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Vesting Contracts</h2>
            <button
              onClick={() => setShowAddVesting(!showAddVesting)}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 text-sm"
            >
              {showAddVesting ? 'Cancelar' : '+ Agregar Contract'}
            </button>
          </div>

          {showAddVesting && (
            <div className="mb-6 p-4 bg-gray-50 rounded border space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="text"
                  placeholder="Nombre *"
                  value={newVesting.name}
                  onChange={(e) => setNewVesting({ ...newVesting, name: e.target.value })}
                  className="px-3 py-2 border rounded"
                />
                <input
                  type="text"
                  placeholder="Address (0x...) *"
                  value={newVesting.address}
                  onChange={(e) => setNewVesting({ ...newVesting, address: e.target.value })}
                  className="px-3 py-2 border rounded font-mono text-sm"
                />
                <select
                  value={newVesting.network}
                  onChange={(e) => setNewVesting({ ...newVesting, network: e.target.value })}
                  className="px-3 py-2 border rounded"
                >
                  <option value="base">Base Mainnet</option>
                  <option value="base-testnet">Base Testnet</option>
                  <option value="base-sepolia">Base Sepolia</option>
                </select>
                <input
                  type="text"
                  placeholder="Categoría (opcional)"
                  value={newVesting.category}
                  onChange={(e) => setNewVesting({ ...newVesting, category: e.target.value })}
                  className="px-3 py-2 border rounded"
                />
              </div>
              <textarea
                placeholder="Descripción (opcional)"
                value={newVesting.description}
                onChange={(e) => setNewVesting({ ...newVesting, description: e.target.value })}
                className="w-full px-3 py-2 border rounded"
                rows={2}
              />
              <button
                onClick={handleAddVesting}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Agregar Vesting Contract
              </button>
            </div>
          )}

          {vestingLoading ? (
            <p className="text-gray-500">Cargando...</p>
          ) : vestingContracts.length === 0 ? (
            <p className="text-gray-500 text-sm">
              No hay vesting contracts configurados. Agrega uno usando el botón de arriba.
            </p>
          ) : (
            <div className="space-y-2">
              {vestingContracts.map((contract) => (
                <div
                  key={contract.id}
                  className="flex items-center justify-between p-3 border rounded hover:bg-gray-50"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium">{contract.name}</h3>
                      {contract.category && (
                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                          {contract.category}
                        </span>
                      )}
                      {!contract.isActive && (
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                          Inactivo
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 font-mono mt-1">
                      {contract.address}
                    </p>
                    {contract.description && (
                      <p className="text-xs text-gray-600 mt-1">{contract.description}</p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleToggleVesting(contract.id, contract.isActive)}
                      className={`px-3 py-1 rounded text-xs ${
                        contract.isActive
                          ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
                          : 'bg-green-100 text-green-700 hover:bg-green-200'
                      }`}
                    >
                      {contract.isActive ? 'Desactivar' : 'Activar'}
                    </button>
                    <button
                      onClick={() => handleDeleteVesting(contract.id)}
                      className="px-3 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200 text-xs"
                    >
                      Eliminar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex gap-3 justify-end pt-4">
          <button
            onClick={() => router.back()}
            className="px-6 py-2 border rounded hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Guardando...' : 'Guardar Cambios'}
          </button>
        </div>
      </div>
    </div>
  );
}
