import { NextRequest, NextResponse } from 'next/server'
import { makeVapiCall } from '@/lib/callRouting'
import { getAdminDb } from '@/lib/firebaseAdmin'
import { requireOrgId } from '@/lib/orgResolver'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST - Disparar ligação para um contato específico
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { clientId, name, phone, company, industry, partners } = body

    // Resolve orgId: body > headers > email lookup
    let orgId = body.orgId || null
    if (!orgId) {
      const orgCtx = await requireOrgId(req.headers)
      if (!orgCtx) {
        return NextResponse.json({ error: 'orgId is required' }, { status: 401 })
      }
      orgId = orgCtx.orgId
    }

    if (!clientId || !name || !phone) {
      return NextResponse.json(
        { error: 'clientId, name e phone são obrigatórios' },
        { status: 400 }
      )
    }

    // Validate client belongs to this org
    const db = getAdminDb()
    const clientDoc = await db.collection('clients').doc(clientId).get()
    if (!clientDoc.exists) {
      return NextResponse.json({ error: 'Cliente não encontrado' }, { status: 404 })
    }
    const clientData = clientDoc.data()
    if (!clientData?.orgId || clientData.orgId !== orgId) {
      return NextResponse.json({ error: 'Cliente não pertence a esta organização' }, { status: 403 })
    }

    console.log(`[CALL-CONTACT] Iniciando ligação para ${name} (${clientId}) orgId=${orgId}`)

    const call = await makeVapiCall({
      id: clientId,
      name,
      phone,
      company,
      industry,
      partners,
    }, orgId)

    console.log(`[CALL-CONTACT] Ligação iniciada: ${call.id}`)

    return NextResponse.json({
      success: true,
      callId: call.id,
      status: call.status,
      message: `Ligação iniciada para ${name}`,
    })
  } catch (error) {
    console.error('[CALL-CONTACT] Error:', error)
    return NextResponse.json(
      { error: String(error) },
      { status: 500 }
    )
  }
}
