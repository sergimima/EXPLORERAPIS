'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';

export default function OrganizationSettings() {
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

  if (loading) return <div>Cargando...</div>;

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Organización</h1>

      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Información General</h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">
              Nombre de la Organización
            </label>
            <input
              type="text"
              value={organization?.name || ''}
              className="w-full px-3 py-2 border rounded"
              disabled
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Slug (URL)
            </label>
            <div className="flex items-center gap-2">
              <span className="text-gray-500">app.tudominio.com/</span>
              <input
                type="text"
                value={organization?.slug || ''}
                className="flex-1 px-3 py-2 border rounded"
                disabled
              />
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">
          Miembros del Equipo
        </h2>

        <div className="space-y-3">
          {organization?.members?.map((member: any) => (
            <div key={member.id} className="flex items-center justify-between p-3 border rounded">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gray-200 rounded-full" />
                <div>
                  <div className="font-medium">{member.user.name || member.user.email}</div>
                  <div className="text-sm text-gray-500">{member.role}</div>
                </div>
              </div>
              {member.role !== 'OWNER' && (
                <button className="text-red-600 hover:text-red-700">
                  Remover
                </button>
              )}
            </div>
          ))}
        </div>

        <button className="mt-4 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
          Invitar Miembro
        </button>
      </div>
    </div>
  );
}
