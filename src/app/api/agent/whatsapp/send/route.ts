/**
 * POST /api/agent/whatsapp/send
 *
 * Envio manual de mensagem (para quando humano assume a conversa).
 */

import { NextResponse } from 'next/server'
import { getAdminDb } from '@/lib/firebaseAdmin'
import { addMessage } from '@/lib/agentConversation'
import { sendTextMessage } from '@/lib/channels/zapiConnector'
import { canSendWhatsApp, deductAction } from '@/lib/credits'

export async function POST(request: Request) {
  try {
    const { orgId, conversationId, message, senderEmail } = await request.json()

    if (!orgId || !conversationId || !message) {
      return NextResponse.json({ error: 'orgId, conversationId e message obrigatorios' }, { status: 400 })
    }

    // Verificar creditos
    const creditCheck = await canSendWhatsApp(orgId)
    if (!creditCheck.allowed) {
      return NextResponse.json({ error: creditCheck.reason }, { status: 402 })
    }

    // Carregar conversa para obter telefone
    const db = getAdminDb()
    const convDoc = await db
      .collection('organizations').doc(orgId)
      .collection('conversations').doc(conversationId)
      .get()

    if (!convDoc.exists) {
      return NextResponse.json({ error: 'Conversa nao encontrada' }, { status: 404 })
    }

    const conv = convDoc.data()!
    const phone = conv.contactPhone

    if (!phone) {
      return NextResponse.json({ error: 'Contato sem telefone' }, { status: 400 })
    }

    // Carregar conexao WhatsApp
    const connDoc = await db.collection('whatsappConnections').doc(orgId).get()
    if (!connDoc.exists) {
      return NextResponse.json({ error: 'WhatsApp nao conectado' }, { status: 400 })
    }
    const { instanceId, instanceToken } = connDoc.data() as { instanceId: string; instanceToken: string }

    // Enviar mensagem
    const result = await sendTextMessage(instanceId, instanceToken, phone, message)

    // Salvar mensagem
    await addMessage(orgId, conversationId, {
      role: 'human',
      content: message,
      contentType: 'text',
      channel: 'whatsapp',
      externalMessageId: result.zapiMessageId,
      creditsUsed: 1,
    })

    // Debitar credito
    await deductAction(orgId, 'whatsapp', conversationId, 'Mensagem manual WhatsApp')

    return NextResponse.json({ status: 'sent', messageId: result.zapiMessageId })
  } catch (error) {
    console.error('[agent-send] Erro:', error)
    return NextResponse.json({ error: 'Erro ao enviar mensagem' }, { status: 500 })
  }
}
