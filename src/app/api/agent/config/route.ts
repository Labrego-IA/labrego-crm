/**
 * GET/POST /api/agent/config?orgId=xxx
 *
 * GET: Retorna configuracao do agente para a org
 * POST: Salva configuracao do agente
 */

import { NextResponse } from 'next/server'
import { getAgentConfig, saveAgentConfig } from '@/lib/agentConversation'
import { assembleTextAgentPrompt, calculateTextAgentStrength } from '@/lib/agentEngine'
import { DEFAULT_AGENT_CONFIG } from '@/types/agentConfig'
import { requireOrgId } from '@/lib/orgResolver'
import { checkRateLimit, getClientIp } from '@/lib/rateLimit'

export async function GET(request: Request) {
  const ip = getClientIp(new Headers(request.headers))
  const rl = checkRateLimit(`agent-config:${ip}`, { limit: 20, windowSeconds: 60 })
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

  try {
    const orgCtx = await requireOrgId(new Headers(request.headers))
    if (!orgCtx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const orgId = orgCtx.orgId

    const config = await getAgentConfig(orgId)
    if (!config) {
      // Retorna config padrao
      return NextResponse.json({
        ...DEFAULT_AGENT_CONFIG,
        orgId,
      })
    }

    return NextResponse.json(config)
  } catch (error) {
    console.error('[agent-config] GET erro:', error)
    return NextResponse.json({ error: 'Erro ao carregar config' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const ip = getClientIp(new Headers(request.headers))
  const rl = checkRateLimit(`agent-config:${ip}`, { limit: 20, windowSeconds: 60 })
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

  try {
    const orgCtx = await requireOrgId(new Headers(request.headers))
    if (!orgCtx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const orgId = orgCtx.orgId

    const body = await request.json()
    const { orgId: _bodyOrgId, ...configData } = body

    // Recalcular strength score e system prompt para WhatsApp
    if (configData.whatsapp?.wizardAnswers) {
      const strength = calculateTextAgentStrength(configData.whatsapp.wizardAnswers)
      configData.whatsapp.strengthScore = strength
      configData.whatsapp.systemPrompt = assembleTextAgentPrompt(
        configData.whatsapp.wizardAnswers,
        configData.faq || [],
        configData.tools
      )
    }

    // Recalcular para Email
    if (configData.email?.wizardAnswers) {
      const strength = calculateTextAgentStrength(configData.email.wizardAnswers)
      configData.email.strengthScore = strength
      configData.email.systemPrompt = assembleTextAgentPrompt(
        configData.email.wizardAnswers,
        configData.faq || [],
        configData.tools
      )
    }

    await saveAgentConfig(orgId, configData)

    return NextResponse.json({ status: 'saved', orgId })
  } catch (error) {
    console.error('[agent-config] POST erro:', error)
    return NextResponse.json({ error: 'Erro ao salvar config' }, { status: 500 })
  }
}
