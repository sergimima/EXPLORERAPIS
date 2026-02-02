'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Network } from '@/lib/types';
import dynamic from 'next/dynamic';
import NetworkSelector from '@/components/NetworkSelector';
import WalletInput from '@/components/WalletInput';
import TokenFilter from '@/components/TokenFilter';
import TokenBalance from '@/components/TokenBalance';
import TokenTransfersList from '@/components/TokenTransfersList';
import VestingInfo from '@/components/VestingInfo';
import VestingSummary from '@/components/VestingSummary';
import AirdropAssignments from '@/components/AirdropAssignments';
import VestingContractList from '../explorer/vestings/components/VestingContractList';
import { fetchTokenTransfers } from '@/lib/blockchain';
import { clearWalletCache } from '@/actions/wallet';

// Importar dinámicamente componentes pesados
const TokenSupplyCard = dynamic(
  () => import('../explorer/vestings/components/TokenSupplyCard'),
  { ssr: false, loading: () => <div className="h-40 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse mb-8"></div> }
);

// Importar Analytics de forma dinámica para mejor performance
const AnalyticsContent = dynamic(
  () => import('../explorer/analytics/page'),
  { ssr: false, loading: () => <div className="text-center py-8">Cargando Analytics...</div> }
);

export default function UnifiedExplorer() {
  const searchParams = useSearchParams();

  // Estado principal
  const [activeTab, setActiveTab] = useState<'tokens' | 'vestings' | 'analytics'>('tokens');
  const [wallet, setWallet] = useState<string>('');
  const [network, setNetwork] = useState<Network>('base');
  const [tokenFilter, setTokenFilter] = useState<string>('');
  const [contractAddress, setContractAddress] = useState('');
  const [showContractDetails, setShowContractDetails] = useState(false);

  // Leer parámetros URL al cargar (soportar redirecciones desde /explorer/tokens)
  useEffect(() => {
    const tabParam = searchParams.get('tab');
    const walletParam = searchParams.get('wallet');

    // Setear tab si viene en URL
    if (tabParam && (tabParam === 'tokens' || tabParam === 'vestings' || tabParam === 'analytics')) {
      setActiveTab(tabParam);
    }

    // Setear wallet si viene en URL y auto-buscar
    if (walletParam) {
      setWallet(walletParam);
      // Trigger búsqueda automática después de setear wallet
      setTimeout(() => {
        const searchButton = document.querySelector('button[type="submit"]') as HTMLButtonElement;
        if (searchButton) {
          searchButton.click();
        }
      }, 100);
    }
  }, [searchParams]);

  // Estados para la sección de tokens
  const [transfers, setTransfers] = useState<any[]>([]);
  const [tokenBalances, setTokenBalances] = useState<any[]>([]);
  const [vestingSchedules, setVestingSchedules] = useState<any[]>([]);
  const [airdropData, setAirdropData] = useState<{ tokens: any[], points: any[] }>({ tokens: [], points: [] });

  // Estados de carga
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loadingStates, setLoadingStates] = useState<{
    transfers: boolean;
    balances: boolean;
    vesting: boolean;
    airdrops: boolean;
  }>({
    transfers: false,
    balances: false,
    vesting: false,
    airdrops: false
  });

  const [error, setError] = useState<string | null>(null);
  const [dataFetched, setDataFetched] = useState<{
    transfers: boolean;
    balances: boolean;
    vesting: boolean;
    airdrops: boolean;
  }>({
    transfers: false,
    balances: false,
    vesting: false,
    airdrops: false
  });

  const [searchCount, setSearchCount] = useState<number>(0);
  const [tokenSubTab, setTokenSubTab] = useState<string>('balance');

  // Función para buscar datos de tokens
  const handleTokenSearch = async () => {
    if (!wallet) {
      setError('Por favor, introduce una dirección de wallet válida');
      return;
    }

    setSearchCount(prev => prev + 1);
    setTransfers([]);
    setTokenBalances([]);
    setVestingSchedules([]);
    setAirdropData({ tokens: [], points: [] });

    setIsLoading(true);
    setError(null);

    setLoadingStates({
      transfers: true,
      balances: true,
      vesting: true,
      airdrops: true
    });

    try {
      const transfersPromise = fetchTokenTransfers(wallet, network, tokenFilter)
        .then(data => {
          setTransfers(data);
          setDataFetched(prev => ({ ...prev, transfers: true }));
          setLoadingStates(prev => ({ ...prev, transfers: false }));
          return data;
        })
        .catch(err => {
          console.error("Error al cargar transferencias:", err);
          setLoadingStates(prev => ({ ...prev, transfers: false }));
          return [];
        });

      const balancesPromise = import('@/lib/blockchain').then(module => {
        return module.fetchTokenBalances(wallet, network)
          .then(data => {
            setTokenBalances(data);
            setDataFetched(prev => ({ ...prev, balances: true }));
            setLoadingStates(prev => ({ ...prev, balances: false }));
            return data;
          })
          .catch(err => {
            console.error("Error al cargar balances:", err);
            setLoadingStates(prev => ({ ...prev, balances: false }));
            return [];
          });
      });

      setDataFetched(prev => ({ ...prev, vesting: false }));
      setLoadingStates(prev => ({ ...prev, vesting: false }));

      const airdropsPromise = Promise.resolve()
        .then(() => {
          setDataFetched(prev => ({ ...prev, airdrops: true }));
          setLoadingStates(prev => ({ ...prev, airdrops: false }));
          return { tokens: [], points: [] };
        });

      await Promise.all([transfersPromise, balancesPromise, airdropsPromise]);
    } catch (err) {
      setError('Error al obtener los datos. Por favor, inténtalo de nuevo.');
      console.error("Error general:", err);
    } finally {
      setIsLoading(false);
      setLoadingStates({
        transfers: false,
        balances: false,
        vesting: false,
        airdrops: false
      });
    }
  };

  const handleAddressClick = (address: string) => {
    setWallet(address);
    setSearchCount(prev => prev + 1);
    setTransfers([]);
    setTokenBalances([]);
    setVestingSchedules([]);
    setAirdropData({ tokens: [], points: [] });
    setDataFetched({
      transfers: false,
      balances: false,
      vesting: false,
      airdrops: false
    });
    handleTokenSearch();
  };

  // Función para actualizar solo transferencias (incremental)
  const handleRefreshTransfers = async () => {
    if (!wallet) return;

    setLoadingStates(prev => ({ ...prev, transfers: true }));

    try {
      const data = await fetchTokenTransfers(wallet, network, tokenFilter);
      setTransfers(data);
      setDataFetched(prev => ({ ...prev, transfers: true }));
      console.log("Transferencias actualizadas:", data.length);
    } catch (err) {
      console.error("Error al actualizar transferencias:", err);
    } finally {
      setLoadingStates(prev => ({ ...prev, transfers: false }));
    }
  };

  // Función para limpiar caché y recargar todo (full refresh)
  const handleClearCache = async () => {
    if (!wallet) return;

    if (!confirm('¿Estás seguro de que quieres borrar el caché y recargar todas las transferencias? Esto puede tardar unos segundos.')) {
      return;
    }

    setLoadingStates(prev => ({ ...prev, transfers: true }));

    try {
      // 1. Limpiar caché
      await clearWalletCache(wallet);
      console.log("Caché limpiado");

      // 2. Recargar transferencias (esto buscará todo de nuevo en la API)
      const transfersData = await fetchTokenTransfers(wallet, network, tokenFilter);
      setTransfers(transfersData);
      setDataFetched(prev => ({ ...prev, transfers: true }));

      // 3. Recargar balances también (para arreglar los nombres UNKNOWN)
      setLoadingStates(prev => ({ ...prev, balances: true }));
      const { fetchTokenBalances } = await import('@/lib/blockchain');
      const balancesData = await fetchTokenBalances(wallet, network);
      setTokenBalances(balancesData);
      setDataFetched(prev => ({ ...prev, balances: true }));

      console.log("Datos recargados tras limpiar caché");
    } catch (err) {
      console.error("Error al limpiar caché y recargar:", err);
      setError("Error al limpiar el caché. Por favor intenta de nuevo.");
    } finally {
      setLoadingStates(prev => ({ ...prev, transfers: false, balances: false }));
    }
  };

  // Función para cambiar desde Analytics al tab de Tokens con una wallet específica
  const handleWalletFromAnalytics = async (address: string) => {
    // Establecer la wallet
    setWallet(address);
    // Cambiar al tab de tokens
    setActiveTab('tokens');

    // Preparar para nueva búsqueda
    setSearchCount(prev => prev + 1);
    setTransfers([]);
    setTokenBalances([]);
    setVestingSchedules([]);
    setAirdropData({ tokens: [], points: [] });

    setIsLoading(true);
    setError(null);

    setLoadingStates({
      transfers: true,
      balances: true,
      vesting: true,
      airdrops: true
    });

    try {
      const transfersPromise = fetchTokenTransfers(address, network, tokenFilter)
        .then(data => {
          setTransfers(data);
          setDataFetched(prev => ({ ...prev, transfers: true }));
          setLoadingStates(prev => ({ ...prev, transfers: false }));
          return data;
        })
        .catch(err => {
          console.error("Error al cargar transferencias:", err);
          setLoadingStates(prev => ({ ...prev, transfers: false }));
          return [];
        });

      const balancesPromise = import('@/lib/blockchain').then(module => {
        return module.fetchTokenBalances(address, network)
          .then(data => {
            setTokenBalances(data);
            setDataFetched(prev => ({ ...prev, balances: true }));
            setLoadingStates(prev => ({ ...prev, balances: false }));
            return data;
          })
          .catch(err => {
            console.error("Error al cargar balances:", err);
            setLoadingStates(prev => ({ ...prev, balances: false }));
            return [];
          });
      });

      setDataFetched(prev => ({ ...prev, vesting: false }));
      setLoadingStates(prev => ({ ...prev, vesting: false }));

      const airdropsPromise = Promise.resolve()
        .then(() => {
          setDataFetched(prev => ({ ...prev, airdrops: true }));
          setLoadingStates(prev => ({ ...prev, airdrops: false }));
          return { tokens: [], points: [] };
        });

      await Promise.all([transfersPromise, balancesPromise, airdropsPromise]);
    } catch (err) {
      setError('Error al obtener los datos. Por favor, inténtalo de nuevo.');
      console.error("Error general:", err);
    } finally {
      setIsLoading(false);
      setLoadingStates({
        transfers: false,
        balances: false,
        vesting: false,
        airdrops: false
      });
    }
  };

  const loadingProgress = Object.values(loadingStates).filter(state => !state).length / 4 * 100;

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-4xl font-bold mb-8">Blockchain Explorer Dashboard</h1>

      {/* Navegación Principal por Tabs */}
      <div className="bg-white rounded-lg shadow-md mb-6">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6" aria-label="Tabs">
            <button
              onClick={() => setActiveTab('tokens')}
              className={`py-4 px-1 border-b-2 font-medium text-lg transition-colors ${activeTab === 'tokens'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
            >
              🪙 Tokens & Balances
            </button>
            <button
              onClick={() => setActiveTab('vestings')}
              className={`py-4 px-1 border-b-2 font-medium text-lg transition-colors ${activeTab === 'vestings'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
            >
              🔒 Vesting Contracts
            </button>
            <button
              onClick={() => setActiveTab('analytics')}
              className={`py-4 px-1 border-b-2 font-medium text-lg transition-colors ${activeTab === 'analytics'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
            >
              📊 Analytics
            </button>
          </nav>
        </div>
      </div>

      {/* Contenido según el tab activo */}
      {activeTab === 'tokens' && (
        <div>
          {/* Controles de búsqueda */}
          <div className="bg-white p-6 rounded-lg shadow-md mb-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <WalletInput value={wallet} onChange={setWallet} />
              <NetworkSelector value={network} onChange={setNetwork} />
              <TokenFilter value={tokenFilter} onChange={setTokenFilter} />
              <div className="flex items-end">
                <button
                  onClick={handleTokenSearch}
                  disabled={isLoading}
                  className="btn-primary w-full"
                >
                  {isLoading ? 'Buscando...' : 'Buscar'}
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
                {error}
              </div>
            )}

            {isLoading && (
              <div className="mt-4 mb-4">
                <p className="text-sm text-gray-600 mb-2">Cargando datos... ({Math.round(loadingProgress)}%)</p>
                <div className="w-full bg-gray-200 rounded-full h-2.5">
                  <div
                    className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
                    style={{ width: `${loadingProgress}%` }}
                  ></div>
                </div>
              </div>
            )}
          </div>

          {/* Sub-tabs para diferentes vistas de tokens */}
          <div className="bg-white rounded-lg shadow-md">
            <div className="border-b border-gray-200">
              <nav className="flex space-x-8 px-6" aria-label="Token tabs">
                <button
                  onClick={() => setTokenSubTab('balance')}
                  className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${tokenSubTab === 'balance'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                >
                  Balance de Tokens
                </button>
                <button
                  onClick={() => setTokenSubTab('transfers')}
                  className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${tokenSubTab === 'transfers'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                >
                  Transferencias
                </button>
                <button
                  onClick={() => setTokenSubTab('vesting')}
                  className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${tokenSubTab === 'vesting'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                >
                  Información de Vesting
                </button>
                <button
                  onClick={() => setTokenSubTab('vestingSummary')}
                  className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${tokenSubTab === 'vestingSummary'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                >
                  Resumen de Vesting
                </button>
                <button
                  onClick={() => setTokenSubTab('airdrops')}
                  className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${tokenSubTab === 'airdrops'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                >
                  Airdrops
                </button>
              </nav>
            </div>

            <div className="p-6">
              {tokenSubTab === 'balance' && (
                <TokenBalance
                  walletAddress={wallet}
                  network={network}
                  isLoading={loadingStates.balances}
                  searchTriggered={searchCount}
                  preloadedData={dataFetched.balances ? tokenBalances : undefined}
                />
              )}
              {tokenSubTab === 'transfers' && (
                <TokenTransfersList
                  transfers={transfers}
                  isLoading={loadingStates.transfers}
                  onAddressClick={handleAddressClick}
                  onRefresh={handleRefreshTransfers}
                  onClearCache={handleClearCache}
                />
              )}
              {tokenSubTab === 'vesting' && (
                <VestingInfo
                  walletAddress={wallet}
                  network={network}
                  isLoading={loadingStates.vesting}
                  searchTriggered={searchCount}
                  preloadedData={dataFetched.vesting ? vestingSchedules : undefined}
                />
              )}
              {tokenSubTab === 'vestingSummary' && (
                <VestingSummary
                  network={network}
                />
              )}
              {tokenSubTab === 'airdrops' && (
                <AirdropAssignments
                  walletAddress={wallet}
                  network={network}
                  isLoading={loadingStates.airdrops}
                  searchTriggered={searchCount}
                  preloadedData={dataFetched.airdrops ? airdropData : undefined}
                />
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'vestings' && (
        <div>
          {/* Sección de Información de Suministro */}
          <div className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">Información del Suministro</h2>
            <TokenSupplyCard />
          </div>

          {/* Lista de contratos de vesting predefinidos */}
          <VestingContractList
            network={network}
            onSelectContract={(address) => {
              setContractAddress(address);
              setShowContractDetails(false);
              setTimeout(() => setShowContractDetails(true), 50);
            }}
          />

          {/* Campo para ingresar dirección de contrato manualmente */}
          <div className="bg-white p-6 rounded-lg shadow-md mb-8">
            <div className="mb-6">
              <label htmlFor="contract-address" className="block text-sm font-medium text-gray-700 mb-2">
                Dirección del Contrato de Vesting
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  id="contract-address"
                  value={contractAddress}
                  onChange={(e) => {
                    setContractAddress(e.target.value);
                    setShowContractDetails(false);
                  }}
                  placeholder="0x..."
                  className="flex-1 p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 bg-white"
                />
              </div>
              <p className="mt-1 text-sm text-gray-500">
                Ingresa la dirección del contrato de vesting para ver su estado.
              </p>
              <div className="mt-4">
                <button
                  onClick={() => {
                    console.log("🔍 Botón 'Buscar Contrato' clickeado. Dirección:", contractAddress);
                    setShowContractDetails(true);
                    console.log("✅ showContractDetails establecido a true");
                  }}
                  disabled={!contractAddress}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  Buscar Contrato
                </button>
              </div>
            </div>
          </div>


          {(() => {
            console.log("🔍 Debug VestingSummary:");
            console.log("  - showContractDetails:", showContractDetails);
            console.log("  - contractAddress:", contractAddress);
            console.log("  - Condición cumplida:", showContractDetails && contractAddress);
            return null;
          })()}

          {showContractDetails && contractAddress && (
            <div className="mt-8">
              <VestingSummary
                network={network}
                initialContractAddress={contractAddress}
                hideSearchBar={true}
              />
            </div>
          )}
        </div>
      )}

      {activeTab === 'analytics' && (
        <div>
          <AnalyticsContent />
        </div>
      )}
    </div>
  );
}
