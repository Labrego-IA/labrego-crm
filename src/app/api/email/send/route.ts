import { NextRequest, NextResponse } from 'next/server'
import { sendWithFallback } from '@/lib/email/emailProvider'
import { checkRateLimit, getClientIp } from '@/lib/rateLimit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const ip = getClientIp(new Headers(req.headers))
  const rl = checkRateLimit(`email-send:${ip}`, { limit: 20, windowSeconds: 60 })
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

  try {
    const { to, subject, body, orgId } = await req.json()

    if (!to || !subject || !body) {
      return NextResponse.json(
        { error: 'Missing required fields: to, subject, body' },
        { status: 400 },
      )
    }

    if (!orgId) {
      return NextResponse.json(
        { error: 'orgId is required' },
        { status: 400 },
      )
    }

    const result = await sendWithFallback(orgId, to, subject, body)

    if (result.success) {
      return NextResponse.json({
        success: true,
        messageId: result.messageId,
        provider: result.provider,
      })
    }

    return NextResponse.json(
      { error: result.error || 'Failed to send email', provider: result.provider },
      { status: 500 },
    )
  } catch (error) {
    console.error('[API] Email send error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    )
  }
}
