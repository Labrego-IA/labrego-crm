import { NextRequest, NextResponse } from 'next/server'
import { getAdminDb } from '@/lib/firebaseAdmin'
import { getVapiCalls } from '@/lib/callRouting'
import {
  CallDailyReport,
  NOT_CONNECTED_REASONS,
  VOICEMAIL_PHRASES,
  CallOutcomeCode,
} from '@/types/callRouting'
import { resolveOrgByEmail, getOrgIdFromHeaders } from '@/lib/orgResolver'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Resolve orgId from request: x-user-email > x-org-id header > DEFAULT_ORG_ID */
async function resolveOrgId(req: NextRequest): Promise<string> {
  const email = req.headers.get('x-user-email')
  if (email) {
    const ctx = await resolveOrgByEmail(email)
    if (ctx) return ctx.orgId
  }
  const fromHeader = getOrgIdFromHeaders(req.headers)
  if (fromHeader) return fromHeader
  const fallback = process.env.DEFAULT_ORG_ID || ''
  if (fallback) {
    console.warn('[CALL-ROUTING REPORTS] Using DEFAULT_ORG_ID fallback')
  } else {
    console.warn('[CALL-ROUTING REPORTS] No orgId resolved')
  }
  return fallback
}

// GET - Relatório de ligações
export async function GET(req: NextRequest) {
  try {
    const orgId = await resolveOrgId(req)
    if (!orgId) {
      return NextResponse.json({ error: 'orgId is required' }, { status: 400 })
    }

    const searchParams = req.nextUrl.searchParams
    const dateStr = searchParams.get('date') // formato: YYYY-MM-DD
    const source = searchParams.get('source') || 'vapi' // 'vapi' ou 'firestore'

    const today = dateStr || new Date().toISOString().split('T')[0]

    if (source === 'vapi') {
      return await getVapiReport(today)
    } else {
      return await getFirestoreReport(today, orgId)
    }
  } catch (error) {
    console.error('[CALL-ROUTING REPORTS] GET error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// Relatório via API do Vapi
async function getVapiReport(date: string): Promise<NextResponse> {
  try {
    const calls = (await getVapiCalls(100)) as Array<{
      id: string
      createdAt?: string
      customer?: { number: string }
      assistantOverrides?: { metadata?: { prospectName?: string } }
      endedReason?: string
      startedAt?: string
      endedAt?: string
      analysis?: { summary?: string; successEvaluation?: string | boolean }
    }>

    // Filtrar ligações do dia
    const todayCalls = calls.filter(c => c.createdAt?.startsWith(date))

    let atenderam = 0
    let naoAtenderam = 0
    const outcomes: Record<string, number> = {}
    const details: CallDailyReport['details'] = []

    for (const call of todayCalls) {
      const phone = call.customer?.number || 'Desconhecido'
      const metadata = call.assistantOverrides?.metadata || {}
      const name = metadata.prospectName || phone
      const endedReason = call.endedReason || 'unknown'
      const summary = (call.analysis?.summary || '').toLowerCase()

      // Calcular duração
      let duration: number | undefined
      if (call.startedAt && call.endedAt) {
        duration = Math.round(
          (new Date(call.endedAt).getTime() - new Date(call.startedAt).getTime()) / 1000
        )
      }

      // Verificar se é caixa postal pelo summary
      const ehCaixaPostal = VOICEMAIL_PHRASES.some(frase => summary.includes(frase))

      if (NOT_CONNECTED_REASONS.includes(endedReason) || ehCaixaPostal) {
        naoAtenderam++
        const outcome: CallOutcomeCode = 'TELEFONE_INDISPONIVEL'
        outcomes[outcome] = (outcomes[outcome] || 0) + 1
        details.push({
          name,
          phone,
          status: 'não atendeu',
          outcome,
          duration,
        })
      } else {
        atenderam++
        const success = call.analysis?.successEvaluation
        let outcome: CallOutcomeCode = 'SEM_INTERESSE'

        if (success === 'true' || success === true) {
          outcome = 'REUNIAO_AGENDADA'
        } else if (summary.includes('email') || summary.includes('material')) {
          outcome = 'ENVIAR_EMAIL'
        }

        outcomes[outcome] = (outcomes[outcome] || 0) + 1
        details.push({
          name,
          phone,
          status: 'atendeu',
          outcome,
          duration,
        })
      }
    }

    const report: CallDailyReport = {
      date,
      total: todayCalls.length,
      atenderam,
      naoAtenderam,
      outcomes: outcomes as Record<CallOutcomeCode, number>,
      details: details.slice(0, 50),
    }

    return NextResponse.json({
      success: true,
      source: 'vapi',
      report,
    })
  } catch (error) {
    console.error('[CALL-ROUTING REPORTS] Vapi error:', error)
    return NextResponse.json({ error: 'Erro ao buscar dados do Vapi' }, { status: 500 })
  }
}

// Relatório via Firestore (histórico salvo)
async function getFirestoreReport(date: string, orgId: string): Promise<NextResponse> {
  try {
    const db = getAdminDb()

    // Buscar todas as ligações do dia
    const startOfDay = new Date(date + 'T00:00:00.000Z')
    const endOfDay = new Date(date + 'T23:59:59.999Z')

    // Precisamos buscar em todas as subcollections de calls
    // Como não temos collectionGroup habilitado, vamos buscar clientes primeiro
    // Multi-tenant: filtrar clientes da org
    const clientsSnapshot = await db.collection('clients').where('orgId', '==', orgId).get()

    let atenderam = 0
    let naoAtenderam = 0
    const outcomes: Record<string, number> = {}
    const details: CallDailyReport['details'] = []

    for (const clientDoc of clientsSnapshot.docs) {
      const callsSnapshot = await db
        .collection('clients')
        .doc(clientDoc.id)
        .collection('calls')
        .where('createdAt', '>=', startOfDay.toISOString())
        .where('createdAt', '<=', endOfDay.toISOString())
        .get()

      for (const callDoc of callsSnapshot.docs) {
        const call = callDoc.data()
        const outcome = call.outcome as CallOutcomeCode
        const name = call.metadata?.prospectName || clientDoc.data().name || 'Desconhecido'
        const phone = call.metadata?.prospectPhone

        if (outcome === 'TELEFONE_INDISPONIVEL') {
          naoAtenderam++
        } else {
          atenderam++
        }

        if (outcome) {
          outcomes[outcome] = (outcomes[outcome] || 0) + 1
        }

        details.push({
          name,
          phone,
          status: outcome === 'TELEFONE_INDISPONIVEL' ? 'não atendeu' : 'atendeu',
          outcome,
          duration: call.duration,
        })
      }
    }

    const report: CallDailyReport = {
      date,
      total: atenderam + naoAtenderam,
      atenderam,
      naoAtenderam,
      outcomes: outcomes as Record<CallOutcomeCode, number>,
      details: details.slice(0, 50),
    }

    return NextResponse.json({
      success: true,
      source: 'firestore',
      report,
    })
  } catch (error) {
    console.error('[CALL-ROUTING REPORTS] Firestore error:', error)
    return NextResponse.json({ error: 'Erro ao buscar dados do Firestore' }, { status: 500 })
  }
}
