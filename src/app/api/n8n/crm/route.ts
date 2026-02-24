import crypto from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { getAdminDb } from '@/lib/firebaseAdmin'
import { getOrgIdFromHeaders } from '@/lib/orgResolver'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const WEBHOOK_SECRET = process.env.N8N_CRM_WEBHOOK_SECRET

function verifyWebhookAuth(req: Request): boolean {
  if (!WEBHOOK_SECRET) return false // Bloqueia se secret não configurado
  const header = req.headers.get('x-webhook-secret') ?? req.headers.get('authorization')
  if (!header) return false
  const token = header.startsWith('Bearer ') ? header.slice(7) : header
  if (!token) return false
  // Comparação segura contra timing attacks
  const a = Buffer.from(token)
  const b = Buffer.from(WEBHOOK_SECRET)
  if (a.length !== b.length) return false
  return crypto.timingSafeEqual(a, b)
}

function cleanString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

// GET - Buscar clientes do CRM com filtros
export async function GET(req: NextRequest) {
  if (!verifyWebhookAuth(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const searchParams = req.nextUrl.searchParams
    const search = searchParams.get('search')?.toLowerCase()
    const funnelStageName = searchParams.get('funnelStage') // Nome do estágio (ex: "Prospecção ativa")
    const funnelStageId = searchParams.get('funnelStageId') // ID direto do estágio
    const status = searchParams.get('status')
    const leadSource = searchParams.get('leadSource')
    const leadType = searchParams.get('leadType')
    const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 500)
    const includeFollowups = searchParams.get('includeFollowups') === 'true'
    const includeLogs = searchParams.get('includeLogs') === 'true'

    // Multi-tenant: resolve orgId from query param, header, or env fallback
    const orgId = searchParams.get('orgId') || getOrgIdFromHeaders(req.headers) || process.env.DEFAULT_ORG_ID || ''
    if (!orgId) {
      console.warn('[N8N CRM] No orgId resolved for GET request')
    }

    const db = getAdminDb()

    // Se filtrar por nome do estágio, primeiro buscar o ID
    let targetStageId: string | null = funnelStageId
    if (funnelStageName && !funnelStageId) {
      const stagesSnap = await db.collection('funnelStages').where('name', '==', funnelStageName).get()
      if (!stagesSnap.empty) {
        targetStageId = stagesSnap.docs[0].id
      } else {
        return NextResponse.json({
          success: true,
          clients: [],
          message: `Nenhum estágio encontrado com o nome "${funnelStageName}"`,
        })
      }
    }

    // Buscar todos os estágios para enriquecer os dados
    const allStagesSnap = await db.collection('funnelStages').orderBy('order').get()
    const stagesMap = new Map<string, { name: string; order: number; color?: number }>()
    allStagesSnap.docs.forEach((doc) => {
      const data = doc.data()
      stagesMap.set(doc.id, {
        name: data.name,
        order: data.order,
        color: data.color,
      })
    })

    // Construir query base (multi-tenant filtered)
    let query: FirebaseFirestore.Query = db.collection('clients')
    if (orgId) {
      query = query.where('orgId', '==', orgId)
    }
    query = query.orderBy('updatedAt', 'desc').limit(limit)

    const snapshot = await query.get()

    let clients = snapshot.docs.map((doc) => {
      const data = doc.data()
      const stageInfo = data.funnelStage ? stagesMap.get(data.funnelStage) : null

      return {
        id: doc.id,
        name: data.name,
        phone: data.phone,
        company: data.company,
        email: data.email,
        document: data.document,
        industry: data.industry,
        description: data.description,
        status: data.status,
        leadSource: data.leadSource,
        leadType: data.leadType,
        funnelStageId: data.funnelStage,
        funnelStageName: stageInfo?.name || null,
        funnelStageUpdatedAt: data.funnelStageUpdatedAt,
        lastFollowUpAt: data.lastFollowUpAt,
        returnAlert: data.returnAlert,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
      }
    })

    // Aplicar filtros em memória
    if (targetStageId) {
      clients = clients.filter((c) => c.funnelStageId === targetStageId)
    }

    if (status) {
      clients = clients.filter((c) => c.status === status)
    }

    if (leadSource) {
      clients = clients.filter((c) => c.leadSource === leadSource)
    }

    if (leadType) {
      clients = clients.filter((c) => c.leadType === leadType)
    }

    if (search) {
      clients = clients.filter(
        (c) =>
          c.name?.toLowerCase().includes(search) ||
          c.phone?.includes(search) ||
          c.company?.toLowerCase().includes(search) ||
          c.email?.toLowerCase().includes(search)
      )
    }

    // Buscar followups e logs se solicitado
    if (includeFollowups || includeLogs) {
      const enrichedClients = await Promise.all(
        clients.map(async (client) => {
          const enriched: any = { ...client }

          if (includeFollowups) {
            const followupsSnap = await db
              .collection('clients')
              .doc(client.id)
              .collection('followups')
              .orderBy('createdAt', 'desc')
              .limit(10)
              .get()

            enriched.followups = followupsSnap.docs.map((doc) => ({
              id: doc.id,
              ...doc.data(),
            }))
          }

          if (includeLogs) {
            const logsSnap = await db
              .collection('clients')
              .doc(client.id)
              .collection('logs')
              .orderBy('createdAt', 'desc')
              .limit(10)
              .get()

            enriched.logs = logsSnap.docs.map((doc) => ({
              id: doc.id,
              ...doc.data(),
            }))
          }

          return enriched
        })
      )

      return NextResponse.json({
        success: true,
        count: enrichedClients.length,
        clients: enrichedClients,
      })
    }

    return NextResponse.json({
      success: true,
      count: clients.length,
      clients,
    })
  } catch (error) {
    console.error('[N8N CRM] GET error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// POST - Adicionar logs e/ou followups a um cliente
export async function POST(req: Request) {
  if (!verifyWebhookAuth(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    let payload: any
    try {
      payload = await req.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const clientId = cleanString(payload.clientId) || cleanString(payload.id)
    if (!clientId) {
      return NextResponse.json(
        { error: 'clientId é obrigatório' },
        { status: 400 }
      )
    }

    const followupText = cleanString(payload.followup) || cleanString(payload.followupText) || cleanString(payload.note)
    const logMessage = cleanString(payload.log) || cleanString(payload.logMessage)
    const author = cleanString(payload.author) || cleanString(payload.email) || 'automação'

    if (!followupText && !logMessage) {
      return NextResponse.json(
        { error: 'Pelo menos um campo é necessário: followup ou log' },
        { status: 400 }
      )
    }

    const db = getAdminDb()
    const clientRef = db.collection('clients').doc(clientId)

    // Verificar se o cliente existe
    const clientDoc = await clientRef.get()
    if (!clientDoc.exists) {
      return NextResponse.json(
        { error: `Cliente não encontrado: ${clientId}` },
        { status: 404 }
      )
    }

    const nowIso = new Date().toISOString()
    const results: { followupId?: string; logId?: string } = {}

    // Adicionar followup se fornecido
    if (followupText) {
      const followupRef = await clientRef.collection('followups').add({
        text: followupText,
        author,
        createdAt: nowIso,
      })
      results.followupId = followupRef.id

      // Atualizar lastFollowUpAt no cliente
      await clientRef.update({
        lastFollowUpAt: nowIso,
        updatedAt: nowIso,
      })
    }

    // Adicionar log se fornecido
    if (logMessage) {
      const logRef = await clientRef.collection('logs').add({
        message: logMessage,
        email: author,
        createdAt: nowIso,
        source: cleanString(payload.source) || 'n8n',
      })
      results.logId = logRef.id

      // Atualizar updatedAt se não foi atualizado pelo followup
      if (!followupText) {
        await clientRef.update({
          updatedAt: nowIso,
        })
      }
    }

    return NextResponse.json({
      success: true,
      clientId,
      ...results,
      message: 'Registros adicionados com sucesso',
    })
  } catch (error) {
    console.error('[N8N CRM] POST error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
