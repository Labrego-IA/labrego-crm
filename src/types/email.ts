/**
 * Email engagement event types for tracking opens, clicks, bounces, etc.
 * Used by webhook handlers and campaign analytics.
 */

export type EmailEventType = 'delivered' | 'opened' | 'clicked' | 'bounced' | 'complained'

export interface EmailEvent {
  id: string
  orgId: string
  campaignId: string
  contactId: string
  recipientEmail: string
  type: EmailEventType
  timestamp: string // ISO date
  metadata: {
    eventId?: string // For idempotency
    ipAddress?: string
    userAgent?: string
    linkUrl?: string // For click events
    bounceType?: string // hard | soft
    provider?: string // resend | sendgrid
  }
  createdAt: string
}

export interface CampaignEngagement {
  sent: number
  delivered: number
  opened: number
  uniqueOpens: number
  clicked: number
  uniqueClicks: number
  bounced: number
  complained: number
  openRate: number // opens / delivered * 100
  clickRate: number // clicks / delivered * 100
  bounceRate: number // bounces / sent * 100
  deliveryRate: number // delivered / sent * 100
}

export const EMPTY_ENGAGEMENT: CampaignEngagement = {
  sent: 0,
  delivered: 0,
  opened: 0,
  uniqueOpens: 0,
  clicked: 0,
  uniqueClicks: 0,
  bounced: 0,
  complained: 0,
  openRate: 0,
  clickRate: 0,
  bounceRate: 0,
  deliveryRate: 0,
}

export function calcEngagement(events: EmailEvent[], sentCount: number): CampaignEngagement {
  const delivered = new Set<string>()
  const opened = new Set<string>()
  const clicked = new Set<string>()
  const bounced = new Set<string>()
  const complained = new Set<string>()
  let totalOpens = 0
  let totalClicks = 0

  for (const e of events) {
    switch (e.type) {
      case 'delivered':
        delivered.add(e.contactId)
        break
      case 'opened':
        opened.add(e.contactId)
        totalOpens++
        break
      case 'clicked':
        clicked.add(e.contactId)
        totalClicks++
        break
      case 'bounced':
        bounced.add(e.contactId)
        break
      case 'complained':
        complained.add(e.contactId)
        break
    }
  }

  const deliveredCount = delivered.size
  const sent = sentCount || 1

  return {
    sent: sentCount,
    delivered: deliveredCount,
    opened: totalOpens,
    uniqueOpens: opened.size,
    clicked: totalClicks,
    uniqueClicks: clicked.size,
    bounced: bounced.size,
    complained: complained.size,
    openRate: deliveredCount > 0 ? (opened.size / deliveredCount) * 100 : 0,
    clickRate: deliveredCount > 0 ? (clicked.size / deliveredCount) * 100 : 0,
    bounceRate: sent > 0 ? (bounced.size / sent) * 100 : 0,
    deliveryRate: sent > 0 ? (deliveredCount / sent) * 100 : 0,
  }
}
