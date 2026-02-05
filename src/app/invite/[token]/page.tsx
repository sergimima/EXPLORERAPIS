'use client';

import { useState, useEffect, use } from 'react';
import { useSession, signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

interface InvitationDetails {
  id: string;
  email: string;
  role: string;
  organizationId: string;
  organization: {
    id: string;
    name: string;
    slug: string;
  };
  inviter: {
    name: string;
    email: string;
  };
  expiresAt: string;
  acceptedAt: string | null;
}

export default function AcceptInvitationPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const { data: session, status } = useSession();
  const router = useRouter();
  const [invitation, setInvitation] = useState<InvitationDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [accepting, setAccepting] = useState(false);

  // Estado para crear cuenta
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  useEffect(() => {
    // Cargar detalles de la invitación (API GET para obtener info)
    loadInvitationDetails();
  }, []);

  useEffect(() => {
    // Si el usuario está autenticado, aceptar automáticamente
    if (status === 'authenticated' && invitation) {
      handleAccept();
    }
  }, [status, invitation]);

  const loadInvitationDetails = async () => {
    try {
      // Nota: Necesitaremos crear una API GET para obtener detalles sin aceptar
      // Por ahora, asumimos que el usuario puede ver la invitación
      setLoading(false);
    } catch (err) {
      setError('Error al cargar la invitación');
      setLoading(false);
    }
  };

  const handleAccept = async () => {
    if (accepting) return;
    setAccepting(true);
    setError('');

    try {
      const body: any = {};

      // Si no está autenticado, incluir datos de registro
      if (status !== 'authenticated') {
        if (!name || !password) {
          setError('Por favor completa todos los campos');
          setAccepting(false);
          return;
        }

        if (password !== confirmPassword) {
          setError('Las contraseñas no coinciden');
          setAccepting(false);
          return;
        }

        if (password.length < 6) {
          setError('La contraseña debe tener al menos 6 caracteres');
          setAccepting(false);
          return;
        }

        body.name = name;
        body.password = password;
      }

      const res = await fetch(`/api/invitations/${token}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.requireLogin) {
          // Usuario existe pero no está autenticado
          router.push(`/auth/signin?callbackUrl=/invite/${token}`);
          return;
        }
        setError(data.error || 'Error al aceptar la invitación');
        setAccepting(false);
        return;
      }

      // Éxito
      toast.success('¡Bienvenido a ' + data.organization.name + '!');

      // Si se creó cuenta, hacer login automático
      if (status !== 'authenticated' && password) {
        await signIn('credentials', {
          email: invitation?.email,
          password: password,
          redirect: false
        });
      }

      // Redirigir a members para ver el equipo
      router.push('/settings/members');

    } catch (err) {
      console.error('Error accepting invitation:', err);
      setError('Error al aceptar la invitación');
      setAccepting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p>Cargando invitación...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="bg-card rounded-lg shadow-lg p-8 max-w-md w-full border border-border">
        <div className="text-center mb-6">
          <div className="text-4xl mb-2">📨</div>
          <h1 className="text-2xl font-bold mb-2">Invitación a Organización</h1>
          <p className="text-muted-foreground">
            Has sido invitado a unirte a una organización en TokenLens
          </p>
        </div>

        {error && (
          <div className="bg-destructive/10 border border-destructive text-destructive px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        {status === 'authenticated' ? (
          // Usuario ya autenticado
          <div>
            <div className="bg-accent border border-border rounded p-4 mb-6">
              <p className="text-sm text-card-foreground">
                <strong>Sesión iniciada como:</strong> {session?.user?.email}
              </p>
            </div>

            <button
              onClick={handleAccept}
              disabled={accepting}
              className="w-full bg-primary text-primary-foreground px-4 py-3 rounded hover:opacity-90 disabled:opacity-50"
            >
              {accepting ? 'Aceptando...' : 'Aceptar Invitación'}
            </button>

            <p className="text-sm text-muted-foreground text-center mt-4">
              ¿No eres tú?{' '}
              <button
                onClick={() => router.push('/auth/signout')}
                className="text-primary hover:underline"
              >
                Cerrar sesión
              </button>
            </p>
          </div>
        ) : (
          // Usuario no autenticado - Formulario de registro
          <div>
            <p className="text-sm text-muted-foreground mb-4">
              Para aceptar la invitación, crea tu cuenta o inicia sesión si ya tienes una.
            </p>

            <form onSubmit={(e) => { e.preventDefault(); handleAccept(); }}>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">
                  Nombre
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 border rounded"
                  placeholder="Tu nombre"
                  required
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">
                  Contraseña
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2 border rounded"
                  placeholder="Mínimo 6 caracteres"
                  required
                />
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium mb-1">
                  Confirmar Contraseña
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-3 py-2 border rounded"
                  placeholder="Repite tu contraseña"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={accepting}
                className="w-full bg-primary text-primary-foreground px-4 py-3 rounded hover:opacity-90 disabled:opacity-50 mb-3"
              >
                {accepting ? 'Creando cuenta...' : 'Crear Cuenta y Aceptar'}
              </button>

              <p className="text-sm text-muted-foreground text-center">
                ¿Ya tienes cuenta?{' '}
                <button
                  type="button"
                  onClick={() => router.push(`/auth/signin?callbackUrl=/invite/${token}`)}
                  className="text-primary hover:underline"
                >
                  Inicia sesión aquí
                </button>
              </p>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
