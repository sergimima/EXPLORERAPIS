'use client';

import { useState} from 'react';
import { fetchTokenTransfers } from '@/lib/blockchain';
import NetworkSelector from '@/components/NetworkSelector';
import TokenTransfersList from '@/components/TokenTransfersList';
import WalletInput from '@/components/WalletInput';
import TokenFilter from '@/components/TokenFilter';
import TabsContainer from '@/components/TabsContainer';
import VestingInfo from '@/components/VestingInfo';
import TokenBalance from '@/components/TokenBalance';
import AirdropAssignments from '@/components/AirdropAssignments';
import { Network } from '@/lib/types';

export default function TokenExplorer() {
  const [wallet, setWallet] = useState<string>('');
  const [network, setNetwork] = useState<Network>('base');
  const [tokenFilter, setTokenFilter] = useState<string>('');

  // Estados compartidos para almacenar los resultados de cada componente
  const [transfers, setTransfers] = useState<any[]>([]);
  const [tokenBalances, setTokenBalances] = useState<any[]>([]);
  const [vestingSchedules, setVestingSchedules] = useState<any[]>([]);
  const [airdropData, setAirdropData] = useState<{tokens: any[], points: any[]}>({tokens: [], points: []});

  // Estados de carga separados para cada tipo de datos
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

  // Estados de carga y error
  const [error, setError] = useState<string | null>(null);

  // Estado para controlar si ya se ha buscado cada tipo de dato
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

  const [activeTab, setActiveTab] = useState<string>('balance');

  // Estado para contar las búsquedas
  const [searchCount, setSearchCount] = useState<number>(0);

  // Función para buscar todos los datos a la vez
  const handleSearch = async () => {
    if (!wallet) {
      setError('Por favor, introduce una dirección de wallet válida');
      return;
    }

    // Incrementar el contador de búsquedas para forzar la actualización de los componentes
    setSearchCount(prev => prev + 1);

    // Limpiar datos anteriores para evitar confusión
    setTransfers([]);
    setTokenBalances([]);
    setVestingSchedules([]);
    setAirdropData({tokens: [], points: []});

    setIsLoading(true);
    setError(null);

    // Inicializar estados de carga
    setLoadingStates({
      transfers: true,
      balances: true,
      vesting: true,
      airdrops: true
    });

    try {
      // Buscar transferencias
      const transfersPromise = fetchTokenTransfers(wallet, network, tokenFilter)
        .then(data => {
          setTransfers(data);
          setDataFetched(prev => ({...prev, transfers: true}));
          setLoadingStates(prev => ({...prev, transfers: false}));
          console.log("Transferencias cargadas:", data.length);
          return data;
        })
        .catch(err => {
          console.error("Error al cargar transferencias:", err);
          setLoadingStates(prev => ({...prev, transfers: false}));
          return [];
        });

      // Buscar balances (importamos la función desde el componente)
      const balancesPromise = import('@/lib/blockchain').then(module => {
        return module.fetchTokenBalances(wallet, network)
          .then(data => {
            setTokenBalances(data);
            setDataFetched(prev => ({...prev, balances: true}));
            setLoadingStates(prev => ({...prev, balances: false}));
            console.log("Balances cargados:", data.length);
            return data;
          })
          .catch(err => {
            console.error("Error al cargar balances:", err);
            setLoadingStates(prev => ({...prev, balances: false}));
            return [];
          });
      });

      // Ya no buscamos vesting automáticamente, solo marcamos como no cargado
      setDataFetched(prev => ({...prev, vesting: false}));
      setLoadingStates(prev => ({...prev, vesting: false}));
      console.log("Vesting no cargado automáticamente, debe usar el botón específico");

      // Buscar airdrops (simulado, ya que no tenemos la función real)
      const airdropsPromise = Promise.resolve()
        .then(() => {
          // Aquí iría la llamada real a la API de airdrops
          // Por ahora, solo marcamos como cargado
          setDataFetched(prev => ({...prev, airdrops: true}));
          setLoadingStates(prev => ({...prev, airdrops: false}));
          console.log("Airdrops cargados");
          return {tokens: [], points: []};
        });

      // Esperar a que todas las promesas se resuelvan
      await Promise.all([transfersPromise, balancesPromise, airdropsPromise]);

      console.log("Todos los datos cargados correctamente");
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

    // Incrementar el contador de búsquedas para forzar la actualización de los componentes
    setSearchCount(prev => prev + 1);

    // Limpiar datos anteriores para evitar confusión
    setTransfers([]);
    setTokenBalances([]);
    setVestingSchedules([]);
    setAirdropData({tokens: [], points: []});

    // Resetear los estados de datos cargados
    setDataFetched({
      transfers: false,
      balances: false,
      vesting: false,
      airdrops: false
    });

    // Iniciar nueva búsqueda
    handleSearch();
  };

  // Componentes con datos precargados
  const balanceComponent = (
    <TokenBalance 
      walletAddress={wallet} 
      network={network} 
      isLoading={loadingStates.balances}
      searchTriggered={searchCount}
      preloadedData={dataFetched.balances ? tokenBalances : undefined}
    />
  );

  const transfersComponent = (
    <TokenTransfersList 
      transfers={transfers} 
      isLoading={loadingStates.transfers} 
      onAddressClick={handleAddressClick}
    />
  );

  const vestingComponent = (
    <VestingInfo 
      walletAddress={wallet} 
      network={network} 
      isLoading={loadingStates.vesting}
      searchTriggered={searchCount}
      preloadedData={dataFetched.vesting ? vestingSchedules : undefined}
    />
  );

  const airdropsComponent = (
    <AirdropAssignments 
      walletAddress={wallet} 
      network={network} 
      isLoading={loadingStates.airdrops}
      searchTriggered={searchCount}
      preloadedData={dataFetched.airdrops ? airdropData : undefined}
    />
  );

  const tabs = [
    {
      id: 'balance',
      label: 'Balance de Tokens',
      content: balanceComponent
    },
    {
      id: 'transfers',
      label: 'Transferencias de Tokens',
      content: transfersComponent
    },
    {
      id: 'vesting',
      label: 'Información de Vesting',
      content: vestingComponent
    },
    {
      id: 'airdrops',
      label: 'Tokens Asignados (Airdrops)',
      content: airdropsComponent
    }
  ];

  // Calcular el progreso total de carga
  const loadingProgress = Object.values(loadingStates).filter(state => !state).length / 4 * 100;

  return (
    <div className="container mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold mb-8">Explorador de Tokens</h1>

      <div className="bg-white p-6 rounded-lg shadow-md mb-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <WalletInput value={wallet} onChange={setWallet} />
          <NetworkSelector value={network} onChange={setNetwork} />
          <TokenFilter value={tokenFilter} onChange={setTokenFilter} />
          <div className="flex items-end">
            <button 
              onClick={handleSearch}
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
            <p className="text-sm text-gray-600 mb-2">Cargando datos para todas las pestañas... ({Math.round(loadingProgress)}%)</p>
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <div 
                className="bg-blue-600 h-2.5 rounded-full" 
                style={{ width: `${loadingProgress}%` }}
              ></div>
            </div>
          </div>
        )}
      </div>

      <TabsContainer tabs={tabs} defaultTab="balance" onTabChange={setActiveTab} />
    </div>
  );
}
