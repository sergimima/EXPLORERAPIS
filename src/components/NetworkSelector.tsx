import React from 'react';
import { Network } from '@/lib/types';

interface NetworkSelectorProps {
  value: Network;
  onChange: (value: Network) => void;
}

const networks = [
  { id: 'base' as Network, name: 'Base Mainnet' },
  { id: 'base-testnet' as Network, name: 'Base Testnet (Goerli)' },
  { id: 'base-sepolia' as Network, name: 'Base Testnet (Sepolia)' },
];

const NetworkSelector: React.FC<NetworkSelectorProps> = ({ value, onChange }) => {
  return (
    <div className="flex flex-col">
      <label htmlFor="network" className="text-sm font-medium text-gray-700 mb-1">
        Red Blockchain
      </label>
      <select
        id="network"
        value={value}
        onChange={(e) => onChange(e.target.value as Network)}
        className="input-field"
      >
        {networks.map((network) => (
          <option key={network.id} value={network.id}>
            {network.name}
          </option>
        ))}
      </select>
    </div>
  );
};

export default NetworkSelector;
