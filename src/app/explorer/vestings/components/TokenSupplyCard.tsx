'use client';

import React, { useEffect, useState, useRef } from 'react';
import { getTokenSupplyInfo, TokenSupplyInfo } from '@/actions/blockchain';
import { useToken } from '@/contexts/TokenContext';
import type { Network } from '@/lib/types';

interface SupplyCardProps {
  title: string;
  value: string;
  description?: string;
  icon?: React.ReactNode;
}

const SupplyCard: React.FC<SupplyCardProps> = ({ title, value, description, icon }) => {
  // Asegurarse de que el valor sea un número válido
  const displayValue = () => {
    try {
      const numValue = parseFloat(value);
      return isNaN(numValue) ? '0' : numValue.toLocaleString();
    } catch (e) {
      console.warn(`Error al procesar valor para ${title}:`, e);
      return '0';
    }
  };

  return (
    <div className="bg-card rounded-lg shadow-md p-6 flex flex-col h-full border border-border">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium text-card-foreground">
          {title}
        </h3>
        {icon && <div className="text-primary">{icon}</div>}
      </div>
      <div className="flex-1">
        <p className="text-2xl font-bold text-card-foreground">
          {displayValue()}
        </p>
        {description && (
          <p className="mt-2 text-sm text-muted-foreground">
            {description}
          </p>
        )}
      </div>
    </div>
  );
};

const TokenSupplyCard: React.FC = () => {
  const { activeToken, loading: tokenLoading } = useToken();
  const [supplyInfo, setSupplyInfo] = useState<TokenSupplyInfo | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  // Referencias para controlar peticiones duplicadas
  const fetchingRef = useRef<boolean>(false);

  useEffect(() => {
    if (!activeToken || tokenLoading) {
      setLoading(false);
      return;
    }

    const fetchSupplyInfo = async () => {
      // Si ya estamos obteniendo datos, no hacer nada
      if (fetchingRef.current) {
        return;
      }
      fetchingRef.current = true;

      try {
        setLoading(true);

        // Llamar a getTokenSupplyInfo con el token activo (Server Action)
        const data = await getTokenSupplyInfo(
          activeToken.address,
          (activeToken.network ?? 'base') as Network,
          activeToken.id
        );
        setSupplyInfo(data);
      } catch (err) {
        console.error('Error al obtener información del suministro:', err);
        setError('No se pudo cargar la información del suministro');
      } finally {
        setLoading(false);
        // Permitir futuras actualizaciones después de un tiempo
        setTimeout(() => {
          fetchingRef.current = false;
        }, 5000);
      }
    };

    fetchSupplyInfo();

    // Función de limpieza
    return () => {
      // No reseteamos fetchingRef.current aquí para evitar que se inicien nuevas peticiones
      // durante el desmontaje o re-renderizado
    };
  }, [activeToken, tokenLoading]);

  if (tokenLoading || !activeToken) {
    return (
      <div className="mb-8">
        <div className="bg-muted rounded-lg p-8 text-center">
          {tokenLoading ? (
            <p className="text-muted-foreground">Cargando token...</p>
          ) : (
            <p className="text-muted-foreground">No hay token seleccionado</p>
          )}
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="mb-8">
        <div className="bg-card rounded-lg shadow-md p-6 mb-4 border border-border">
          <div className="flex items-center justify-center gap-3 py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <h3 className="text-lg font-medium text-card-foreground">
              Cargando información del suministro...
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-muted rounded-lg p-4 animate-pulse">
                <div className="h-4 bg-muted-foreground/20 rounded w-1/2 mb-4"></div>
                <div className="h-8 bg-muted-foreground/20 rounded w-3/4 mb-2"></div>
                <div className="h-3 bg-muted-foreground/20 rounded w-5/6"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-destructive/10 border border-destructive rounded-lg p-4 mb-6">
        <p className="text-destructive">{error}</p>
      </div>
    );
  }

  if (!supplyInfo) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
      <SupplyCard
        title="Total Supply"
        value={supplyInfo.totalSupply}
        description="Número total de tokens en existencia"
        icon={
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        }
      />

      <SupplyCard
        title="Circulating Supply"
        value={supplyInfo.circulatingSupply}
        description="Tokens en circulación en el mercado"
        icon={
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
          </svg>
        }
      />

      <SupplyCard
        title="Locked Supply (provisional, solo hace diferencia entre total y circulating)"
        value={supplyInfo.lockedSupply}
        description="Tokens bloqueados en contratos"
        icon={
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        }
      />
    </div>
  );
};

export default TokenSupplyCard;
