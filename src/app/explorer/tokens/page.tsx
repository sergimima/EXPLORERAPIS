'use client';

export const dynamic = 'force-dynamic';

import { useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

/**
 * ⚠️ DEPRECATED: Esta página ha sido consolidada en /dashboard
 *
 * Esta página redirige automáticamente a /dashboard con los parámetros apropiados.
 * Para acceder a la funcionalidad de tokens, use /dashboard?tab=tokens
 */
export default function TokenExplorerRedirect() {
  const searchParams = useSearchParams();
  const router = useRouter();

  // Redirigir automáticamente a /dashboard con parámetros
  useEffect(() => {
    const walletParam = searchParams.get('wallet');
    const networkParam = searchParams.get('network');

    // Construir URL de redirección
    const params = new URLSearchParams();
    params.set('tab', 'tokens');

    if (walletParam) {
      params.set('wallet', walletParam);
    }

    if (networkParam) {
      params.set('network', networkParam);
    }

    // Redirigir inmediatamente
    router.replace(`/dashboard?${params.toString()}`);
  }, [searchParams, router]);

  // Mostrar mensaje mientras redirige
  return (
    <div className="container mx-auto px-4 py-12 text-center">
      <div className="max-w-md mx-auto bg-blue-50 p-8 rounded-lg">
        <div className="text-4xl mb-4">🔄</div>
        <h1 className="text-2xl font-bold mb-4">Redirigiendo al Dashboard...</h1>
        <p className="text-gray-600 mb-4">
          Esta página ha sido consolidada en el dashboard unificado.
        </p>
        <p className="text-sm text-gray-500">
          Si no eres redirigido automáticamente,{' '}
          <a href="/dashboard" className="text-blue-600 hover:underline">
            haz clic aquí
          </a>
        </p>
      </div>
    </div>
  );
}
