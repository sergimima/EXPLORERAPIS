'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';

export default function TokensSettings() {
  const { data: session } = useSession();
  const [tokens, setTokens] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);

  useEffect(() => {
    fetchTokens();
  }, []);

  const fetchTokens = async () => {
    const res = await fetch('/api/tokens');
    const data = await res.json();
    setTokens(data);
    setLoading(false);
  };

  const handleDelete = async (tokenId: string) => {
    if (!confirm('¿Eliminar este token? Se perderán todos los datos asociados.')) {
      return;
    }

    await fetch(`/api/tokens?id=${tokenId}`, { method: 'DELETE' });
    fetchTokens();
  };

  if (loading) return <div className="p-6">Cargando...</div>;

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Tokens</h1>
        <button
          onClick={() => setShowAddModal(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          + Agregar Token
        </button>
      </div>

      {tokens.length === 0 ? (
        <div className="bg-gray-50 border-2 border-dashed rounded-lg p-12 text-center">
          <div className="text-6xl mb-4">🪙</div>
          <h3 className="text-xl font-semibold mb-2">
            No hay tokens configurados
          </h3>
          <p className="text-gray-600 mb-4">
            Agrega tu primer token ERC20 para empezar a analizar
          </p>
          <button
            onClick={() => setShowAddModal(true)}
            className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700"
          >
            Agregar Token
          </button>
        </div>
      ) : (
        <div className="grid gap-4">
          {tokens.map((token) => (
            <div key={token.id} className="bg-white border rounded-lg p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold">
                      {token.symbol.substring(0, 2)}
                    </div>
                    <div>
                      <h3 className="text-xl font-bold">{token.symbol}</h3>
                      <p className="text-gray-600">{token.name}</p>
                    </div>
                    {token.isActive && (
                      <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs">
                        Activo
                      </span>
                    )}
                    {token.isVerified && (
                      <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs">
                        ✓ Verificado
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4 mt-4 text-sm">
                    <div>
                      <span className="text-gray-500">Address:</span>
                      <div className="font-mono text-xs mt-1 break-all">
                        {token.address}
                      </div>
                    </div>
                    <div>
                      <span className="text-gray-500">Network:</span>
                      <div className="mt-1 capitalize">{token.network}</div>
                    </div>
                    <div>
                      <span className="text-gray-500">Decimals:</span>
                      <div className="mt-1">{token.decimals}</div>
                    </div>
                    <div>
                      <span className="text-gray-500">Whale Threshold:</span>
                      <div className="mt-1">
                        {Number(token.settings?.whaleThreshold || 0).toLocaleString()} {token.symbol}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => window.location.href = `/settings/tokens/${token.id}`}
                    className="text-blue-600 hover:text-blue-700 px-3 py-1 border rounded"
                  >
                    Configurar
                  </button>
                  <button
                    onClick={() => handleDelete(token.id)}
                    className="text-red-600 hover:text-red-700 px-3 py-1 border rounded"
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showAddModal && (
        <AddTokenModal
          onClose={() => setShowAddModal(false)}
          onSuccess={() => {
            setShowAddModal(false);
            fetchTokens();
          }}
        />
      )}
    </div>
  );
}

// Modal para agregar token
function AddTokenModal({ onClose, onSuccess }: any) {
  const [address, setAddress] = useState('');
  const [network, setNetwork] = useState('base');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/tokens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address, network })
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Error al agregar token');
        return;
      }

      onSuccess();
    } catch (err) {
      setError('Error al agregar token');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-md w-full p-6">
        <h2 className="text-2xl font-bold mb-4">Agregar Token</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-red-50 text-red-600 p-3 rounded">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1">
              Contract Address
            </label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="0x..."
              className="w-full px-3 py-2 border rounded"
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              Address del contrato ERC20 del token
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Network
            </label>
            <select
              value={network}
              onChange={(e) => setNetwork(e.target.value)}
              className="w-full px-3 py-2 border rounded"
            >
              <option value="base">Base Mainnet</option>
              <option value="base-testnet">Base Testnet (Goerli)</option>
              <option value="base-sepolia">Base Sepolia</option>
            </select>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded p-3">
            <p className="text-sm text-blue-800">
              💡 Verificaremos on-chain que el token existe y obtendremos automáticamente el nombre, símbolo y decimales.
            </p>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border rounded hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Verificando...' : 'Agregar Token'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
