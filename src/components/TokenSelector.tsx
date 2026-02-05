'use client';

import { useToken } from '@/contexts/TokenContext';
import Link from 'next/link';
import Avatar from './Avatar';

export default function TokenSelector() {
  const { activeToken, tokens, loading, error, setActiveTokenId } = useToken();

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-muted rounded-md animate-pulse">
        <div className="w-6 h-6 bg-muted-foreground/30 rounded-full"></div>
        <div className="w-20 h-4 bg-muted-foreground/30 rounded"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-3 py-2 bg-destructive/10 text-destructive text-sm rounded-md">
        Error al cargar tokens
      </div>
    );
  }

  if (tokens.length === 0) {
    return (
      <Link
        href="/settings/tokens"
        className="px-3 py-2 bg-warning/10 border border-warning/50 text-warning text-sm rounded-md hover:bg-warning/20 transition-colors"
      >
        + Agregar Token
      </Link>
    );
  }

  return (
    <div className="relative group">
      <button className="flex items-center gap-2 px-3 py-2 bg-card border border-input rounded-md hover:bg-muted transition-colors">
        {/* Token Icon */}
        <Avatar
          src={activeToken?.logoUrl}
          name={activeToken?.symbol || '??'}
          size="xs"
        />

        {/* Token Info */}
        <div className="flex flex-col items-start">
          <span className="text-sm font-medium text-card-foreground">
            {activeToken?.symbol || 'Sin token'}
          </span>
          <span className="text-xs text-muted-foreground capitalize">
            {activeToken?.network || ''}
          </span>
        </div>

        {/* Dropdown Arrow */}
        <svg
          className="w-4 h-4 text-muted-foreground"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown Menu */}
      <div className="absolute left-0 mt-2 w-64 bg-card rounded-md shadow-lg border border-border py-1 z-50 hidden group-hover:block">
        {/* Token List */}
        <div className="max-h-64 overflow-y-auto">
          {tokens.map((token) => (
            <button
              key={token.id}
              onClick={() => setActiveTokenId(token.id)}
              className={`w-full flex items-center gap-3 px-4 py-2 text-left hover:bg-muted transition-colors ${
                activeToken?.id === token.id ? 'bg-accent' : ''
              }`}
            >
              {/* Token Icon */}
              <Avatar
                src={token.logoUrl}
                name={token.symbol}
                size="sm"
              />

              {/* Token Info */}
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm text-card-foreground truncate">
                  {token.symbol}
                </div>
                <div className="text-xs text-muted-foreground truncate">
                  {token.name}
                </div>
                <div className="text-xs text-muted-foreground capitalize">
                  {token.network}
                </div>
              </div>

              {/* Selected Indicator */}
              {activeToken?.id === token.id && (
                <svg
                  className="w-5 h-5 text-primary flex-shrink-0"
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
        <div className="border-t border-border my-1"></div>

        {/* Manage Tokens Link */}
        <Link
          href="/settings/tokens"
          className="block px-4 py-2 text-sm text-primary hover:bg-muted transition-colors"
        >
          ⚙️ Gestionar Tokens
        </Link>
      </div>
    </div>
  );
}
