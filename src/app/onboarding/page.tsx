'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function OnboardingPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
      return;
    }

    // Redirect SUPER_ADMIN to admin panel
    if (status === 'authenticated' && session?.user?.role === 'SUPER_ADMIN') {
      router.push('/admin/dashboard');
      return;
    }
  }, [status, session, router]);

  if (status === 'loading' || (status === 'authenticated' && session?.user?.role === 'SUPER_ADMIN')) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">
            {session?.user?.role === 'SUPER_ADMIN' ? 'Redirigiendo al panel de administración...' : 'Cargando...'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="bg-card shadow-md rounded-lg p-8 border border-border">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-card-foreground mb-2">
              ¡Bienvenido, {session?.user?.name}!
            </h1>
            <p className="text-muted-foreground">
              Configura tu organización y comienza a analizar tokens blockchain
            </p>
          </div>

          <div className="bg-warning/10 border border-warning rounded-lg p-4 mb-6">
            <p className="text-warning text-sm">
              🚧 La página de onboarding está en construcción. Próximamente podrás:
            </p>
            <ul className="list-disc list-inside text-warning text-sm mt-2 ml-4">
              <li>Crear tu organización</li>
              <li>Configurar tu primer token para análisis</li>
              <li>Agregar claves API personalizadas</li>
              <li>Invitar miembros a tu equipo</li>
            </ul>
          </div>

          <div className="flex justify-center gap-4">
            <button
              onClick={() => router.push('/dashboard')}
              className="bg-primary hover:opacity-90 text-primary-foreground font-bold py-2 px-6 rounded"
            >
              Ir al Dashboard
            </button>
            <button
              onClick={() => router.push('/')}
              className="bg-muted hover:bg-muted/80 text-foreground font-bold py-2 px-6 rounded"
            >
              Ir al Inicio
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
