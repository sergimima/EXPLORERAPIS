'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { toast } from 'sonner';
import LogoUpload from '@/components/LogoUpload';

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
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Cargando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-card-foreground">General Settings</h1>
        <p className="text-muted-foreground mt-2">
          Configuración básica de tu organización
        </p>
      </div>

      {/* Logo de la Organización */}
      <div className="bg-card rounded-lg shadow-sm border border-border p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4 text-card-foreground">
          Logo de la Organización
        </h2>
        <LogoUpload
          type="organization"
          currentLogoUrl={organization?.logoUrl}
          name={organization?.name || 'Organization'}
          onUploadSuccess={(logoUrl) => {
            setOrganization({ ...organization, logoUrl });
            toast.success('Logo actualizado correctamente');
          }}
          onDeleteSuccess={() => {
            setOrganization({ ...organization, logoUrl: null });
            toast.success('Logo eliminado correctamente');
          }}
        />
      </div>

      {/* Información General */}
      <div className="bg-card rounded-lg shadow-sm border border-border p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4 text-card-foreground">
          Información de la Organización
        </h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Nombre de la Organización
            </label>
            <input
              type="text"
              value={organization?.name || ''}
              className="w-full px-4 py-2 border border-input rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent bg-background text-foreground"
              disabled
            />
            <p className="text-xs text-muted-foreground mt-1">
              El nombre de tu organización tal como aparecerá en la plataforma
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              URL Slug
            </label>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground whitespace-nowrap">
                tokenlens.com/
              </span>
              <input
                type="text"
                value={organization?.slug || ''}
                className="flex-1 px-4 py-2 border border-input rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                disabled
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              URL única para tu organización
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Organization ID
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={organization?.id || ''}
                className="flex-1 px-4 py-2 border border-input rounded-lg bg-muted font-mono text-sm"
                disabled
              />
              <button
                onClick={() => {
                  navigator.clipboard.writeText(organization?.id || '');
                  toast.success('ID copiado al portapapeles');
                }}
                className="px-3 py-2 text-sm text-muted-foreground hover:text-foreground border border-input rounded-lg hover:bg-muted"
              >
                📋 Copiar
              </button>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Identificador único de tu organización
            </p>
          </div>
        </div>

        <div className="mt-6 pt-6 border-t border-border">
          <button
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled
          >
            Guardar Cambios
          </button>
          <p className="text-xs text-muted-foreground mt-2">
            La edición estará disponible próximamente
          </p>
        </div>
      </div>

      {/* Información del Owner */}
      {organization?.ownerId && (
        <div className="bg-card rounded-lg shadow-sm border border-border p-6">
          <h2 className="text-lg font-semibold mb-4 text-card-foreground">
            Propietario de la Organización
          </h2>

          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-accent rounded-full flex items-center justify-center text-accent-foreground font-semibold text-lg">
              {session?.user?.name?.[0]?.toUpperCase() || 'O'}
            </div>
            <div>
              <div className="font-medium text-card-foreground">
                {session?.user?.name || 'Owner'}
              </div>
              <div className="text-sm text-muted-foreground">
                {session?.user?.email}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
