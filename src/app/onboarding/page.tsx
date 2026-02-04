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
    }
  }, [status, router]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white shadow-md rounded-lg p-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              ¡Bienvenido, {session?.user?.name}!
            </h1>
            <p className="text-gray-600">
              Configura tu organización y comienza a analizar tokens blockchain
            </p>
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
            <p className="text-yellow-800 text-sm">
              🚧 La página de onboarding está en construcción. Próximamente podrás:
            </p>
            <ul className="list-disc list-inside text-yellow-800 text-sm mt-2 ml-4">
              <li>Crear tu organización</li>
              <li>Configurar tu primer token para análisis</li>
              <li>Agregar claves API personalizadas</li>
              <li>Invitar miembros a tu equipo</li>
            </ul>
          </div>

          <div className="flex justify-center gap-4">
            <button
              onClick={() => router.push('/dashboard')}
              className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded"
            >
              Ir al Dashboard
            </button>
            <button
              onClick={() => router.push('/')}
              className="bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold py-2 px-6 rounded"
            >
              Ir al Inicio
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
