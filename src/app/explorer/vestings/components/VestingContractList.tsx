'use client';

import React, { useState, useEffect } from 'react';
import { Network } from '@/lib/types';

interface VestingContract {
  id: string;
  name: string;
  address: string;
  network: string;
  category?: string;
  isActive: boolean;
}

interface VestingContractListProps {
  tokenId: string;
  onSelectContract: (address: string) => void;
}

const VestingContractList: React.FC<VestingContractListProps> = ({
  tokenId,
  onSelectContract
}) => {
  const [selectedContract, setSelectedContract] = useState<string | null>(null);
  const [contracts, setContracts] = useState<VestingContract[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchContracts();
  }, [tokenId]);

  const fetchContracts = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/tokens/${tokenId}/vesting-contracts?active=true`);

      if (!res.ok) {
        throw new Error('Error al cargar contratos de vesting');
      }

      const data = await res.json();
      setContracts(data.contracts || []);
    } catch (err: any) {
      console.error('Error fetching vesting contracts:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectContract = (address: string) => {
    setSelectedContract(address);
    onSelectContract(address);
  };

  if (loading) {
    return (
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Contratos de Vesting</h2>
        <div className="flex items-center justify-center p-8 bg-muted rounded-lg">
          <div className="text-muted-foreground">Cargando contratos...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Contratos de Vesting</h2>
        <div className="bg-destructive/10 border border-destructive rounded-lg p-4">
          <p className="text-destructive">Error: {error}</p>
        </div>
      </div>
    );
  }

  if (contracts.length === 0) {
    return (
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Contratos de Vesting</h2>
        <div className="bg-warning/10 border border-warning rounded-lg p-4">
          <p className="text-warning">
            No hay contratos de vesting configurados para este token.{' '}
            <a href={`/settings/tokens/${tokenId}`} className="underline font-semibold text-primary hover:opacity-80">
              Agregar contratos →
            </a>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-8">
      <h2 className="text-xl font-semibold mb-4">
        Contratos de Vesting ({contracts.length})
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {contracts.map((contract) => (
          <div
            key={contract.id}
            className={`p-4 rounded-lg shadow-md cursor-pointer transition-all duration-200 border ${
              selectedContract === contract.address
                ? 'bg-accent border-2 border-primary'
                : 'bg-card hover:bg-muted border-border'
            }`}
            onClick={() => handleSelectContract(contract.address)}
          >
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-medium text-lg">{contract.name}</h3>
              {contract.category && (
                <span className="text-xs bg-accent text-accent-foreground px-2 py-0.5 rounded">
                  {contract.category}
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground break-all">{contract.address}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default VestingContractList;
