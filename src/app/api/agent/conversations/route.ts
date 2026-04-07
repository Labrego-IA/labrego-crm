/**
 * GET /api/agent/conversations?orgId=xxx&channel=whatsapp&status=active
 *
 * Lista conversas de uma org com filtros opcionais.
 */

import { NextResponse } from 'next/server'
import { listConversations } from '@/lib/agentConversation'
import type { ConversationStatus, MessageChannel } from '@/types/agentConfig'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const orgId = searchParams.get('orgId')
    if (!orgId) {
      return NextResponse.json({ error: 'orgId obrigatorio' }, { status: 400 })
    }

    const channel = searchParams.get('channel') as MessageChannel | null
    const statusParam = searchParams.get('status')
    const limit = parseInt(searchParams.get('limit') || '30')

    let status: ConversationStatus | ConversationStatus[] | undefined
    if (statusParam === 'all') {
      status = undefined
    } else if (statusParam) {
      status = statusParam.split(',') as ConversationStatus[]
    } else {
      status = ['active', 'human_handoff']
    }

    const conversations = await listConversations(orgId, {
      channel: channel || undefined,
      status,
      limit,
    })

    return NextResponse.json({ conversations })
  } catch (error) {
    console.error('[conversations] GET erro:', error)
    return NextResponse.json({ error: 'Erro ao listar conversas' }, { status: 500 })
  }
}
