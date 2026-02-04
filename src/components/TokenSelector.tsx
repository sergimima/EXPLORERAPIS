'use client';

import { useToken } from '@/contexts/TokenContext';
import Link from 'next/link';

export default function TokenSelector() {
  const { activeToken, tokens, loading, error, setActiveTokenId } = useToken();

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-gray-100 rounded-md animate-pulse">
        <div className="w-6 h-6 bg-gray-300 rounded-full"></div>
        <div className="w-20 h-4 bg-gray-300 rounded"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-3 py-2 bg-red-50 text-red-600 text-sm rounded-md">
        Error al cargar tokens
      </div>
    );
  }

  if (tokens.length === 0) {
    return (
      <Link
        href="/settings/tokens"
        className="px-3 py-2 bg-yellow-50 border border-yellow-200 text-yellow-700 text-sm rounded-md hover:bg-yellow-100 transition-colors"
      >
        + Agregar Token
      </Link>
    );
  }

  return (
    <div className="relative group">
      <button className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors">
        {/* Token Icon */}
        <div className="w-6 h-6 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-xs font-bold">
          {activeToken?.symbol.substring(0, 2) || '??'}
        </div>

        {/* Token Info */}
        <div className="flex flex-col items-start">
          <span className="text-sm font-medium text-gray-900">
            {activeToken?.symbol || 'Sin token'}
          </span>
          <span className="text-xs text-gray-500 capitalize">
            {activeToken?.network || ''}
          </span>
        </div>

        {/* Dropdown Arrow */}
        <svg
          className="w-4 h-4 text-gray-500"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown Menu */}
      <div className="absolute left-0 mt-2 w-64 bg-white rounded-md shadow-lg border border-gray-200 py-1 z-50 hidden group-hover:block">
        {/* Token List */}
        <div className="max-h-64 overflow-y-auto">
          {tokens.map((token) => (
            <button
              key={token.id}
              onClick={() => setActiveTokenId(token.id)}
              className={`w-full flex items-center gap-3 px-4 py-2 text-left hover:bg-gray-50 transition-colors ${
                activeToken?.id === token.id ? 'bg-blue-50' : ''
              }`}
            >
              {/* Token Icon */}
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                {token.symbol.substring(0, 2)}
              </div>

              {/* Token Info */}
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm text-gray-900 truncate">
                  {token.symbol}
                </div>
                <div className="text-xs text-gray-500 truncate">
                  {token.name}
                </div>
                <div className="text-xs text-gray-400 capitalize">
                  {token.network}
                </div>
              </div>

              {/* Selected Indicator */}
              {activeToken?.id === token.id && (
                <svg
                  className="w-5 h-5 text-blue-600 flex-shrink-0"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
              )}
            </button>
          ))}
        </div>

        {/* Divider */}
        <div className="border-t border-gray-200 my-1"></div>

        {/* Manage Tokens Link */}
        <Link
          href="/settings/tokens"
          className="block px-4 py-2 text-sm text-blue-600 hover:bg-blue-50 transition-colors"
        >
          ⚙️ Gestionar Tokens
        </Link>
      </div>
    </div>
  );
}
