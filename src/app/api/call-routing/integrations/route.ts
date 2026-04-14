import { NextRequest, NextResponse } from 'next/server'
import { getCallRoutingConfig, saveCallRoutingConfig } from '@/lib/callRouting'
import { requireOrgId } from '@/lib/orgResolver'
import type { OrgIntegrations } from '@/types/callRouting'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function maskKey(key: string | undefined): string {
  if (!key || key.length < 8) return key ? '••••••••' : ''
  return '••••••••' + key.slice(-5)
}

// GET - Retorna integrations com keys mascaradas
export async function GET(req: NextRequest) {
  try {
    const orgCtx = await requireOrgId(req.headers)
    if (!orgCtx) {
      return NextResponse.json({ error: 'orgId is required' }, { status: 401 })
    }
    const orgId = orgCtx.orgId

    const config = await getCallRoutingConfig(orgId)
    const integrations = config?.integrations || {}

    const masked: OrgIntegrations = {}

    if (integrations.vapi) {
      masked.vapi = {
        ...integrations.vapi,
        apiKey: maskKey(integrations.vapi.apiKey),
      }
    }

    if (integrations.twilio) {
      masked.twilio = {
        ...integrations.twilio,
        accountSid: maskKey(integrations.twilio.accountSid),
        authToken: maskKey(integrations.twilio.authToken),
      }
    }

    if (integrations.elevenLabs) {
      masked.elevenLabs = {
        ...integrations.elevenLabs,
        apiKey: maskKey(integrations.elevenLabs.apiKey),
      }
    }

    if (integrations.google) {
      masked.google = { ...integrations.google }
    }

    return NextResponse.json(masked)
  } catch (error) {
    console.error('[INTEGRATIONS GET] Error:', error)
    return NextResponse.json({ error: 'Failed to get integrations' }, { status: 500 })
  }
}

// PUT - Salvar integrations (recebe keys completas)
export async function PUT(req: NextRequest) {
  try {
    const orgCtx = await requireOrgId(req.headers)
    if (!orgCtx) {
      return NextResponse.json({ error: 'orgId is required' }, { status: 401 })
    }
    const orgId = orgCtx.orgId

    const body = await req.json() as Partial<OrgIntegrations>
    const config = await getCallRoutingConfig(orgId)
    if (!config) {
      return NextResponse.json({ error: 'Config not found' }, { status: 404 })
    }

    const existing = config.integrations || {}

    // Merge: se o valor começa com ••••, manter o existente (usuario nao editou)
    const merged: OrgIntegrations = { ...existing }

    if (body.vapi) {
      merged.vapi = {
        apiKey: body.vapi.apiKey?.startsWith('••••') ? (existing.vapi?.apiKey || '') : (body.vapi.apiKey || ''),
        assistantId: body.vapi.assistantId || existing.vapi?.assistantId || '',
        phoneNumberId: body.vapi.phoneNumberId || existing.vapi?.phoneNumberId || '',
        status: body.vapi.status || existing.vapi?.status || 'untested',
        lastTestedAt: body.vapi.lastTestedAt || existing.vapi?.lastTestedAt,
      }
    }

    if (body.twilio) {
      merged.twilio = {
        accountSid: body.twilio.accountSid?.startsWith('••••') ? (existing.twilio?.accountSid || '') : (body.twilio.accountSid || ''),
        authToken: body.twilio.authToken?.startsWith('••••') ? (existing.twilio?.authToken || '') : (body.twilio.authToken || ''),
        phoneNumber: body.twilio.phoneNumber || existing.twilio?.phoneNumber || '',
        status: body.twilio.status || existing.twilio?.status || 'untested',
      }
    }

    if (body.elevenLabs) {
      merged.elevenLabs = {
        apiKey: body.elevenLabs.apiKey?.startsWith('••••') ? (existing.elevenLabs?.apiKey || '') : (body.elevenLabs.apiKey || ''),
        status: body.elevenLabs.status || existing.elevenLabs?.status || 'untested',
      }
    }

    if (body.google) {
      merged.google = {
        calendarId: body.google.calendarId || existing.google?.calendarId || '',
        status: body.google.status || existing.google?.status || 'untested',
      }
    }

    await saveCallRoutingConfig({ ...config, integrations: merged }, orgId)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[INTEGRATIONS PUT] Error:', error)
    return NextResponse.json({ error: 'Failed to save integrations' }, { status: 500 })
  }
}

// POST - Testar conexão VAPI
export async function POST(req: NextRequest) {
  try {
    const orgCtx = await requireOrgId(req.headers)
    if (!orgCtx) {
      return NextResponse.json({ error: 'orgId is required' }, { status: 401 })
    }
    const orgId = orgCtx.orgId

    const { service } = await req.json() as { service: string }

    if (service === 'vapi') {
      const config = await getCallRoutingConfig(orgId)
      const apiKey = config?.integrations?.vapi?.apiKey || process.env.VAPI_API_KEY

      if (!apiKey) {
        return NextResponse.json({ status: 'error', message: 'Chave VAPI nao configurada' })
      }

      const response = await fetch('https://api.vapi.ai/assistant', {
        headers: { Authorization: `Bearer ${apiKey}` },
      })

      if (response.ok) {
        return NextResponse.json({ status: 'connected', message: 'Conexao com VAPI OK' })
      } else {
        return NextResponse.json({ status: 'error', message: `VAPI retornou status ${response.status}` })
      }
    }

    return NextResponse.json({ status: 'error', message: 'Servico nao suportado' })
  } catch (error) {
    console.error('[INTEGRATIONS TEST] Error:', error)
    return NextResponse.json({ status: 'error', message: 'Falha ao testar conexao' })
  }
}
