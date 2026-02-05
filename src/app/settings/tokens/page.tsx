'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Avatar from '@/components/Avatar';

export default function TokensSettings() {
  const { data: session } = useSession();
  const router = useRouter();
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Cargando tokens...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-card-foreground">Tokens</h1>
        <p className="text-muted-foreground mt-2">
          Gestiona los tokens ERC20 de tu organización
        </p>
      </div>

      {tokens.length === 0 ? (
        <div className="bg-card border-2 border-dashed border-border rounded-lg p-12 text-center">
          <div className="text-6xl mb-4">🪙</div>
          <h3 className="text-xl font-semibold mb-2 text-card-foreground">
            No hay tokens configurados
          </h3>
          <p className="text-muted-foreground mb-6">
            Agrega tu primer token ERC20 para empezar a analizar transacciones, holders y métricas avanzadas
          </p>
          <button
            onClick={() => setShowAddModal(true)}
            className="bg-primary text-primary-foreground px-6 py-3 rounded-lg hover:opacity-90 font-medium inline-flex items-center gap-2"
          >
            <span>➕</span>
            Agregar Token
          </button>
        </div>
      ) : (
        <>
          <div className="flex justify-end mb-4">
            <button
              onClick={() => setShowAddModal(true)}
              className="bg-primary text-primary-foreground px-4 py-2 rounded-lg hover:opacity-90 inline-flex items-center gap-2"
            >
              <span>➕</span>
              Agregar Token
            </button>
          </div>

          <div className="grid gap-4">
            {tokens.map((token) => (
              <div key={token.id} className="bg-card border border-border rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-4 mb-4">
                      <Avatar
                        src={token.logoUrl}
                        name={token.symbol}
                        size="lg"
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-xl font-bold text-card-foreground">{token.symbol}</h3>
                          {token.isActive && (
                            <span className="bg-success/10 text-success px-2 py-0.5 rounded text-xs font-medium">
                              ✓ Activo
                            </span>
                          )}
                          {token.isVerified && (
                            <span className="bg-accent text-accent-foreground px-2 py-0.5 rounded text-xs font-medium">
                              ✓ Verificado
                            </span>
                          )}
                        </div>
                        <p className="text-muted-foreground">{token.name}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                      <div className="bg-background rounded-lg p-3">
                        <span className="text-muted-foreground text-xs font-medium block mb-1">Contract Address</span>
                        <div className="font-mono text-xs break-all text-card-foreground">
                          {token.address}
                        </div>
                      </div>
                      <div className="bg-background rounded-lg p-3">
                        <span className="text-muted-foreground text-xs font-medium block mb-1">Network</span>
                        <div className="capitalize text-card-foreground">{token.network}</div>
                      </div>
                      <div className="bg-background rounded-lg p-3">
                        <span className="text-muted-foreground text-xs font-medium block mb-1">Decimals</span>
                        <div className="text-card-foreground">{token.decimals}</div>
                      </div>
                      <div className="bg-background rounded-lg p-3">
                        <span className="text-muted-foreground text-xs font-medium block mb-1">Whale Threshold</span>
                        <div className="text-card-foreground">
                          {Number(token.settings?.whaleThreshold || 0).toLocaleString()} {token.symbol}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 ml-6">
                    <button
                      onClick={() => router.push(`/settings/tokens/${token.id}`)}
                      className="text-primary hover:opacity-80 px-4 py-2 border border-primary rounded-lg hover:bg-accent font-medium text-sm whitespace-nowrap"
                    >
                      ⚙️ Configurar
                    </button>
                    <button
                      onClick={() => handleDelete(token.id)}
                      className="text-destructive hover:opacity-80 px-4 py-2 border border-destructive rounded-lg hover:bg-destructive/10 font-medium text-sm"
                    >
                      🗑️ Eliminar
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
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
      <div className="bg-card rounded-lg max-w-md w-full p-6 shadow-xl border border-border">
        <h2 className="text-2xl font-bold mb-4 text-card-foreground">Agregar Token</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-destructive/10 border border-destructive text-destructive p-3 rounded-lg">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Contract Address
            </label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="0x..."
              className="w-full px-4 py-2 border border-input rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent bg-background text-foreground"
              required
            />
            <p className="text-xs text-muted-foreground mt-1">
              Address del contrato ERC20 del token
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Network
            </label>
            <select
              value={network}
              onChange={(e) => setNetwork(e.target.value)}
              className="w-full px-4 py-2 border border-input rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent bg-background text-foreground"
            >
              <option value="base">Base Mainnet</option>
              <option value="base-testnet">Base Testnet (Goerli)</option>
              <option value="base-sepolia">Base Sepolia</option>
            </select>
          </div>

          <div className="bg-accent border border-border rounded-lg p-4">
            <p className="text-sm text-muted-foreground">
              💡 <strong>Verificación automática:</strong> Validaremos on-chain que el token existe y obtendremos automáticamente el nombre, símbolo y decimales.
            </p>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-input rounded-lg hover:bg-muted font-medium bg-background text-foreground"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-primary text-primary-foreground px-4 py-2 rounded-lg hover:opacity-90 disabled:opacity-50 font-medium"
            >
              {loading ? 'Verificando...' : 'Agregar Token'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
