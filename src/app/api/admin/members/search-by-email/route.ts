import { NextRequest, NextResponse } from 'next/server'
import { getAdminDb, getAdminAuth } from '@/lib/firebaseAdmin'

export const runtime = 'nodejs'

/**
 * POST /api/admin/members/search-by-email
 * Searches for an existing user by email across Firebase Auth.
 * Returns user info if found, or indicates that the user doesn't exist yet.
 */
export async function POST(req: NextRequest) {
  const callerEmail = req.headers.get('x-user-email')?.toLowerCase()
  if (!callerEmail) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }

  try {
    const { orgId, email } = await req.json()

    if (!orgId || !email) {
      return NextResponse.json({ error: 'missing required fields' }, { status: 400 })
    }

    const normalizedEmail = email.toLowerCase().trim()

    // Verify caller is admin of this org
    const db = getAdminDb()
    const callerSnap = await db
      .collection('organizations').doc(orgId)
      .collection('members')
      .where('email', '==', callerEmail)
      .limit(1)
      .get()

    if (callerSnap.empty) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 })
    }

    // Caller is a member of this org — page-level PermissionGate already handles access control

    const callerMember = callerSnap.docs[0].data()

    // Check if the caller is themselves a partner of another user (has invitedBy set)
    // Partners cannot invite other users — only account owners can
    if (callerMember.invitedBy) {
      return NextResponse.json({ error: 'caller_is_partner' }, { status: 403 })
    }

    // Check if email is already a partner of the current user in this org
    const ownInviteSnap = await db
      .collection('organizations').doc(orgId)
      .collection('members')
      .where('email', '==', normalizedEmail)
      .where('invitedBy', '==', callerEmail)
      .limit(1)
      .get()

    if (!ownInviteSnap.empty) {
      return NextResponse.json({ error: 'already_your_partner' }, { status: 409 })
    }

    // Check if email is already a partner of another user (across all orgs)
    const partnerSnap = await db.collectionGroup('members')
      .where('email', '==', normalizedEmail)
      .where('status', 'in', ['active', 'pending'])
      .limit(5)
      .get()

    const isPartnerOfAnother = partnerSnap.docs.some(d => {
      const data = d.data()
      return data.invitedBy && data.invitedBy !== callerEmail
    })

    if (isPartnerOfAnother) {
      return NextResponse.json({ error: 'already_partner_of_another' }, { status: 409 })
    }

    // Search in Firebase Auth
    const auth = getAdminAuth()
    try {
      const userRecord = await auth.getUserByEmail(normalizedEmail)
      return NextResponse.json({
        found: true,
        user: {
          uid: userRecord.uid,
          email: userRecord.email,
          displayName: userRecord.displayName || userRecord.email?.split('@')[0] || '',
          photoUrl: userRecord.photoURL || null,
        },
      })
    } catch {
      // User not found in Firebase Auth
      return NextResponse.json({
        found: false,
        user: null,
      })
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    console.error('[search-by-email] Error:', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
