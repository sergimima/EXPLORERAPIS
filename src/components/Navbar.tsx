'use client';

import { useSession, signOut } from 'next-auth/react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useState, useEffect, useRef } from 'react';
import TokenSelector from './TokenSelector';
import GlobalSearch from './GlobalSearch';
import ThemeToggle from './ThemeToggle';
import Avatar from './Avatar';

export default function Navbar() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const [organization, setOrganization] = useState<any>(null);
  const settingsRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Fetch organization data
  useEffect(() => {
    if (session?.user?.email) {
      fetch('/api/organizations')
        .then(res => res.json())
        .then(data => setOrganization(data))
        .catch(err => console.error('Error fetching organization:', err));
    }
  }, [session]);

  // Cerrar menús al hacer clic fuera
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (settingsRef.current && !settingsRef.current.contains(target)) setShowSettingsMenu(false);
      if (userMenuRef.current && !userMenuRef.current.contains(target)) setShowUserMenu(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // No mostrar navbar en landing, auth pages, docs, ni en admin (tiene su propio layout)
  const hideNavbar = pathname === '/' || pathname.startsWith('/auth') || pathname === '/docs' || pathname.startsWith('/admin');

  if (!session || hideNavbar) return null;

  const isAdmin = session.user?.role === 'ADMIN' || session.user?.role === 'SUPER_ADMIN';
  const isSuperAdmin = session.user?.role === 'SUPER_ADMIN';

  return (
    <nav className="bg-card shadow-md border-b border-border">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center h-16">
          {/* Logo / Brand */}
          <div className="flex items-center">
            <Link href="/dashboard" className="flex items-center gap-3">
              {/* Organization Logo */}
              <Avatar
                src={organization?.logoUrl}
                name={organization?.name || 'TokenLens'}
                size="md"
              />
              <div className="flex flex-col">
                <span className="text-lg font-bold text-card-foreground">
                  {organization?.name || 'TokenLens'}
                </span>
                {organization?.name && (
                  <span className="text-xs text-muted-foreground">TokenLens</span>
                )}
              </div>
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

            {/* Admin Link (only for SUPER_ADMIN) */}
            {isSuperAdmin && (
              <Link
                href="/admin/dashboard"
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  pathname.startsWith('/admin')
                    ? 'bg-accent text-accent-foreground'
                    : 'text-secondary-foreground hover:bg-muted'
                }`}
              >
                🔧 Admin
              </Link>
            )}

            {/* Settings Dropdown */}
            <div className="relative" ref={settingsRef}>
              <button
                onClick={() => setShowSettingsMenu(!showSettingsMenu)}
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  pathname.startsWith('/settings')
                    ? 'bg-accent text-accent-foreground'
                    : 'text-secondary-foreground hover:bg-muted'
                }`}
              >
                Settings ▾
              </button>
              {showSettingsMenu && (
                <div className="absolute left-0 mt-2 w-48 bg-card rounded-md shadow-lg py-1 z-10 border border-border">
                  <Link
                    href="/settings/general"
                    className="block px-4 py-2 text-sm text-secondary-foreground hover:bg-muted"
                    onClick={() => setShowSettingsMenu(false)}
                  >
                    🏢 General
                  </Link>
                  <Link
                    href="/settings/members"
                    className="block px-4 py-2 text-sm text-secondary-foreground hover:bg-muted"
                    onClick={() => setShowSettingsMenu(false)}
                  >
                    👥 Members
                  </Link>
                  <Link
                    href="/settings/tokens"
                    className="block px-4 py-2 text-sm text-secondary-foreground hover:bg-muted"
                    onClick={() => setShowSettingsMenu(false)}
                  >
                    🪙 Tokens
                  </Link>
                  <Link
                    href="/settings/addresses"
                    className="block px-4 py-2 text-sm text-secondary-foreground hover:bg-muted"
                    onClick={() => setShowSettingsMenu(false)}
                  >
                    📝 Addresses
                  </Link>
                </div>
              )}
            </div>

            {/* Theme Toggle */}
            <ThemeToggle />
          </div>

          {/* User Menu */}
          <div className="relative" ref={userMenuRef}>
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
