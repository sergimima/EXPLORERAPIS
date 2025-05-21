'use client';

import { useState } from 'react';
import VestingSummary from '@/components/VestingSummary';
import { Network } from '@/lib/types';
import dynamic from 'next/dynamic';
import VestingContractList from './components/VestingContractList';

// Importar dinámicamente el componente para evitar problemas de hidratación
const TokenSupplyCard = dynamic(
  () => import('./components/TokenSupplyCard'),
  { ssr: false, loading: () => <div className="h-40 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse mb-8"></div> }
);

export default function VestingsPage() {
  const [network, setNetwork] = useState<Network>('base');
  const [contractAddress, setContractAddress] = useState('');
  const [showContractDetails, setShowContractDetails] = useState(false);

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">DASHBOARD</h1>
      
      {/* Sección de Información de Suministro */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Información del Suministro</h2>
        <TokenSupplyCard />
      </div>
      
      {/* Lista de contratos de vesting predefinidos */}
      <VestingContractList 
        network={network} 
        onSelectContract={(address) => {
          console.log('Contrato seleccionado:', address);
          setContractAddress(address);
          // Forzar la actualización de showContractDetails para asegurar que se active la búsqueda
          setShowContractDetails(false);
          setTimeout(() => setShowContractDetails(true), 50);
        }} 
      />
      
      {/* Campo para ingresar dirección de contrato manualmente */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md mb-8">
        <div className="mb-6">
          <label htmlFor="contract-address" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
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
              className="flex-1 p-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
            />
          </div>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Ingresa la dirección del contrato de vesting para ver su estado.
          </p>
          <div className="mt-4">
            <button
              onClick={() => setShowContractDetails(true)}
              disabled={!contractAddress}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              Buscar Contrato
            </button>
          </div>
        </div>
      </div>

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
  );
}