/**
 * GET /api/agent/conversations?orgId=xxx&channel=whatsapp&status=active
 *
 * Lista conversas de uma org com filtros opcionais.
 */

import { NextResponse } from 'next/server'
import { listConversations } from '@/lib/agentConversation'
import type { ConversationStatus, MessageChannel } from '@/types/agentConfig'
import { requireOrgId } from '@/lib/orgResolver'
import { checkRateLimit, getClientIp } from '@/lib/rateLimit'

export async function GET(request: Request) {
  const ip = getClientIp(new Headers(request.headers))
  const rl = checkRateLimit(`agent-conversations:${ip}`, { limit: 30, windowSeconds: 60 })
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

  try {
    const orgCtx = await requireOrgId(new Headers(request.headers))
    if (!orgCtx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const orgId = orgCtx.orgId

    const { searchParams } = new URL(request.url)
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
