/**
 * POST /api/agent/whatsapp/connect
 *
 * Dois modos:
 * 1. Automatico (SaaS): Se ZAPI_CLIENT_TOKEN e de integrador, cria instancia via API
 * 2. Manual: Usuario insere instanceId + token
 */

import { NextResponse } from 'next/server'
import { getQRCodeImage, setWebhookUrl, getConnectionStatus } from '@/lib/channels/zapiConnector'
import { saveWhatsAppConnection, getWhatsAppConnection } from '@/lib/agentConversation'

const ZAPI_BASE_URL = process.env.ZAPI_BASE_URL || 'https://api.z-api.io'
const ZAPI_CLIENT_TOKEN = process.env.ZAPI_CLIENT_TOKEN || ''

/** Tenta criar instancia via API de integrador Z-API */
async function createInstanceViaAPI(orgId: string): Promise<{ instanceId: string; token: string } | null> {
  if (!ZAPI_CLIENT_TOKEN) return null

  try {
    const response = await fetch(`${ZAPI_BASE_URL}/instances`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Client-Token': ZAPI_CLIENT_TOKEN,
      },
      body: JSON.stringify({ name: `voxium-${orgId.slice(0, 8)}` }),
    })

    if (!response.ok) {
      console.warn('[agent-connect] Criacao automatica falhou (pode nao ser conta de integrador):', response.status)
      return null
    }

    const data = await response.json()
    return {
      instanceId: data.id || data.instanceId,
      token: data.token || data.instanceToken,
    }
  } catch (e) {
    console.warn('[agent-connect] Criacao automatica nao disponivel:', e)
    return null
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { orgId, instanceId, instanceToken } = body

    if (!orgId) {
      return NextResponse.json({ error: 'orgId obrigatorio' }, { status: 400 })
    }

    let finalInstanceId = instanceId
    let finalToken = instanceToken

    // Se veio credenciais manuais, usar direto
    if (finalInstanceId && finalToken) {
      // Salvar e continuar
    } else {
      // Verificar se ja tem credenciais salvas
      const existing = await getWhatsAppConnection(orgId)
      if (existing?.instanceId && existing?.instanceToken) {
        finalInstanceId = existing.instanceId
        finalToken = existing.instanceToken
      } else {
        // Tentar criar automaticamente (modo integrador)
        const autoInstance = await createInstanceViaAPI(orgId)
        if (autoInstance) {
          finalInstanceId = autoInstance.instanceId
          finalToken = autoInstance.token
        } else {
          // Sem credenciais e sem integrador — pedir manualmente
          return NextResponse.json({
            status: 'needs_credentials',
            message: 'Insira o ID da instancia e o Token da Z-API',
          })
        }
      }
    }

    // Salvar credenciais
    await saveWhatsAppConnection(orgId, {
      provider: 'zapi',
      instanceId: finalInstanceId,
      instanceToken: finalToken,
      phoneNumber: '',
      status: 'connecting',
      qrCode: '',
      connectedAt: '',
      lastMessageAt: '',
    })

    // Configurar webhook
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || ''
    if (appUrl) {
      try {
        await setWebhookUrl(finalInstanceId, finalToken, `${appUrl}/api/agent/whatsapp/webhook`)
      } catch (e) {
        console.warn('[agent-connect] Webhook config falhou (nao critico):', e)
      }
    }

    // Verificar se ja esta conectado
    const statusCheck = await getConnectionStatus(finalInstanceId, finalToken)
    if (statusCheck.connected) {
      await saveWhatsAppConnection(orgId, { status: 'connected', connectedAt: new Date().toISOString(), qrCode: '' })
      return NextResponse.json({ status: 'connected', instanceId: finalInstanceId })
    }

    // Buscar QR code
    let qrCode = ''
    try {
      qrCode = await getQRCodeImage(finalInstanceId, finalToken)
      await saveWhatsAppConnection(orgId, { status: qrCode ? 'qr_ready' : 'connecting', qrCode: qrCode || '' })
    } catch (e) {
      console.warn('[agent-connect] QR nao disponivel ainda:', e)
    }

    return NextResponse.json({
      status: qrCode ? 'qr_ready' : 'connecting',
      qrCode,
      instanceId: finalInstanceId,
    })
  } catch (error) {
    console.error('[agent-connect] Erro:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao conectar WhatsApp' },
      { status: 500 }
    )
  }
}
