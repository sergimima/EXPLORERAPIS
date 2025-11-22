import React from 'react';

interface TokenTransfer {
  tokenAddress: string;
  tokenSymbol: string;
  tokenName: string;
  from: string;
  to: string;
  amount: string;
  decimals: number;
  timestamp: number;
  transactionHash: string;
}

interface TokenTransfersListProps {
  transfers: TokenTransfer[];
  isLoading: boolean;
  onAddressClick?: (address: string) => void;
  onRefresh?: () => void;
  onClearCache?: () => void;
}

const TokenTransfersList: React.FC<TokenTransfersListProps> = ({
  transfers,
  isLoading,
  onAddressClick,
  onRefresh,
  onClearCache
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
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Transferencias de Tokens</h2>
          <div className="flex space-x-2">
            {onRefresh && (
              <button
                onClick={onRefresh}
                className="px-3 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 text-sm font-medium transition-colors"
              >
                Actualizar
              </button>
            )}
            {onClearCache && (
              <button
                onClick={onClearCache}
                className="px-3 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200 text-sm font-medium transition-colors"
              >
                Limpiar y Recargar
              </button>
            )}
          </div>
        </div>
        <p className="text-center text-gray-500 py-8">
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
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">Transferencias de Tokens</h2>
        <div className="flex space-x-2">
          {onRefresh && (
            <button
              onClick={onRefresh}
              className="px-3 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 text-sm font-medium transition-colors"
            >
              Actualizar
            </button>
          )}
          {onClearCache && (
            <button
              onClick={onClearCache}
              className="px-3 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200 text-sm font-medium transition-colors"
            >
              Limpiar y Recargar
            </button>
          )}
        </div>
      </div>
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
                <div className="text-sm text-gray-900">{formatAmount(transfer.amount, transfer.decimals)}</div>
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

// Función auxiliar para formatear cantidades de tokens
const formatAmount = (amount: string, decimals: number): string => {
  try {
    const value = BigInt(amount);
    const divisor = BigInt(10 ** decimals);
    const integerPart = value / divisor;
    const remainder = value % divisor;

    // Convertir el resto a decimal
    const decimalStr = remainder.toString().padStart(decimals, '0');
    // Tomar solo los primeros 4 decimales
    const significantDecimals = decimalStr.substring(0, 4).replace(/0+$/, '');

    // Formatear con separadores de miles
    const formattedInteger = integerPart.toLocaleString('en-US');

    if (significantDecimals) {
      return `${formattedInteger}.${significantDecimals}`;
    }
    return formattedInteger;
  } catch (error) {
    return amount; // Si falla, mostrar el valor raw
  }
};

// Función auxiliar para acortar direcciones
const shortenAddress = (address: string): string => {
  return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
};

export default TokenTransfersList;
