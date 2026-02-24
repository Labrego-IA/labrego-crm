import { NextRequest, NextResponse } from 'next/server'
import { getAdminDb } from '@/lib/firebaseAdmin'
import { getUserRole } from '@/lib/requireAdmin'
import { resolveOrgByEmail, getOrgIdFromHeaders } from '@/lib/orgResolver'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    // Allow any authenticated user to register FCM tokens (not just admins)
    let email = (req.headers.get('x-user-email') || '').toLowerCase()

    const body = await req.json()

    const { token, email: emailFromBody } = body

    const normalizedBodyEmail =
      typeof emailFromBody === 'string' ? emailFromBody.trim().toLowerCase() : ''
    if (!email && normalizedBodyEmail) {
      email = normalizedBodyEmail
    }

    if (!email) {
      return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
    }

    if (!token) {
      return NextResponse.json({ error: 'Token ausente' }, { status: 400 })
    }

    const db = getAdminDb()
    const role = await getUserRole(email)

    if (role === 'frozen') {
      return NextResponse.json({ error: 'account_frozen' }, { status: 403 })
    }

    // Multi-tenant: resolve orgId from email or header
    let orgId = getOrgIdFromHeaders(req.headers) || ''
    if (!orgId && email) {
      try {
        const orgContext = await resolveOrgByEmail(email)
        if (orgContext) {
          orgId = orgContext.orgId
        }
      } catch (err) {
        console.warn('[API:fcm-token] Failed to resolve orgId from email:', err)
      }
    }
    if (!orgId) {
      orgId = process.env.DEFAULT_ORG_ID || ''
      if (!orgId) {
        console.warn('[API:fcm-token] No orgId resolved for FCM token registration')
      }
    }

    await db
      .collection('fcmTokens')
      .doc(token)
      .set(
        { token, email, role, orgId, updatedAt: new Date().toISOString() },
        { merge: true }
      )

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('[API:fcm-token] ERRO:', err)
    return NextResponse.json(
      { error: err.message || 'Internal Server Error' },
      { status: 500 }
    )
  }
}
