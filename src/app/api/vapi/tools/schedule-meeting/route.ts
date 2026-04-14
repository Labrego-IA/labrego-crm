import { NextRequest, NextResponse } from 'next/server'
import { createCalendarMeeting, formatSlotForSpeech } from '@/lib/callRouting'
import { getAdminDb } from '@/lib/firebaseAdmin'
import { VapiToolResponse } from '@/types/callRouting'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Resolve orgId from VAPI call metadata or client doc */
async function resolveOrgIdFromContext(body: Record<string, unknown>): Promise<string | undefined> {
  const call = (body.message as Record<string, unknown>)?.call as Record<string, unknown>
  const metadata = call?.metadata || (call?.assistantOverrides as Record<string, unknown>)?.metadata || {}
  const orgId = (metadata as Record<string, unknown>).orgId as string | undefined
  if (orgId) return orgId

  const clientId = (metadata as Record<string, unknown>).clientId as string | undefined
  if (clientId) {
    try {
      const db = getAdminDb()
      const clientDoc = await db.collection('clients').doc(clientId).get()
      if (clientDoc.exists) {
        const clientOrgId = clientDoc.data()?.orgId
        if (clientOrgId) return clientOrgId
      }
    } catch (error) {
      console.error('[SCHEDULE-MEETING] Error resolving orgId from client:', error)
    }
  }

  console.warn('[SCHEDULE-MEETING] No orgId resolved from call data')
  return undefined
}

// POST - Endpoint do Vapi para agendar reunião
export async function POST(req: NextRequest): Promise<NextResponse<VapiToolResponse>> {
  console.log('[SCHEDULE-MEETING] Request received')

  try {
    const body = await req.json()
    const toolCall = body.message?.toolCallList?.[0]
    const args = toolCall?.function?.arguments || {}
    const toolCallId = toolCall?.id

    // Multi-tenant: resolve orgId from call context
    const orgId = await resolveOrgIdFromContext(body)

    // Pegar metadata da chamada (fallback para dados do prospect)
    const callMetadata = body.message?.call?.assistantOverrides?.metadata || {}
    const customerPhone = body.message?.call?.customer?.number

    console.log('[SCHEDULE-MEETING] Tool Call ID:', toolCallId)
    console.log('[SCHEDULE-MEETING] Arguments:', JSON.stringify(args))
    console.log('[SCHEDULE-MEETING] Call Metadata:', JSON.stringify(callMetadata))

    // Usar args da tool, com fallback para metadata da chamada
    const startTime = args.startTime as string
    const prospectEmail = args.prospectEmail as string | undefined
    const prospectName = (args.prospectName as string) || callMetadata.prospectName || 'Prospect'
    const prospectCompany = (args.prospectCompany as string) || callMetadata.prospectCompany || 'Empresa'
    const prospectPhone = (args.prospectPhone as string) || customerPhone

    console.log('[SCHEDULE-MEETING] Extracted data:')
    console.log('  - startTime:', startTime)
    console.log('  - prospectName:', prospectName)
    console.log('  - prospectCompany:', prospectCompany)
    console.log('  - prospectPhone:', prospectPhone)
    console.log('  - prospectEmail:', prospectEmail)

    if (!startTime) {
      console.log('[SCHEDULE-MEETING] No startTime provided')
      return NextResponse.json({
        results: [
          {
            toolCallId: toolCallId || '',
            result: 'Preciso do horário para agendar. Qual horário você prefere?',
          },
        ],
      })
    }

    console.log('[SCHEDULE-MEETING] Creating calendar event...')
    const event = await createCalendarMeeting(
      startTime,
      prospectName,
      prospectCompany,
      prospectPhone,
      prospectEmail,
      orgId
    )

    console.log('[SCHEDULE-MEETING] Event created:', event.id)

    const meetingDate = new Date(startTime)
    const formatted = formatSlotForSpeech(meetingDate)
    const confirmationMsg = prospectEmail
      ? `Você vai receber o convite no seu email ${prospectEmail}.`
      : `Vou enviar uma confirmação por WhatsApp.`

    const responseText = `Reunião agendada com sucesso para ${formatted}. ${confirmationMsg}`

    console.log('[SCHEDULE-MEETING] Response:', responseText)

    return NextResponse.json({
      results: [
        {
          toolCallId: toolCallId || '',
          result: responseText,
        },
      ],
    })
  } catch (error) {
    console.error('[SCHEDULE-MEETING] Error:', error)

    let toolCallId = ''
    try {
      const body = await req.json()
      toolCallId = body.message?.toolCallList?.[0]?.id || ''
    } catch {
      // ignore
    }

    return NextResponse.json({
      results: [
        {
          toolCallId,
          result: 'Houve um problema ao agendar. Vou confirmar o horário por WhatsApp, ok?',
        },
      ],
    })
  }
}
