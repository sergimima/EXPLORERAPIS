'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function AddressesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  const tabs = [
    { href: '/settings/addresses', label: 'Lista', icon: '📋' },
    { href: '/settings/addresses/new', label: 'Nueva', icon: '➕' },
    { href: '/settings/addresses/import', label: 'Importar', icon: '📥' },
    { href: '/settings/addresses/stats', label: 'Estadísticas', icon: '📊' },
  ];

  return (
    <div className="max-w-7xl">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-card-foreground">Addresses</h1>
        <p className="text-muted-foreground mt-2">
          Gestiona las direcciones etiquetadas de tu organización
        </p>
      </div>

      {/* Tabs */}
      <div className="border-b border-border mb-6">
        <nav className="flex gap-2">
          {tabs.map((tab) => {
            const isActive = pathname === tab.href;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`
                  px-4 py-3 border-b-2 transition-colors font-medium text-sm
                  ${isActive
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
                  }
                `}
              >
                <span className="mr-2">{tab.icon}</span>
                {tab.label}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Content */}
      {children}
    </div>
  );
}
