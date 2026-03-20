import { NextRequest, NextResponse } from 'next/server'
import { getAdminDb } from '@/lib/firebaseAdmin'
import { sendWithFallback, getEmailProviderConfig } from '@/lib/email/emailProvider'

export const runtime = 'nodejs'

/**
 * POST /api/admin/members/send-invite-email
 * Sends an invitation email via the org's configured email provider (Hostinger, Gmail, etc.)
 * with a link containing the invite token.
 */
export async function POST(req: NextRequest) {
  const callerEmail = req.headers.get('x-user-email')?.toLowerCase()
  if (!callerEmail) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }

  try {
    const { orgId, email, inviteToken, inviterName, orgName, role } = await req.json()

    if (!orgId || !email || !inviteToken) {
      return NextResponse.json({ error: 'missing required fields' }, { status: 400 })
    }

    const db = getAdminDb()

    // Verify caller is member of this org
    const callerSnap = await db
      .collection('organizations').doc(orgId)
      .collection('members')
      .where('email', '==', callerEmail)
      .limit(1)
      .get()

    if (callerSnap.empty) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 })
    }

    // Build the invite link
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin
    const inviteLink = `${baseUrl}/invite?token=${inviteToken}`

    const ROLE_LABELS: Record<string, string> = {
      admin: 'Administrador',
      manager: 'Gerente',
      seller: 'Vendedor',
      viewer: 'Visualizador',
      cliente: 'Cliente',
    }
    const roleLabel = ROLE_LABELS[role] || role || 'Parceiro'

    // Build beautiful HTML email
    const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#f4f6f9;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f6f9;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:16px;box-shadow:0 2px 8px rgba(0,0,0,0.06);overflow:hidden;">
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:32px 40px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;">Convite de Parceria</h1>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px 40px;">
              <p style="margin:0 0 16px;color:#374151;font-size:16px;line-height:1.6;">
                Ola!
              </p>
              <p style="margin:0 0 24px;color:#374151;font-size:16px;line-height:1.6;">
                <strong>${inviterName || callerEmail}</strong> convidou voce para ser parceiro(a) na organizacao
                <strong>${orgName || 'Labrego CRM'}</strong> com o cargo de <strong>${roleLabel}</strong>.
              </p>
              <!-- Details Card -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;margin-bottom:24px;">
                <tr>
                  <td style="padding:20px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding:4px 0;color:#64748b;font-size:14px;">Organizacao</td>
                        <td style="padding:4px 0;color:#1e293b;font-size:14px;font-weight:600;text-align:right;">${orgName || 'Labrego CRM'}</td>
                      </tr>
                      <tr>
                        <td style="padding:4px 0;color:#64748b;font-size:14px;">Cargo</td>
                        <td style="padding:4px 0;color:#1e293b;font-size:14px;font-weight:600;text-align:right;">${roleLabel}</td>
                      </tr>
                      <tr>
                        <td style="padding:4px 0;color:#64748b;font-size:14px;">Convidado por</td>
                        <td style="padding:4px 0;color:#1e293b;font-size:14px;font-weight:600;text-align:right;">${inviterName || callerEmail}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding:8px 0 24px;">
                    <a href="${inviteLink}" style="display:inline-block;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#ffffff;text-decoration:none;font-size:16px;font-weight:600;padding:14px 40px;border-radius:12px;box-shadow:0 4px 12px rgba(99,102,241,0.3);">
                      Aceitar Convite
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 8px;color:#9ca3af;font-size:13px;text-align:center;">
                Se voce nao reconhece este convite, ignore este email.
              </p>
              <p style="margin:0;color:#9ca3af;font-size:12px;text-align:center;">
                Ou copie e cole este link no navegador:<br/>
                <a href="${inviteLink}" style="color:#6366f1;word-break:break-all;">${inviteLink}</a>
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color:#f8fafc;padding:20px 40px;border-top:1px solid #e2e8f0;text-align:center;">
              <p style="margin:0;color:#94a3b8;font-size:12px;">
                Labrego CRM &mdash; Gestao inteligente de parceiros
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`

    // Check if org has email provider configured
    const emailConfig = await getEmailProviderConfig(orgId)
    const hasCredentials = !!(
      (emailConfig.primaryProvider === 'hostinger' && (emailConfig.hostingerUser || process.env.HOSTINGER_EMAIL_USER)) ||
      (emailConfig.primaryProvider === 'gmail' && (emailConfig.gmailUser || process.env.GMAIL_USER)) ||
      (emailConfig.primaryProvider === 'resend' && (emailConfig.resendApiKey || process.env.RESEND_API_KEY)) ||
      (emailConfig.primaryProvider === 'sendgrid' && (emailConfig.sendgridApiKey || process.env.SENDGRID_API_KEY))
    )

    // Also check env-based fallbacks for any provider
    const hasAnyProvider = hasCredentials ||
      !!process.env.HOSTINGER_EMAIL_USER ||
      !!process.env.GMAIL_USER ||
      !!process.env.RESEND_API_KEY ||
      !!process.env.SENDGRID_API_KEY

    if (!hasAnyProvider) {
      return NextResponse.json(
        { error: 'no_email_provider', message: 'Nenhum provedor de email configurado. Configure em Admin > Plano > Provedor de Email.' },
        { status: 422 },
      )
    }

    // Send the email
    const result = await sendWithFallback(
      orgId,
      email,
      `Convite de parceria - ${orgName || 'Labrego CRM'}`,
      html,
    )

    if (!result.success) {
      return NextResponse.json(
        { error: 'email_send_failed', message: result.error || 'Falha ao enviar email. Verifique as configuracoes do provedor.' },
        { status: 500 },
      )
    }

    return NextResponse.json({ success: true, messageId: result.messageId })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    console.error('[send-invite-email] Error:', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
