'use client';

import React, { useEffect, useState, useRef } from 'react';
import { getTokenSupplyInfo, TokenSupplyInfo } from '@/lib/blockchain';

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
    <div className="bg-white bg-white rounded-lg shadow-md p-6 flex flex-col h-full">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium text-gray-900">
          {title}
        </h3>
        {icon && <div className="text-blue-500">{icon}</div>}
      </div>
      <div className="flex-1">
        <p className="text-2xl font-bold text-gray-900">
          {displayValue()}
        </p>
        {description && (
          <p className="mt-2 text-sm text-gray-500 text-gray-500">
            {description}
          </p>
        )}
      </div>
    </div>
  );
};

const TokenSupplyCard: React.FC = () => {
  const [supplyInfo, setSupplyInfo] = useState<TokenSupplyInfo | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [loadingProgress, setLoadingProgress] = useState<number>(0);
  const [loadingStage, setLoadingStage] = useState<string>('');
  // Referencias para controlar peticiones duplicadas
  const fetchingRef = useRef<boolean>(false);
  const requestIdRef = useRef<number>(0);

  useEffect(() => {
    // Generar un ID único para esta ejecución del efecto
    const currentRequestId = ++requestIdRef.current;


    const fetchSupplyInfo = async () => {
      // Si ya estamos obteniendo datos, no hacer nada
      if (fetchingRef.current) {
        return;
      }
      fetchingRef.current = true;

      try {
        setLoading(true);
        setLoadingProgress(0);
        setLoadingStage('iniciando');

        // Definir el callback de progreso
        const handleProgress = (stage: string, progress: number) => {
          setLoadingProgress(progress);

          // Traducir las etapas a mensajes en español
          switch (stage) {
            case 'iniciando':
              setLoadingStage('Iniciando...');
              break;
            case 'cargando_total_supply':
              setLoadingStage('Cargando suministro total...');
              break;
            case 'cargando_datos':
              setLoadingStage('Procesando datos...');
              break;
            case 'esperando':
              setLoadingStage(`Esperando (${progress}%)...`);
              break;
            case 'esperando_peticion':
              setLoadingStage(`Esperando a que termine otra petición (${progress}%)...`);
              break;
            case 'usando_cache':
              setLoadingStage('Usando datos en caché');
              break;
            case 'cargando_circulating_supply':
              setLoadingStage('Cargando suministro circulante...');
              break;
            case 'completado':
              setLoadingStage('Completado');
              break;
            default:
              setLoadingStage(`Cargando (${progress}%)...`);
          }
        };

        // Llamar a getTokenSupplyInfo con el callback de progreso
        const data = await getTokenSupplyInfo(handleProgress);
        setSupplyInfo(data);
      } catch (err) {
        console.error('Error al obtener información del suministro:', err);
        setError('No se pudo cargar la información del suministro');
      } finally {
        setLoading(false);
        // Permitir futuras actualizaciones después de un tiempo
        const timeoutId = setTimeout(() => {
          fetchingRef.current = false;
        }, 5000); // Esperar 5 segundos antes de permitir otra actualización
      }
    };

    fetchSupplyInfo();

    // Función de limpieza
    return () => {
      // No reseteamos fetchingRef.current aquí para evitar que se inicien nuevas peticiones
      // durante el desmontaje o re-renderizado
    };
  }, []);

  if (loading) {
    return (
      <div className="mb-8">
        <div className="bg-white bg-white rounded-lg shadow-md p-6 mb-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
              Cargando información del suministro
            </h3>
          </div>

          <div className="mb-4">
            <div className="relative pt-1">
              <div className="flex mb-2 items-center justify-between">
                <div>
                  <span className="text-xs font-semibold inline-block py-1 px-2 uppercase rounded-full text-blue-600 bg-blue-200">
                    {loadingStage}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-xs font-semibold inline-block text-blue-600">
                    {loadingProgress}%
                  </span>
                </div>
              </div>
              <div className="overflow-hidden h-2 mb-4 text-xs flex rounded bg-blue-200">
                <div
                  style={{ width: `${loadingProgress}%` }}
                  className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-blue-500 transition-all duration-300"
                ></div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-gray-100 bg-gray-100 rounded-lg p-4 animate-pulse">
                <div className="h-4 bg-gray-200 bg-gray-200 rounded w-1/2 mb-4"></div>
                <div className="h-8 bg-gray-200 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="h-3 bg-gray-200 bg-gray-200 rounded w-5/6"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 bg-red-50 border border-red-200 border-red-200 rounded-lg p-4 mb-6">
        <p className="text-red-600 dark:text-red-400">{error}</p>
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
