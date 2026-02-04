'use client';

import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

export default function AuthErrorPage() {
  const searchParams = useSearchParams();
  const error = searchParams.get('error');

  const errorMessages: Record<string, string> = {
    Configuration: 'Hay un problema con la configuración del servidor.',
    AccessDenied: 'Acceso denegado. No tienes permisos para acceder.',
    Verification: 'El token de verificación ha expirado o ya fue usado.',
    Default: 'Ocurrió un error durante la autenticación.',
    OAuthSignin: 'Error al iniciar sesión con el proveedor OAuth.',
    OAuthCallback: 'Error en el callback de OAuth.',
    OAuthCreateAccount: 'Error al crear la cuenta con OAuth.',
    EmailCreateAccount: 'Error al crear la cuenta con email.',
    Callback: 'Error en el callback de autenticación.',
    OAuthAccountNotLinked: 'Esta cuenta de email ya existe con otro método de inicio de sesión.',
    EmailSignin: 'Error al enviar el email de verificación.',
    CredentialsSignin: 'Credenciales inválidas. Verifica tu email y contraseña.',
    SessionRequired: 'Debes iniciar sesión para acceder a esta página.',
  };

  const errorMessage = error ? errorMessages[error] || errorMessages.Default : errorMessages.Default;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 to-orange-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full">
        <div className="bg-white shadow-md rounded-lg px-8 pt-6 pb-8">
          <div className="text-center mb-6">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
              <svg
                className="h-6 w-6 text-red-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Error de Autenticación</h2>
            <p className="text-gray-600">{errorMessage}</p>
          </div>

          <div className="flex flex-col gap-3">
            <Link
              href="/auth/signin"
              className="w-full bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded text-center"
            >
              Volver a Iniciar Sesión
            </Link>
            <Link
              href="/auth/signup"
              className="w-full bg-white hover:bg-gray-50 text-gray-700 font-semibold py-2 px-4 border border-gray-300 rounded text-center"
            >
              Crear Nueva Cuenta
            </Link>
            <Link
              href="/"
              className="w-full text-center text-blue-500 hover:text-blue-700 font-semibold py-2"
            >
              Volver al Inicio
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
