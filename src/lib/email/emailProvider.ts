import 'server-only'
import { getAdminDb } from '@/lib/firebaseAdmin'

/* ═══════════════════════════════════════════════════════════ */
/*  Types                                                     */
/* ═══════════════════════════════════════════════════════════ */

export type EmailProviderId = 'gmail' | 'resend' | 'sendgrid'

export interface EmailResult {
  success: boolean
  messageId?: string
  provider: EmailProviderId
  error?: string
}

export interface BulkEmail {
  to: string
  subject: string
  html: string
  metadata?: Record<string, string>
}

export interface BulkEmailResult {
  total: number
  sent: number
  failed: number
  results: EmailResult[]
  provider: EmailProviderId
}

export interface EmailProvider {
  id: EmailProviderId
  name: string
  send(to: string, subject: string, html: string, from?: string): Promise<EmailResult>
  sendBulk(emails: BulkEmail[], from?: string): Promise<BulkEmailResult>
}

export interface EmailProviderConfig {
  primaryProvider: EmailProviderId
  fallbackProvider?: EmailProviderId
  fromName: string
  fromEmail: string
  // Provider-specific credentials stored separately
  gmailUser?: string
  gmailAppPassword?: string
  resendApiKey?: string
  sendgridApiKey?: string
}

export const DEFAULT_EMAIL_CONFIG: EmailProviderConfig = {
  primaryProvider: 'gmail',
  fromName: 'Voxium',
  fromEmail: '',
}

export const PROVIDER_LABELS: Record<EmailProviderId, string> = {
  gmail: 'Gmail (SMTP)',
  resend: 'Resend',
  sendgrid: 'SendGrid',
}

/* ═══════════════════════════════════════════════════════════ */
/*  Factory                                                   */
/* ═══════════════════════════════════════════════════════════ */

export async function getEmailProviderConfig(orgId: string): Promise<EmailProviderConfig> {
  const db = getAdminDb()
  const configDoc = await db.collection('emailProviderConfigs').doc(orgId).get()
  if (configDoc.exists) {
    return { ...DEFAULT_EMAIL_CONFIG, ...configDoc.data() } as EmailProviderConfig
  }
  return DEFAULT_EMAIL_CONFIG
}

export async function saveEmailProviderConfig(
  orgId: string,
  config: Partial<EmailProviderConfig>,
): Promise<void> {
  const db = getAdminDb()
  await db.collection('emailProviderConfigs').doc(orgId).set(config, { merge: true })
}

export function createProvider(
  providerId: EmailProviderId,
  config: EmailProviderConfig,
): EmailProvider {
  switch (providerId) {
    case 'resend':
      return createResendProvider(config)
    case 'sendgrid':
      return createSendGridProvider(config)
    case 'gmail':
    default:
      return createGmailProvider(config)
  }
}

/* ═══════════════════════════════════════════════════════════ */
/*  Send with Fallback                                        */
/* ═══════════════════════════════════════════════════════════ */

export async function sendWithFallback(
  orgId: string,
  to: string,
  subject: string,
  html: string,
): Promise<EmailResult> {
  const config = await getEmailProviderConfig(orgId)
  const primary = createProvider(config.primaryProvider, config)
  const from = config.fromEmail ? `${config.fromName} <${config.fromEmail}>` : undefined

  const result = await primary.send(to, subject, html, from)
  if (result.success) {
    await logProviderEvent(orgId, config.primaryProvider, 'send', true)
    return result
  }

  // Fallback
  if (config.fallbackProvider && config.fallbackProvider !== config.primaryProvider) {
    const fallback = createProvider(config.fallbackProvider, config)
    const fallbackResult = await fallback.send(to, subject, html, from)
    await logProviderEvent(orgId, config.fallbackProvider, 'send_fallback', fallbackResult.success, result.error)
    return fallbackResult
  }

  await logProviderEvent(orgId, config.primaryProvider, 'send', false, result.error)
  return result
}

