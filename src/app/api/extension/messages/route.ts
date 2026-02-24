import { NextRequest, NextResponse } from 'next/server'
import { getAdminDb } from '@/lib/firebaseAdmin'
import { verifyExtensionAuth } from '@/lib/extensionAuth'
import { resolveOrgByEmail } from '@/lib/orgResolver'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Message = {
  text: string
  sender: string
  timestamp: string // Data/hora formatada para exibição (ex: "15/01/2025 14:30")
  timestampMs?: number // Timestamp em milissegundos para ordenação
  isOutgoing?: boolean
}

type SaveMessagesPayload = {
  opportunityId?: string
  contactId?: string
  messages: Message[]
  saveToOpportunity?: boolean
}

// Salvar mensagens
export async function POST(req: NextRequest) {
  const user = await verifyExtensionAuth(req)
  if (!user) {
    return NextResponse.json({ success: false, error: 'Não autorizado' }, { status: 401 })
  }

  const orgContext = await resolveOrgByEmail(user.email || '')
  if (!orgContext) {
    return NextResponse.json({ success: false, error: 'Organização não encontrada' }, { status: 403 })
  }
  const { orgId } = orgContext

  try {
    const body = (await req.json()) as SaveMessagesPayload

    const { opportunityId, contactId, messages } = body

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Mensagens são obrigatórias' },
        { status: 400 }
      )
    }

    const targetId = opportunityId || contactId
    if (!targetId) {
      return NextResponse.json(
        { success: false, error: 'ID do contato ou oportunidade é obrigatório' },
        { status: 400 }
      )
    }

    const db = getAdminDb()
    const nowIso = new Date().toISOString()
    const userEmail = user.email || 'extension-user'

    // Determinar a coleção alvo
    // Se saveToOpportunity é true, salvar na subcoleção do cliente
    // O opportunityId na verdade é o clientId no modelo atual
    const clientRef = db.collection('clients').doc(targetId)

    // Verificar se o cliente existe e pertence à org do usuário
    const clientDoc = await clientRef.get()
    if (!clientDoc.exists) {
      return NextResponse.json(
        { success: false, error: 'Contato não encontrado' },
        { status: 404 }
      )
    }

    const clientData = clientDoc.data()
    if (clientData?.orgId !== orgId) {
      return NextResponse.json(
        { success: false, error: 'Contato não pertence à sua organização' },
        { status: 403 }
      )
    }

    // Ordenar mensagens por timestamp (mais antigas primeiro)
    const sortedMessages = [...messages].sort((a, b) => {
      const tsA = a.timestampMs || 0
      const tsB = b.timestampMs || 0
      return tsA - tsB
    })

    // Salvar mensagens como followups
    const batch = db.batch()
    const savedMessages: any[] = []

    for (const msg of sortedMessages) {
      const followupRef = clientRef.collection('followups').doc()

      // Determinar o timestamp ISO para armazenar
      let messageTimestamp = nowIso
      if (msg.timestampMs) {
        // Se temos timestamp em milissegundos, converter para ISO
        messageTimestamp = new Date(msg.timestampMs).toISOString()
      } else if (msg.timestamp) {
        // Tentar parsear a data formatada (DD/MM/YYYY HH:MM)
        const match = msg.timestamp.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})/)
        if (match) {
          const [, day, month, year, hours, minutes] = match
          const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day), parseInt(hours), parseInt(minutes))
          messageTimestamp = date.toISOString()
        }
      }

      const followupData = {
        text: `[WhatsApp] ${msg.sender}: ${msg.text}`,
        message: msg.text,
        sender: msg.sender,
        timestamp: messageTimestamp,
        displayTime: msg.timestamp || '', // Data/hora formatada original
        isOutgoing: msg.isOutgoing || false,
        author: userEmail,
        source: 'whatsapp-extension',
        createdAt: messageTimestamp, // Usar timestamp da mensagem como createdAt
      }

      batch.set(followupRef, followupData)
      savedMessages.push({
        id: followupRef.id,
        ...followupData,
      })
    }

    // Atualizar lastFollowUpAt do cliente
    batch.update(clientRef, {
      lastFollowUpAt: nowIso,
      updatedAt: nowIso,
    })

    await batch.commit()

    return NextResponse.json({
      success: true,
      savedCount: savedMessages.length,
      messages: savedMessages,
    })
  } catch (err) {
    console.error('[Extension Messages] Save error:', err)
    return NextResponse.json(
      { success: false, error: 'Erro ao salvar mensagens' },
      { status: 500 }
    )
  }
}
