import { NextRequest, NextResponse } from 'next/server'
import { getAdminDb } from '@/lib/firebaseAdmin'

export const runtime = 'nodejs'

/**
 * POST /api/admin/members/resolve-invite-token
 * Resolves an invite token to get invite details.
 * Does NOT require authentication (user may not be logged in yet).
 */
export async function POST(req: NextRequest) {
  try {
    const { token } = await req.json()

    if (!token) {
      return NextResponse.json({ error: 'missing token' }, { status: 400 })
    }

    const db = getAdminDb()

    // Search across all orgs for a member with this invite token
    const memberSnap = await db.collectionGroup('members')
      .where('inviteToken', '==', token)
      .where('status', '==', 'pending')
      .limit(1)
      .get()

    if (memberSnap.empty) {
      return NextResponse.json({ error: 'invite_not_found', message: 'Convite nao encontrado ou ja foi aceito.' }, { status: 404 })
    }

    const memberDoc = memberSnap.docs[0]
    const memberData = memberDoc.data()
    const orgRef = memberDoc.ref.parent.parent

    if (!orgRef) {
      return NextResponse.json({ error: 'org_not_found' }, { status: 404 })
    }

    // Get org name
    const orgDoc = await db.collection('organizations').doc(orgRef.id).get()
    const orgData = orgDoc.data()

    return NextResponse.json({
      found: true,
      invite: {
        orgId: orgRef.id,
        orgName: orgData?.name || 'Organizacao',
        memberId: memberDoc.id,
        email: memberData.email,
        role: memberData.role,
        inviterEmail: memberData.invitedBy,
        displayName: memberData.displayName,
      },
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    console.error('[resolve-invite-token] Error:', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
