/**
 * POST /api/agent/whatsapp/disconnect
 *
 * Desconecta a sessao WhatsApp da org.
 */

import { NextResponse } from 'next/server'
import { disconnect } from '@/lib/channels/zapiConnector'
import { getWhatsAppConnection, saveWhatsAppConnection } from '@/lib/agentConversation'

export async function POST(request: Request) {
  try {
    const { orgId } = await request.json()
    if (!orgId) {
      return NextResponse.json({ error: 'orgId obrigatorio' }, { status: 400 })
    }

    const conn = await getWhatsAppConnection(orgId)
    if (!conn?.instanceId || !conn?.instanceToken) {
      return NextResponse.json({ status: 'already_disconnected' })
    }

    const { instanceId, instanceToken } = conn as { instanceId: string; instanceToken: string }

    // Desconectar no Z-API
    await disconnect(instanceId, instanceToken)

    // Atualizar Firestore
    await saveWhatsAppConnection(orgId, {
      status: 'disconnected',
      qrCode: '',
      phoneNumber: '',
    })

    return NextResponse.json({ status: 'disconnected' })
  } catch (error) {
    console.error('[agent-disconnect] Erro:', error)
    return NextResponse.json(
      { error: 'Erro ao desconectar' },
      { status: 500 }
    )
  }
}
