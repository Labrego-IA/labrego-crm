import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const data = await req.json()

    // Multi-tenant: ensure orgId is present, fallback to env default
    if (!data.orgId) {
      data.orgId = process.env.DEFAULT_ORG_ID || ''
      if (!data.orgId) {
        console.warn('[N8N] No orgId in body and no DEFAULT_ORG_ID configured')
      }
    }

    const url = process.env.N8N_WEBHOOK_LEAD_CREATED
    if (!url) {
      console.error('[N8N] webhook not configured')
      return NextResponse.json({ error: 'N8N webhook not configured' }, { status: 500 })
    }
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('[N8N] lead webhook error', err)
    return NextResponse.json(
      { error: err.message || 'Internal Server Error' },
      { status: 500 },
    )
  }
}
