import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { checkVestingContractStatus } from '@/actions/blockchain';
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
  const [beneficiariesLastUpdate, setBeneficiariesLastUpdate] = useState<Date | null>(null);
  const [loadingBeneficiaries, setLoadingBeneficiaries] = useState<boolean>(false);

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
  const loadBeneficiaryDetails = async (forceRefresh = false) => {
    if (!summary || !contractAddress) return;

    setLoadingBeneficiaries(true);
    setShowDetails(true);

    try {
      let shouldRefresh = forceRefresh;

      // 1. Intentar cargar desde BD primero (solo si no es force refresh)
      if (!forceRefresh) {
        const params = new URLSearchParams({
          vestingContract: contractAddress,
          network: network
        });

        const cacheResponse = await fetch(`/api/vesting-beneficiaries?${params}`);

        if (cacheResponse.ok) {
          const cacheData = await cacheResponse.json();

          if (cacheData.beneficiaries && cacheData.beneficiaries.length > 0) {
            // Verificar si hay beneficiarios con datos en 0
            const hasZeroData = cacheData.beneficiaries.some((b: any) =>
              b.totalAmount === '0' && b.releasedAmount === '0' && b.claimableAmount === '0'
            );

            if (hasZeroData) {
              console.log('⚠️ Encontrados beneficiarios con datos en 0, forzando actualización...');
              shouldRefresh = true;
            } else {
              // Hay datos en caché válidos, usarlos
              console.log(`✓ Cargados ${cacheData.count} beneficiarios desde BD`);

              setSummary(prevSummary => {
                if (!prevSummary) return null;
                return {
                  ...prevSummary,
                  beneficiaries: cacheData.beneficiaries.map((b: any) => ({
                    address: b.beneficiaryAddress,
                    amount: b.totalAmount,
                    claimed: b.releasedAmount,
                    releasable: b.claimableAmount,
                    remaining: b.remainingAmount,
                    start: b.startTime,
                    end: b.endTime,
                    vestings: b.vestings && b.vestings.length > 0 ? b.vestings.map((v: any) => ({
                      scheduleId: v.scheduleId,
                      phase: v.phase,
                      cliff: v.cliff,
                      start: v.start,
                      duration: v.duration,
                      amount: v.amountTotal,
                      slicePeriodSeconds: v.claimFrequencyInSeconds,
                      lastClaimDate: v.lastClaimDate,
                      released: v.released,
                      revoked: v.revoked
                    })) : undefined
                  })),
                  validBeneficiaries: cacheData.count,
                  errorBeneficiaries: 0
                  // totalSchedulesCreated ya viene del useEffect inicial (checkVestingContractStatus sin beneficiarios)
                };
              });

              setBeneficiariesLastUpdate(new Date(cacheData.lastUpdate));
              setLoadingBeneficiaries(false);
              return; // Terminar aquí si hay caché válido
            }
          }
        }
      }

      // 2. Si no hay caché, tiene force refresh, o hay datos en 0 → consultar blockchain
      console.log(shouldRefresh ? '🔄 Actualizando beneficiarios desde blockchain...' : 'No hay caché de beneficiarios, consultando blockchain...');
      const contractStatus = await checkVestingContractStatus(contractAddress, network);

      console.log('Beneficiarios obtenidos de blockchain:', contractStatus.beneficiaries?.slice(0, 3)); // Primeros 3 para debug

      // 3. Guardar en BD
      if (contractStatus.beneficiaries && contractStatus.beneficiaries.length > 0) {
        const saveResponse = await fetch('/api/vesting-beneficiaries', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            vestingContract: contractAddress,
            beneficiaries: contractStatus.beneficiaries.map((b: any) => ({
              beneficiaryAddress: b.address,
              totalAmount: b.amount || '0',
              vestedAmount: b.vested || '0',
              releasedAmount: b.claimed || '0',
              claimableAmount: b.releasable || '0',
              remainingAmount: b.remaining || '0',
              startTime: b.start || 0,
              endTime: b.end || 0,
              vestings: b.vestings || undefined
            })),
            network: network,
            tokenAddress: contractStatus.tokenAddress || '',
            tokenSymbol: contractStatus.tokenSymbol || 'TOKEN',
            tokenName: contractStatus.tokenName || 'Unknown Token'
          })
        });

        if (saveResponse.ok) {
          const saveData = await saveResponse.json();
          console.log(`✓ Guardados ${saveData.saved} beneficiarios en BD`);
        }
      }

      // 4. Actualizar el resumen
      setSummary(prevSummary => {
        if (!prevSummary) return null;

        return {
          ...prevSummary,
          beneficiaries: contractStatus.beneficiaries || [],
          validBeneficiaries: contractStatus.validBeneficiaries,
          errorBeneficiaries: contractStatus.errorBeneficiaries,
        };
      });

      setBeneficiariesLastUpdate(new Date());
    } catch (error) {
      console.error('Error al cargar detalles de beneficiarios:', error);
      setError('Error al cargar los detalles de beneficiarios');
    } finally {
      setLoadingBeneficiaries(false);
    }
  };

  // Función para actualizar un solo beneficiario
  const refreshSingleBeneficiary = async (beneficiaryAddress: string) => {
    if (!contractAddress || !summary) return;

    setLoadingBeneficiaries(true);

    try {
      // Llamar a getVestingListByHolder para este beneficiario específico
      const response = await fetch('/api/refresh-single-beneficiary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vestingContract: contractAddress,
          beneficiaryAddress: beneficiaryAddress,
          network: network,
          tokenAddress: summary.tokenAddress || '',
          tokenSymbol: summary.tokenSymbol || 'TOKEN',
          tokenName: summary.tokenName || 'Unknown Token'
        })
      });

      if (!response.ok) {
        throw new Error('Error al actualizar beneficiario');
      }

      const data = await response.json();
      console.log('✓ Beneficiario actualizado:', data);

      // Recargar beneficiarios desde BD para reflejar los cambios
      await loadBeneficiaryDetails(false);
    } catch (error) {
      console.error('Error al actualizar beneficiario:', error);
      toast.error('Error al actualizar beneficiario');
    } finally {
      setLoadingBeneficiaries(false);
    }
  };

  // Función para limpiar caché y recargar desde cero
  const handleClearCacheAndReload = async () => {
    if (!contractAddress || !summary) return;

    if (!confirm('¿Borrar caché y descargar TODO el historial desde cero? Esto puede tardar.')) {
      return;
    }

    setLoadingBasic(true);
    setError(null);

    try {
      // Borrar caché (usar token del contrato de vesting verificado)
      const tokenAddressForCache = summary.tokenAddress || '';
      if (!tokenAddressForCache) {
        setError('No se pudo determinar la dirección del token del contrato');
        setLoadingBasic(false);
        return;
      }
      const params = new URLSearchParams({
        contractAddress: contractAddress,
        tokenAddress: tokenAddressForCache,
        network: network
      });

      const deleteResponse = await fetch(`/api/transfers-cache?${params}`, {
        method: 'DELETE'
      });

      if (!deleteResponse.ok) {
        throw new Error('Error al borrar caché');
      }

      const deleteData = await deleteResponse.json();
      console.log(`✓ Borrados ${deleteData.deleted} registros de caché`);

      // Recargar datos
      await handleSearch();
    } catch (error) {
      console.error('Error al limpiar caché:', error);
      setError('Error al limpiar caché y recargar');
      setLoadingBasic(false);
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
          // Usar la función para verificar el estado del contrato de vesting (SIN cargar beneficiarios)
          const contractStatus = await checkVestingContractStatus(initialContractAddress, network, false);
          
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
    <div className="bg-card shadow-md rounded-lg p-6 border border-border">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Resumen de Contrato de Vesting</h2>
        {summary && (
          <div className="flex gap-2">
            <button
              onClick={handleSearch}
              disabled={loadingBasic || loadingDetails}
              className={`px-4 py-2 rounded-md text-white ${
                (loadingBasic || loadingDetails) ? 'bg-muted' : 'bg-success hover:opacity-90'
              }`}
            >
              {(loadingBasic || loadingDetails) ? 'Refrescando...' : '🔄 Refrescar'}
            </button>
            <button
              onClick={handleClearCacheAndReload}
              disabled={loadingBasic || loadingDetails}
              className={`px-4 py-2 rounded-md text-white ${
                (loadingBasic || loadingDetails) ? 'bg-muted' : 'bg-destructive hover:opacity-90'
              }`}
            >
              {(loadingBasic || loadingDetails) ? 'Borrando...' : '🗑️ Recargar desde cero'}
            </button>
          </div>
        )}
      </div>
      
      {!hideSearchBar && (
        <div className="mb-6">
          <div className="flex items-center space-x-2">
            <input
              type="text"
              value={contractAddress}
              onChange={(e) => setContractAddress(e.target.value)}
              placeholder="Dirección del contrato de vesting"
              className="flex-1 p-2 border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-primary bg-background text-foreground"
            />
            <button
              onClick={handleSearch}
              disabled={loadingBasic || loadingDetails}
              className={`px-4 py-2 rounded-md text-primary-foreground ${
                (loadingBasic || loadingDetails) ? 'bg-muted' : 'bg-primary hover:opacity-90'
              }`}
            >
              {(loadingBasic || loadingDetails) ? 'Buscando...' : 'Buscar'}
            </button>
          </div>
          {error && <p className="text-destructive mt-2">{error}</p>}
        </div>
      )}
      
      {summary && (
        <div className="bg-background p-4 rounded-md mb-6">
          <h3 className="text-lg font-semibold mb-2">Información del Contrato</h3>
          {loadingBasic && (
            <div className="flex justify-center items-center my-8">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
              <span className="ml-3 text-muted-foreground">Cargando información básica del contrato...</span>
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Dirección del Contrato:</p>
              <p className="font-medium">
                <a
                  href={`${getExplorerUrl(network)}/address/${summary.contractAddress}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:opacity-80"
                >
                  {summary.contractAddress}
                </a>
              </p>
            </div>
            
            {summary.contractType && (
              <div>
                <p className="text-sm text-muted-foreground">Tipo de Contrato:</p>
                <p className="font-medium">{summary.contractType}</p>
              </div>
            )}
            
            {summary.tokenAddress && (
              <div>
                <p className="text-sm text-muted-foreground">Token:</p>
                <p className="font-medium">
                  {summary.tokenName} ({summary.tokenSymbol})
                  <a
                    href={`${getExplorerUrl(network)}/token/${summary.tokenAddress}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:opacity-80 ml-2"
                  >
                    Ver
                  </a>
                </p>
              </div>
            )}
            
            {summary.creationDate && (
              <div>
                <p className="text-sm text-muted-foreground">Fecha de Creación:</p>
                <p className="font-medium">{new Date(summary.creationDate).toLocaleString()}</p>
              </div>
            )}
          </div>
          
          {/* Resumen de tokens */}
          <div className="mt-6">
            <h4 className="text-md font-semibold mb-2">Resumen de Tokens</h4>
            <div className="bg-card p-3 rounded-md border border-border">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Total Tokens IN:</p>
                  <p className="font-medium text-success">
                    {summary.totalTokensIn ? parseFloat(summary.totalTokensIn).toLocaleString(undefined, {maximumFractionDigits: 6}) : '0'} {summary.tokenSymbol}
                  </p>
                </div>
                
                <div>
                  <p className="text-sm text-muted-foreground">Total Tokens OUT:</p>
                  <p className="font-medium text-destructive">
                    {summary.totalTokensOut ? parseFloat(summary.totalTokensOut).toLocaleString(undefined, {maximumFractionDigits: 6}) : '0'} {summary.tokenSymbol}
                  </p>
                </div>
                
                <div>
                  <p className="text-sm text-muted-foreground">Balance Actual en Contrato:</p>
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
            <div className="bg-card p-3 rounded-md border border-border">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Total Vested:</p>
                  <p className="font-medium">
                    {summary.totalVested ? parseFloat(summary.totalVested).toLocaleString(undefined, {maximumFractionDigits: 6}) : 
                     (summary.totalTokensIn ? parseFloat(summary.totalTokensIn).toLocaleString(undefined, {maximumFractionDigits: 6}) : '0')} {summary.tokenSymbol}
                  </p>
                </div>
                
                <div>
                  <p className="text-sm text-muted-foreground">Total Liberado:</p>
                  <p className="font-medium">
                    {summary.totalReleased ? parseFloat(summary.totalReleased).toLocaleString(undefined, {maximumFractionDigits: 6}) : 
                     (summary.totalTokensOut ? parseFloat(summary.totalTokensOut).toLocaleString(undefined, {maximumFractionDigits: 6}) : '0')} {summary.tokenSymbol}
                  </p>
                </div>
                
                <div>
                  <p className="text-sm text-muted-foreground">Pendiente de Vesting:</p>
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
                  <p className="text-sm text-muted-foreground">Tokens Bloqueados:</p>
                  <p className="font-medium text-warning">
                    {summary.lockedTokens ? parseFloat(summary.lockedTokens).toLocaleString(undefined, {maximumFractionDigits: 6}) : 
                     (summary.totalVested && summary.totalReleased ? 
                      (parseFloat(summary.totalVested) - parseFloat(summary.totalReleased)).toLocaleString(undefined, {maximumFractionDigits: 6}) : 
                      (summary.totalTokensIn && summary.totalTokensOut ? 
                        (parseFloat(summary.totalTokensIn) - parseFloat(summary.totalTokensOut)).toLocaleString(undefined, {maximumFractionDigits: 6}) : 
                        '0'))} {summary.tokenSymbol}
                  </p>
                </div>
                
                <div>
                  <p className="text-sm text-muted-foreground">Tokens Liberables:</p>
                  <p className="font-medium text-primary">
                    {summary.releasableTokens ? parseFloat(summary.releasableTokens).toLocaleString(undefined, {maximumFractionDigits: 6}) : '0'} {summary.tokenSymbol}
                  </p>
                </div>
                
                <div>
                  <p className="text-sm text-muted-foreground">Tokens Reclamados:</p>
                  <p className="font-medium text-success">
                    {summary.claimedTokens ? parseFloat(summary.claimedTokens).toLocaleString(undefined, {maximumFractionDigits: 6}) : 
                     (summary.totalReleased ? parseFloat(summary.totalReleased).toLocaleString(undefined, {maximumFractionDigits: 6}) : 
                      (summary.totalTokensOut ? parseFloat(summary.totalTokensOut).toLocaleString(undefined, {maximumFractionDigits: 6}) : '0'))} {summary.tokenSymbol}
                  </p>
                </div>
              </div>
            </div>
          </div>
          
          {/* Información de beneficiarios en el resumen */}
          <div className="mt-4 p-4 bg-accent border border-border rounded-md">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold">Beneficiarios</h3>
              <span className="text-xl font-bold text-primary">
                {summary.beneficiaries ? summary.beneficiaries.length : (typeof summary.totalBeneficiaries === 'number' ? summary.totalBeneficiaries : '...')}
              </span>
            </div>
            {!summary.beneficiaries && (
              <p className="text-sm text-muted-foreground mt-2">Cargando información de beneficiarios...</p>
            )}
          </div>

          {/* Información del token */}
          <div className="mt-4">
            <h3 className="text-lg font-semibold">Información del Token</h3>
            {summary.tokenAddress && (
              <div>
                <p className="text-sm text-muted-foreground">Token:</p>
                <p className="font-medium">
                  {summary.tokenName} ({summary.tokenSymbol})
                  <a
                    href={`${getExplorerUrl(network)}/token/${summary.tokenAddress}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:opacity-80 ml-2"
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
            <div className="bg-card p-3 rounded-md border border-border">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                {/* Schedules activos */}
                <div className="bg-card p-4 rounded-lg shadow-sm border border-border">
                  <h4 className="text-sm font-semibold text-muted-foreground mb-1">Número de Schedules Activos:</h4>
                  <p className="text-2xl font-bold">
                    {summary.totalSchedulesCreated !== undefined ? summary.totalSchedulesCreated : '...'}
                  </p>
                  {summary.totalSchedulesCreated === 0 && summary.beneficiaries && summary.beneficiaries.length > 0 && (
                    <p className="text-xs text-warning">Cargando schedules...</p>
                  )}
                </div>
                
                {summary.totalSchedulesCreated !== undefined && summary.totalSchedulesCreated > 0 && (
                  <div className="bg-card p-4 rounded-lg shadow-sm border border-border">
                    <h4 className="text-sm font-semibold text-muted-foreground mb-1">Total de Schedules Creados:</h4>
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
                          <span className="text-success">{summary.validBeneficiaries} válidos</span>
                          {summary.errorBeneficiaries !== undefined && summary.errorBeneficiaries > 0 && (
                            <span className="ml-2 text-destructive">{summary.errorBeneficiaries} con errores</span>
                          )}
                        </span>
                      )}
                    </h3>
                    
                    {/* Botones para cargar/actualizar detalles */}
                    <div className="flex gap-2 items-center">
                      {beneficiariesLastUpdate && (
                        <span className="text-sm text-muted-foreground">
                          Última actualización: {beneficiariesLastUpdate.toLocaleString()}
                        </span>
                      )}
                      <button
                        onClick={() => loadBeneficiaryDetails(false)}
                        disabled={loadingBeneficiaries}
                        className={`px-4 py-2 rounded-md flex items-center ${loadingBeneficiaries ? 'bg-muted cursor-not-allowed' : 'bg-primary hover:opacity-90 text-primary-foreground'}`}
                      >
                        {loadingBeneficiaries ? (
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
                            {beneficiariesLastUpdate ? '🔄 Actualizar beneficiarios' : 'Cargar detalles de beneficiarios'}
                          </>
                        )}
                      </button>

                      {beneficiariesLastUpdate && (
                        <button
                          onClick={() => loadBeneficiaryDetails(true)}
                          disabled={loadingBeneficiaries}
                          className={`px-4 py-2 rounded-md flex items-center ${loadingBeneficiaries ? 'bg-muted cursor-not-allowed' : 'bg-destructive hover:opacity-90 text-destructive-foreground'}`}
                        >
                          {loadingBeneficiaries ? (
                            <>
                              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                              Limpiando...
                            </>
                          ) : (
                            <>
                              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                              </svg>
                              🗑️ Limpiar y recargar todo
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                  {loadingDetails && (
                    <div className="mb-4 p-3 bg-accent border border-border rounded-md">
                      <p className="text-sm text-primary">Cargando información detallada de beneficiarios...</p>
                    </div>
                  )}
                  
                  {/* Tabla de beneficiarios (solo se muestra si se están cargando los detalles o ya se han cargado) */}
                  {showDetails && (
                    <div className="overflow-x-auto">
                    <table className="min-w-full bg-card border border-border rounded-md">
                      <thead className="bg-muted">
                        <tr>
                          <th className="py-2 px-4 border-b text-left">Dirección</th>
                          <th className="py-2 px-4 border-b text-center">Total Tokens</th>
                          <th className="py-2 px-4 border-b text-center">Reclamados</th>
                          <th className="py-2 px-4 border-b text-center">Pendientes</th>
                          <th className="py-2 px-4 border-b text-center">Liberables</th>
                          <th className="py-2 px-4 border-b text-center">Detalles</th>
                          <th className="py-2 px-4 border-b text-center">Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {summary.beneficiaries.map((beneficiary: any, index: number) => (
                          <React.Fragment key={index}>
                            {/* Fila principal del beneficiario con totales */}
                            <tr className={`${index % 2 === 0 ? 'bg-muted' : 'bg-card'} border-b-2 border-border ${beneficiary.hasError ? 'bg-destructive/10' : ''} ${beneficiary.noVestings ? 'bg-warning/10' : ''}`}>
                              <td className="py-2 px-4 font-mono text-sm font-semibold">
                                {beneficiary.address}
                                {beneficiary.vestings && <span className="ml-2 text-xs text-primary">({beneficiary.vestings.length} vestings)</span>}
                                {beneficiary.hasError && <span className="ml-2 text-xs text-destructive">(Error: {beneficiary.error || 'Desconocido'})</span>}
                                {beneficiary.noVestings && <span className="ml-2 text-xs text-warning">(Sin vestings)</span>}
                              </td>
                              <td className="py-2 px-4 text-right font-semibold">
                                {beneficiary.totalAmount ? parseFloat(beneficiary.totalAmount).toLocaleString(undefined, { maximumFractionDigits: 4 }) : 
                                 (beneficiary.amount ? parseFloat(beneficiary.amount).toLocaleString(undefined, { maximumFractionDigits: 4 }) : '0')}
                              </td>
                              <td className="py-2 px-4 text-right text-destructive font-semibold">
                                {beneficiary.totalClaimed ? parseFloat(beneficiary.totalClaimed).toLocaleString(undefined, { maximumFractionDigits: 4 }) : 
                                 (beneficiary.claimed ? parseFloat(beneficiary.claimed).toLocaleString(undefined, { maximumFractionDigits: 4 }) : '0')}
                              </td>
                              <td className="py-2 px-4 text-right font-semibold">
                                {beneficiary.totalRemaining ? parseFloat(beneficiary.totalRemaining).toLocaleString(undefined, { maximumFractionDigits: 4 }) : 
                                 (beneficiary.remaining ? parseFloat(beneficiary.remaining).toLocaleString(undefined, { maximumFractionDigits: 4 }) : '0')}
                              </td>
                              <td className="py-2 px-4 text-right text-success font-semibold">
                                {beneficiary.totalReleasable ? parseFloat(beneficiary.totalReleasable).toLocaleString(undefined, { maximumFractionDigits: 4 }) : 
                                 (beneficiary.releasable ? parseFloat(beneficiary.releasable).toLocaleString(undefined, { maximumFractionDigits: 4 }) : '0')}
                              </td>
                              <td className="py-2 px-4 text-center">
                                {beneficiary.vestings && beneficiary.vestings.length > 0 ? (
                                  <button
                                    className="text-primary hover:opacity-80 text-sm"
                                    onClick={() => {
                                      const expandedRows = {...expandedBeneficiaries};
                                      expandedRows[index] = !expandedRows[index];
                                      setExpandedBeneficiaries(expandedRows);
                                    }}
                                  >
                                    {expandedBeneficiaries[index] ? 'Ocultar detalles' : 'Ver detalles'}
                                  </button>
                                ) : (
                                  <span className="text-muted-foreground text-sm">No hay vestings</span>
                                )}
                              </td>
                              <td className="py-2 px-4 text-center">
                                <button
                                  onClick={() => refreshSingleBeneficiary(beneficiary.address)}
                                  disabled={loadingBeneficiaries}
                                  className="text-primary hover:opacity-80 disabled:text-muted-foreground disabled:cursor-not-allowed"
                                  title="Actualizar datos de este beneficiario"
                                >
                                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
                                  </svg>
                                </button>
                              </td>
                            </tr>
                            
                            {/* Filas de detalle para cada vesting individual */}
                            {beneficiary.vestings && expandedBeneficiaries[index] && beneficiary.vestings.map((vesting: any, vestingIndex: number) => {
                              const remaining = vesting.amount && vesting.released ? (parseFloat(vesting.amount) - parseFloat(vesting.released)).toString() : '0';
                              const endTime = vesting.start && vesting.duration ? vesting.start + vesting.duration : 0;

                              return (
                              <tr key={`${index}-${vestingIndex}`} className="bg-muted text-sm">
                                <td className="py-1 px-4 border-b pl-8 font-mono">
                                  <div className="text-card-foreground">{vesting.phase || 'Sin fase'}</div>
                                  <div className="text-xs text-muted-foreground">ID: {vesting.scheduleId || 'N/A'}</div>
                                </td>
                                <td className="py-1 px-4 border-b text-right">
                                  {vesting.amount ? parseFloat(vesting.amount).toLocaleString(undefined, { maximumFractionDigits: 4 }) : '0'}
                                </td>
                                <td className="py-1 px-4 border-b text-right text-destructive">
                                  {vesting.released ? parseFloat(vesting.released).toLocaleString(undefined, { maximumFractionDigits: 4 }) : '0'}
                                </td>
                                <td className="py-1 px-4 border-b text-right">
                                  {parseFloat(remaining).toLocaleString(undefined, { maximumFractionDigits: 4 })}
                                </td>
                                <td className="py-1 px-4 border-b text-right text-success">
                                  0
                                </td>
                                <td className="py-1 px-4 border-b text-center text-xs">
                                  {vesting.start ? (
                                    <div>
                                      <div>Inicio: {new Date(vesting.start * 1000).toLocaleDateString()}</div>
                                      {endTime > 0 && <div>Fin: {new Date(endTime * 1000).toLocaleDateString()}</div>}
                                      {vesting.cliff > 0 && (
                                        <div className="text-warning">
                                          Cliff: {new Date((vesting.start + vesting.cliff) * 1000).toLocaleDateString()}
                                        </div>
                                      )}
                                    </div>
                                  ) : (
                                    <span className="text-muted-foreground">No disponible</span>
                                  )}
                                </td>
                              </tr>
                              );
                            })}
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
              <div className={`p-4 rounded-md ${summary.allTokensVested ? 'bg-success/10 border border-success' : 'bg-warning/10 border border-warning'}`}>
                <p className={`font-bold text-lg ${summary.allTokensVested ? 'text-success' : 'text-warning'}`}>
                  {summary.allTokensVested ? 'SÍ - Todos los tokens han sido vested' : 'NO - Aún quedan tokens por vestear'}
                </p>
                {summary.allTokensVested && (
                  <p className="text-sm text-muted-foreground mt-1">
                    El contrato ha distribuido todos los tokens a los beneficiarios.
                  </p>
                )}
                {!summary.allTokensVested && summary.remainingToVest && summary.remainingToVest !== '0' && (
                  <p className="text-sm text-muted-foreground mt-1">
                    Quedan aproximadamente {parseFloat(summary.remainingToVest).toLocaleString(undefined, {maximumFractionDigits: 6})} {summary.tokenSymbol} por distribuir.
                  </p>
                )}
              </div>
            </div>
          )}
          
          <div className="mt-4 text-right">
            <p className="text-xs text-muted-foreground">Última actualización: {new Date(summary.lastUpdated).toLocaleString()}</p>
          </div>
          
          {summary.error && (
            <div className="mt-4 p-3 bg-destructive/10 border border-destructive rounded-md">
              <p className="text-sm text-destructive">Error:</p>
              <p className="font-medium text-destructive">{summary.error}</p>
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
                className="p-2 border border-border rounded-md hover:bg-muted cursor-pointer"
                onClick={() => loadFromHistory(item)}
              >
                <p className="font-medium">{item.contractAddress}</p>
                <div className="flex justify-between text-sm text-muted-foreground">
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
