import React, { useState, useEffect } from 'react';
import { fetchTokenBalances } from '@/lib/blockchain';
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
  const [showMockData, setShowMockData] = useState<boolean>(false);

  // Datos de ejemplo para cuando no hay tokens reales
  const mockTokenBalances: TokenInfo[] = [
    {
      tokenAddress: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      tokenSymbol: 'USDC',
      tokenName: 'USD Coin',
      balance: '80000.0',
      decimals: 6
    },
    {
      tokenAddress: '0xfef6980d6d92bac3e99b5a8f2f58a6e1e4c7651a',
      tokenSymbol: 'ANTHRAX',
      tokenName: 'Anthrax',
      balance: '3834.0',
      decimals: 18
    },
    {
      tokenAddress: '0xfef6980d6d92bac3e99b5a8f2f58a6e1e4c7651b',
      tokenSymbol: 'SMALLPOX',
      tokenName: 'Smallpox',
      balance: '1278.0',
      decimals: 18
    }
  ];

  // Efecto para usar datos precargados si están disponibles
  useEffect(() => {
    if (preloadedData && preloadedData.length > 0) {
      console.log("Usando datos precargados en TokenBalance:", preloadedData.length, "tokens");
      setTokenBalances(preloadedData);
      setShowMockData(false);
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
    setShowMockData(false);

    try {
      console.log(`Fetching token balances for wallet: ${walletAddress} on network: ${network}`);
      const data = await fetchTokenBalances(walletAddress, network);
      console.log('Token balances received:', data);
      
      if (data && data.length > 0) {
        setTokenBalances(data);
        setShowMockData(false);
      } else {
        console.log('No token balances found, showing mock data');
        setShowMockData(true);
        setTokenBalances(mockTokenBalances);
      }
    } catch (err: any) {
      setError(`Error al obtener los balances de tokens: ${err.message || 'Error desconocido'}`);
      console.error('Error fetching token balances:', err);
      setShowMockData(true);
      setTokenBalances(mockTokenBalances);
    } finally {
      setLoading(false);
    }
  };

  // Cargar datos cuando cambia la wallet o la red, solo si no hay datos precargados
  useEffect(() => {
    // Comentamos esta parte para evitar cargas automáticas al cambiar la wallet
    // if (walletAddress && !isLoading && !preloadedData) {
    //   handleFetchBalances();
    // }
  }, [walletAddress, network, isLoading, preloadedData]);

  // Responder al botón de búsqueda global, solo si no hay datos precargados
  useEffect(() => {
    if (searchTriggered > 0 && !preloadedData) {
      handleFetchBalances();
    }
  }, [searchTriggered, preloadedData]);

  if (isLoading) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-md">
        <div className="flex justify-center items-center h-40">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <h2 className="text-xl font-semibold mb-4">Balance de Tokens</h2>
      
      {loading ? (
        <div className="flex justify-center items-center h-40">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <>
          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
              {error}
            </div>
          )}
          
          {tokenBalances.length > 0 ? (
            <table className="min-w-full bg-white">
              <thead>
                <tr>
                  <th className="py-2 px-4 border-b border-gray-200 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Token
                  </th>
                  <th className="py-2 px-4 border-b border-gray-200 bg-gray-50 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Balance
                  </th>
                </tr>
              </thead>
              <tbody>
                {tokenBalances.map((token, index) => (
                  <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="py-2 px-4 border-b border-gray-200">
                      <div className="flex items-center">
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">
                            {token.tokenName} ({token.tokenSymbol})
                          </div>
                          <div className="text-sm text-gray-500">
                            <a 
                              href={`${getExplorerUrl(network)}/token/${token.tokenAddress}`} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:text-blue-800"
                            >
                              {token.tokenAddress.substring(0, 6)}...{token.tokenAddress.substring(token.tokenAddress.length - 4)}
                            </a>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-2 px-4 border-b border-gray-200 text-right text-sm font-medium">
                      {parseFloat(token.balance).toLocaleString(undefined, {
                        minimumFractionDigits: 0,
                        maximumFractionDigits: 4
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-500">No se encontraron tokens para esta wallet.</p>
              <button 
                onClick={() => {
                  setShowMockData(true);
                  setTokenBalances(mockTokenBalances);
                }} 
                className="text-blue-600 hover:text-blue-800 underline"
              >
                Mostrar datos de ejemplo
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default TokenBalance;
