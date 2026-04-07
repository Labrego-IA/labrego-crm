/**
 * GET /api/agent/logs?orgId=xxx&limit=50&channel=whatsapp&action=ai_responded
 *
 * Lista logs de atividade do agente IA de uma org.
 */

import { NextResponse } from 'next/server'
import { getAdminDb } from '@/lib/firebaseAdmin'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const orgId = searchParams.get('orgId')
    if (!orgId) {
      return NextResponse.json({ error: 'orgId obrigatorio' }, { status: 400 })
    }

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
