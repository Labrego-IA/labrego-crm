/**
 * POST /api/agent/conversations/[id]/resolve
 *
 * Marca conversa como resolvida. Opcao de re-ativar IA.
 */

import { NextResponse } from 'next/server'
import { updateConversationStatus, resumeAI, addMessage } from '@/lib/agentConversation'
import { logAgentAction } from '@/lib/agentCRM'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { orgId, action } = await request.json()

    if (!orgId) {
      return NextResponse.json({ error: 'orgId obrigatorio' }, { status: 400 })
    }

    if (action === 'resume_ai') {
      // Re-ativar IA
      await resumeAI(orgId, id)
      await addMessage(orgId, id, {
        role: 'system',
        content: 'Agente IA reativado na conversa.',
        contentType: 'text',
        channel: 'whatsapp',
      })
      await logAgentAction(orgId, 'whatsapp', id, '', 'ai_resumed', 'IA reativada pelo atendente')
      return NextResponse.json({ status: 'ai_resumed', conversationId: id })
    }

    // Resolver conversa
    await updateConversationStatus(orgId, id, 'resolved')
    await addMessage(orgId, id, {
      role: 'system',
      content: 'Conversa marcada como resolvida.',
      contentType: 'text',
      channel: 'whatsapp',
    })
    await logAgentAction(orgId, 'whatsapp', id, '', 'ai_responded', 'Conversa resolvida')

    return NextResponse.json({ status: 'resolved', conversationId: id })
  } catch (error) {
    console.error('[resolve] POST erro:', error)
    return NextResponse.json({ error: 'Erro ao resolver conversa' }, { status: 500 })
  }
}
