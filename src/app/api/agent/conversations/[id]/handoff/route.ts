/**
 * POST /api/agent/conversations/[id]/handoff
 *
 * Transfere conversa para atendimento humano.
 */

import { NextResponse } from 'next/server'
import { updateConversationStatus, addMessage } from '@/lib/agentConversation'
import { logAgentAction } from '@/lib/agentCRM'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { orgId, assignedTo, reason } = await request.json()

    if (!orgId) {
      return NextResponse.json({ error: 'orgId obrigatorio' }, { status: 400 })
    }

    await updateConversationStatus(orgId, id, 'human_handoff', assignedTo)

    // Adicionar mensagem de sistema
    await addMessage(orgId, id, {
      role: 'system',
      content: `Conversa transferida para atendimento humano. ${reason ? `Motivo: ${reason}` : ''}`,
      contentType: 'text',
      channel: 'whatsapp',
    })

    await logAgentAction(orgId, 'whatsapp', id, '', 'human_handoff',
      reason || 'Transferido manualmente para humano')

    return NextResponse.json({ status: 'handoff', conversationId: id })
  } catch (error) {
    console.error('[handoff] POST erro:', error)
    return NextResponse.json({ error: 'Erro ao transferir conversa' }, { status: 500 })
  }
}
