import React from 'react';

interface TokenTransfer {
  tokenAddress: string;
  tokenSymbol: string;
  tokenName: string;
  from: string;
  to: string;
  amount: string;
  timestamp: number;
  transactionHash: string;
}

interface TokenTransfersListProps {
  transfers: TokenTransfer[];
  isLoading: boolean;
  onAddressClick?: (address: string) => void;
}

const TokenTransfersList: React.FC<TokenTransfersListProps> = ({ 
  transfers, 
  isLoading,
  onAddressClick 
}) => {
  if (isLoading) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-md">
        <div className="flex justify-center items-center h-40">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  if (transfers.length === 0) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-md">
        <p className="text-center text-gray-500">
          No se encontraron transferencias de tokens para esta wallet.
        </p>
      </div>
    );
  }

  const handleAddressClick = (address: string) => {
    if (onAddressClick) {
      onAddressClick(address);
    }
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-md overflow-x-auto">
      <h2 className="text-xl font-semibold mb-4">Transferencias de Tokens</h2>
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Token</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Desde</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Hasta</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cantidad</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tx Hash</th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {transfers.map((transfer, index) => (
            <tr key={index}>
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="flex items-center">
                  <div className="ml-4">
                    <div className="text-sm font-medium text-gray-900">{transfer.tokenSymbol}</div>
                    <div className="text-sm text-gray-500">{transfer.tokenName}</div>
                  </div>
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <div 
                  className="text-sm text-blue-600 hover:text-blue-900 cursor-pointer"
                  onClick={() => handleAddressClick(transfer.from)}
                  title="Haz clic para buscar esta dirección"
                >
                  {shortenAddress(transfer.from)}
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <div 
                  className="text-sm text-blue-600 hover:text-blue-900 cursor-pointer"
                  onClick={() => handleAddressClick(transfer.to)}
                  title="Haz clic para buscar esta dirección"
                >
                  {shortenAddress(transfer.to)}
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="text-sm text-gray-900">{transfer.amount}</div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="text-sm text-gray-900">
                  {new Date(transfer.timestamp * 1000).toLocaleString()}
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <a
                  href={`https://basescan.org/tx/${transfer.transactionHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-900 text-sm"
                >
                  {shortenAddress(transfer.transactionHash)}
                </a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// Función auxiliar para acortar direcciones
const shortenAddress = (address: string): string => {
  return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
};

export default TokenTransfersList;
