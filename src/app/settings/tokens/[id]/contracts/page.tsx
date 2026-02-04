'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';

interface Contract {
  id: string;
  name: string;
  address: string;
  network: string;
  category?: string;
  description?: string;
  isActive: boolean;
}

export default function ContractsSettingsPage() {
  const params = useParams();
  const tokenId = params.id as string;

  const [contracts, setContracts] = useState<Contract[]>([]);
  const [allAbis, setAllAbis] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showAbiModal, setShowAbiModal] = useState(false);
  const [selectedAbi, setSelectedAbi] = useState<any>(null);

  const [newContract, setNewContract] = useState({
    name: '',
    address: '',
    network: 'base',
    category: 'OTHER',
    description: ''
  });

  useEffect(() => {
    fetchData();
  }, [tokenId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [contractsRes, abisRes] = await Promise.all([
        fetch(`/api/tokens/${tokenId}/vesting-contracts`),
        fetch(`/api/tokens/${tokenId}/abis`)
      ]);

      const contractsText = await contractsRes.text();
      const abisText = await abisRes.text();

      let contractsData: { contracts: any[]; error?: string } = { contracts: [] };
      let abisData: { abis: any[]; error?: string } = { abis: [] };
      try {
        contractsData = contractsText ? JSON.parse(contractsText) : contractsData;
      } catch {
        console.error('Respuesta contratos no es JSON válido:', contractsText?.slice(0, 100));
      }
      try {
        abisData = abisText ? JSON.parse(abisText) : abisData;
      } catch {
        console.error('Respuesta ABIs no es JSON válido:', abisText?.slice(0, 100));
      }

      if (!contractsRes.ok) {
        console.error('Error contratos:', contractsData?.error || contractsRes.statusText);
      }
      if (!abisRes.ok) {
        console.error('Error ABIs:', abisData?.error || abisRes.statusText);
      }

      setContracts(contractsData.contracts || []);
      setAllAbis(abisData.abis || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      setContracts([]);
      setAllAbis([]);
    }
    setLoading(false);
  };

  const handleAddContract = async () => {
    if (!newContract.name || !newContract.address) {
      alert('Nombre y Address son requeridos');
      return;
    }

    try {
      const res = await fetch(`/api/tokens/${tokenId}/vesting-contracts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newContract)
      });

      if (res.ok) {
        alert('Contrato agregado correctamente!');
        setShowAddForm(false);
        setNewContract({ name: '', address: '', network: 'base', category: 'OTHER', description: '' });
        fetchData();
      } else {
        const data = await res.json();
        alert('Error: ' + data.error);
      }
    } catch (error: any) {
      alert('Error: ' + error.message);
    }
  };

  const handleToggleActive = async (contractId: string, isActive: boolean) => {
    try {
      await fetch(`/api/tokens/${tokenId}/vesting-contracts/${contractId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !isActive })
      });
      fetchData();
    } catch (error: any) {
      alert('Error: ' + error.message);
    }
  };

  const handleDeleteContract = async (contractId: string) => {
    if (!confirm('¿Eliminar este contrato?')) return;

    try {
      await fetch(`/api/tokens/${tokenId}/vesting-contracts/${contractId}`, {
        method: 'DELETE'
      });
      fetchData();
    } catch (error: any) {
      alert('Error: ' + error.message);
    }
  };

  const handleDetectAbi = async (contractAddress: string, network: string) => {
    try {
      const res = await fetch(`/api/tokens/${tokenId}/abis`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contractAddress,
          network,
          autoDetect: true
        })
      });

      const data = await res.json();

      if (res.ok) {
        alert(`ABI detectado! ${data.customAbi.methodCount} métodos, ${data.customAbi.eventCount} eventos`);
        fetchData();
      } else {
        alert('Error: ' + data.error);
      }
    } catch (error: any) {
      alert('Error: ' + error.message);
    }
  };

  const handleDeleteAbi = async (abiId: string) => {
    if (!confirm('¿Eliminar este ABI?')) return;

    try {
      await fetch(`/api/tokens/${tokenId}/abis/${abiId}`, {
        method: 'DELETE'
      });
      fetchData();
    } catch (error: any) {
      alert('Error: ' + error.message);
    }
  };

  if (loading) {
    return <div className="text-muted-foreground">Cargando...</div>;
  }

  return (
    <div className="max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-2xl font-bold mb-2">Contratos</h2>
          <p className="text-muted-foreground">
            Gestiona todos los contratos del token (vesting, staking, etc.) y sus ABIs
          </p>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="px-4 py-2 bg-success text-success-foreground rounded-lg hover:opacity-90 font-medium"
        >
          {showAddForm ? 'Cancelar' : '+ Agregar Contrato'}
        </button>
      </div>

      {/* Add Contract Form */}
      {showAddForm && (
        <div className="bg-card rounded-lg shadow p-6 border border-border">
          <h3 className="text-lg font-semibold mb-4">Nuevo Contrato</h3>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Nombre *
                </label>
                <input
                  type="text"
                  value={newContract.name}
                  onChange={(e) => setNewContract({ ...newContract, name: e.target.value })}
                  placeholder="Ej: Investors Vesting"
                  className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Address *
                </label>
                <input
                  type="text"
                  value={newContract.address}
                  onChange={(e) => setNewContract({ ...newContract, address: e.target.value })}
                  placeholder="0x..."
                  className="w-full px-3 py-2 border rounded font-mono text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Network
                </label>
                <select
                  value={newContract.network}
                  onChange={(e) => setNewContract({ ...newContract, network: e.target.value })}
                  className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="base">Base Mainnet</option>
                  <option value="base-testnet">Base Testnet</option>
                  <option value="base-sepolia">Base Sepolia</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Categoría
                </label>
                <select
                  value={newContract.category}
                  onChange={(e) => setNewContract({ ...newContract, category: e.target.value })}
                  className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="VESTING">Vesting</option>
                  <option value="STAKING">Staking</option>
                  <option value="LIQUIDITY">Liquidity Pool</option>
                  <option value="DAO">DAO</option>
                  <option value="TREASURY">Treasury</option>
                  <option value="MARKETING">Marketing</option>
                  <option value="TEAM">Team</option>
                  <option value="OTHER">Otro</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Descripción (opcional)
              </label>
              <textarea
                value={newContract.description}
                onChange={(e) => setNewContract({ ...newContract, description: e.target.value })}
                placeholder="Información adicional sobre este contrato..."
                className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                rows={3}
              />
            </div>

            <button
              onClick={handleAddContract}
              className="px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 font-medium"
            >
              Agregar Contrato
            </button>
          </div>
        </div>
      )}

      {/* Contracts List */}
      {contracts.length === 0 ? (
        <div className="bg-card rounded-lg shadow p-12 text-center border border-border">
          <div className="text-6xl mb-4">📦</div>
          <p className="text-gray-600 mb-4">
            No hay contratos configurados todavía
          </p>
          <button
            onClick={() => setShowAddForm(true)}
            className="px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 font-medium"
          >
            Agregar Primer Contrato
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {contracts.map((contract) => {
            const contractAbi = allAbis.find(
              abi => abi.contractAddress.toLowerCase() === contract.address.toLowerCase() &&
                     abi.network === contract.network
            );

            return (
              <div
                key={contract.id}
                className="bg-card rounded-lg shadow p-5 hover:shadow-md transition-shadow border border-border"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-semibold text-lg">{contract.name}</h3>
                      {contract.category && (
                        <span className="text-xs bg-accent text-accent-foreground px-2 py-1 rounded font-medium">
                          {contract.category}
                        </span>
                      )}
                      {!contract.isActive && (
                        <span className="text-xs bg-muted text-muted-foreground px-2 py-1 rounded font-medium">
                          Inactivo
                        </span>
                      )}
                      <span className="text-xs bg-muted text-muted-foreground px-2 py-1 rounded font-medium">
                        {contract.network}
                      </span>
                    </div>

                    <p className="text-xs text-gray-500 font-mono mb-2">
                      {contract.address}
                    </p>

                    {contract.description && (
                      <p className="text-sm text-muted-foreground mb-3">{contract.description}</p>
                    )}

                    {/* ABI Status */}
                    <div className="flex items-center gap-2 text-sm">
                      {contractAbi ? (
                        <>
                          <span className="text-success font-medium">✓ ABI Configurado</span>
                          <span className="text-muted-foreground">
                            ({contractAbi.source} | {contractAbi.methodCount || 0} métodos)
                          </span>
                        </>
                      ) : (
                        <>
                          <span className="text-warning font-medium">⚠ Sin ABI custom</span>
                          <span className="text-muted-foreground">(usando ABI estándar)</span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="ml-4 flex flex-col gap-2">
                    {/* ABI Actions */}
                    <div className="flex gap-2">
                      {contractAbi ? (
                        <>
                          <button
                            onClick={() => {
                              setSelectedAbi(contractAbi);
                              setShowAbiModal(true);
                            }}
                            className="px-3 py-1.5 bg-purple-100 text-purple-700 rounded hover:bg-purple-200 text-xs font-medium"
                            title="Ver ABI"
                          >
                            Ver ABI
                          </button>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(JSON.stringify(contractAbi.abi, null, 2));
                              alert('ABI copiado!');
                            }}
                            className="px-3 py-1.5 bg-accent text-accent-foreground rounded hover:opacity-80 text-xs font-medium"
                            title="Copiar ABI"
                          >
                            Copiar
                          </button>
                          <button
                            onClick={() => handleDeleteAbi(contractAbi.id)}
                            className="px-3 py-1.5 bg-destructive/10 text-destructive rounded hover:bg-destructive/20 text-xs font-medium"
                            title="Eliminar ABI"
                          >
                            🗑
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => handleDetectAbi(contract.address, contract.network)}
                          className="px-3 py-1.5 bg-purple-600 text-white rounded hover:bg-purple-700 text-xs font-medium"
                        >
                          Auto-detectar ABI
                        </button>
                      )}
                    </div>

                    {/* Contract Actions */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleToggleActive(contract.id, contract.isActive)}
                        className={`px-3 py-1.5 rounded text-xs font-medium ${
                          contract.isActive
                            ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
                            : 'bg-success/10 text-success hover:opacity-80'
                        }`}
                      >
                        {contract.isActive ? 'Desactivar' : 'Activar'}
                      </button>
                      <button
                        onClick={() => handleDeleteContract(contract.id)}
                        className="px-3 py-1.5 bg-destructive/10 text-destructive rounded hover:bg-destructive/20 text-xs font-medium"
                      >
                        Eliminar
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ABI Modal */}
      {showAbiModal && selectedAbi && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b flex justify-between items-center">
              <div>
                <h3 className="text-xl font-semibold">ABI - {selectedAbi.contractAddress}</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {selectedAbi.source} | {selectedAbi.network} | Métodos: {selectedAbi.methodCount || 0}
                </p>
              </div>
              <button
                onClick={() => {
                  setShowAbiModal(false);
                  setSelectedAbi(null);
                }}
                className="text-muted-foreground hover:text-card-foreground text-3xl leading-none"
              >
                ×
              </button>
            </div>
            <div className="p-6 overflow-auto flex-1">
              <pre className="bg-background p-4 rounded border text-xs font-mono overflow-x-auto">
                {JSON.stringify(selectedAbi.abi, null, 2)}
              </pre>
            </div>
            <div className="p-4 border-t flex gap-2 justify-end">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(JSON.stringify(selectedAbi.abi, null, 2));
                  alert('ABI copiado al portapapeles!');
                }}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 font-medium"
              >
                Copiar ABI
              </button>
              <button
                onClick={() => {
                  setShowAbiModal(false);
                  setSelectedAbi(null);
                }}
                className="px-4 py-2 border border-border rounded-lg hover:bg-muted font-medium"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
