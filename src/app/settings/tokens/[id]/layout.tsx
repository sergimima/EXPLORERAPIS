'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';

const PATH_TO_LABEL: Record<string, string> = {
  general: 'General',
  'api-keys': 'API Keys',
  supply: 'Supply',
  abi: 'Token ABI',
  contracts: 'Contratos',
};

export default function TokenSettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const params = useParams();
  const pathname = usePathname();
  const router = useRouter();
  const tokenId = params.id as string;
  const sidebarRef = useRef<HTMLElement>(null);

  const [token, setToken] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    fetchToken();
  }, [tokenId]);

  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  const fetchToken = async () => {
    try {
      const res = await fetch(`/api/tokens/${tokenId}`);
      const data = await res.json();
      setToken(data);
    } catch (error) {
      console.error('Error fetching token:', error);
    }
    setLoading(false);
  };

  const navItems = [
    { href: `/settings/tokens/${tokenId}/general`, label: 'General', icon: '⚙️' },
    { href: `/settings/tokens/${tokenId}/api-keys`, label: 'API Keys', icon: '🔑' },
    { href: `/settings/tokens/${tokenId}/supply`, label: 'Supply', icon: '📊' },
    { href: `/settings/tokens/${tokenId}/abi`, label: 'Token ABI', icon: '📄' },
    { href: `/settings/tokens/${tokenId}/contracts`, label: 'Contratos', icon: '📦' },
  ];

  const isActive = (href: string) => pathname === href;

  const currentSection = pathname?.split('/').pop() || 'general';
  const currentLabel = PATH_TO_LABEL[currentSection] || 'General';

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (sidebarRef.current && !sidebarRef.current.contains(e.target as Node)) {
      setSidebarOpen(false);
    }
  };

  if (loading) {
    return <div className="p-6">Cargando...</div>;
  }

  const networkLabels: Record<string, string> = {
    base: 'Base Mainnet',
    'base-testnet': 'Base Testnet',
    'base-sepolia': 'Base Sepolia',
  };
  const networkLabel = networkLabels[token?.network || ''] || (token?.network || '-');

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-card border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
          {/* Breadcrumb */}
          <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
            <Link href="/settings/tokens" className="hover:text-primary">
              Tokens
            </Link>
            <span>/</span>
            <Link href={`/settings/tokens/${tokenId}`} className="hover:text-primary">
              {token?.symbol || 'Token'}
            </Link>
            <span>/</span>
            <span className="text-foreground font-medium">{currentLabel}</span>
          </nav>

          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <button
                onClick={() => setSidebarOpen(true)}
                className="md:hidden p-2 -ml-2 rounded-lg hover:bg-muted text-muted-foreground"
                aria-label="Abrir menú"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              {token?.logoUrl ? (
                <img
                  src={token.logoUrl}
                  alt={token.symbol || 'Token'}
                  className="w-12 h-12 flex-shrink-0 rounded-full object-cover"
                />
              ) : (
                <div className="w-12 h-12 flex-shrink-0 bg-primary rounded-full flex items-center justify-center text-primary-foreground font-bold text-lg">
                  {token?.symbol?.substring(0, 2) || '??'}
                </div>
              )}
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-2xl font-bold truncate">{token?.symbol || 'Token'}</h1>
                  <span className="px-2 py-0.5 text-xs font-medium bg-muted text-muted-foreground rounded uppercase">
                    {networkLabel}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground truncate">{token?.name || 'Loading...'}</p>
              </div>
            </div>
            <Link
              href={`/dashboard?token=${tokenId}`}
              className="flex-shrink-0 px-4 py-2 text-sm font-medium text-primary hover:opacity-80 bg-accent hover:bg-accent/80 rounded-lg transition-colors"
            >
              Ir al dashboard →
            </Link>
          </div>
        </div>
      </div>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={handleBackdropClick}
          aria-hidden="true"
        />
      )}

      {/* Layout: Sidebar + Content */}
      <div className="max-w-7xl mx-auto flex">
        {/* Sidebar - colapsable en móvil */}
        <aside
          ref={sidebarRef}
          className={`
            w-60 flex-shrink-0 bg-card border-r border-border min-h-[calc(100vh-140px)] p-4
            fixed md:relative inset-y-0 left-0 z-50 transform transition-transform duration-200 ease-in-out
            ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
          `}
        >
          <div className="flex items-center justify-between mb-4 md:hidden">
            <span className="font-semibold">Menú</span>
            <button
              onClick={() => setSidebarOpen(false)}
              className="p-2 rounded-lg hover:bg-muted text-muted-foreground"
              aria-label="Cerrar menú"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <nav className="space-y-1">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive(item.href)
                    ? 'bg-accent text-accent-foreground border-l-4 border-primary -ml-4 pl-[13px]'
                    : 'text-foreground hover:bg-muted'
                }`}
              >
                <span className="text-lg">{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            ))}
          </nav>
        </aside>

        {/* Content */}
        <main className="flex-1 p-4 sm:p-6 min-w-0">
          {children}
        </main>
      </div>
    </div>
  );
}
