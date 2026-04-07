/**
 * GET /api/agent/conversations/[id]?orgId=xxx
 *
 * Retorna conversa com mensagens.
 */

import { NextResponse } from 'next/server'
import { getConversation, listMessages, markConversationAsRead } from '@/lib/agentConversation'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { searchParams } = new URL(request.url)
    const orgId = searchParams.get('orgId')
    if (!orgId) {
      return NextResponse.json({ error: 'orgId obrigatorio' }, { status: 400 })
    }

    const conversation = await getConversation(orgId, id)
    if (!conversation) {
      return NextResponse.json({ error: 'Conversa nao encontrada' }, { status: 404 })
    }

    const messages = await listMessages(orgId, id, 50)

    // Marcar como lida
    await markConversationAsRead(orgId, id)

    return NextResponse.json({ conversation, messages })
  } catch (error) {
    console.error('[conversation-detail] GET erro:', error)
    return NextResponse.json({ error: 'Erro ao carregar conversa' }, { status: 500 })
  }
}
