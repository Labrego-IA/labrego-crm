import { NextRequest, NextResponse } from 'next/server'
import { getAdminAuth } from '@/lib/firebaseAdmin'

/**
 * POST /api/cadence/trigger
 * Manually triggers the cadence cron from the UI.
 * Requires Firebase Auth token.
 */
export async function POST(req: NextRequest) {
  // Verify Firebase Auth
  const authHeader = req.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const token = authHeader.slice(7)
    await getAdminAuth().verifyIdToken(token)
  } catch {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
  }

  // Call the cadence process endpoint internally
  const baseUrl = req.nextUrl.origin
  const cronSecret = process.env.CRON_SECRET

  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (cronSecret) {
    headers['Authorization'] = `Bearer ${cronSecret}`
  }

  try {
    const res = await fetch(`${baseUrl}/api/cadence/process`, {
      method: 'POST',
      headers,
    })

    const data = await res.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('[CADENCE TRIGGER] Error:', error)
    return NextResponse.json(
      { error: 'Failed to trigger cadence processing' },
      { status: 500 }
    )
  }
}
