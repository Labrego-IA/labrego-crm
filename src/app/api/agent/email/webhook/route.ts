/**
 * POST /api/agent/email/webhook
 *
 * Recebe emails inbound (Resend ou SendGrid), processa via Agent Engine e responde.
 * Bypassa auth (adicionado ao BYPASS_PATHS no middleware).
 *
 * Fluxo:
 * 1. Recebe payload do provider de email
 * 2. Normaliza para InboundEmail
 * 3. Resolve orgId pelo email destino
 * 4. Busca ou cria conversa + contato
 * 5. Verifica creditos
 * 6. Processa via Agent Engine
 * 7. Envia resposta por email
 * 8. Debita credito
 */

import { NextResponse } from 'next/server'
import { getAdminDb } from '@/lib/firebaseAdmin'
import { processIncomingMessage } from '@/lib/agentEngine'
import { findOrCreateContact, logAgentAction } from '@/lib/agentCRM'
import {
  findActiveConversationByEmail,
  createConversation,
  addMessage,
  getAgentConfig,
  updateConversationStatus,
} from '@/lib/agentConversation'
import {
  parseResendInbound,
  parseSendGridInbound,
  extractCleanText,
  sendAgentEmailReply,
} from '@/lib/channels/emailAgentConnector'
import { canSendWhatsApp, deductAction } from '@/lib/credits'
import type { AgentConfig, ChannelMessage } from '@/types/agentConfig'

// ========== ORG RESOLUTION ==========

/** Resolve orgId pelo email destino (busca em emailProviderConfigs) */
async function resolveOrgByEmail(toEmail: string): Promise<string | null> {
  const db = getAdminDb()

  // Buscar org que tem esse email configurado como fromEmail
  const snap = await db.collection('emailProviderConfigs')
    .where('fromEmail', '==', toEmail.toLowerCase())
    .limit(1)
    .get()

  if (!snap.empty) return snap.docs[0].id

  // Fallback: buscar em agentConfigs onde email agent esta ativado
  const agentSnap = await db.collection('agentConfigs')
    .where('email.enabled', '==', true)
    .get()

  // Verificar se alguma org tem esse email
  for (const doc of agentSnap.docs) {
    const config = doc.data()
    if (config.email?.inboundEmail?.toLowerCase() === toEmail.toLowerCase()) {
      return doc.id
    }
  }

  return null
}

/** Detecta o provider pelo formato do payload */
function detectProvider(payload: Record<string, unknown>): 'resend' | 'sendgrid' | 'unknown' {
  if (payload.message_id || payload.created_at) return 'resend'
  if (payload.envelope || payload.charsets) return 'sendgrid'
  return 'unknown'
}

// ========== MAIN HANDLER ==========

