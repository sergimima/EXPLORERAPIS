import React, { useState, useEffect } from 'react';
import { checkVestingContractStatus } from '@/lib/blockchain';
import { ethers } from 'ethers';
import { Network } from '@/lib/types';

interface VestingSummaryProps {
  network: Network;
  initialContractAddress?: string;
  hideSearchBar?: boolean;
}

interface VestingContractSummary {
  contractAddress: string;
  tokenAddress?: string;
  tokenName?: string;
  tokenSymbol?: string;
  totalVested?: string;
  totalReleased?: string;
  remainingToVest?: string;
  allTokensVested?: boolean;
  vestingSchedulesCount?: number;
  totalSchedulesCreated?: number;
  lastTokenBalance?: string;
  contractType?: string;
  creationDate?: string;
  totalTokensIn?: string;
  totalTokensOut?: string;
  lockedTokens?: string;
  releasableTokens?: string;
  claimedTokens?: string;
  beneficiaries?: any[];
  totalBeneficiaries?: number; // Número total de beneficiarios
  validBeneficiaries?: number; // Número de beneficiarios con datos válidos
  errorBeneficiaries?: number; // Número de beneficiarios con errores
  lastUpdated: number;
  error?: string;
}

const VestingSummary: React.FC<VestingSummaryProps> = ({ network, initialContractAddress = '', hideSearchBar = false }) => {
  const [contractAddress, setContractAddress] = useState<string>(initialContractAddress);
  const [loadingBasic, setLoadingBasic] = useState<boolean>(false);
  const [loadingDetails, setLoadingDetails] = useState<boolean>(false);
  const [showDetails, setShowDetails] = useState<boolean>(false); // Estado para controlar si se muestran los detalles
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<VestingContractSummary | null>(null);
  const [expandedBeneficiaries, setExpandedBeneficiaries] = useState<Record<number, boolean>>({});
  const [searchHistory, setSearchHistory] = useState<VestingContractSummary[]>([]);

  // Función para verificar si una dirección es válida
  const isValidAddress = (address: string): boolean => {
    try {
      return ethers.isAddress(address);
    } catch (e) {
      return false;
    }
  };

  // Función para obtener la URL del explorador según la red
  const getExplorerUrl = (network: string): string => {
    const explorers: Record<string, string> = {
      'base': 'https://basescan.org',
      'base-testnet': 'https://testnet.basescan.org',
      'base-sepolia': 'https://sepolia.basescan.org'
    };
    return explorers[network] || explorers['base'];
  };

  // Función para cargar los detalles de beneficiarios
  const loadBeneficiaryDetails = async () => {
    if (!summary) return;
    
    setLoadingDetails(true);
    setShowDetails(true);
    
    try {
      // Obtener los detalles completos de los beneficiarios
      const contractStatus = await checkVestingContractStatus(summary.contractAddress, network);
      
      // Actualizar el resumen con la información detallada
      setSummary(prevSummary => {
        if (!prevSummary) return null;
        
        return {
          ...prevSummary,
          beneficiaries: contractStatus.beneficiaries || [],
          validBeneficiaries: contractStatus.validBeneficiaries,
          errorBeneficiaries: contractStatus.errorBeneficiaries,
        };
      });
    } catch (error) {
      console.error('Error al cargar detalles de beneficiarios:', error);
      setError('Error al cargar los detalles de beneficiarios');
    } finally {
      setLoadingDetails(false);
    }
  };

  // Función para buscar información del contrato de vesting
  const handleSearch = async () => {
    if (!contractAddress) {
      setError('Por favor, introduce una dirección de contrato');
      return;
    }

    if (!isValidAddress(contractAddress)) {
      setError('La dirección del contrato no es válida');
      return;
    }

    // Resetear estados
    setLoadingBasic(true);
    setLoadingDetails(false);
    setShowDetails(false);
    setError(null);
    setSummary(null);

    try {
      // Paso 1: Cargar la información básica del contrato
      const contractStatus = await checkVestingContractStatus(contractAddress, network);
      
      // Depurar los valores recibidos del backend
      console.log("Valores recibidos del backend:", {
        totalBeneficiaries: contractStatus.totalBeneficiaries,
        beneficiaries: contractStatus.beneficiaries?.length || 0,
        totalVested: contractStatus.totalVested,
        totalReleased: contractStatus.totalReleased,
        totalTokensIn: contractStatus.totalTokensIn,
        totalTokensOut: contractStatus.totalTokensOut,
        lockedTokens: contractStatus.lockedTokens,
        releasableTokens: contractStatus.releasableTokens,
        claimedTokens: contractStatus.claimedTokens
      });
      
      // Paso 2: Mostrar solo el resumen básico inmediatamente
      
      // Actualizar el resumen con la información completa
      const completeSummary: VestingContractSummary = {
        contractAddress: contractStatus.contractAddress,
        tokenAddress: contractStatus.tokenAddress || undefined,
        tokenName: contractStatus.tokenName || undefined,
        tokenSymbol: contractStatus.tokenSymbol || undefined,
        totalVested: contractStatus.totalVested,
        totalReleased: contractStatus.totalReleased,
        remainingToVest: contractStatus.remainingToVest,
        allTokensVested: contractStatus.allTokensVested,
        vestingSchedulesCount: contractStatus.vestingSchedulesCount,
        totalSchedulesCreated: contractStatus.totalSchedulesCreated,
        lastTokenBalance: contractStatus.lastTokenBalance,
        contractType: contractStatus.contractType,
        creationDate: contractStatus.creationDate,
        totalTokensIn: contractStatus.totalTokensIn,
        totalTokensOut: contractStatus.totalTokensOut,
        lockedTokens: contractStatus.lockedTokens,
        releasableTokens: contractStatus.releasableTokens,
        claimedTokens: contractStatus.claimedTokens,
        beneficiaries: contractStatus.beneficiaries,
        totalBeneficiaries: contractStatus.totalBeneficiaries,
        validBeneficiaries: contractStatus.validBeneficiaries,
        errorBeneficiaries: contractStatus.errorBeneficiaries,
        lastUpdated: Date.now(),
        error: contractStatus.error || undefined
      };
      
      setSummary(completeSummary);
      
      // Añadimos a historial solo si es un contrato válido
      if (contractStatus.isValid) {
        setSearchHistory(prev => {
          // Eliminar duplicados
          const filtered = prev.filter(item => item.contractAddress.toLowerCase() !== contractAddress.toLowerCase());
          return [completeSummary, ...filtered].slice(0, 5); // Mantener solo los últimos 5
        });
      }
    } catch (err) {
      console.error('Error al obtener información del contrato:', err);
      setError(`Error al obtener información del contrato: ${err instanceof Error ? err.message : 'Error desconocido'}`);
    } finally {
      setLoadingBasic(false);
      setLoadingDetails(false);
    }
  };

  // Función para cargar un contrato del historial
  const loadFromHistory = (historySummary: VestingContractSummary) => {
    setContractAddress(historySummary.contractAddress);
    setSummary(historySummary);
  };

  // Efecto para buscar automáticamente cuando se proporciona una dirección inicial
  useEffect(() => {
    // Crear una función para buscar el contrato inicial
    const searchInitialContract = async () => {
      if (initialContractAddress && isValidAddress(initialContractAddress)) {
        console.log('Buscando contrato inicial:', initialContractAddress);
        
        // Primero actualizamos la dirección del contrato
        setContractAddress(initialContractAddress);
        
        // Luego ejecutamos la búsqueda manualmente
        // Ya validamos la dirección arriba, así que no necesitamos volver a hacerlo
        console.log('Iniciando búsqueda para:', initialContractAddress);

        // Resetear estados
        setLoadingBasic(true);
        setLoadingDetails(true);
        setError(null);
        
        // Mostrar inmediatamente la información básica
        const initialSummary: VestingContractSummary = {
          contractAddress: initialContractAddress,
          lastUpdated: Date.now()
        };
        setSummary(initialSummary);

        try {
          // Usar la función para verificar el estado del contrato de vesting
          const contractStatus = await checkVestingContractStatus(initialContractAddress, network);
          
          // Crear un resumen con la información obtenida
          const newSummary: VestingContractSummary = {
            contractAddress: contractStatus.contractAddress,
            tokenAddress: contractStatus.tokenAddress || undefined,
            tokenName: contractStatus.tokenName || undefined,
            tokenSymbol: contractStatus.tokenSymbol || undefined,
            totalVested: contractStatus.totalVested,
            totalReleased: contractStatus.totalReleased,
            remainingToVest: contractStatus.remainingToVest,
            allTokensVested: contractStatus.allTokensVested,
            vestingSchedulesCount: contractStatus.vestingSchedulesCount,
            totalSchedulesCreated: contractStatus.totalSchedulesCreated,
            lastTokenBalance: contractStatus.lastTokenBalance,
            contractType: contractStatus.contractType,
            totalTokensIn: contractStatus.totalTokensIn,
            totalTokensOut: contractStatus.totalTokensOut,
            lockedTokens: contractStatus.lockedTokens,
            releasableTokens: contractStatus.releasableTokens,
            beneficiaries: contractStatus.beneficiaries,
            creationDate: contractStatus.creationDate,
            lastUpdated: Date.now(),
            error: contractStatus.error || undefined,
            claimedTokens: contractStatus.claimedTokens
          };
          
          setSummary(newSummary);
          
          // Añadimos a historial solo si es un contrato válido
          if (contractStatus.isValid) {
            setSearchHistory(prev => {
              // Eliminar duplicados
              const filtered = prev.filter(item => item.contractAddress.toLowerCase() !== initialContractAddress.toLowerCase());
              return [newSummary, ...filtered].slice(0, 5); // Mantener solo los últimos 5
            });
          }
        } catch (err) {
          console.error('Error al obtener información del contrato:', err);
          setError(`Error al obtener información del contrato: ${err instanceof Error ? err.message : 'Error desconocido'}`);
        } finally {
          setLoadingBasic(false);
          setLoadingDetails(false);
        }
      }
    };
    
    // Ejecutar la búsqueda cuando cambie la dirección inicial
    searchInitialContract();
  }, [initialContractAddress, network]);

  return (
    <div className="bg-white shadow-md rounded-lg p-6">
      <h2 className="text-2xl font-bold mb-6">Resumen de Contrato de Vesting</h2>
      
      {!hideSearchBar && (
        <div className="mb-6">
          <div className="flex items-center space-x-2">
            <input
              type="text"
              value={contractAddress}
              onChange={(e) => setContractAddress(e.target.value)}
              placeholder="Dirección del contrato de vesting"
              className="flex-1 p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={handleSearch}
              disabled={loadingBasic || loadingDetails}
              className={`px-4 py-2 rounded-md text-white ${
                (loadingBasic || loadingDetails) ? 'bg-gray-400' : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {(loadingBasic || loadingDetails) ? 'Buscando...' : 'Buscar'}
            </button>
          </div>
          {error && <p className="text-red-500 mt-2">{error}</p>}
        </div>
      )}
      
      {summary && (
        <div className="bg-gray-50 p-4 rounded-md mb-6">
          <h3 className="text-lg font-semibold mb-2">Información del Contrato</h3>
          {loadingBasic && (
            <div className="flex justify-center items-center my-8">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
              <span className="ml-3 text-gray-600">Cargando información básica del contrato...</span>
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-600">Dirección del Contrato:</p>
              <p className="font-medium">
                <a
                  href={`${getExplorerUrl(network)}/address/${summary.contractAddress}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-800"
                >
                  {summary.contractAddress}
                </a>
              </p>
            </div>
            
            {summary.contractType && (
              <div>
                <p className="text-sm text-gray-600">Tipo de Contrato:</p>
                <p className="font-medium">{summary.contractType}</p>
              </div>
            )}
            
            {summary.tokenAddress && (
              <div>
                <p className="text-sm text-gray-600">Token:</p>
                <p className="font-medium">
                  {summary.tokenName} ({summary.tokenSymbol})
                  <a
                    href={`${getExplorerUrl(network)}/token/${summary.tokenAddress}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-800 ml-2"
                  >
                    Ver
                  </a>
                </p>
              </div>
            )}
            
            {summary.creationDate && (
              <div>
                <p className="text-sm text-gray-600">Fecha de Creación:</p>
                <p className="font-medium">{new Date(summary.creationDate).toLocaleString()}</p>
              </div>
            )}
          </div>
          
          {/* Resumen de tokens */}
          <div className="mt-6">
            <h4 className="text-md font-semibold mb-2">Resumen de Tokens</h4>
            <div className="bg-white p-3 rounded-md border border-gray-200">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Total Tokens IN:</p>
                  <p className="font-medium text-green-600">
                    {summary.totalTokensIn ? parseFloat(summary.totalTokensIn).toLocaleString(undefined, {maximumFractionDigits: 6}) : '0'} {summary.tokenSymbol}
                  </p>
                </div>
                
                <div>
                  <p className="text-sm text-gray-600">Total Tokens OUT:</p>
                  <p className="font-medium text-red-600">
                    {summary.totalTokensOut ? parseFloat(summary.totalTokensOut).toLocaleString(undefined, {maximumFractionDigits: 6}) : '0'} {summary.tokenSymbol}
                  </p>
                </div>
                
                <div>
                  <p className="text-sm text-gray-600">Balance Actual en Contrato:</p>
                  <p className="font-medium">
                    {summary.lastTokenBalance ? parseFloat(summary.lastTokenBalance).toLocaleString(undefined, {maximumFractionDigits: 6}) : '0'} {summary.tokenSymbol}
                  </p>
                </div>
              </div>
            </div>
          </div>
          
          {/* Desglose de vesting */}
          <div className="mt-6">
            <h4 className="text-md font-semibold mb-2">Desglose de Vesting</h4>
            <div className="bg-white p-3 rounded-md border border-gray-200">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Total Vested:</p>
                  <p className="font-medium">
                    {summary.totalVested ? parseFloat(summary.totalVested).toLocaleString(undefined, {maximumFractionDigits: 6}) : 
                     (summary.totalTokensIn ? parseFloat(summary.totalTokensIn).toLocaleString(undefined, {maximumFractionDigits: 6}) : '0')} {summary.tokenSymbol}
                  </p>
                </div>
                
                <div>
                  <p className="text-sm text-gray-600">Total Liberado:</p>
                  <p className="font-medium">
                    {summary.totalReleased ? parseFloat(summary.totalReleased).toLocaleString(undefined, {maximumFractionDigits: 6}) : 
                     (summary.totalTokensOut ? parseFloat(summary.totalTokensOut).toLocaleString(undefined, {maximumFractionDigits: 6}) : '0')} {summary.tokenSymbol}
                  </p>
                </div>
                
                <div>
                  <p className="text-sm text-gray-600">Pendiente de Vesting:</p>
                  <p className="font-medium">
                    {summary.remainingToVest ? parseFloat(summary.remainingToVest).toLocaleString(undefined, {maximumFractionDigits: 6}) : 
                     (summary.totalVested && summary.totalReleased ? 
                      (parseFloat(summary.totalVested) - parseFloat(summary.totalReleased)).toLocaleString(undefined, {maximumFractionDigits: 6}) : 
                      (summary.totalTokensIn && summary.totalTokensOut ? 
                        (parseFloat(summary.totalTokensIn) - parseFloat(summary.totalTokensOut)).toLocaleString(undefined, {maximumFractionDigits: 6}) : 
                        '0'))} {summary.tokenSymbol}
                  </p>
                </div>
                
                <div>
                  <p className="text-sm text-gray-600">Tokens Bloqueados:</p>
                  <p className="font-medium text-orange-600">
                    {summary.lockedTokens ? parseFloat(summary.lockedTokens).toLocaleString(undefined, {maximumFractionDigits: 6}) : 
                     (summary.totalVested && summary.totalReleased ? 
                      (parseFloat(summary.totalVested) - parseFloat(summary.totalReleased)).toLocaleString(undefined, {maximumFractionDigits: 6}) : 
                      (summary.totalTokensIn && summary.totalTokensOut ? 
                        (parseFloat(summary.totalTokensIn) - parseFloat(summary.totalTokensOut)).toLocaleString(undefined, {maximumFractionDigits: 6}) : 
                        '0'))} {summary.tokenSymbol}
                  </p>
                </div>
                
                <div>
                  <p className="text-sm text-gray-600">Tokens Liberables:</p>
                  <p className="font-medium text-blue-600">
                    {summary.releasableTokens ? parseFloat(summary.releasableTokens).toLocaleString(undefined, {maximumFractionDigits: 6}) : '0'} {summary.tokenSymbol}
                  </p>
                </div>
                
                <div>
                  <p className="text-sm text-gray-600">Tokens Reclamados:</p>
                  <p className="font-medium text-green-600">
                    {summary.claimedTokens ? parseFloat(summary.claimedTokens).toLocaleString(undefined, {maximumFractionDigits: 6}) : 
                     (summary.totalReleased ? parseFloat(summary.totalReleased).toLocaleString(undefined, {maximumFractionDigits: 6}) : 
                      (summary.totalTokensOut ? parseFloat(summary.totalTokensOut).toLocaleString(undefined, {maximumFractionDigits: 6}) : '0'))} {summary.tokenSymbol}
                  </p>
                </div>
              </div>
            </div>
          </div>
          
          {/* Información de beneficiarios en el resumen */}
          <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-md">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold">Beneficiarios</h3>
              <span className="text-xl font-bold text-blue-600">
                {summary.beneficiaries ? summary.beneficiaries.length : (typeof summary.totalBeneficiaries === 'number' ? summary.totalBeneficiaries : '...')}
              </span>
            </div>
            {!summary.beneficiaries && (
              <p className="text-sm text-gray-600 mt-2">Cargando información de beneficiarios...</p>
            )}
          </div>

          {/* Información del token */}
          <div className="mt-4">
            <h3 className="text-lg font-semibold">Información del Token</h3>
            {summary.tokenAddress && (
              <div>
                <p className="text-sm text-gray-600">Token:</p>
                <p className="font-medium">
                  {summary.tokenName} ({summary.tokenSymbol})
                  <a
                    href={`${getExplorerUrl(network)}/token/${summary.tokenAddress}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-800 ml-2"
                  >
                    Ver
                  </a>
                </p>
              </div>
            )}
          </div>
          
          {/* Información de schedules */}
          <div className="mt-6">
            <h4 className="text-md font-semibold mb-2">Información de Schedules</h4>
            <div className="bg-white p-3 rounded-md border border-gray-200">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                {/* Schedules activos */}
                <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                  <h4 className="text-sm font-semibold text-gray-500 mb-1">Número de Schedules Activos:</h4>
                  <p className="text-2xl font-bold">
                    {summary.totalSchedulesCreated !== undefined ? summary.totalSchedulesCreated : '...'}
                  </p>
                  {summary.totalSchedulesCreated === 0 && summary.beneficiaries && summary.beneficiaries.length > 0 && (
                    <p className="text-xs text-orange-500">Cargando schedules...</p>
                  )}
                </div>
                
                {summary.totalSchedulesCreated !== undefined && summary.totalSchedulesCreated > 0 && (
                  <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                    <h4 className="text-sm font-semibold text-gray-500 mb-1">Total de Schedules Creados:</h4>
                    <p className="text-2xl font-bold">{summary.totalSchedulesCreated || 0}</p>
                  </div>
                )}
              </div>
              
              {/* Sección de beneficiarios */}
              {summary?.beneficiaries && (
                <div className="mt-4">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold">
                      Beneficiarios ({summary.totalBeneficiaries})
                      {summary.validBeneficiaries !== undefined && (
                        <span className="ml-2 text-sm font-normal">
                          <span className="text-green-600">{summary.validBeneficiaries} válidos</span>
                          {summary.errorBeneficiaries !== undefined && summary.errorBeneficiaries > 0 && (
                            <span className="ml-2 text-red-600">{summary.errorBeneficiaries} con errores</span>
                          )}
                        </span>
                      )}
                    </h3>
                    
                    {/* Botón para cargar detalles */}
                    <button 
                      onClick={loadBeneficiaryDetails}
                      disabled={loadingDetails}
                      className={`px-4 py-2 rounded-md flex items-center ${loadingDetails ? 'bg-gray-300 cursor-not-allowed' : 'bg-blue-500 hover:bg-blue-600 text-white'}`}
                    >
                      {loadingDetails ? (
                        <>
                          <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Cargando...
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16m-7 6h7"></path>
                          </svg>
                          Cargar detalles de beneficiarios
                        </>
                      )}
                    </button>
                  </div>
                  {loadingDetails && (
                    <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
                      <p className="text-sm text-blue-600">Cargando información detallada de beneficiarios...</p>
                    </div>
                  )}
                  
                  {/* Tabla de beneficiarios (solo se muestra si se están cargando los detalles o ya se han cargado) */}
                  {showDetails && (
                    <div className="overflow-x-auto">
                    <table className="min-w-full bg-white border border-gray-200 rounded-md">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="py-2 px-4 border-b text-left">Dirección</th>
                          <th className="py-2 px-4 border-b text-center">Total Tokens</th>
                          <th className="py-2 px-4 border-b text-center">Reclamados</th>
                          <th className="py-2 px-4 border-b text-center">Pendientes</th>
                          <th className="py-2 px-4 border-b text-center">Liberables</th>
                          <th className="py-2 px-4 border-b text-center">Detalles</th>
                        </tr>
                      </thead>
                      <tbody>
                        {summary.beneficiaries.map((beneficiary: any, index: number) => (
                          <React.Fragment key={index}>
                            {/* Fila principal del beneficiario con totales */}
                            <tr className={`${index % 2 === 0 ? 'bg-gray-50' : 'bg-white'} border-b-2 border-gray-300 ${beneficiary.hasError ? 'bg-red-50' : ''} ${beneficiary.noVestings ? 'bg-yellow-50' : ''}`}>
                              <td className="py-2 px-4 font-mono text-sm font-semibold">
                                {beneficiary.address}
                                {beneficiary.vestings && <span className="ml-2 text-xs text-blue-500">({beneficiary.vestings.length} vestings)</span>}
                                {beneficiary.hasError && <span className="ml-2 text-xs text-red-500">(Error: {beneficiary.error || 'Desconocido'})</span>}
                                {beneficiary.noVestings && <span className="ml-2 text-xs text-yellow-500">(Sin vestings)</span>}
                              </td>
                              <td className="py-2 px-4 text-right font-semibold">
                                {beneficiary.totalAmount ? parseFloat(beneficiary.totalAmount).toLocaleString(undefined, { maximumFractionDigits: 4 }) : 
                                 (beneficiary.amount ? parseFloat(beneficiary.amount).toLocaleString(undefined, { maximumFractionDigits: 4 }) : '0')}
                              </td>
                              <td className="py-2 px-4 text-right text-red-600 font-semibold">
                                {beneficiary.totalClaimed ? parseFloat(beneficiary.totalClaimed).toLocaleString(undefined, { maximumFractionDigits: 4 }) : 
                                 (beneficiary.claimed ? parseFloat(beneficiary.claimed).toLocaleString(undefined, { maximumFractionDigits: 4 }) : '0')}
                              </td>
                              <td className="py-2 px-4 text-right font-semibold">
                                {beneficiary.totalRemaining ? parseFloat(beneficiary.totalRemaining).toLocaleString(undefined, { maximumFractionDigits: 4 }) : 
                                 (beneficiary.remaining ? parseFloat(beneficiary.remaining).toLocaleString(undefined, { maximumFractionDigits: 4 }) : '0')}
                              </td>
                              <td className="py-2 px-4 text-right text-green-600 font-semibold">
                                {beneficiary.totalReleasable ? parseFloat(beneficiary.totalReleasable).toLocaleString(undefined, { maximumFractionDigits: 4 }) : 
                                 (beneficiary.releasable ? parseFloat(beneficiary.releasable).toLocaleString(undefined, { maximumFractionDigits: 4 }) : '0')}
                              </td>
                              <td className="py-2 px-4 text-center">
                                {beneficiary.vestings && beneficiary.vestings.length > 0 ? (
                                  <button 
                                    className="text-blue-500 hover:text-blue-700 text-sm"
                                    onClick={() => {
                                      const expandedRows = {...expandedBeneficiaries};
                                      expandedRows[index] = !expandedRows[index];
                                      setExpandedBeneficiaries(expandedRows);
                                    }}
                                  >
                                    {expandedBeneficiaries[index] ? 'Ocultar detalles' : 'Ver detalles'}
                                  </button>
                                ) : (
                                  <span className="text-gray-400 text-sm">No hay vestings</span>
                                )}
                              </td>
                            </tr>
                            
                            {/* Filas de detalle para cada vesting individual */}
                            {beneficiary.vestings && expandedBeneficiaries[index] && beneficiary.vestings.map((vesting: any, vestingIndex: number) => (
                              <tr key={`${index}-${vestingIndex}`} className="bg-gray-100 text-sm">
                                <td className="py-1 px-4 border-b pl-8 font-mono">
                                  <span className="text-gray-600">ID: {vesting.scheduleId}</span>
                                  {vesting.isExact && <span className="ml-2 text-xs bg-green-100 text-green-800 px-1 rounded">Exacto</span>}
                                </td>
                                <td className="py-1 px-4 border-b text-right">
                                  {vesting.amount ? parseFloat(vesting.amount).toLocaleString(undefined, { maximumFractionDigits: 4 }) : '0'}
                                </td>
                                <td className="py-1 px-4 border-b text-right text-red-500">
                                  {vesting.claimed ? parseFloat(vesting.claimed).toLocaleString(undefined, { maximumFractionDigits: 4 }) : '0'}
                                </td>
                                <td className="py-1 px-4 border-b text-right">
                                  {vesting.remaining ? parseFloat(vesting.remaining).toLocaleString(undefined, { maximumFractionDigits: 4 }) : '0'}
                                </td>
                                <td className="py-1 px-4 border-b text-right text-green-500">
                                  {vesting.releasable ? parseFloat(vesting.releasable).toLocaleString(undefined, { maximumFractionDigits: 4 }) : '0'}
                                </td>
                                <td className="py-1 px-4 border-b text-center text-xs">
                                  {vesting.startTime ? (
                                    <div>
                                      <div>Inicio: {new Date(vesting.startTime * 1000).toLocaleDateString()}</div>
                                      <div>Fin: {new Date(vesting.endTime * 1000).toLocaleDateString()}</div>
                                      {vesting.cliff > 0 && (
                                        <div className="text-orange-500">
                                          Cliff: {new Date(vesting.cliff * 1000).toLocaleDateString()}
                                        </div>
                                      )}
                                    </div>
                                  ) : (
                                    <span className="text-gray-400">No disponible</span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </React.Fragment>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  )}
                </div>
              )}
            </div>
          </div>
          
          {/* Estado de vesting */}
          {summary.allTokensVested !== undefined && (
            <div className="mt-6">
              <h4 className="text-md font-semibold mb-2">Estado de Vesting</h4>
              <div className={`p-4 rounded-md ${summary.allTokensVested ? 'bg-green-50 border border-green-200' : 'bg-orange-50 border border-orange-200'}`}>
                <p className={`font-bold text-lg ${summary.allTokensVested ? 'text-green-600' : 'text-orange-600'}`}>
                  {summary.allTokensVested ? 'SÍ - Todos los tokens han sido vested' : 'NO - Aún quedan tokens por vestear'}
                </p>
                {summary.allTokensVested && (
                  <p className="text-sm text-gray-600 mt-1">
                    El contrato ha distribuido todos los tokens a los beneficiarios.
                  </p>
                )}
                {!summary.allTokensVested && summary.remainingToVest && summary.remainingToVest !== '0' && (
                  <p className="text-sm text-gray-600 mt-1">
                    Quedan aproximadamente {parseFloat(summary.remainingToVest).toLocaleString(undefined, {maximumFractionDigits: 6})} {summary.tokenSymbol} por distribuir.
                  </p>
                )}
              </div>
            </div>
          )}
          
          <div className="mt-4 text-right">
            <p className="text-xs text-gray-500">Última actualización: {new Date(summary.lastUpdated).toLocaleString()}</p>
          </div>
          
          {summary.error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-600">Error:</p>
              <p className="font-medium text-red-600">{summary.error}</p>
            </div>
          )}
        </div>
      )}
      
      {searchHistory.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-2">Historial de Búsqueda</h3>
          <div className="space-y-2">
            {searchHistory.map((item, index) => (
              <div 
                key={index} 
                className="p-2 border border-gray-200 rounded-md hover:bg-gray-50 cursor-pointer"
                onClick={() => loadFromHistory(item)}
              >
                <p className="font-medium">{item.contractAddress}</p>
                <div className="flex justify-between text-sm text-gray-600">
                  <span>{item.tokenName} ({item.tokenSymbol})</span>
                  <span>{new Date(item.lastUpdated).toLocaleString()}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default VestingSummary;
