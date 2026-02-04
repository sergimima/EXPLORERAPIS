import { Resend } from 'resend';

// Lazy initialization de Resend (solo cuando se necesita)
let resend: Resend | null = null;

function getResendClient() {
  if (!process.env.RESEND_API_KEY) {
    return null;
  }
  if (!resend) {
    resend = new Resend(process.env.RESEND_API_KEY);
  }
  return resend;
}

interface InvitationEmailData {
  to: string;
  organizationName: string;
  inviterName: string;
  inviteUrl: string;
  expiresInDays: number;
}

export async function sendInvitationEmail(data: InvitationEmailData) {
  try {
    const resendClient = getResendClient();

    // Si no hay API key configurada, solo log
    if (!resendClient) {
      console.warn('⚠️  RESEND_API_KEY no configurada. Email no enviado.');
      console.log('📧 Invitation email que se enviaría:', {
        to: data.to,
        inviteUrl: data.inviteUrl
      });
      return { success: true, warning: 'Email not configured' };
    }

    const { error } = await resendClient.emails.send({
      from: process.env.RESEND_FROM_EMAIL || 'noreply@tokenlens.com',
      to: data.to,
      subject: `Invitación a ${data.organizationName}`,
      html: getInvitationEmailHtml(data)
    });

    if (error) {
      console.error('Error sending invitation email:', error);
      return { success: false, error };
    }

    console.log('✅ Invitation email sent to:', data.to);
    return { success: true };

  } catch (error) {
    console.error('Error in sendInvitationEmail:', error);
    return { success: false, error };
  }
}

function getInvitationEmailHtml(data: InvitationEmailData): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Invitación a ${data.organizationName}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
      background-color: #f5f5f5;
    }
    .container {
      background-color: white;
      border-radius: 8px;
      padding: 40px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .header {
      text-align: center;
      margin-bottom: 30px;
    }
    .logo {
      font-size: 32px;
      font-weight: bold;
      color: #2563eb;
      margin-bottom: 10px;
    }
    h1 {
      color: #1f2937;
      font-size: 24px;
      margin-bottom: 20px;
    }
    p {
      color: #4b5563;
      margin-bottom: 15px;
    }
    .button {
      display: inline-block;
      background-color: #2563eb;
      color: white;
      text-decoration: none;
      padding: 12px 30px;
      border-radius: 6px;
      margin: 20px 0;
      font-weight: 500;
    }
    .button:hover {
      background-color: #1d4ed8;
    }
    .info-box {
      background-color: #f9fafb;
      border-left: 4px solid #2563eb;
      padding: 15px;
      margin: 20px 0;
    }
    .footer {
      text-align: center;
      margin-top: 30px;
      padding-top: 20px;
      border-top: 1px solid #e5e7eb;
      color: #6b7280;
      font-size: 14px;
    }
    .expiry {
      color: #ef4444;
      font-weight: 500;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">🔍 TokenLens</div>
    </div>

    <h1>Has sido invitado a ${data.organizationName}</h1>

    <p>Hola,</p>

    <p>
      <strong>${data.inviterName}</strong> te ha invitado a unirte a <strong>${data.organizationName}</strong>
      en TokenLens, la plataforma de análisis de tokens ERC20.
    </p>

    <div class="info-box">
      <p style="margin: 0;">
        💡 <strong>¿Qué es TokenLens?</strong><br>
        Una plataforma SaaS para analizar tokens ERC20 con métricas avanzadas, tracking de holders,
        movimientos de whales, y análisis de liquidez en tiempo real.
      </p>
    </div>

    <center>
      <a href="${data.inviteUrl}" class="button">Aceptar Invitación</a>
    </center>

    <p>
      O copia y pega este link en tu navegador:<br>
      <a href="${data.inviteUrl}" style="color: #2563eb; word-break: break-all;">${data.inviteUrl}</a>
    </p>

    <p class="expiry">
      ⚠️ Esta invitación expira en ${data.expiresInDays} días.
    </p>

    <div class="footer">
      <p>
        Si no esperabas esta invitación, puedes ignorar este email de forma segura.
      </p>
      <p>
        © 2025 TokenLens. Todos los derechos reservados.
      </p>
    </div>
  </div>
</body>
</html>
  `.trim();
}
