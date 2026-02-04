'use client';

import { useSession, signOut } from 'next-auth/react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useState } from 'react';
import TokenSelector from './TokenSelector';
import GlobalSearch from './GlobalSearch';
import ThemeToggle from './ThemeToggle';

export default function Navbar() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const [showUserMenu, setShowUserMenu] = useState(false);

  // No mostrar navbar en landing, auth pages, y docs
  const hideNavbar = pathname === '/' || pathname.startsWith('/auth') || pathname === '/docs';

  if (!session || hideNavbar) return null;

  const isAdmin = session.user?.role === 'ADMIN' || session.user?.role === 'SUPER_ADMIN';

  return (
    <nav className="bg-card shadow-md border-b border-border">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center h-16">
          {/* Logo / Brand */}
          <div className="flex items-center">
            <Link href="/dashboard" className="flex items-center gap-2">
              <Image
                src="/images/logo_blue.png"
                alt="TokenLens"
                width={32}
                height={32}
                className="h-8 w-auto"
              />
              <span className="text-xl font-bold text-card-foreground">TokenLens</span>
            </Link>
          </div>

          {/* Token Selector + Global Search */}
          <div className="flex-1 flex justify-center items-center gap-4">
            <TokenSelector />
            <div className="w-64">
              <GlobalSearch />
            </div>
          </div>

          {/* Navigation Links */}
          <div className="hidden md:flex items-center space-x-4">
            <Link
              href="/dashboard"
              className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                pathname === '/dashboard'
                  ? 'bg-accent text-accent-foreground'
                  : 'text-secondary-foreground hover:bg-muted'
              }`}
            >
              Dashboard
            </Link>

            {/* Settings Dropdown */}
            <div className="relative group">
              <button
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  pathname.startsWith('/settings')
                    ? 'bg-accent text-accent-foreground'
                    : 'text-secondary-foreground hover:bg-muted'
                }`}
              >
                Settings ▾
              </button>
              <div className="absolute left-0 mt-2 w-48 bg-card rounded-md shadow-lg py-1 z-10 hidden group-hover:block border border-border">
                <Link
                  href="/settings/general"
                  className="block px-4 py-2 text-sm text-secondary-foreground hover:bg-muted"
                >
                  🏢 General
                </Link>
                <Link
                  href="/settings/members"
                  className="block px-4 py-2 text-sm text-secondary-foreground hover:bg-muted"
                >
                  👥 Members
                </Link>
                <Link
                  href="/settings/tokens"
                  className="block px-4 py-2 text-sm text-secondary-foreground hover:bg-muted"
                >
                  🪙 Tokens
                </Link>
              </div>
            </div>

            {/* Admin Link (only for admins) */}
            {isAdmin && (
              <Link
                href="/admin/dashboard"
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  pathname.startsWith('/admin')
                    ? 'bg-accent text-accent-foreground'
                    : 'text-secondary-foreground hover:bg-muted'
                }`}
              >
                Admin
              </Link>
            )}

            {/* Theme Toggle */}
            <ThemeToggle />
          </div>

          {/* User Menu */}
          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium text-secondary-foreground hover:bg-muted"
            >
              <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center text-primary-foreground font-semibold">
                {session.user?.name?.charAt(0) || session.user?.email?.charAt(0) || 'U'}
              </div>
              <span className="hidden md:block">{session.user?.name || session.user?.email}</span>
              <span>▾</span>
            </button>

            {showUserMenu && (
              <div className="absolute right-0 mt-2 w-48 bg-card rounded-md shadow-lg py-1 z-10 border border-border">
                <div className="px-4 py-2 text-xs text-muted-foreground border-b border-border">
                  {session.user?.email}
                  <div className="text-xs text-muted-foreground mt-1">
                    Role: {session.user?.role}
                  </div>
                </div>
                <Link
                  href="/settings"
                  className="block px-4 py-2 text-sm text-secondary-foreground hover:bg-muted"
                  onClick={() => setShowUserMenu(false)}
                >
                  ⚙️ Settings
                </Link>
                <button
                  onClick={() => signOut({ callbackUrl: '/auth/signin' })}
                  className="block w-full text-left px-4 py-2 text-sm text-destructive hover:bg-muted"
                >
                  Cerrar Sesión
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Menu (opcional - por ahora sin implementar) */}
    </nav>
  );
}
