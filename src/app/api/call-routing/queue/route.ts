import { NextRequest, NextResponse } from 'next/server'
import {
  createCallQueue,
  getCallQueue,
  getQueueItems,
  processQueue,
  cancelQueue,
} from '@/lib/callQueue'
import { getCallRoutingConfig } from '@/lib/callRouting'
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
    console.warn('[QUEUE-API] Using DEFAULT_ORG_ID fallback')
  } else {
    console.warn('[QUEUE-API] No orgId resolved')
  }
  return fallback
}

/**
 * POST /api/call-routing/queue
 * Cria uma nova fila de ligações e inicia o processamento.
 *
 * Body: { limit?: number, maxConcurrent?: number }
 */
export async function POST(req: NextRequest) {
  try {
    const orgId = await resolveOrgId(req)
    if (!orgId) {
      return NextResponse.json({ error: 'orgId is required' }, { status: 400 })
    }

    const body = await req.json().catch(() => ({}))
    const requestedLimit = body.limit || 50
    const maxConcurrent = body.maxConcurrent || 10

    // Verificar se já existe uma fila rodando para esta org
    const existingQueue = await getCallQueue(undefined, orgId)
    if (existingQueue && existingQueue.status === 'running') {
      return NextResponse.json({
        success: false,
        message: 'Já existe uma fila de ligações em andamento',
        queue: existingQueue,
      }, { status: 409 })
    }

    // Verificar configurações e horário
    const config = await getCallRoutingConfig(orgId)
    const limit = Math.min(requestedLimit, config?.cronLimit || 500)

    if (config?.schedule?.enabled) {
      const now = new Date()
      const hour = parseInt(
        now.toLocaleString('pt-BR', {
          timeZone: config.schedule.timezone || 'America/Sao_Paulo',
          hour: 'numeric',
          hour12: false,
        })
      )
      const dayOfWeek = now.getDay()

      const workDays = config.schedule.workDays || [1, 2, 3, 4, 5]
      const startHour = config.schedule.startHour || 9
      const endHour = config.schedule.endHour || 18

      if (!workDays.includes(dayOfWeek)) {
        return NextResponse.json({
          success: false,
          message: 'Fora do dia de trabalho configurado',
        })
      }

      if (hour < startHour || hour >= endHour) {
        return NextResponse.json({
          success: false,
          message: `Fora do horário de trabalho configurado (${startHour}h - ${endHour}h)`,
        })
      }
    }

    // Criar a fila
    const { queueId, totalItems } = await createCallQueue({
      limit,
      maxConcurrent,
      orgId,
    })

    // Iniciar o processamento (dispara as primeiras N ligações)
    const result = await processQueue(queueId)

    // Buscar a fila atualizada
    const queue = await getCallQueue(queueId)

    return NextResponse.json({
      success: true,
      message: `Fila criada com ${totalItems} ligações. ${result.started} iniciadas.`,
      queue,
      processing: result,
    })
  } catch (error) {
    console.error('[QUEUE-API] Error creating queue:', error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

/**
 * GET /api/call-routing/queue?id=xxx
 * Retorna o status da fila e seus itens.
 */
export async function GET(req: NextRequest) {
  try {
    const orgId = await resolveOrgId(req)
    if (!orgId) {
      return NextResponse.json({ error: 'orgId is required' }, { status: 400 })
    }

    const queueId = req.nextUrl.searchParams.get('id') || undefined

    const queue = await getCallQueue(queueId, orgId)
    if (!queue) {
      return NextResponse.json({
        success: true,
        queue: null,
        items: [],
        message: 'Nenhuma fila encontrada',
      })
    }

    const items = await getQueueItems(queue.id)

    return NextResponse.json({
      success: true,
      queue,
      items,
    })
  } catch (error) {
    console.error('[QUEUE-API] Error getting queue:', error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

/**
 * DELETE /api/call-routing/queue?id=xxx
 * Cancela a fila (itens pendentes são marcados como cancelados).
 */
export async function DELETE(req: NextRequest) {
  try {
    const orgId = await resolveOrgId(req)
    if (!orgId) {
      return NextResponse.json({ error: 'orgId is required' }, { status: 400 })
    }

    const queueId = req.nextUrl.searchParams.get('id')

    if (!queueId) {
      // Cancelar a fila ativa
      const queue = await getCallQueue(undefined, orgId)
      if (!queue || queue.status !== 'running') {
        return NextResponse.json({
          success: false,
          message: 'Nenhuma fila ativa para cancelar',
        })
      }
      await cancelQueue(queue.id)
      return NextResponse.json({ success: true, message: 'Fila cancelada' })
    }

    await cancelQueue(queueId)
    return NextResponse.json({ success: true, message: 'Fila cancelada' })
  } catch (error) {
    console.error('[QUEUE-API] Error cancelling queue:', error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
