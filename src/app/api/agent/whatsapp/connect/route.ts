/**
 * POST /api/agent/whatsapp/connect
 *
 * Cria instancia Z-API para a org e retorna QR code para conexao.
 */

import { NextResponse } from 'next/server'
import { createInstance, getQRCodeImage, setWebhookUrl } from '@/lib/channels/zapiConnector'
import { saveWhatsAppConnection, getWhatsAppConnection } from '@/lib/agentConversation'

export async function POST(request: Request) {
  try {
    const { orgId } = await request.json()
    if (!orgId) {
      return NextResponse.json({ error: 'orgId obrigatorio' }, { status: 400 })
    }

    // Verificar se ja tem conexao
    const existing = await getWhatsAppConnection(orgId)
    if (existing?.instanceId && existing?.instanceToken) {
      // Ja tem instancia, buscar QR code
      try {
        const qrCode = await getQRCodeImage(existing.instanceId, existing.instanceToken)
        await saveWhatsAppConnection(orgId, {
          status: qrCode ? 'qr_ready' : 'connecting',
          qrCode: qrCode || '',
        })
        return NextResponse.json({
          status: 'qr_ready',
          qrCode,
          instanceId: existing.instanceId,
        })
      } catch {
        // Instancia pode estar invalida, criar nova
      }
    }

    // Criar nova instancia
    const instance = await createInstance(orgId)

    // Configurar webhook para apontar para nossa API
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || ''
    if (appUrl) {
      await setWebhookUrl(instance.instanceId, instance.token, `${appUrl}/api/agent/whatsapp/webhook`)
    }

    // Salvar conexao
    await saveWhatsAppConnection(orgId, {
      provider: 'zapi',
      instanceId: instance.instanceId,
      instanceToken: instance.token,
      phoneNumber: '',
      status: 'connecting',
      qrCode: '',
      connectedAt: '',
      lastMessageAt: '',
    })

    // Buscar QR code (pode levar um momento)
    let qrCode = ''
    try {
      // Aguardar breve momento para Z-API preparar o QR
      await new Promise(resolve => setTimeout(resolve, 2000))
      qrCode = await getQRCodeImage(instance.instanceId, instance.token)

      await saveWhatsAppConnection(orgId, {
        status: qrCode ? 'qr_ready' : 'connecting',
        qrCode: qrCode || '',
      })
    } catch {
      // QR pode nao estar pronto ainda, o frontend vai fazer polling
    }

    return NextResponse.json({
      status: qrCode ? 'qr_ready' : 'connecting',
      qrCode,
      instanceId: instance.instanceId,
    })
  } catch (error) {
    console.error('[agent-connect] Erro:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao conectar WhatsApp' },
      { status: 500 }
    )
  }
}
