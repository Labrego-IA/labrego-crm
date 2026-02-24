import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { getAdminDb } from '@/lib/firebaseAdmin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

/**
 * GET /api/campaigns/process-scheduled
 *
 * Called by external cron (e.g. cron-job.org, Vercel Cron) every 5 minutes.
 * Finds scheduled campaigns ready to send and triggers their send process.
 *
 * CRON SETUP:
 * - URL: https://your-domain.com/api/campaigns/process-scheduled
 * - Method: GET
 * - Frequency: Every 5 minutes
 * - Optional header: x-cron-secret for authentication
 */
export async function GET(req: NextRequest) {
  // Optional: verify cron secret
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const providedSecret = req.headers.get('x-cron-secret') || req.nextUrl.searchParams.get('secret')
    if (providedSecret !== cronSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  try {
    const db = getAdminDb()
    const now = new Date().toISOString()
    let processed = 0

    // Find scheduled campaigns (non-recurring) that are due
    const scheduledSnap = await db
      .collectionGroup('campaigns')
      .where('status', '==', 'scheduled')
      .where('type', '==', 'scheduled')
      .get()

    for (const doc of scheduledSnap.docs) {
      const campaign = doc.data()
      if (campaign.scheduledAt && campaign.scheduledAt <= now) {
        // Trigger send
        const orgId = campaign.orgId
        const campaignId = doc.id

        try {
          const baseUrl = process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin
          await fetch(`${baseUrl}/api/campaigns/send`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ campaignId, orgId }),
          })
          processed++
        } catch (error) {
          console.error(`[Scheduler] Failed to trigger send for campaign ${doc.id}:`, error)
        }
      }
    }

    // Find recurring campaigns that are due
    const recurringSnap = await db
      .collectionGroup('campaigns')
      .where('status', '==', 'scheduled')
      .where('type', '==', 'recurring')
      .get()

    for (const docSnap of recurringSnap.docs) {
      const campaign = docSnap.data()
      const recurrence = campaign.recurrence

      if (!recurrence || !recurrence.nextRunAt) continue
      if (recurrence.nextRunAt > now) continue

      // Check if end date has passed
      if (recurrence.endDate && recurrence.endDate < now) {
        await docSnap.ref.update({
          status: 'completed',
          updatedAt: now,
        })
        continue
      }

      const orgId = campaign.orgId
      const campaignId = docSnap.id

      try {
        // Trigger send for current batch
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin
        await fetch(`${baseUrl}/api/campaigns/send`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ campaignId, orgId }),
        })

        // Calculate next run
        const nextRunAt = calculateNextRun(recurrence)

        // Reset recipient statuses for next run and update next run time
        await docSnap.ref.update({
          'recurrence.nextRunAt': nextRunAt,
          status: 'scheduled', // Keep as scheduled for next run
          updatedAt: now,
        })

        processed++
      } catch (error) {
        console.error(`[Scheduler] Failed to process recurring campaign ${docSnap.id}:`, error)
      }
    }

    return NextResponse.json({
      success: true,
      processed,
      timestamp: now,
    })
  } catch (error) {
    console.error('[Scheduler] Error processing scheduled campaigns:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/* ==================== Helpers ==================== */

function calculateNextRun(recurrence: {
  frequency: string
  dayOfWeek?: number
  dayOfMonth?: number
  timeOfDay: string
  nextRunAt: string
}): string {
  const current = new Date(recurrence.nextRunAt)
  const [hours, minutes] = recurrence.timeOfDay.split(':').map(Number)

  switch (recurrence.frequency) {
    case 'daily':
      current.setDate(current.getDate() + 1)
      break

    case 'weekly':
      current.setDate(current.getDate() + 7)
      break

    case 'biweekly':
      current.setDate(current.getDate() + 14)
      break

    case 'monthly':
      current.setMonth(current.getMonth() + 1)
      if (recurrence.dayOfMonth) {
        current.setDate(Math.min(recurrence.dayOfMonth, daysInMonth(current)))
      }
      break
  }

  current.setHours(hours, minutes, 0, 0)
  return current.toISOString()
}

function daysInMonth(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
}
