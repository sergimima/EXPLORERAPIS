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
  const [transfers, setTransfers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTriggered, setSearchTriggered] = useState<number>(0);
  const [activeTab, setActiveTab] = useState<string>('balance');

  const handleSearch = async () => {
    if (!wallet) {
      setError('Por favor, introduce una dirección de wallet válida');
      return;
    }

    setIsLoading(true);
    setError(null);
    
    // Incrementar el contador para forzar la actualización de todos los componentes
    setSearchTriggered(prev => prev + 1);

    try {
      const data = await fetchTokenTransfers(wallet, network, tokenFilter);
      setTransfers(data);
    } catch (err) {
      setError('Error al obtener los datos. Por favor, inténtalo de nuevo.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddressClick = (address: string) => {
    setWallet(address);
    handleSearch();
  };

  // Crear los componentes una sola vez
  const balanceComponent = (
    <TokenBalance 
      walletAddress={wallet} 
      network={network} 
      isLoading={isLoading}
      searchTriggered={searchTriggered}
    />
  );

  const transfersComponent = (
    <TokenTransfersList 
      transfers={transfers} 
      isLoading={isLoading} 
      onAddressClick={handleAddressClick}
    />
  );

  const vestingComponent = (
    <VestingInfo 
      walletAddress={wallet} 
      network={network} 
      isLoading={isLoading}
      searchTriggered={searchTriggered}
    />
  );

  const airdropsComponent = (
    <AirdropAssignments 
      walletAddress={wallet} 
      network={network} 
      isLoading={isLoading}
      searchTriggered={searchTriggered}
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
      </div>

      <TabsContainer tabs={tabs} defaultTab="balance" onTabChange={setActiveTab} />
    </div>
  );
}