export async function sendBulkWithFallback(
  orgId: string,
  emails: BulkEmail[],
): Promise<BulkEmailResult> {
  const config = await getEmailProviderConfig(orgId)
  const primary = createProvider(config.primaryProvider, config)
  const from = config.fromEmail ? `${config.fromName} <${config.fromEmail}>` : undefined

  const result = await primary.sendBulk(emails, from)

  if (result.failed === 0) {
    await logProviderEvent(orgId, config.primaryProvider, 'send_bulk', true)
    return result
  }

  // If primary had failures and there's a fallback, retry failed ones
  if (config.fallbackProvider && config.fallbackProvider !== config.primaryProvider && result.failed > 0) {
    const failedEmails = emails.filter((_, i) => !result.results[i]?.success)
    if (failedEmails.length > 0) {
      const fallback = createProvider(config.fallbackProvider, config)
      const fallbackResult = await fallback.sendBulk(failedEmails, from)
      await logProviderEvent(orgId, config.fallbackProvider, 'send_bulk_fallback', fallbackResult.failed === 0)

      const totalSent = result.sent + fallbackResult.sent
      return {
        total: emails.length,
        sent: totalSent,
        failed: emails.length - totalSent,
        results: [...result.results.filter(r => r.success), ...fallbackResult.results],
        provider: config.primaryProvider,
      }
    }
  }

  await logProviderEvent(orgId, config.primaryProvider, 'send_bulk', result.failed === 0)
  return result
}

/* ═══════════════════════════════════════════════════════════ */
/*  Provider Logging                                          */
/* ═══════════════════════════════════════════════════════════ */

async function logProviderEvent(
  orgId: string,
  provider: EmailProviderId,
  action: string,
  success: boolean,
  error?: string,
) {
  try {
    const db = getAdminDb()
    await db.collection('emailProviderLogs').add({
      orgId,
      provider,
      action,
      success,
      error: error || null,
      createdAt: new Date().toISOString(),
    })
  } catch (err) {
    console.error('[EmailProvider] Failed to log event:', err)
  }
}

/* ═══════════════════════════════════════════════════════════ */
/*  Gmail Provider (existing nodemailer)                      */
/* ═══════════════════════════════════════════════════════════ */

function createGmailProvider(config: EmailProviderConfig): EmailProvider {
  return {
    id: 'gmail',
    name: 'Gmail (SMTP)',
    async send(to, subject, html, from) {
      try {
        const nodemailer = await import('nodemailer')
        const user = config.gmailUser?.trim() || process.env.GMAIL_USER?.trim()
        const pass = config.gmailAppPassword?.trim()?.replace(/\s+/g, '') || process.env.GMAIL_PASS?.trim()?.replace(/\s+/g, '')

        if (!user || !pass) {
          return { success: false, provider: 'gmail', error: 'Credenciais Gmail não configuradas. Acesse Admin > Plano > Provedor de Email para configurar.' }
        }

        const transporter = nodemailer.default.createTransport({
          service: 'gmail',
          auth: { user, pass },
        })

        const info = await transporter.sendMail({
          from: from || `${config.fromName || 'Voxium'} <${user}>`,
          to,
          subject,
          html,
        })

        return { success: true, messageId: info.messageId, provider: 'gmail' }
      } catch (err) {
        return { success: false, provider: 'gmail', error: err instanceof Error ? err.message : 'Gmail send failed' }
      }
    },
    async sendBulk(emails, from) {
      const results: EmailResult[] = []
      let sent = 0
      let failed = 0

      for (const email of emails) {
        const result = await this.send(email.to, email.subject, email.html, from)
        results.push(result)
        if (result.success) sent++
        else failed++
      }

      return { total: emails.length, sent, failed, results, provider: 'gmail' }
    },
  }
}

/* ═══════════════════════════════════════════════════════════ */
/*  Resend Provider (REST API)                                */
/* ═══════════════════════════════════════════════════════════ */

