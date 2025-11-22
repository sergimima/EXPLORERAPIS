'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

interface SearchResult {
  type: 'address' | 'transaction' | 'token';
  value: string;
  label?: string;
  description?: string;
}

export default function GlobalSearch() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isSearching, setIsSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // Detectar Cmd+K / Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(true);
      }
      if (e.key === 'Escape') {
        setIsOpen(false);
        setQuery('');
        setResults([]);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Focus input cuando se abre
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Búsqueda en tiempo real
  useEffect(() => {
    if (query.trim().length < 3) {
      setResults([]);
      return;
    }

    const searchTimeout = setTimeout(async () => {
      setIsSearching(true);
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(query.trim())}`);
        if (response.ok) {
          const data = await response.json();
          setResults(data.results || []);
          setSelectedIndex(0);
        }
      } catch (error) {
        console.error('Error en búsqueda:', error);
      } finally {
        setIsSearching(false);
      }
    }, 300); // Debounce 300ms

    return () => clearTimeout(searchTimeout);
  }, [query]);

  // Navegación con teclado
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % results.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + results.length) % results.length);
    } else if (e.key === 'Enter' && results.length > 0) {
      e.preventDefault();
      handleSelectResult(results[selectedIndex]);
    }
  };

  // Seleccionar resultado
  const handleSelectResult = (result: SearchResult) => {
    setIsOpen(false);
    setQuery('');
    setResults([]);

    // Navegar según tipo
    switch (result.type) {
      case 'address':
        router.push(`/explorer/tokens?wallet=${result.value}`);
        break;
      case 'transaction':
        window.open(`https://basescan.org/tx/${result.value}`, '_blank');
        break;
      case 'token':
        router.push(`/explorer/analytics?token=${result.value}`);
        break;
    }
  };

  // Highlight de query en texto
  const highlightMatch = (text: string, query: string) => {
    const index = text.toLowerCase().indexOf(query.toLowerCase());
    if (index === -1) return text;

    return (
      <>
        {text.substring(0, index)}
        <span className="bg-yellow-200 text-gray-900 font-semibold">
          {text.substring(index, index + query.length)}
        </span>
        {text.substring(index + query.length)}
      </>
    );
  };

  // Icono según tipo
  const getIcon = (type: string) => {
    switch (type) {
      case 'address':
        return '👤';
      case 'transaction':
        return '📝';
      case 'token':
        return '🪙';
      default:
        return '🔍';
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:border-blue-500 transition-colors"
      >
        <span className="text-gray-600">🔍</span>
        <span className="text-gray-500 text-sm">Buscar...</span>
        <kbd className="ml-auto px-2 py-1 text-xs bg-gray-100 border border-gray-300 rounded">
          {typeof navigator !== 'undefined' && navigator.platform.includes('Mac') ? '⌘' : 'Ctrl'}+K
        </kbd>
      </button>
    );
  }

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-50"
        onClick={() => setIsOpen(false)}
      />

      {/* Modal */}
      <div className="fixed top-20 left-1/2 -translate-x-1/2 w-full max-w-2xl bg-white rounded-lg shadow-2xl z-50 overflow-hidden">
        {/* Search Input */}
        <div className="flex items-center gap-3 p-4 border-b border-gray-200">
          <span className="text-gray-400 text-xl">🔍</span>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Buscar direcciones, transacciones o tokens..."
            className="flex-1 text-lg outline-none"
          />
          {isSearching && (
            <div className="animate-spin text-blue-500">⏳</div>
          )}
        </div>

        {/* Results */}
        <div className="max-h-96 overflow-y-auto">
          {query.trim().length < 3 ? (
            <div className="p-8 text-center text-gray-500">
              Escribe al menos 3 caracteres para buscar
            </div>
          ) : results.length === 0 && !isSearching ? (
            <div className="p-8 text-center text-gray-500">
              No se encontraron resultados para &quot;{query}&quot;
            </div>
          ) : (
            <div className="py-2">
              {results.map((result, index) => (
                <button
                  key={`${result.type}-${result.value}`}
                  onClick={() => handleSelectResult(result)}
                  className={`w-full px-4 py-3 flex items-start gap-3 hover:bg-gray-100 transition-colors ${
                    index === selectedIndex ? 'bg-blue-50 border-l-4 border-blue-500' : ''
                  }`}
                >
                  <span className="text-2xl flex-shrink-0">{getIcon(result.type)}</span>
                  <div className="flex-1 text-left">
                    <div className="font-medium text-gray-900">
                      {result.label || highlightMatch(result.value, query)}
                    </div>
                    {result.description && (
                      <div className="text-sm text-gray-500 mt-1">
                        {highlightMatch(result.description, query)}
                      </div>
                    )}
                    <div className="text-xs text-gray-400 mt-1">
                      {result.type === 'address' && 'Dirección'}
                      {result.type === 'transaction' && 'Transacción'}
                      {result.type === 'token' && 'Token'}
                    </div>
                  </div>
                  <span className="text-gray-400 text-sm">↵</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 flex items-center justify-between text-xs text-gray-500">
          <div className="flex gap-4">
            <span><kbd className="px-2 py-1 bg-white border border-gray-300 rounded">↑↓</kbd> Navegar</span>
            <span><kbd className="px-2 py-1 bg-white border border-gray-300 rounded">↵</kbd> Seleccionar</span>
            <span><kbd className="px-2 py-1 bg-white border border-gray-300 rounded">Esc</kbd> Cerrar</span>
          </div>
        </div>
      </div>
    </>
  );
}
