import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import GlobalSearch from '@/components/GlobalSearch';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Blockchain Explorer API',
  description: 'Explorador de datos en blockchains como Base y Base Testnet',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className={inter.className}>
        {/* Barra superior con búsqueda global */}
        <header className="sticky top-0 z-40 bg-white border-b border-gray-200 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <a href="/" className="text-xl font-bold text-blue-600 hover:text-blue-700">
                🔍 Explorer
              </a>
            </div>
            <div className="flex-1 max-w-xl mx-4">
              <GlobalSearch />
            </div>
            <nav className="flex items-center gap-4">
              <a href="/explorer/tokens" className="text-sm text-gray-600 hover:text-gray-900">
                Tokens
              </a>
              <a href="/explorer/vestings" className="text-sm text-gray-600 hover:text-gray-900">
                Vestings
              </a>
              <a href="/explorer/analytics" className="text-sm text-gray-600 hover:text-gray-900">
                Analytics
              </a>
            </nav>
          </div>
        </header>

        <main className="min-h-screen bg-gray-50">
          {children}
        </main>
      </body>
    </html>
  );
}