function createResendProvider(config: EmailProviderConfig): EmailProvider {
  const apiKey = config.resendApiKey || process.env.RESEND_API_KEY

  return {
    id: 'resend',
    name: 'Resend',
    async send(to, subject, html, from) {
      if (!apiKey) {
        return { success: false, provider: 'resend', error: 'Resend API key not configured' }
      }

      try {
        const response = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: from || `${config.fromName} <${config.fromEmail || 'noreply@resend.dev'}>`,
            to: [to],
            subject,
            html,
          }),
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          return {
            success: false,
            provider: 'resend',
            error: `Resend API error ${response.status}: ${JSON.stringify(errorData)}`,
          }
        }

        const data = await response.json()
        return { success: true, messageId: data.id, provider: 'resend' }
      } catch (err) {
        return { success: false, provider: 'resend', error: err instanceof Error ? err.message : 'Resend send failed' }
      }
    },
    async sendBulk(emails, from) {
      if (!apiKey) {
        return {
          total: emails.length,
          sent: 0,
          failed: emails.length,
          results: emails.map(() => ({ success: false, provider: 'resend' as const, error: 'API key not configured' })),
          provider: 'resend',
        }
      }

      // Resend supports batch endpoint
      try {
        const response = await fetch('https://api.resend.com/emails/batch', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(
            emails.map(email => ({
              from: from || `${config.fromName} <${config.fromEmail || 'noreply@resend.dev'}>`,
              to: [email.to],
              subject: email.subject,
              html: email.html,
            })),
          ),
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          return {
            total: emails.length,
            sent: 0,
            failed: emails.length,
            results: emails.map(() => ({
              success: false,
              provider: 'resend' as const,
              error: `Resend batch error: ${JSON.stringify(errorData)}`,
            })),
            provider: 'resend',
          }
        }

        const data = await response.json()
        const results: EmailResult[] = (data.data || []).map((item: { id: string }) => ({
          success: true,
          messageId: item.id,
          provider: 'resend' as const,
        }))

        return {
          total: emails.length,
          sent: results.length,
          failed: emails.length - results.length,
          results,
          provider: 'resend',
        }
      } catch (err) {
        return {
          total: emails.length,
          sent: 0,
          failed: emails.length,
          results: emails.map(() => ({
            success: false,
            provider: 'resend' as const,
            error: err instanceof Error ? err.message : 'Resend batch failed',
          })),
          provider: 'resend',
        }
      }
    },
  }
}

/* ═══════════════════════════════════════════════════════════ */
/*  SendGrid Provider (REST API)                              */
/* ═══════════════════════════════════════════════════════════ */

function createSendGridProvider(config: EmailProviderConfig): EmailProvider {
  const apiKey = config.sendgridApiKey || process.env.SENDGRID_API_KEY

  return {
    id: 'sendgrid',
    name: 'SendGrid',
    async send(to, subject, html, from) {
      if (!apiKey) {
        return { success: false, provider: 'sendgrid', error: 'SendGrid API key not configured' }
      }

      try {
        const fromEmail = config.fromEmail || 'noreply@example.com'
        const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            personalizations: [{ to: [{ email: to }] }],
            from: { email: fromEmail, name: config.fromName || 'Voxium' },
            subject,
            content: [{ type: 'text/html', value: html }],
          }),
        })

        if (!response.ok) {
          const errorText = await response.text().catch(() => '')
          return {
            success: false,
            provider: 'sendgrid',
            error: `SendGrid API error ${response.status}: ${errorText}`,
          }
        }

        const messageId = response.headers.get('x-message-id') || undefined
        return { success: true, messageId, provider: 'sendgrid' }
      } catch (err) {
        return { success: false, provider: 'sendgrid', error: err instanceof Error ? err.message : 'SendGrid send failed' }
      }
    },
    async sendBulk(emails, from) {
      // SendGrid doesn't have a batch endpoint like Resend — send individually
      const results: EmailResult[] = []
      let sent = 0
      let failed = 0

      for (const email of emails) {
        const result = await this.send(email.to, email.subject, email.html, from)
        results.push(result)
        if (result.success) sent++
        else failed++
      }

      return { total: emails.length, sent, failed, results, provider: 'sendgrid' }
    },
  }
}
