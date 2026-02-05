'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';

export interface TokenSettings {
  customBasescanApiKey?: string | null;
  customEtherscanApiKey?: string | null;
  customMoralisApiKey?: string | null;
  customQuiknodeUrl?: string | null;
  whaleThreshold?: string;
  vestingContractAddresses?: string[];
}

export interface TokenData {
  id: string;
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  network: string;
  organizationId: string;
  logoUrl?: string | null;
  settings?: TokenSettings | null;
}

interface TokenContextType {
  activeToken: TokenData | null;
  tokens: TokenData[];
  loading: boolean;
  error: string | null;
  setActiveTokenId: (tokenId: string) => void;
  refreshTokens: () => Promise<void>;
}

const TokenContext = createContext<TokenContextType | undefined>(undefined);

export function TokenProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const [tokens, setTokens] = useState<TokenData[]>([]);
  const [activeToken, setActiveToken] = useState<TokenData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch tokens del usuario
  const fetchTokens = async () => {
    if (status !== 'authenticated' || !session) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/tokens');

      if (!response.ok) {
        throw new Error('Error al obtener tokens');
      }

      const data = await response.json();
      setTokens(data);

      // Obtener token activo guardado en localStorage
      const savedTokenId = typeof window !== 'undefined'
        ? localStorage.getItem('activeTokenId')
        : null;

      // Si hay token guardado y existe en la lista, usarlo
      if (savedTokenId && data.some((t: TokenData) => t.id === savedTokenId)) {
        const token = data.find((t: TokenData) => t.id === savedTokenId);
        setActiveToken(token || null);
      } else if (data.length > 0) {
        // Si no, usar el primero
        setActiveToken(data[0]);
        if (typeof window !== 'undefined') {
          localStorage.setItem('activeTokenId', data[0].id);
        }
      }
    } catch (err) {
      console.error('Error fetching tokens:', err);
      setError('Error al cargar los tokens');
    } finally {
      setLoading(false);
    }
  };

  // Cambiar token activo
  const setActiveTokenId = (tokenId: string) => {
    const token = tokens.find(t => t.id === tokenId);
    if (token) {
      setActiveToken(token);
      if (typeof window !== 'undefined') {
        localStorage.setItem('activeTokenId', tokenId);
      }
    }
  };

  // Effect para cargar tokens cuando el usuario está autenticado
  useEffect(() => {
    if (status === 'authenticated') {
      fetchTokens();
    } else if (status === 'unauthenticated') {
      setTokens([]);
      setActiveToken(null);
      setLoading(false);
    }
  }, [status, session]);

  const value: TokenContextType = {
    activeToken,
    tokens,
    loading,
    error,
    setActiveTokenId,
    refreshTokens: fetchTokens
  };

  return (
    <TokenContext.Provider value={value}>
      {children}
    </TokenContext.Provider>
  );
}

// Hook personalizado para usar el contexto
export function useToken() {
  const context = useContext(TokenContext);
  if (context === undefined) {
    throw new Error('useToken debe ser usado dentro de TokenProvider');
  }
  return context;
}
