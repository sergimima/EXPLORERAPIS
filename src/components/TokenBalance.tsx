import React, { useState, useEffect } from 'react';
import { fetchTokenBalances } from '@/lib/blockchain';
import { Network } from '@/lib/types';
import { getExplorerUrl } from '@/lib/utils';

interface TokenBalanceProps {
  walletAddress: string;
  network: Network;
  isLoading: boolean;
}

interface TokenInfo {
  tokenAddress: string;
  tokenSymbol: string;
  tokenName: string;
  balance: string;
  decimals: number;
}

const TokenBalance: React.FC<TokenBalanceProps> = ({ walletAddress, network, isLoading }) => {
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

  const handleFetchBalances = async () => {
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

  // Cargar datos de ejemplo automáticamente si hay una wallet
  useEffect(() => {
    if (walletAddress && !isLoading) {
      handleFetchBalances();
    }
  }, [walletAddress, network, isLoading]);

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
      
      <div className="mb-6">
        <button 
          onClick={handleFetchBalances}
          disabled={loading || !walletAddress}
          className="btn-primary"
        >
          {loading ? 'Cargando...' : 'Consultar Balance'}
        </button>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mt-4">
            {error}
          </div>
        )}
        
        {showMockData && (
          <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded mt-4">
            <strong>DATOS DE EJEMPLO:</strong> Mostrando datos de ejemplo porque no se pudieron obtener datos reales de la blockchain. Los balances reales pueden ser diferentes.
          </div>
        )}
      </div>

      {tokenBalances.length === 0 && !loading ? (
        <p className="text-center text-gray-500">
          No se encontraron tokens para esta wallet. Por favor, consulta el balance para ver los tokens disponibles.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Token</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Balance</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Dirección del Token</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {tokenBalances.map((token, index) => (
                <tr key={index} className={showMockData ? "bg-yellow-50" : ""}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">{token.tokenSymbol}</div>
                        <div className="text-sm text-gray-500">{token.tokenName}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{token.balance}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <a 
                      href={`${getExplorerUrl(network)}/token/${token.tokenAddress}`} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-sm text-blue-500 hover:text-blue-700"
                    >
                      {`${token.tokenAddress.substring(0, 6)}...${token.tokenAddress.substring(token.tokenAddress.length - 4)}`}
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default TokenBalance;
