'use client';

import { useState } from 'react';
import { toast } from 'sonner';

export interface AdvancedFiltersState {
  addressTypes: {
    exchanges: boolean;
    contracts: boolean;
    wallets: boolean;
  };
  amountRange: {
    min: string;
    max: string;
  };
  dateRange: {
    from: string;
    to: string;
  };
  onlyLabeled: boolean;
  excludedAddresses: string[];
}

interface AdvancedFiltersProps {
  filters: AdvancedFiltersState;
  onChange: (filters: AdvancedFiltersState) => void;
  onApply: () => void;
  onReset: () => void;
}

export const defaultFilters: AdvancedFiltersState = {
  addressTypes: {
    exchanges: true,
    contracts: true,
    wallets: true,
  },
  amountRange: {
    min: '',
    max: '',
  },
  dateRange: {
    from: '',
    to: '',
  },
  onlyLabeled: false,
  excludedAddresses: [],
};

export default function AdvancedFilters({
  filters,
  onChange,
  onApply,
  onReset,
}: AdvancedFiltersProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [newExcludedAddress, setNewExcludedAddress] = useState('');

  const updateFilters = (updates: Partial<AdvancedFiltersState>) => {
    onChange({ ...filters, ...updates });
  };

  const toggleAddressType = (type: keyof typeof filters.addressTypes) => {
    updateFilters({
      addressTypes: {
        ...filters.addressTypes,
        [type]: !filters.addressTypes[type],
      },
    });
  };

  const addExcludedAddress = () => {
    if (!newExcludedAddress.trim()) return;
    if (!/^0x[a-fA-F0-9]{40}$/.test(newExcludedAddress.trim())) {
      toast.error('Formato de address inválido');
      return;
    }

    updateFilters({
      excludedAddresses: [...filters.excludedAddresses, newExcludedAddress.trim().toLowerCase()],
    });
    setNewExcludedAddress('');
  };

  const removeExcludedAddress = (address: string) => {
    updateFilters({
      excludedAddresses: filters.excludedAddresses.filter((a) => a !== address),
    });
  };

  const hasActiveFilters =
    !filters.addressTypes.exchanges ||
    !filters.addressTypes.contracts ||
    !filters.addressTypes.wallets ||
    filters.amountRange.min !== '' ||
    filters.amountRange.max !== '' ||
    filters.dateRange.from !== '' ||
    filters.dateRange.to !== '' ||
    filters.onlyLabeled ||
    filters.excludedAddresses.length > 0;

  return (
    <div className="bg-card rounded-lg shadow-md mb-6 border border-border">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-6 py-4 flex items-center justify-between hover:bg-muted transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-lg font-semibold text-card-foreground">🔧 Filtros Avanzados</span>
          {hasActiveFilters && (
            <span className="px-2 py-1 bg-accent text-accent-foreground rounded text-xs font-medium">
              Activos
            </span>
          )}
        </div>
        <span className="text-muted-foreground">{isExpanded ? '▲' : '▼'}</span>
      </button>

      {/* Content */}
      {isExpanded && (
        <div className="px-6 pb-6 space-y-6 border-t border-border pt-6">
          {/* Tipo de Address */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-3">
              Tipo de Address
            </label>
            <div className="flex flex-wrap gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={filters.addressTypes.exchanges}
                  onChange={() => toggleAddressType('exchanges')}
                  className="rounded"
                />
                <span className="text-sm text-foreground">🏦 Exchanges (CEX)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={filters.addressTypes.contracts}
                  onChange={() => toggleAddressType('contracts')}
                  className="rounded"
                />
                <span className="text-sm text-foreground">📝 Contratos</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={filters.addressTypes.wallets}
                  onChange={() => toggleAddressType('wallets')}
                  className="rounded"
                />
                <span className="text-sm text-foreground">👤 Wallets</span>
              </label>
            </div>
          </div>

          {/* Rango de Montos */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-3">
              Rango de Montos (VTN)
            </label>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <input
                  type="number"
                  placeholder="Mínimo"
                  value={filters.amountRange.min}
                  onChange={(e) =>
                    updateFilters({
                      amountRange: { ...filters.amountRange, min: e.target.value },
                    })
                  }
                  className="w-full px-3 py-2 border border-input rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
                />
              </div>
              <div>
                <input
                  type="number"
                  placeholder="Máximo"
                  value={filters.amountRange.max}
                  onChange={(e) =>
                    updateFilters({
                      amountRange: { ...filters.amountRange, max: e.target.value },
                    })
                  }
                  className="w-full px-3 py-2 border border-input rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
                />
              </div>
            </div>
          </div>

          {/* Rango de Fechas */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-3">
              Rango de Fechas
            </label>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <input
                  type="date"
                  value={filters.dateRange.from}
                  onChange={(e) =>
                    updateFilters({
                      dateRange: { ...filters.dateRange, from: e.target.value },
                    })
                  }
                  className="w-full px-3 py-2 border border-input rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
                />
              </div>
              <div>
                <input
                  type="date"
                  value={filters.dateRange.to}
                  onChange={(e) =>
                    updateFilters({
                      dateRange: { ...filters.dateRange, to: e.target.value },
                    })
                  }
                  className="w-full px-3 py-2 border border-input rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
                />
              </div>
            </div>
          </div>

          {/* Solo Etiquetadas */}
          <div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={filters.onlyLabeled}
                onChange={(e) => updateFilters({ onlyLabeled: e.target.checked })}
                className="rounded"
              />
              <span className="text-sm text-foreground">
                🏷️ Mostrar solo addresses etiquetadas
              </span>
            </label>
          </div>

          {/* Excluir Addresses */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-3">
              Excluir Addresses
            </label>
            <div className="flex gap-2 mb-3">
              <input
                type="text"
                placeholder="0x..."
                value={newExcludedAddress}
                onChange={(e) => setNewExcludedAddress(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addExcludedAddress()}
                className="flex-1 px-3 py-2 border border-input rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent text-sm font-mono"
              />
              <button
                onClick={addExcludedAddress}
                className="px-4 py-2 bg-muted text-foreground rounded-lg hover:bg-muted/80 transition-colors text-sm"
              >
                + Agregar
              </button>
            </div>

            {filters.excludedAddresses.length > 0 && (
              <div className="space-y-2">
                {filters.excludedAddresses.map((addr) => (
                  <div
                    key={addr}
                    className="flex items-center justify-between p-2 bg-muted rounded border border-border"
                  >
                    <span className="text-xs font-mono text-foreground">
                      {addr.slice(0, 10)}...{addr.slice(-8)}
                    </span>
                    <button
                      onClick={() => removeExcludedAddress(addr)}
                      className="text-destructive hover:opacity-80 text-sm"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Botones */}
          <div className="flex gap-3 pt-4 border-t border-border">
            <button
              onClick={onApply}
              className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-colors font-medium"
            >
              Aplicar Filtros
            </button>
            <button
              onClick={onReset}
              className="px-4 py-2 bg-muted text-foreground rounded-lg hover:bg-muted/80 transition-colors"
            >
              Resetear
            </button>
          </div>

          {/* Info de filtros activos */}
          {hasActiveFilters && (
            <div className="text-xs text-muted-foreground space-y-1">
              <div className="font-medium">Filtros activos:</div>
              {(!filters.addressTypes.exchanges ||
                !filters.addressTypes.contracts ||
                !filters.addressTypes.wallets) && (
                <div>
                  • Tipos:{' '}
                  {[
                    filters.addressTypes.exchanges && 'Exchanges',
                    filters.addressTypes.contracts && 'Contratos',
                    filters.addressTypes.wallets && 'Wallets',
                  ]
                    .filter(Boolean)
                    .join(', ')}
                </div>
              )}
              {(filters.amountRange.min || filters.amountRange.max) && (
                <div>
                  • Montos: {filters.amountRange.min || '0'} -{' '}
                  {filters.amountRange.max || '∞'} VTN
                </div>
              )}
              {(filters.dateRange.from || filters.dateRange.to) && (
                <div>
                  • Fechas: {filters.dateRange.from || 'inicio'} →{' '}
                  {filters.dateRange.to || 'hoy'}
                </div>
              )}
              {filters.onlyLabeled && <div>• Solo etiquetadas</div>}
              {filters.excludedAddresses.length > 0 && (
                <div>• {filters.excludedAddresses.length} address(es) excluidas</div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
