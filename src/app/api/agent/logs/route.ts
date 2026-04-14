/**
 * GET /api/agent/logs?orgId=xxx&limit=50&channel=whatsapp&action=ai_responded
 *
 * Lista logs de atividade do agente IA de uma org.
 */

import { NextResponse } from 'next/server'
import { getAdminDb } from '@/lib/firebaseAdmin'
import { requireOrgId } from '@/lib/orgResolver'
import { checkRateLimit, getClientIp } from '@/lib/rateLimit'

export async function GET(request: Request) {
  const ip = getClientIp(new Headers(request.headers))
  const rl = checkRateLimit(`agent-logs:${ip}`, { limit: 30, windowSeconds: 60 })
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
    const limit = parseInt(searchParams.get('limit') || '50')
    const channel = searchParams.get('channel')
    const action = searchParams.get('action')

    const db = getAdminDb()
    let query = db
      .collection('organizations').doc(orgId)
      .collection('agentActivityLog')
      .orderBy('createdAt', 'desc')

    if (channel) query = query.where('channel', '==', channel)
    if (action) query = query.where('action', '==', action)

    const snap = await query.limit(limit).get()
    const logs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))

    return NextResponse.json({ logs })
  } catch (error) {
    console.error('[agent-logs] GET erro:', error)
    return NextResponse.json({ error: 'Erro ao carregar logs' }, { status: 500 })
  }
}
