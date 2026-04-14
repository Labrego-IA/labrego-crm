/**
 * GET /api/agent/whatsapp/status?orgId=xxx
 *
 * Retorna status da conexao WhatsApp da org via Z-API.
 */

import { NextResponse } from 'next/server'
import { getConnectionStatus, getQRCodeImage } from '@/lib/channels/zapiConnector'
import { getWhatsAppConnection, saveWhatsAppConnection } from '@/lib/agentConversation'
import type { WhatsAppConnectionStatus } from '@/types/agentConfig'
import { requireOrgId } from '@/lib/orgResolver'
import { checkRateLimit, getClientIp } from '@/lib/rateLimit'

export async function GET(request: Request) {
  const ip = getClientIp(new Headers(request.headers))
  const rl = checkRateLimit(`whatsapp-status:${ip}`, { limit: 30, windowSeconds: 60 })
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

  try {
    const orgCtx = await requireOrgId(new Headers(request.headers))
    if (!orgCtx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const orgId = orgCtx.orgId

    const conn = await getWhatsAppConnection(orgId)
    if (!conn?.instanceId || !conn?.instanceToken) {
      return NextResponse.json({
        status: 'disconnected' as WhatsAppConnectionStatus,
        needsCredentials: true,
        phoneNumber: '',
        qrCode: '',
      })
    }

    const { instanceId, instanceToken } = conn as { instanceId: string; instanceToken: string }

    // Buscar status real no Z-API
    const zapiStatus = await getConnectionStatus(instanceId, instanceToken)

    let status: WhatsAppConnectionStatus = 'disconnected'
    let qrCode = conn.qrCode || ''

    if (zapiStatus.connected) {
      status = 'connected'
      qrCode = ''
      if (conn.status !== 'connected') {
        await saveWhatsAppConnection(orgId, {
          status: 'connected',
          connectedAt: new Date().toISOString(),
          qrCode: '',
        })
      }
    } else if (zapiStatus.error && !zapiStatus.error.includes('Z-API error')) {
      status = 'error'
      await saveWhatsAppConnection(orgId, { status: 'error', errorMessage: zapiStatus.error })
    } else {
      // Nao conectado — buscar QR code
      status = 'qr_ready'
      try {
        qrCode = await getQRCodeImage(instanceId, instanceToken)
        if (qrCode) {
          await saveWhatsAppConnection(orgId, { status: 'qr_ready', qrCode })
        }
      } catch {
        status = 'connecting'
      }
    }

    return NextResponse.json({
      status,
      phoneNumber: conn.phoneNumber || '',
      qrCode,
      connected: zapiStatus.connected,
    })
  } catch (error) {
    console.error('[agent-status] Erro:', error)
    return NextResponse.json({ error: 'Erro ao verificar status' }, { status: 500 })
  }
}
