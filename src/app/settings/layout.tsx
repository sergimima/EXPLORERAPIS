'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  const isActive = (path: string) => {
    return pathname.startsWith(path);
  };

  const navItems = [
    {
      href: '/settings/general',
      label: 'General',
      icon: '🏢',
      description: 'Organización y configuración básica'
    },
    {
      href: '/settings/members',
      label: 'Members',
      icon: '👥',
      description: 'Miembros e invitaciones'
    },
    {
      href: '/settings/tokens',
      label: 'Tokens',
      icon: '🪙',
      description: 'Gestión de tokens'
    },
    {
      href: '/settings/billing',
      label: 'Billing',
      icon: '💳',
      description: 'Suscripción y facturación',
      disabled: true,
      badge: 'Próximamente'
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      <div className="flex">
        {/* Sidebar */}
        <aside className="w-72 bg-card border-r border-border min-h-screen sticky top-0">
          <div className="p-6">
            <h2 className="text-xl font-bold text-card-foreground mb-2">⚙️ Settings</h2>
            <p className="text-sm text-muted-foreground mb-6">Configuración de tu organización</p>

            <nav className="space-y-1">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.disabled ? '#' : item.href}
                  className={`
                    block px-4 py-3 rounded-lg transition-colors relative
                    ${item.disabled
                      ? 'opacity-50 cursor-not-allowed'
                      : isActive(item.href)
                        ? 'bg-accent text-accent-foreground border border-border'
                        : 'text-secondary-foreground hover:bg-muted hover:text-foreground'
                    }
                  `}
                  onClick={(e) => item.disabled && e.preventDefault()}
                >
                  <div className="flex items-start gap-3">
                    <span className="text-xl">{item.icon}</span>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{item.label}</span>
                        {item.badge && (
                          <span className="text-xs px-2 py-0.5 bg-muted text-muted-foreground rounded-full">
                            {item.badge}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {item.description}
                      </p>
                    </div>
                  </div>
                </Link>
              ))}
            </nav>

            <div className="pt-6 mt-6 border-t border-border">
              <Link
                href="/dashboard"
                className="block px-4 py-2 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors text-sm"
              >
                ← Volver al Dashboard
              </Link>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
