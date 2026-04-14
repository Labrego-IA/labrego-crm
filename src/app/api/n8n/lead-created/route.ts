import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const data = await req.json()

    // Multi-tenant: require orgId from request body (no env fallback)
    if (!data.orgId) {
      return NextResponse.json({ error: 'orgId is required in request body' }, { status: 400 })
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
