/**
 * POST /api/agent/whatsapp/webhook
 *
 * Recebe mensagens do Z-API, processa via Agent Engine e responde.
 * Esta rota bypassa auth (adicionada ao BYPASS_PATHS no middleware).
 *
 * Fluxo:
 * 1. Recebe payload do Z-API
 * 2. Resolve orgId pela instanceId (armazenado em whatsappConnections)
 * 3. Carrega config do agente
 * 4. Busca ou cria conversa + contato
 * 5. Verifica creditos
 * 6. Processa via Agent Engine (texto/audio/imagem/documento)
 * 7. Envia resposta via Z-API
 * 8. Debita credito
 */

import { NextResponse } from 'next/server'
import { getAdminDb } from '@/lib/firebaseAdmin'
import { processIncomingMessage } from '@/lib/agentEngine'
import { findOrCreateContact, logAgentAction } from '@/lib/agentCRM'
import {
  findActiveConversationByPhone,
  createConversation,
  addMessage,
  getAgentConfig,
  updateConversationStatus,
} from '@/lib/agentConversation'
import {
  sendTextMessage,
  sendAudioMessage,
  sendTypingIndicator,
  uploadAudioToStorage,
} from '@/lib/channels/zapiConnector'
import { canSendWhatsApp, deductAction } from '@/lib/credits'
import type { AgentConfig, ChannelMessage, MessageContentType } from '@/types/agentConfig'

// ========== Z-API WEBHOOK PAYLOAD TYPES ==========

interface ZAPIWebhookPayload {
  // Mensagem recebida
  phone?: string
  instanceId?: string
  messageId?: string
  fromMe?: boolean
  mompiessage?: unknown
  body?: string
  type?: string // 'ReceivedCallback' | 'MessageStatusCallback' | 'StatusInstanceCallback'
  // Campos especificos por tipo de mensagem
  text?: { message: string }
  image?: { imageUrl: string; caption?: string; mimeType?: string }
  audio?: { audioUrl: string; mimeType?: string }
  document?: { documentUrl: string; fileName?: string; mimeType?: string }
  video?: { videoUrl: string; caption?: string; mimeType?: string }
  senderName?: string
  photo?: string
  isGroup?: boolean
  // Status update
  status?: string
  chatName?: string
  // Connection status
  connected?: boolean
}

// ========== HELPERS ==========

/** Resolve orgId a partir do instanceId do Z-API */
async function resolveOrgByInstanceId(instanceId: string): Promise<string | null> {
  const db = getAdminDb()
  const snap = await db.collection('whatsappConnections')
    .where('instanceId', '==', instanceId)
    .limit(1)
    .get()

  if (snap.empty) return null
  return snap.docs[0].data().orgId || snap.docs[0].id
}

/** Extrai conteudo normalizado do payload Z-API */
function extractMessageContent(payload: ZAPIWebhookPayload): {
  content: string
  contentType: MessageContentType
  mediaUrl?: string
  mediaMimeType?: string
  mediaFileName?: string
} {
  // Audio
  if (payload.audio?.audioUrl) {
    return {
      content: '[Audio recebido]',
      contentType: 'audio',
      mediaUrl: payload.audio.audioUrl,
      mediaMimeType: payload.audio.mimeType,
    }
  }

  // Imagem
  if (payload.image?.imageUrl) {
    return {
      content: payload.image.caption || '[Imagem recebida]',
      contentType: 'image',
      mediaUrl: payload.image.imageUrl,
      mediaMimeType: payload.image.mimeType,
    }
  }

  // Documento
  if (payload.document?.documentUrl) {
    return {
      content: `[Documento: ${payload.document.fileName || 'arquivo'}]`,
      contentType: 'document',
      mediaUrl: payload.document.documentUrl,
      mediaMimeType: payload.document.mimeType,
      mediaFileName: payload.document.fileName,
    }
  }

  // Video (tratado como documento por enquanto)
  if (payload.video?.videoUrl) {
    return {
      content: payload.video.caption || '[Video recebido]',
      contentType: 'video',
      mediaUrl: payload.video.videoUrl,
    }
  }

  // Texto (default)
  const textContent = payload.text?.message || payload.body || ''
  return {
    content: textContent,
    contentType: 'text',
  }
}

// ========== MAIN HANDLER ==========

