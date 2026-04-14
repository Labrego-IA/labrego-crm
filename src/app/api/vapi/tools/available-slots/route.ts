import { NextRequest, NextResponse } from 'next/server'
import { getAvailableSlots } from '@/lib/callRouting'
import { getAdminDb } from '@/lib/firebaseAdmin'
import { VapiToolResponse } from '@/types/callRouting'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Resolve orgId from VAPI call metadata or client doc */
async function resolveOrgIdFromContext(body: Record<string, unknown>): Promise<string | undefined> {
  const callMetadata = (body.message as Record<string, unknown>)?.call as Record<string, unknown>
  const metadata = callMetadata?.metadata || (callMetadata?.assistantOverrides as Record<string, unknown>)?.metadata || {}
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
      console.error('[AVAILABLE-SLOTS] Error resolving orgId from client:', error)
    }
  }

  console.warn('[AVAILABLE-SLOTS] No orgId resolved from call data')
  return undefined
}

// POST - Endpoint do Vapi para buscar horários disponíveis
export async function POST(req: NextRequest): Promise<NextResponse<VapiToolResponse>> {
  console.log('[AVAILABLE-SLOTS] Request received')

  try {
    const body = await req.json()
    const toolCallId = body.message?.toolCallList?.[0]?.id

    console.log('[AVAILABLE-SLOTS] Tool Call ID:', toolCallId)

    // Multi-tenant: resolve orgId from call context
    const orgId = await resolveOrgIdFromContext(body)

    const slots = await getAvailableSlots(7, orgId)
    const nextSlots = slots.slice(0, 3)

    console.log('[AVAILABLE-SLOTS] Found', slots.length, 'total slots')
    console.log('[AVAILABLE-SLOTS] Returning top 3:', nextSlots.map(s => s.formatted))

    const responseText =
      nextSlots.length > 0
        ? `Tenho três opções: ${nextSlots.map((s, i) => `${i + 1}, ${s.formatted}`).join('. ')}. Qual funciona melhor pra você?`
        : 'No momento não tenho horários disponíveis. Posso te retornar quando tiver uma vaga?'

    return NextResponse.json({
      results: [
        {
          toolCallId: toolCallId || '',
          result: responseText,
        },
      ],
    })
  } catch (error) {
    console.error('[AVAILABLE-SLOTS] Error:', error)

    const body = await req.json().catch(() => ({}))
    const toolCallId = body.message?.toolCallList?.[0]?.id

    return NextResponse.json({
      results: [
        {
          toolCallId: toolCallId || '',
          result:
            'Desculpe, não consegui acessar a agenda no momento. Podemos confirmar o horário por WhatsApp?',
        },
      ],
    })
  }
}

// GET - Endpoint para testar horários disponíveis
export async function GET(req: NextRequest) {
  try {
    const orgId = req.nextUrl.searchParams.get('orgId') || undefined
    const slots = await getAvailableSlots(7, orgId)
    return NextResponse.json({
      total: slots.length,
      slots: slots.slice(0, 20),
    })
  } catch (error) {
    console.error('[AVAILABLE-SLOTS] GET Error:', error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
