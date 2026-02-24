import { NextRequest, NextResponse } from 'next/server'
import { getAdminDb } from '@/lib/firebaseAdmin'
import { sendServerNotification } from '@/lib/serverNotifications'
import { getOrgIdFromHeaders } from '@/lib/orgResolver'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const FORM_SECRET = process.env.FORM_SECRET
const N8N_WEBHOOK = process.env.N8N_WEBHOOK_LEAD_CREATED

type ClientPayload = {
  name: string
  phone: string
  company?: string
  email?: string
}

function clean(value: unknown) {
  if (typeof value !== 'string') return ''
  return value.trim()
}

export async function POST(req: NextRequest) {
  try {
    if (FORM_SECRET) {
      const header =
        req.headers.get('x-form-secret') ?? req.headers.get('authorization')
      const token = header?.startsWith('Bearer ')
        ? header.slice(7)
        : header || undefined

      if (token !== FORM_SECRET) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    }

    let body: ClientPayload
    try {
      body = (await req.json()) as ClientPayload
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    }

    const name = clean(body.name)
    const phone = clean(body.phone)
    const company = clean(body.company)
    const email = clean(body.email).toLowerCase()

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }
    if (!phone) {
      return NextResponse.json({ error: 'Phone is required' }, { status: 400 })
    }

    // Multi-tenant: resolve orgId from header or env fallback
    const orgId = getOrgIdFromHeaders(req.headers) || process.env.DEFAULT_ORG_ID || ''
    if (!orgId) {
      console.warn('[CRM] No orgId resolved for client creation')
    }

    const db = getAdminDb()
    const docRef = db.collection('clients').doc()

    const nowIso = new Date().toISOString()
    const data: Record<string, any> = {
      name,
      phone,
      orgId,
      createdAt: nowIso,
      updatedAt: nowIso,
      leadSource: 'Formulário do site',
    }

    if (company) data.company = company
    if (email) data.email = email

    await docRef.set(data)

    const responsePayload = { id: docRef.id, ...data }

    if (N8N_WEBHOOK) {
      fetch(N8N_WEBHOOK, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(responsePayload),
      }).catch(err => {
        console.error('[CRM] Failed to notify n8n webhook', err)
      })
    }

    try {
      await sendServerNotification('Novo lead', `Tem um novo lead: ${name}`, {
        url: '/crm',
        role: 'admin',
        data: { clientId: docRef.id },
      })
    } catch (err) {
      console.error('[CRM] Failed to send notification', err)
    }

    return NextResponse.json(responsePayload, { status: 201 })
  } catch (err) {
    console.error('[CRM] client creation error', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
