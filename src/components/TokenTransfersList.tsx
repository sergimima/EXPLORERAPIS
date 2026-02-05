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
      <div className="bg-card p-6 rounded-lg shadow-md">
        <div className="flex justify-center items-center h-40">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  if (transfers.length === 0) {
    return (
      <div className="bg-card p-6 rounded-lg shadow-md">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Transferencias de Tokens</h2>
          <div className="flex space-x-2">
            {onRefresh && (
              <button
                onClick={onRefresh}
                className="px-3 py-1 bg-accent text-accent-foreground rounded hover:opacity-80 text-sm font-medium transition-colors"
              >
                Actualizar
              </button>
            )}
            {onClearCache && (
              <button
                onClick={onClearCache}
                className="px-3 py-1 bg-destructive/10 text-destructive rounded hover:opacity-80 text-sm font-medium transition-colors"
              >
                Limpiar y Recargar
              </button>
            )}
          </div>
        </div>
        <p className="text-center text-muted-foreground py-8">
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
    <div className="bg-card p-6 rounded-lg shadow-md overflow-x-auto">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">Transferencias de Tokens</h2>
        <div className="flex space-x-2">
          {onRefresh && (
            <button
              onClick={onRefresh}
              className="px-3 py-1 bg-accent text-accent-foreground rounded hover:opacity-80 text-sm font-medium transition-colors"
            >
              Actualizar
            </button>
          )}
          {onClearCache && (
            <button
              onClick={onClearCache}
              className="px-3 py-1 bg-destructive/10 text-destructive rounded hover:opacity-80 text-sm font-medium transition-colors"
            >
              Limpiar y Recargar
            </button>
          )}
        </div>
      </div>
      <table className="min-w-full divide-y divide-border">
        <thead className="bg-muted">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Token</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Desde</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Hasta</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Cantidad</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Fecha</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Tx Hash</th>
          </tr>
        </thead>
        <tbody className="bg-card divide-y divide-border">
          {transfers.map((transfer, index) => (
            <tr key={index}>
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="flex items-center">
                  <div className="ml-4">
                    <div className="text-sm font-medium text-card-foreground">{transfer.tokenSymbol}</div>
                    <div className="text-sm text-muted-foreground">{transfer.tokenName}</div>
                  </div>
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <div
                  className="text-sm text-primary hover:opacity-80 cursor-pointer"
                  onClick={() => handleAddressClick(transfer.from)}
                  title="Haz clic para buscar esta dirección"
                >
                  {shortenAddress(transfer.from)}
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <div
                  className="text-sm text-primary hover:opacity-80 cursor-pointer"
                  onClick={() => handleAddressClick(transfer.to)}
                  title="Haz clic para buscar esta dirección"
                >
                  {shortenAddress(transfer.to)}
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="text-sm text-card-foreground">{formatAmount(transfer.amount, transfer.decimals)}</div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="text-sm text-card-foreground">
                  {new Date(transfer.timestamp * 1000).toLocaleString()}
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <a
                  href={`https://basescan.org/tx/${transfer.transactionHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:opacity-80 text-sm"
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