export async function POST(request: Request) {
  try {
    const payload = await request.json()

    // Detectar provider e normalizar
    const provider = detectProvider(payload)
    const inbound = provider === 'resend'
      ? parseResendInbound(payload)
      : provider === 'sendgrid'
        ? parseSendGridInbound(payload)
        : null

    if (!inbound) {
      console.error('[email-webhook] Payload nao reconhecido:', JSON.stringify(payload).substring(0, 500))
      return NextResponse.json({ error: 'Payload nao reconhecido' }, { status: 400 })
    }

    // 1. Resolver org pelo email destino
    const orgId = await resolveOrgByEmail(inbound.to)
    if (!orgId) {
      console.warn(`[email-webhook] Org nao encontrada para email: ${inbound.to}`)
      return NextResponse.json({ status: 'no_org' })
    }

    // 2. Carregar config do agente
    const configData = await getAgentConfig(orgId)
    if (!configData || !configData.email?.enabled) {
      return NextResponse.json({ status: 'agent_disabled' })
    }
    const config = configData as AgentConfig

    // 3. Extrair texto limpo (sem quotes/signatures)
    const cleanText = extractCleanText(inbound.textBody, inbound.htmlBody)
    if (!cleanText) {
      return NextResponse.json({ status: 'empty_message' })
    }

    // 4. Buscar ou criar contato
    const contactResult = await findOrCreateContact(orgId, {
      email: inbound.from,
      name: inbound.fromName,
    }, config)

    if (contactResult.isNew) {
      await logAgentAction(orgId, 'email', '', contactResult.contactId, 'contact_created',
        `Contato criado via email: ${inbound.fromName || inbound.from}`)
    }

    // 5. Buscar ou criar conversa
    let conversation = await findActiveConversationByEmail(orgId, inbound.from)
    if (!conversation) {
      conversation = await createConversation(orgId, {
        contactId: contactResult.contactId,
        contactName: inbound.fromName || inbound.from,
        contactEmail: inbound.from,
        channel: 'email',
        metadata: {
          emailSubject: inbound.subject,
          emailThreadId: inbound.inReplyTo || inbound.messageId,
        },
      })
    }

    // 6. Salvar mensagem do contato
    await addMessage(orgId, conversation.id, {
      role: 'contact',
      content: cleanText,
      contentType: 'text',
      channel: 'email',
      externalMessageId: inbound.messageId,
    })

    await logAgentAction(orgId, 'email', conversation.id, contactResult.contactId, 'message_received',
      `Email recebido: ${inbound.subject}`)

    // 7. Se em handoff humano, nao processar
    if (conversation.status === 'human_handoff' || !conversation.aiEnabled) {
      return NextResponse.json({ status: 'human_handoff', conversationId: conversation.id })
    }

    // 8. Verificar creditos (reutiliza mesma pool de acoes)
    const creditCheck = await canSendWhatsApp(orgId)
    if (!creditCheck.allowed) {
      await updateConversationStatus(orgId, conversation.id, 'human_handoff')
      await logAgentAction(orgId, 'email', conversation.id, contactResult.contactId, 'credit_insufficient',
        creditCheck.reason || 'Creditos insuficientes')
      return NextResponse.json({ status: 'no_credits' })
    }

    // 9. Montar ChannelMessage normalizada
    const channelMessage: ChannelMessage = {
      externalMessageId: inbound.messageId,
      channel: 'email',
      orgId,
      from: inbound.from,
      fromName: inbound.fromName,
      content: cleanText,
      contentType: 'text',
      timestamp: inbound.timestamp,
      emailSubject: inbound.subject,
      emailThreadId: inbound.inReplyTo,
      emailInReplyTo: inbound.inReplyTo,
    }

    // 10. Carregar historico
    const db = getAdminDb()
    const historySnap = await db
      .collection('organizations').doc(orgId)
      .collection('conversations').doc(conversation.id)
      .collection('messages')
      .orderBy('createdAt', 'asc')
      .limitToLast(20)
      .get()
    const conversationHistory = historySnap.docs.map(d => ({
      id: d.id, ...d.data(),
    })) as import('@/types/agentConfig').ConversationMessage[]

    // 11. Processar via Agent Engine
    const agentResponse = await processIncomingMessage(channelMessage, config, conversationHistory)

    // 12. Handoff se necessario
    if (agentResponse.shouldHandoff) {
      await updateConversationStatus(orgId, conversation.id, 'human_handoff')
      await logAgentAction(orgId, 'email', conversation.id, contactResult.contactId, 'human_handoff',
        agentResponse.handoffReason || 'Handoff solicitado')
      return NextResponse.json({ status: 'handoff', conversationId: conversation.id })
    }

    // 13. Enviar resposta por email
    const emailResult = await sendAgentEmailReply(
      orgId,
      inbound.from,
      inbound.subject,
      agentResponse.content,
      inbound.messageId
    )

    // 14. Salvar resposta do agente
    await addMessage(orgId, conversation.id, {
      role: 'agent',
      content: agentResponse.content,
      contentType: 'text',
      channel: 'email',
      externalMessageId: emailResult.messageId,
      creditsUsed: 1,
      tokensUsed: agentResponse.tokensUsed,
    })

    // 15. Debitar credito
    await deductAction(orgId, 'whatsapp', conversation.id, 'Resposta agente IA Email')

    await logAgentAction(orgId, 'email', conversation.id, contactResult.contactId, 'ai_responded',
      `Resposta enviada por email (${agentResponse.processingTimeMs}ms)`)

    return NextResponse.json({
      status: 'ok',
      conversationId: conversation.id,
      processingTimeMs: agentResponse.processingTimeMs,
    })
  } catch (error) {
    console.error('[email-webhook] Erro:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({ status: 'ok', agent: 'email' })
}
