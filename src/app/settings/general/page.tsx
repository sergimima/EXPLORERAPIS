'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';

export default function GeneralSettingsPage() {
  const { data: session } = useSession();
  const [organization, setOrganization] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchOrganization();
  }, []);

  const fetchOrganization = async () => {
    const res = await fetch('/api/organizations');
    const data = await res.json();
    setOrganization(data);
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">General Settings</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-2">
          Configuración básica de tu organización
        </p>
      </div>

      {/* Información General */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4 text-gray-900">
          Información de la Organización
        </h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Nombre de la Organización
            </label>
            <input
              type="text"
              value={organization?.name || ''}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled
            />
            <p className="text-xs text-gray-500 mt-1">
              El nombre de tu organización tal como aparecerá en la plataforma
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              URL Slug
            </label>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500 whitespace-nowrap">
                tokenlens.com/
              </span>
              <input
                type="text"
                value={organization?.slug || ''}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">
              URL única para tu organización
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Organization ID
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={organization?.id || ''}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 font-mono text-sm"
                disabled
              />
              <button
                onClick={() => {
                  navigator.clipboard.writeText(organization?.id || '');
                  alert('ID copiado al portapapeles');
                }}
                className="px-3 py-2 text-sm text-gray-600 hover:text-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50"
              >
                📋 Copiar
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Identificador único de tu organización
            </p>
          </div>
        </div>

        <div className="mt-6 pt-6 border-t border-gray-200">
          <button
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled
          >
            Guardar Cambios
          </button>
          <p className="text-xs text-gray-500 mt-2">
            La edición estará disponible próximamente
          </p>
        </div>
      </div>

      {/* Información del Owner */}
      {organization?.ownerId && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold mb-4 text-gray-900">
            Propietario de la Organización
          </h2>

          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-semibold text-lg">
              {session?.user?.name?.[0]?.toUpperCase() || 'O'}
            </div>
            <div>
              <div className="font-medium text-gray-900">
                {session?.user?.name || 'Owner'}
              </div>
              <div className="text-sm text-gray-500">
                {session?.user?.email}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