export async function POST(request: Request) {
  try {
    const payload: ZAPIWebhookPayload = await request.json()

    // Ignorar mensagens proprias (fromMe) e mensagens de grupo
    if (payload.fromMe || payload.isGroup) {
      return NextResponse.json({ status: 'ignored' })
    }

    // Ignorar status updates e connection callbacks
    if (payload.type === 'MessageStatusCallback' || payload.type === 'StatusInstanceCallback') {
      // Atualizar status da conexao se for StatusInstance
      if (payload.type === 'StatusInstanceCallback' && payload.instanceId) {
        const orgId = await resolveOrgByInstanceId(payload.instanceId)
        if (orgId) {
          const db = getAdminDb()
          await db.collection('whatsappConnections').doc(orgId).update({
            status: payload.connected ? 'connected' : 'disconnected',
            updatedAt: new Date().toISOString(),
          })
        }
      }
      return NextResponse.json({ status: 'ok' })
    }

    // Precisa de phone e instanceId para processar
    if (!payload.phone || !payload.instanceId) {
      return NextResponse.json({ status: 'ignored', reason: 'missing phone or instanceId' })
    }

    // 1. Resolver org
    const orgId = await resolveOrgByInstanceId(payload.instanceId)
    if (!orgId) {
      console.error(`[agent-webhook] Org nao encontrada para instanceId: ${payload.instanceId}`)
      return NextResponse.json({ error: 'Org not found' }, { status: 404 })
    }

    // 2. Carregar config do agente
    const configData = await getAgentConfig(orgId)
    if (!configData || !configData.whatsapp?.enabled) {
      return NextResponse.json({ status: 'agent_disabled' })
    }
    const config = configData as AgentConfig

    // 3. Carregar conexao WhatsApp para enviar respostas
    const db = getAdminDb()
    const connDoc = await db.collection('whatsappConnections').doc(orgId).get()
    if (!connDoc.exists) {
      return NextResponse.json({ error: 'WhatsApp not connected' }, { status: 400 })
    }
    const conn = connDoc.data()!
    const { instanceId, instanceToken } = conn as { instanceId: string; instanceToken: string }

    // 4. Buscar ou criar contato
    const contactResult = await findOrCreateContact(orgId, {
      phone: payload.phone,
      name: payload.senderName || payload.chatName,
    }, config)

    if (contactResult.isNew) {
      await logAgentAction(orgId, 'whatsapp', '', contactResult.contactId, 'contact_created',
        `Contato criado automaticamente: ${payload.senderName || payload.phone}`)
    }

    // 5. Buscar ou criar conversa
    let conversation = await findActiveConversationByPhone(orgId, payload.phone)
    if (!conversation) {
      conversation = await createConversation(orgId, {
        contactId: contactResult.contactId,
        contactName: payload.senderName || payload.chatName || payload.phone,
        contactPhone: payload.phone.replace(/\D/g, ''),
        channel: 'whatsapp',
      })
    }

    // 6. Extrair conteudo da mensagem
    const { content, contentType, mediaUrl, mediaMimeType, mediaFileName } = extractMessageContent(payload)

    // 7. Salvar mensagem do contato
    await addMessage(orgId, conversation.id, {
      role: 'contact',
      content,
      contentType,
      mediaUrl,
      channel: 'whatsapp',
      externalMessageId: payload.messageId,
    })

    await logAgentAction(orgId, 'whatsapp', conversation.id, contactResult.contactId, 'message_received',
      `Mensagem recebida (${contentType}): ${content.substring(0, 100)}`)

    // 8. Se conversa em handoff humano, nao processar com IA
    if (conversation.status === 'human_handoff' || !conversation.aiEnabled) {
      return NextResponse.json({ status: 'human_handoff', conversationId: conversation.id })
    }

    // 9. Verificar creditos
    const creditCheck = await canSendWhatsApp(orgId)
    if (!creditCheck.allowed) {
      // Enviar mensagem de creditos esgotados e transferir para humano
      const noCreditsMsg = 'Obrigado pelo contato! Nossa equipe vai continuar essa conversa em breve.'
      await sendTextMessage(instanceId, instanceToken, payload.phone, noCreditsMsg)
      await addMessage(orgId, conversation.id, {
        role: 'system',
        content: noCreditsMsg,
        contentType: 'text',
        channel: 'whatsapp',
      })
      await updateConversationStatus(orgId, conversation.id, 'human_handoff')
      await logAgentAction(orgId, 'whatsapp', conversation.id, contactResult.contactId, 'credit_insufficient',
        creditCheck.reason || 'Creditos insuficientes')
      return NextResponse.json({ status: 'no_credits' })
    }

    // 10. Mostrar "digitando..." enquanto processa
    await sendTypingIndicator(instanceId, instanceToken, payload.phone)

    // 11. Montar ChannelMessage normalizada
    const channelMessage: ChannelMessage = {
      externalMessageId: payload.messageId || '',
      channel: 'whatsapp',
      orgId,
      from: payload.phone,
      fromName: payload.senderName || payload.chatName || '',
      content,
      contentType,
      mediaUrl,
      mediaMimeType,
      mediaFileName,
      timestamp: new Date().toISOString(),
    }

    // 12. Carregar historico da conversa
    const messagesRef = db
      .collection('organizations').doc(orgId)
      .collection('conversations').doc(conversation.id)
      .collection('messages')
    const historySnap = await messagesRef.orderBy('createdAt', 'asc').limitToLast(20).get()
    const conversationHistory = historySnap.docs.map(d => ({ id: d.id, ...d.data() })) as import('@/types/agentConfig').ConversationMessage[]

    // 13. Processar via Agent Engine
    const agentResponse = await processIncomingMessage(channelMessage, config, conversationHistory)

    // 14. Handoff se necessario
    if (agentResponse.shouldHandoff) {
      await sendTextMessage(instanceId, instanceToken, payload.phone, agentResponse.content)
      await addMessage(orgId, conversation.id, {
        role: 'agent',
        content: agentResponse.content,
        contentType: 'text',
        channel: 'whatsapp',
      })
      await updateConversationStatus(orgId, conversation.id, 'human_handoff')
      await logAgentAction(orgId, 'whatsapp', conversation.id, contactResult.contactId, 'human_handoff',
        agentResponse.handoffReason || 'Handoff solicitado')
      return NextResponse.json({ status: 'handoff', conversationId: conversation.id })
    }

    // 15. Enviar resposta
    let sentMessageId = ''

    if (agentResponse.contentType === 'audio' && agentResponse.audioUrl) {
      // Enviar audio via Z-API
      try {
        // Se o audioUrl e base64, fazer upload para Storage primeiro
        if (agentResponse.audioUrl.startsWith('data:audio')) {
          const base64Data = agentResponse.audioUrl.split(',')[1]
          const audioBuffer = Buffer.from(base64Data, 'base64')
          const publicUrl = await uploadAudioToStorage(orgId, audioBuffer, `response-${Date.now()}.mp3`)
          const result = await sendAudioMessage(instanceId, instanceToken, payload.phone, publicUrl)
          sentMessageId = result.zapiMessageId
        }
        // Tambem enviar texto como fallback
        await sendTextMessage(instanceId, instanceToken, payload.phone, agentResponse.content)
      } catch (error) {
        console.error('[agent-webhook] Erro ao enviar audio, fallback para texto:', error)
        const result = await sendTextMessage(instanceId, instanceToken, payload.phone, agentResponse.content)
        sentMessageId = result.zapiMessageId
      }
      await logAgentAction(orgId, 'whatsapp', conversation.id, contactResult.contactId, 'audio_generated',
        'Audio gerado via ElevenLabs e enviado')
    } else {
      // Enviar texto
      const result = await sendTextMessage(instanceId, instanceToken, payload.phone, agentResponse.content)
      sentMessageId = result.zapiMessageId
    }

    // 16. Salvar resposta do agente
    await addMessage(orgId, conversation.id, {
      role: 'agent',
      content: agentResponse.content,
      contentType: agentResponse.contentType,
      mediaUrl: agentResponse.audioUrl,
      channel: 'whatsapp',
      externalMessageId: sentMessageId,
      creditsUsed: 1,
      tokensUsed: agentResponse.tokensUsed,
    })

    // 17. Debitar credito
    await deductAction(orgId, 'whatsapp', conversation.id, `Resposta agente IA WhatsApp`)

    await logAgentAction(orgId, 'whatsapp', conversation.id, contactResult.contactId, 'ai_responded',
      `Resposta enviada (${agentResponse.processingTimeMs}ms, ${agentResponse.tokensUsed} tokens)`)

    return NextResponse.json({
      status: 'ok',
      conversationId: conversation.id,
      processingTimeMs: agentResponse.processingTimeMs,
    })
  } catch (error) {
    console.error('[agent-webhook] Erro:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/** GET para verificacao do webhook (health check) */
export async function GET() {
  return NextResponse.json({ status: 'ok', agent: 'whatsapp' })
}
