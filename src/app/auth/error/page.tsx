'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

function ErrorContent() {
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
    <div className="min-h-screen flex items-center justify-center bg-background py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full">
        <div className="bg-card shadow-md rounded-lg px-8 pt-6 pb-8 border border-border">
          <div className="text-center mb-6">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-destructive/10 mb-4">
              <svg
                className="h-6 w-6 text-destructive"
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
            <h2 className="text-2xl font-bold text-card-foreground mb-2">Error de Autenticación</h2>
            <p className="text-muted-foreground">{errorMessage}</p>
          </div>

          <div className="flex flex-col gap-3">
            <Link
              href="/auth/signin"
              className="w-full bg-primary hover:opacity-90 text-primary-foreground font-bold py-2 px-4 rounded text-center"
            >
              Volver a Iniciar Sesión
            </Link>
            <Link
              href="/auth/signup"
              className="w-full bg-background hover:bg-muted text-foreground font-semibold py-2 px-4 border border-input rounded text-center"
            >
              Crear Nueva Cuenta
            </Link>
            <Link
              href="/"
              className="w-full text-center text-primary hover:opacity-80 font-semibold py-2"
            >
              Volver al Inicio
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AuthErrorPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-destructive mx-auto"></div>
        </div>
      </div>
    }>
      <ErrorContent />
    </Suspense>
  );
}
