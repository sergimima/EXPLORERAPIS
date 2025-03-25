import React from 'react';

interface WalletInputProps {
  value: string;
  onChange: (value: string) => void;
}

const WalletInput: React.FC<WalletInputProps> = ({ value, onChange }) => {
  return (
    <div className="flex flex-col">
      <label htmlFor="wallet" className="text-sm font-medium text-gray-700 mb-1">
        Dirección de Wallet
      </label>
      <input
        id="wallet"
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="0x..."
        className="input-field"
      />
    </div>
  );
};

export default WalletInput;
