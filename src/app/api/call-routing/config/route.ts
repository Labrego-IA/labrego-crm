import { NextRequest, NextResponse } from 'next/server'
import { getCallRoutingConfig, saveCallRoutingConfig } from '@/lib/callRouting'
import { CallRoutingConfig, DEFAULT_AGENT_KNOWLEDGE } from '@/types/callRouting'
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
    console.warn('[CALL-ROUTING CONFIG] Using DEFAULT_ORG_ID fallback')
  } else {
    console.warn('[CALL-ROUTING CONFIG] No orgId resolved')
  }
  return fallback
}

// GET - Buscar configurações
export async function GET(req: NextRequest) {
  try {
    const orgId = await resolveOrgId(req)
    if (!orgId) {
      return NextResponse.json({ error: 'orgId is required' }, { status: 400 })
    }

    const config = await getCallRoutingConfig(orgId)

    if (!config) {
      // Retornar configuração padrão
      const defaultConfig: CallRoutingConfig = {
        schedule: {
          enabled: true,
          startHour: 9,
          endHour: 18,
          timezone: 'America/Sao_Paulo',
          workDays: [1, 2, 3, 4, 5],
          slotDuration: 30,
          callInterval: 30,
        },
        voiceAgent: {
          vapiAssistantId: process.env.VAPI_ASSISTANT_ID || '',
          vapiPhoneNumberId: process.env.VAPI_PHONE_NUMBER_ID || '',
          llmModel: 'gpt-4o',
          sttProvider: 'deepgram',
        },
        agentKnowledge: { ...DEFAULT_AGENT_KNOWLEDGE },
        calendar: {
          googleCalendarId: process.env.GOOGLE_CALENDAR_ID || 'primary',
          bufferDays: 1,
          maxSlotsToShow: 3,
        },
        notifications: {
          whatsappReportEnabled: true,
          whatsappNumber: process.env.REPORT_WHATSAPP_NUMBER || '',
          emailReportEnabled: false,
        },
        cronEnabled: true,
        cronSchedule: '0 9 * * 1-5',
        cronLimit: 500,
      }

      return NextResponse.json({
        success: true,
        config: defaultConfig,
        isDefault: true,
      })
    }

    return NextResponse.json({
      success: true,
      config,
      isDefault: false,
    })
  } catch (error) {
    console.error('[CALL-ROUTING CONFIG] GET error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// PUT - Atualizar configurações
export async function PUT(req: NextRequest) {
  try {
    const orgId = await resolveOrgId(req)
    if (!orgId) {
      return NextResponse.json({ error: 'orgId is required' }, { status: 400 })
    }

    const body = await req.json()

    // Validar campos obrigatórios
    if (!body.schedule || !body.voiceAgent || !body.calendar || !body.notifications) {
      return NextResponse.json(
        { error: 'Campos obrigatórios faltando: schedule, voiceAgent, calendar, notifications' },
        { status: 400 }
      )
    }

    await saveCallRoutingConfig(body as Partial<CallRoutingConfig>, orgId)

    return NextResponse.json({
      success: true,
      message: 'Configurações salvas com sucesso',
    })
  } catch (error) {
    console.error('[CALL-ROUTING CONFIG] PUT error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// POST - Criar configurações iniciais
export async function POST(req: NextRequest) {
  try {
    const orgId = await resolveOrgId(req)
    if (!orgId) {
      return NextResponse.json({ error: 'orgId is required' }, { status: 400 })
    }

    const body = await req.json()

    const existingConfig = await getCallRoutingConfig(orgId)
    if (existingConfig) {
      return NextResponse.json(
        { error: 'Configurações já existem. Use PUT para atualizar.' },
        { status: 409 }
      )
    }

    await saveCallRoutingConfig(body as Partial<CallRoutingConfig>, orgId)

    return NextResponse.json({
      success: true,
      message: 'Configurações criadas com sucesso',
    })
  } catch (error) {
    console.error('[CALL-ROUTING CONFIG] POST error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
