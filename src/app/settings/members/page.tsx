'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { toast } from 'sonner';

interface Invitation {
  id: string;
  email: string;
  role: string;
  createdAt: string;
  expiresAt: string;
  inviter: {
    name: string;
    email: string;
  };
}

export default function MembersPage() {
  const { data: session } = useSession();
  const [organization, setOrganization] = useState<any>(null);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('MEMBER');
  const [inviting, setInviting] = useState(false);

  useEffect(() => {
    fetchOrganization();
    fetchInvitations();
  }, []);

  const fetchOrganization = async () => {
    const res = await fetch('/api/organizations');
    const data = await res.json();
    setOrganization(data);
    setLoading(false);
  };

  const fetchInvitations = async () => {
    const res = await fetch('/api/organizations/invitations');
    const data = await res.json();
    setInvitations(data.invitations || []);
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviting(true);

    try {
      const res = await fetch('/api/organizations/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole })
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || 'Error al enviar invitación');
        return;
      }

      toast.success('Invitación enviada correctamente');
      setShowInviteModal(false);
      setInviteEmail('');
      setInviteRole('MEMBER');
      fetchInvitations();
    } catch (error) {
      console.error('Error inviting member:', error);
      toast.error('Error al enviar invitación');
    } finally {
      setInviting(false);
    }
  };

  const handleCancelInvitation = async (invitationId: string) => {
    if (!confirm('¿Estás seguro de cancelar esta invitación?')) return;

    try {
      const res = await fetch(`/api/organizations/invitations/${invitationId}`, {
        method: 'DELETE'
      });

      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || 'Error al cancelar invitación');
        return;
      }

      toast.success('Invitación cancelada');
      fetchInvitations();
    } catch (error) {
      console.error('Error canceling invitation:', error);
      toast.error('Error al cancelar invitación');
    }
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
        <h1 className="text-3xl font-bold text-card-foreground">Team Members</h1>
        <p className="text-muted-foreground mt-2">
          Gestiona los miembros de tu organización y envía invitaciones
        </p>
      </div>

      {/* Miembros Activos */}
      <div className="bg-card rounded-lg shadow-sm border border-border p-6 mb-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-semibold text-card-foreground">
              Miembros Activos
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              {organization?.members?.length || 0} miembros en total
            </p>
          </div>
          <button
            onClick={() => setShowInviteModal(true)}
            className="px-4 py-2 bg-primary text-white rounded-lg hover:opacity-90 flex items-center gap-2"
          >
            <span>➕</span>
            Invitar Miembro
          </button>
        </div>

        <div className="space-y-3">
          {organization?.members?.map((member: any) => (
            <div
              key={member.id}
              className="flex items-center justify-between p-4 border border-border rounded-lg hover:bg-muted transition-colors"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-primary rounded-full flex items-center justify-center text-primary-foreground font-semibold text-lg shadow-sm">
                  {member.user.name?.[0]?.toUpperCase() || member.user.email[0].toUpperCase()}
                </div>
                <div>
                  <div className="font-medium text-card-foreground">
                    {member.user.name || member.user.email}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {member.user.email}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`
                      text-xs px-2 py-0.5 rounded-full font-medium
                      ${member.role === 'OWNER' ? 'bg-primary/20 text-primary' :
                        member.role === 'ADMIN' ? 'bg-accent text-accent-foreground' :
                        member.role === 'MEMBER' ? 'bg-success/20 text-success' :
                        'bg-muted text-muted-foreground'}
                    `}>
                      {member.role}
                    </span>
                    {member.joinedAt && (
                      <span className="text-xs text-muted-foreground">
                        Unido el {new Date(member.joinedAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              {member.role !== 'OWNER' && (
                <button className="text-destructive hover:opacity-80 text-sm font-medium px-3 py-1 hover:bg-destructive/10 rounded">
                  Remover
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Invitaciones Pendientes */}
      {invitations.length > 0 && (
        <div className="bg-card rounded-lg shadow-sm border border-border p-6">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-card-foreground">
              Invitaciones Pendientes
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              {invitations.length} invitación{invitations.length !== 1 ? 'es' : ''} esperando respuesta
            </p>
          </div>

          <div className="space-y-3">
            {invitations.map((invitation) => (
              <div
                key={invitation.id}
                className="flex items-center justify-between p-4 border border-warning rounded-lg bg-warning/10"
              >
                <div>
                  <div className="font-medium text-card-foreground">
                    📧 {invitation.email}
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">
                    Rol: <span className="font-medium">{invitation.role}</span>
                    {' • '}
                    Invitado por {invitation.inviter.name || invitation.inviter.email}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Expira: {new Date(invitation.expiresAt).toLocaleDateString()} a las{' '}
                    {new Date(invitation.expiresAt).toLocaleTimeString()}
                  </div>
                </div>
                <button
                  onClick={() => handleCancelInvitation(invitation.id)}
                  className="text-destructive hover:opacity-80 text-sm font-medium px-3 py-1 hover:bg-destructive/10 rounded"
                >
                  Cancelar
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal de Invitación */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-lg p-6 w-full max-w-md shadow-xl">
            <h2 className="text-xl font-semibold mb-4 text-card-foreground">
              Invitar Nuevo Miembro
            </h2>

            <form onSubmit={handleInvite}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-foreground mb-2">
                  Email del Invitado
                </label>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="w-full px-4 py-2 border border-input rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent bg-background text-foreground"
                  placeholder="usuario@ejemplo.com"
                  required
                />
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium text-foreground mb-2">
                  Rol en la Organización
                </label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                  className="w-full px-4 py-2 border border-input rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent bg-background text-foreground"
                >
                  <option value="VIEWER">👁️ Viewer - Solo lectura</option>
                  <option value="MEMBER">👤 Member - Acceso normal</option>
                  <option value="ADMIN">⚡ Admin - Acceso completo</option>
                </select>
                <p className="text-xs text-muted-foreground mt-2">
                  Los <strong>Admins</strong> pueden invitar y gestionar otros miembros
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowInviteModal(false);
                    setInviteEmail('');
                    setInviteRole('MEMBER');
                  }}
                  className="flex-1 px-4 py-2 border border-input rounded-lg hover:bg-muted font-medium bg-background text-foreground"
                  disabled={inviting}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-primary text-white px-4 py-2 rounded-lg hover:opacity-90 disabled:opacity-50 font-medium"
                  disabled={inviting}
                >
                  {inviting ? 'Enviando...' : 'Enviar Invitación'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
