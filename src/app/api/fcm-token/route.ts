import { NextRequest, NextResponse } from 'next/server'
import { getAdminDb } from '@/lib/firebaseAdmin'
import { getUserRole } from '@/lib/requireAdmin'
import { requireOrgId } from '@/lib/orgResolver'

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

    // Multi-tenant: resolve orgId securely (no fallback)
    const resolved = await requireOrgId(req.headers)
    if (!resolved) {
      return NextResponse.json({ error: 'Unable to resolve organization' }, { status: 401 })
    }
    const orgId = resolved.orgId

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
