import { NextRequest, NextResponse } from 'next/server'
import {
  getCallRoutingConfig,
  getActiveProspects,
  makeVapiCall,
  getGreeting,
  parseMultiplePhones,
} from '@/lib/callRouting'
import { CallBatchTracker } from '@/types/callRouting'
import { resolveOrgByEmail } from '@/lib/orgResolver'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 600 // 10 minutos para processar o batch (batches grandes + backoff adaptativo)

// Tracker em memória (para este request)
let batchTracker: CallBatchTracker | null = null

// Controle de cancelamento
let cancelledBatchId: string | null = null

// POST - Disparar lote de ligações (streaming NDJSON)
// Dispara 1 ligação a cada intervalMs com backoff adaptativo em caso de rate limit.
// Quando atinge maxConcurrent simultâneas, espera uma acabar antes de continuar.
export async function POST(req: NextRequest) {
  // Verificar autenticação — somente usuários autenticados podem disparar ligações
  const userEmail = req.headers.get('x-user-email')
  if (!userEmail) {
    return NextResponse.json({ error: 'Authentication required. Send x-user-email header.' }, { status: 401 })
  }

  // Multi-tenant: resolver orgId via email
  const orgContext = await resolveOrgByEmail(userEmail)
  const orgId = orgContext?.orgId || process.env.DEFAULT_ORG_ID || ''
  if (!orgId) {
    console.warn('[TRIGGER-CALLS] No orgId resolved for email:', userEmail)
    return NextResponse.json({ error: 'Could not resolve organization for user' }, { status: 400 })
  }
  if (!orgContext) {
    console.warn('[TRIGGER-CALLS] Using DEFAULT_ORG_ID fallback for email:', userEmail)
  }

  try {
    const body = await req.json().catch(() => ({}))
    const requestedLimit = body.limit || 5
    const baseIntervalMs = body.intervalMs || 5000
    const maxConcurrent = body.maxConcurrent || 5

    console.log(`[TRIGGER-CALLS] Batch start: limit=${requestedLimit} interval=${baseIntervalMs}ms concurrent=${maxConcurrent} orgId=${orgId}`)

    // Buscar configurações
    const config = await getCallRoutingConfig(orgId)
    // No trigger manual, usar o limite que o usuario pediu (cap de seguranca: 500)
    // cronLimit se aplica apenas ao cron automatico
    const limit = Math.min(requestedLimit, 500)

    // Verificar se está dentro do horário permitido
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
          currentDay: dayOfWeek,
          allowedDays: workDays,
        })
      }

      if (hour < startHour || hour >= endHour) {
        return NextResponse.json({
          success: false,
          message: 'Fora do horário de trabalho configurado',
          currentHour: hour,
          allowedHours: `${startHour}h - ${endHour}h`,
        })
      }
    }

    // Buscar prospects ativos (filtrados por org)
    const { clients } = await getActiveProspects(limit * 2, orgId)

    if (clients.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'Nenhum prospect em Prospecção Ativa',
        calls: [],
      })
    }

    // Filtrar apenas quem tem pelo menos um telefone válido
    const clientsToCall = clients
      .filter(c => {
        if (!c.phone) return false
        const validPhones = parseMultiplePhones(c.phone)
        return validPhones.length > 0
      })
      .slice(0, limit)

    // Inicializar tracker
    const today = new Date().toISOString().split('T')[0]
    batchTracker = {
      date: today,
      batchId: Date.now().toString(),
      started: 0,
      pendingCallIds: [],
      results: {
        atendeu: 0,
        naoAtendeu: 0,
        outcomes: {},
      },
      prospects: [],
    }

    const currentBatchId = batchTracker.batchId

    const greeting = getGreeting()
    const encoder = new TextEncoder()

    const stream = new ReadableStream({
      async start(controller) {
        const send = (data: Record<string, unknown>) => {
          try {
            controller.enqueue(encoder.encode(JSON.stringify(data) + '\n'))
          } catch {
            // Stream already closed
          }
        }

        // Track active calls
        let activeCalls = 0

        // Backoff adaptativo: quando 429 ocorre, aumenta o intervalo e reduz concorrência
        let currentIntervalMs = baseIntervalMs
        let currentMaxConcurrent = maxConcurrent
        let consecutive429 = 0

        // Evento inicial com lista de prospects
        send({
          type: 'start',
          greeting,
          total: clientsToCall.length,
          prospects: clientsToCall.map(c => ({
            id: c.id,
            name: c.name,
            phone: c.phone,
            company: c.company || '',
          })),
        })

        let queued = 0
        let errors = 0

        // Disparar ligações com intervalo e controle de concorrência
        for (let i = 0; i < clientsToCall.length; i++) {
          // Check if cancelled
          if (cancelledBatchId === currentBatchId) {
            send({ type: 'cancelled', index: i, remaining: clientsToCall.length - i })
            break
          }

          const prospect = clientsToCall[i]

          // Se atingiu o máximo de simultâneas, esperar até liberar uma vaga
          while (activeCalls >= currentMaxConcurrent) {
            if (cancelledBatchId === currentBatchId) break
            send({ type: 'waiting', index: i, activeCalls, maxConcurrent: currentMaxConcurrent, prospect: prospect.name })
            await new Promise(resolve => setTimeout(resolve, 5000))
            // Decrementar ligações que provavelmente já acabaram (estimativa conservadora)
            // Cada ligação VAPI dura em média 30-60s, então a cada 5s checamos
            activeCalls = Math.max(0, activeCalls - 1)
          }

          if (cancelledBatchId === currentBatchId) {
            send({ type: 'cancelled', index: i, remaining: clientsToCall.length - i })
            break
          }

          // Evento: ligando para este prospect
          send({
            type: 'calling',
            index: i,
            prospect: prospect.name,
            activeCalls,
          })

          try {
            const call = await makeVapiCall({
              id: prospect.id,
              name: prospect.name,
              phone: prospect.phone,
              company: prospect.company,
              industry: prospect.industry,
              partners: prospect.partners,
            }, orgId)

            activeCalls++

            // Chamada OK - recuperar gradualmente o ritmo
            if (consecutive429 > 0) {
              consecutive429 = 0
              // Recuperar devagar: voltar ao intervalo base ao longo das próximas chamadas
              currentIntervalMs = Math.max(baseIntervalMs, currentIntervalMs * 0.8)
              currentMaxConcurrent = Math.min(maxConcurrent, currentMaxConcurrent + 1)
            }

            // Registrar no tracker
            if (batchTracker) {
              batchTracker.started++
              batchTracker.pendingCallIds.push(call.id)
              batchTracker.prospects.push({
                callId: call.id,
                name: prospect.name,
                status: 'pendente',
              })
            }

            queued++

            // Evento: ligação disparada
            send({
              type: 'result',
              index: i,
              clientId: prospect.id,
              prospect: prospect.name,
              phone: prospect.phone,
              callId: call.id,
              status: 'queued',
              activeCalls,
            })

          } catch (error) {
            const errorStr = String(error)
            const is429 = errorStr.includes('429')

            console.error(`[TRIGGER-CALLS] Error calling ${prospect.name}:`, error)
            errors++

            // Backoff adaptativo: se é 429, aumentar intervalo e reduzir concorrência
            if (is429) {
              consecutive429++
              // Dobrar intervalo a cada 429 consecutivo (cap: 60s)
              currentIntervalMs = Math.min(60000, currentIntervalMs * 2)
              // Reduzir concorrência (mínimo 1)
              currentMaxConcurrent = Math.max(1, currentMaxConcurrent - 1)

              const cooldownMs = Math.min(30000, consecutive429 * 10000) // 10s, 20s, 30s
              send({
                type: 'rate_limit',
                index: i,
                cooldownMs,
                newInterval: currentIntervalMs,
                newMaxConcurrent: currentMaxConcurrent,
                message: `Rate limit atingido. Aguardando ${Math.round(cooldownMs / 1000)}s antes de continuar...`,
              })

              // Cooldown extra antes de tentar a próxima
              await new Promise(resolve => setTimeout(resolve, cooldownMs))
            }

            // Evento: erro na ligação
            send({
              type: 'result',
              index: i,
              clientId: prospect.id,
              prospect: prospect.name,
              phone: prospect.phone,
              status: 'error',
              error: errorStr,
              activeCalls,
            })
          }

          // Aguardar intervalo antes da próxima (exceto na última)
          if (i < clientsToCall.length - 1) {
            await new Promise(resolve => setTimeout(resolve, currentIntervalMs))
          }
        }

        // Evento final
        send({
          type: 'done',
          total: clientsToCall.length,
          queued,
          errors,
          batchId: batchTracker?.batchId,
        })

        controller.close()
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'application/x-ndjson',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    })
  } catch (error) {
    console.error('[TRIGGER-CALLS] Error:', error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

// GET - Status do batch atual
export async function GET() {
  try {
    if (!batchTracker) {
      return NextResponse.json({
        success: true,
        message: 'Nenhum batch em andamento',
        tracker: null,
      })
    }

    return NextResponse.json({
      success: true,
      tracker: batchTracker,
    })
  } catch (error) {
    console.error('[TRIGGER-CALLS] GET error:', error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

// DELETE - Cancelar batch em andamento
export async function DELETE() {
  if (batchTracker) {
    cancelledBatchId = batchTracker.batchId
    return NextResponse.json({ success: true, message: 'Batch cancelado' })
  }
  return NextResponse.json({ success: false, message: 'Nenhum batch em andamento' })
}
