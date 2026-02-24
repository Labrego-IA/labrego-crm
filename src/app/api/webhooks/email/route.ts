import { NextRequest, NextResponse } from 'next/server'
import { getAdminDb } from '@/lib/firebaseAdmin'

/**
 * Email webhook handler for engagement tracking.
 * Receives events from email providers (Resend, SendGrid).
 * Events: delivered, opened, clicked, bounced, complained.
 */

// Resend event types mapping
const EVENT_TYPE_MAP: Record<string, string> = {
  'email.delivered': 'delivered',
  'email.opened': 'opened',
  'email.clicked': 'clicked',
  'email.bounced': 'bounced',
  'email.complained': 'complained',
  // SendGrid events
  'delivered': 'delivered',
  'open': 'opened',
  'click': 'clicked',
  'bounce': 'bounced',
  'spamreport': 'complained',
}

export async function POST(req: NextRequest) {
  // Webhook authentication via shared secret
  const webhookSecret = process.env.WEBHOOK_SECRET
  if (webhookSecret) {
    const providedSecret = req.headers.get('x-webhook-secret') || req.nextUrl.searchParams.get('secret')
    if (providedSecret !== webhookSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  try {
    const body = await req.json()

    // Handle Resend webhook format
    if (body.type && body.data) {
      return handleResendEvent(body)
    }

    // Handle SendGrid webhook format (array of events)
    if (Array.isArray(body)) {
      const results = await Promise.allSettled(
        body.map(event => handleSendGridEvent(event))
      )
      const failed = results.filter(r => r.status === 'rejected').length
      return NextResponse.json({ received: true, processed: body.length, failed })
    }

    return NextResponse.json({ error: 'Unknown webhook format' }, { status: 400 })
  } catch (error) {
    console.error('Email webhook error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

async function handleResendEvent(body: { type: string; data: Record<string, unknown> }) {
  const eventType = EVENT_TYPE_MAP[body.type]
  if (!eventType) {
    return NextResponse.json({ received: true }) // Ignore unknown events
  }

  const data = body.data
  const emailId = data.email_id as string
  const tags = (data.tags as Record<string, string>) || {}
  const orgId = tags.orgId
  const campaignId = tags.campaignId
  const contactId = tags.contactId

  if (!orgId || !campaignId || !contactId) {
    // Missing required tags — ignore silently
    return NextResponse.json({ received: true })
  }

  // Idempotency check using top-level eventId field (indexed)
  const eventId = `${emailId}_${eventType}_${data.created_at || Date.now()}`
  const existingSnap = await getAdminDb()
    .collection('emailEvents')
    .where('eventId', '==', eventId)
    .limit(1)
    .get()

  if (!existingSnap.empty) {
    return NextResponse.json({ received: true, duplicate: true })
  }

  await getAdminDb().collection('emailEvents').add({
    orgId,
    campaignId,
    contactId,
    eventId,
    recipientEmail: (data.to as string[])?.[0] || '',
    type: eventType,
    timestamp: (data.created_at as string) || new Date().toISOString(),
    metadata: {
      ipAddress: '',
      userAgent: '',
      linkUrl: eventType === 'clicked' ? (data.click as Record<string, unknown>)?.link as string || '' : '',
      bounceType: eventType === 'bounced' ? (data.bounce as Record<string, unknown>)?.type as string || '' : '',
      provider: 'resend',
    },
    createdAt: new Date().toISOString(),
  })

  return NextResponse.json({ received: true })
}

async function handleSendGridEvent(event: Record<string, unknown>) {
  const eventType = EVENT_TYPE_MAP[event.event as string]
  if (!eventType) return

  const customArgs = (event.custom_args as Record<string, string>) || {}
  const orgId = customArgs.orgId
  const campaignId = customArgs.campaignId
  const contactId = customArgs.contactId

  if (!orgId || !campaignId || !contactId) return

  const eventId = `${event.sg_event_id || ''}_${eventType}`
  const existingSnap = await getAdminDb()
    .collection('emailEvents')
    .where('eventId', '==', eventId)
    .limit(1)
    .get()

  if (!existingSnap.empty) return

  await getAdminDb().collection('emailEvents').add({
    orgId,
    campaignId,
    contactId,
    eventId,
    recipientEmail: (event.email as string) || '',
    type: eventType,
    timestamp: event.timestamp
      ? new Date((event.timestamp as number) * 1000).toISOString()
      : new Date().toISOString(),
    metadata: {
      ipAddress: (event.ip as string) || '',
      userAgent: (event.useragent as string) || '',
      linkUrl: eventType === 'clicked' ? (event.url as string) || '' : '',
      bounceType: eventType === 'bounced' ? (event.type as string) || '' : '',
      provider: 'sendgrid',
    },
    createdAt: new Date().toISOString(),
  })
}
