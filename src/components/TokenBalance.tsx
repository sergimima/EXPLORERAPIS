import React, { useState, useEffect } from 'react';
import { fetchTokenBalances } from '@/lib/blockchain';
import { ethers } from 'ethers';
import { Network } from '@/lib/types';
import { getExplorerUrl } from '@/lib/utils';

interface TokenBalanceProps {
  walletAddress: string;
  network: Network;
  isLoading: boolean;
  searchTriggered?: number;
  preloadedData?: TokenInfo[]; // Datos precargados desde el componente principal
}

interface TokenInfo {
  tokenAddress: string;
  tokenSymbol: string;
  tokenName: string;
  balance: string;
  decimals: number;
}

const TokenBalance: React.FC<TokenBalanceProps> = ({
  walletAddress,
  network,
  isLoading,
  searchTriggered = 0,
  preloadedData
}) => {
  const [tokenBalances, setTokenBalances] = useState<TokenInfo[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Efecto para usar datos precargados si están disponibles
  useEffect(() => {
    if (preloadedData && preloadedData.length > 0) {
      console.log("Usando datos precargados en TokenBalance:", preloadedData.length, "tokens");
      setTokenBalances(preloadedData);
      setError(null);
    }
  }, [preloadedData]);

  const handleFetchBalances = async () => {
    // Si ya tenemos datos precargados, no necesitamos buscar de nuevo
    if (preloadedData && preloadedData.length > 0) {
      console.log("Usando datos precargados, no es necesario buscar de nuevo");
      return;
    }

    if (!walletAddress) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      console.log(`Fetching token balances for wallet: ${walletAddress} on network: ${network}`);
      const data = await fetchTokenBalances(walletAddress, network);
      console.log('Token balances received:', data);

      if (data && data.length > 0) {
        setTokenBalances(data);
      } else {
        console.log('No token balances found');
        setTokenBalances([]);
      }
    } catch (err: any) {
      setError(`Error al obtener los balances de tokens: ${err.message || 'Error desconocido'}`);
      console.error('Error fetching token balances:', err);
      setTokenBalances([]);
    } finally {
      setLoading(false);
    }
  };

  // Efecto para cargar datos cuando cambia la wallet o el contador de búsqueda
  useEffect(() => {
    if (walletAddress) {
      handleFetchBalances();
    }
  }, [walletAddress, network, searchTriggered]);

  // Efecto para actualizar estado de carga basado en props
  useEffect(() => {
    if (isLoading !== undefined) {
      setLoading(isLoading);
    }
  }, [isLoading]);

  if (isLoading) {
    return (
      <div className="bg-card p-6 rounded-lg shadow-md">
        <div className="flex justify-center items-center h-40">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  // Empty state cuando no hay wallet
  if (!walletAddress) {
    return (
      <div className="bg-card p-6 rounded-lg shadow-md mb-8">
        <h2 className="text-xl font-semibold mb-4">Balance de Tokens</h2>
        <div className="text-center py-12">
          <div className="text-6xl mb-4">👛</div>
          <p className="text-secondary mb-2">
            Introduce una dirección de wallet arriba para ver los balances
          </p>
          <p className="text-sm text-muted-foreground">
            Puedes pegar una dirección Ethereum (0x...) o ENS name
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card p-6 rounded-lg shadow-md mb-8">
      <h2 className="text-xl font-semibold mb-4">Balance de Tokens</h2>

      {loading ? (
        <div className="flex justify-center items-center h-40">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      ) : (
        <>
          {error && (
            <div className="bg-destructive/10 border border-destructive text-destructive px-4 py-3 rounded mb-4">
              {error}
            </div>
          )}

          {tokenBalances.length > 0 ? (
            <table className="min-w-full bg-card">
              <thead>
                <tr>
                  <th className="py-2 px-4 border-b border-border bg-muted text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Token
                  </th>
                  <th className="py-2 px-4 border-b border-border bg-muted text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Balance
                  </th>
                </tr>
              </thead>
              <tbody>
                {tokenBalances.map((token, index) => (
                  <tr key={index} className={index % 2 === 0 ? 'bg-card' : 'bg-muted/50'}>
                    <td className="py-2 px-4 border-b border-border">
                      <div className="flex items-center">
                        <div className="ml-4">
                          <div className="text-sm font-medium text-card-foreground">
                            {token.tokenName} ({token.tokenSymbol})
                          </div>
                          <div className="text-sm text-muted-foreground">
                            <a
                              href={`${getExplorerUrl(network)}/token/${token.tokenAddress}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary hover:opacity-80"
                            >
                              {token.tokenAddress.substring(0, 6)}...{token.tokenAddress.substring(token.tokenAddress.length - 4)}
                            </a>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-2 px-4 border-b border-border text-right text-sm font-medium">
                      {parseFloat(ethers.formatUnits(token.balance, token.decimals)).toLocaleString(undefined, {
                        minimumFractionDigits: 0,
                        maximumFractionDigits: 4
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">📭</div>
              <p className="text-secondary-foreground font-medium mb-2">
                No se encontraron tokens para esta wallet
              </p>
              <p className="text-sm text-muted-foreground mb-4">
                Esta wallet no tiene balances de tokens ERC20 en {network === 'base' ? 'Base Mainnet' : network}
              </p>
              <p className="text-xs text-muted-foreground">
                Verifica la dirección o prueba en otra red
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default TokenBalance;
