/**
 * Email Agent Connector — Processa emails inbound e envia respostas via provider existente
 *
 * Inbound: Recebe emails via webhooks do Resend ou SendGrid
 * Outbound: Usa sendWithFallback() do emailProvider.ts existente
 *
 * O email agent reutiliza toda a infra de email ja existente no CRM.
 */

import { sendWithFallback } from '@/lib/email/emailProvider'
import type { EmailResult } from '@/lib/email/emailProvider'

// ========== INBOUND TYPES ==========

/** Payload normalizado de email inbound (independente do provider) */
export interface InboundEmail {
  messageId: string
  from: string            // email do remetente
  fromName: string        // nome do remetente
  to: string              // email destino (da org)
  subject: string
  textBody: string        // corpo em texto plano
  htmlBody: string        // corpo em HTML
  inReplyTo?: string      // Message-ID do email anterior (thread)
  references?: string     // References header (thread)
  attachments: InboundAttachment[]
  timestamp: string
}

export interface InboundAttachment {
  fileName: string
  contentType: string
  size: number
  url?: string
}

// ========== INBOUND PARSING ==========

/** Normaliza payload do Resend inbound webhook */
export function parseResendInbound(payload: Record<string, unknown>): InboundEmail | null {
  try {
    const headers = payload.headers as Record<string, string> | undefined
    const from = (payload.from as string) || ''
    const fromMatch = from.match(/(?:"?([^"]*)"?\s)?<?([^>]+@[^>]+)>?/)

    return {
      messageId: (payload.message_id as string) || headers?.['message-id'] || `resend-${Date.now()}`,
      from: fromMatch?.[2] || from,
      fromName: fromMatch?.[1] || '',
      to: (payload.to as string) || '',
      subject: (payload.subject as string) || '(Sem assunto)',
      textBody: (payload.text as string) || '',
      htmlBody: (payload.html as string) || '',
      inReplyTo: headers?.['in-reply-to'],
      references: headers?.['references'],
      attachments: ((payload.attachments as unknown[]) || []).map((a: unknown) => {
        const att = a as Record<string, unknown>
        return {
          fileName: (att.filename as string) || 'arquivo',
          contentType: (att.content_type as string) || 'application/octet-stream',
          size: (att.size as number) || 0,
          url: att.url as string | undefined,
        }
      }),
      timestamp: new Date().toISOString(),
    }
  } catch {
    return null
  }
}

/** Normaliza payload do SendGrid inbound webhook */
export function parseSendGridInbound(payload: Record<string, unknown>): InboundEmail | null {
  try {
    const from = (payload.from as string) || ''
    const fromMatch = from.match(/(?:"?([^"]*)"?\s)?<?([^>]+@[^>]+)>?/)
    const headers = (payload.headers as string) || ''

    // Extrair In-Reply-To e References dos headers raw
    const inReplyToMatch = headers.match(/In-Reply-To:\s*(<[^>]+>)/i)
    const referencesMatch = headers.match(/References:\s*(.+)/i)

    return {
      messageId: (payload['Message-ID'] as string) || `sg-${Date.now()}`,
      from: fromMatch?.[2] || from,
      fromName: fromMatch?.[1] || '',
      to: (payload.to as string) || '',
      subject: (payload.subject as string) || '(Sem assunto)',
      textBody: (payload.text as string) || '',
      htmlBody: (payload.html as string) || '',
      inReplyTo: inReplyToMatch?.[1],
      references: referencesMatch?.[1],
      attachments: [], // SendGrid attachments requerem parsing especifico
      timestamp: new Date().toISOString(),
    }
  } catch {
    return null
  }
}

/** Extrai texto limpo do corpo do email (remove HTML, quotes, signatures) */
export function extractCleanText(textBody: string, htmlBody: string): string {
  let text = textBody || ''

  // Se so tem HTML, extrair texto
  if (!text && htmlBody) {
    text = htmlBody
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/\s+/g, ' ')
      .trim()
  }

  // Remover citacoes de email anterior (linhas que comecam com >)
  const lines = text.split('\n')
  const cleanLines: string[] = []
  for (const line of lines) {
    // Parar ao encontrar marcadores de citacao
    if (line.trim().startsWith('>')) break
    if (line.match(/^On .+ wrote:$/i)) break
    if (line.match(/^Em .+ escreveu:$/i)) break
    if (line.match(/^-{3,}\s*Original Message/i)) break
    if (line.match(/^-{3,}\s*Mensagem Original/i)) break
    cleanLines.push(line)
  }

  return cleanLines.join('\n').trim()
}

// ========== OUTBOUND ==========

/** Envia email de resposta do agente usando o provider configurado da org */
export async function sendAgentEmailReply(
  orgId: string,
  to: string,
  subject: string,
  textContent: string,
  inReplyTo?: string
): Promise<EmailResult> {
  // Formatar como HTML simples
  const html = `<div style="font-family: sans-serif; font-size: 14px; line-height: 1.6; color: #333;">
${textContent.split('\n').map(line => `<p style="margin: 0 0 8px 0;">${line || '&nbsp;'}</p>`).join('\n')}
</div>`

  // Garantir que o subject tem Re: para thread
  const replySubject = subject.startsWith('Re:') ? subject : `Re: ${subject}`

  return sendWithFallback(orgId, to, replySubject, html)
}
