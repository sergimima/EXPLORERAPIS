'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import ThemeToggle from '@/components/ThemeToggle';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const router = useRouter();

  // Verificar que el usuario es SUPER_ADMIN
  useEffect(() => {
    if (status === 'loading') return;

    if (!session) {
      router.push('/auth/signin');
      return;
    }

    if (session.user?.role !== 'SUPER_ADMIN') {
      router.push('/dashboard');
      return;
    }
  }, [session, status, router]);

  // Mostrar loading mientras verifica permisos
  if (status === 'loading' || !session || session.user?.role !== 'SUPER_ADMIN') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Verificando permisos...</p>
        </div>
      </div>
    );
  }

  const isActive = (path: string) => {
    return pathname === path || pathname.startsWith(path + '/');
  };

  const navItems = [
    {
      href: '/admin/dashboard',
      label: 'Dashboard',
      icon: '📊',
      description: 'Métricas y estadísticas globales'
    },
    {
      href: '/admin/organizations',
      label: 'Organizations',
      icon: '🏢',
      description: 'Gestionar organizaciones y planes'
    },
    {
      href: '/admin/users',
      label: 'Users',
      icon: '👥',
      description: 'Gestionar usuarios del sistema'
    },
    {
      href: '/admin/tokens',
      label: 'Tokens',
      icon: '🪙',
      description: 'Vista global de todos los tokens'
    },
    {
      href: '/admin/plans',
      label: 'Plans',
      icon: '💳',
      description: 'Crear y editar planes de suscripción'
    },
    {
      href: '/admin/settings',
      label: 'Settings',
      icon: '⚙️',
      description: 'Configuración global del sistema'
    },
    {
      href: '/admin/health',
      label: 'Health',
      icon: '💚',
      description: 'Estado de servicios y APIs'
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header con logo, user info, theme toggle y logout */}
      <header className="h-16 bg-card border-b border-border flex items-center justify-between px-6 sticky top-0 z-10">
        <Link href="/admin/dashboard" className="flex items-center gap-2">
          <Image
            src="/images/logo_blue.png"
            alt="TokenLens"
            width={28}
            height={28}
            className="h-7 w-auto"
          />
          <span className="font-bold text-card-foreground">TokenLens Admin</span>
        </Link>
        <div className="flex items-center gap-4">
          <div className="hidden sm:block text-right">
            <p className="text-xs text-muted-foreground">Logged in as</p>
            <p className="text-sm font-medium text-foreground truncate max-w-[180px]">{session.user?.email}</p>
          </div>
          <ThemeToggle />
          <button
            onClick={() => signOut({ callbackUrl: '/auth/signin' })}
            className="px-3 py-1.5 text-sm font-medium text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
          >
            Cerrar sesión
          </button>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside className="w-72 bg-card border-r border-border min-h-[calc(100vh-4rem)] sticky top-16">
          <div className="p-6">
            <div className="mb-6">
              <h2 className="text-xl font-bold text-card-foreground">🔧 Admin Panel</h2>
              <p className="text-xs text-muted-foreground mt-1">Gestión global del SaaS</p>
            </div>

            <nav className="space-y-1">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`
                    block px-4 py-3 rounded-lg transition-colors
                    ${isActive(item.href)
                      ? 'bg-accent text-accent-foreground border border-border'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                    }
                  `}
                >
                  <div className="flex items-start gap-3">
                    <span className="text-xl">{item.icon}</span>
                    <div className="flex-1">
                      <div className="font-medium">{item.label}</div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {item.description}
                      </p>
                    </div>
                  </div>
                </Link>
              ))}
            </nav>

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
