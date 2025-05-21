'use client';

import React, { useState } from 'react';
import { Network } from '@/lib/types';

interface VestingContractListProps {
  network: Network;
  onSelectContract: (address: string) => void;
}

// Lista de contratos de vesting predefinidos
const VESTING_CONTRACTS = [
  { name: 'Vottun World', address: '0xa699Cf416FFe6063317442c3Fbd0C39742E971c5' },
  { name: 'Investors', address: '0x3e0ef51811B647E00A85A7e5e495fA4763911982' },
  { name: 'Marketing', address: '0xE521B2929DD28a725603bCb6F4009FBb656C4b15' },
  { name: 'Staking', address: '0x3a7cf4cCC76bb23Cf15845B0d4f05BafF1D478cF' },
  { name: 'Liquidity', address: '0x417Fc9c343210AA52F0b19dbf4EecBD786139BC1' },
  { name: 'Promos', address: '0xFC750D874077F8c90858cC132e0619CE7571520b' },
  { name: 'Team', address: '0xde68AD324aafD9F2b6946073C90ED5e61D5d51B8' },
  { name: 'Reserve', address: '0xC4CE5cFea2B6e32Ad41973348AC70EB3b00D8e6d' }
];

const VestingContractList: React.FC<VestingContractListProps> = ({ network, onSelectContract }) => {
  const [selectedContract, setSelectedContract] = useState<string | null>(null);

  const handleSelectContract = (address: string) => {
    setSelectedContract(address);
    onSelectContract(address);
  };

  return (
    <div className="mb-8">
      <h2 className="text-xl font-semibold mb-4">Contratos de Vesting</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {VESTING_CONTRACTS.map((contract) => (
          <div
            key={contract.address}
            className={`p-4 rounded-lg shadow-md cursor-pointer transition-all duration-200 ${
              selectedContract === contract.address
                ? 'bg-blue-100 dark:bg-blue-900 border-2 border-blue-500'
                : 'bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
            onClick={() => handleSelectContract(contract.address)}
          >
            <h3 className="font-medium text-lg mb-2">{contract.name}</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 break-all">{contract.address}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default VestingContractList;
