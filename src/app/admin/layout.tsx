import Link from 'next/link';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="flex">
        {/* Sidebar */}
        <aside className="w-64 bg-white border-r border-gray-200 min-h-screen sticky top-16">
          <div className="p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-6">⚙️ Admin Panel</h2>

            <nav className="space-y-2">
              <Link
                href="/admin/addresses"
                className="block px-4 py-2 rounded-lg text-gray-700 hover:bg-blue-50 hover:text-blue-600 transition-colors"
              >
                📝 Addresses
              </Link>

              <Link
                href="/admin/dashboard"
                className="block px-4 py-2 rounded-lg text-gray-700 hover:bg-blue-50 hover:text-blue-600 transition-colors"
              >
                📊 Dashboard
              </Link>

              <Link
                href="/admin/import"
                className="block px-4 py-2 rounded-lg text-gray-700 hover:bg-blue-50 hover:text-blue-600 transition-colors"
              >
                📥 Importar
              </Link>

              <div className="pt-4 mt-4 border-t border-gray-200">
                <Link
                  href="/"
                  className="block px-4 py-2 rounded-lg text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-colors text-sm"
                >
                  ← Volver al Explorer
                </Link>
              </div>
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
