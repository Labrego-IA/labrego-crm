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

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const orgId = searchParams.get('orgId')
    if (!orgId) {
      return NextResponse.json({ error: 'orgId obrigatorio' }, { status: 400 })
    }

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
  try {
    const body = await request.json()
    const { orgId, ...configData } = body

    if (!orgId) {
      return NextResponse.json({ error: 'orgId obrigatorio' }, { status: 400 })
    }

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
