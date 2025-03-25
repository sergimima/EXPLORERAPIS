import React from 'react';

interface TokenFilterProps {
  value: string;
  onChange: (value: string) => void;
}

const TokenFilter: React.FC<TokenFilterProps> = ({ value, onChange }) => {
  return (
    <div className="flex flex-col">
      <label htmlFor="tokenFilter" className="text-sm font-medium text-gray-700 mb-1">
        Filtrar por Token (opcional)
      </label>
      <input
        id="tokenFilter"
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Dirección o símbolo del token"
        className="input-field"
      />
    </div>
  );
};

export default TokenFilter;
