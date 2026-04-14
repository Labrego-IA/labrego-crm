import { NextRequest, NextResponse } from 'next/server'
import { getAdminDb, getAdminAuth } from '@/lib/firebaseAdmin'
import { unlinkLeaderPartners } from '@/lib/unlinkLeaderPartners'
import { checkRateLimit, getClientIp } from '@/lib/rateLimit'

export const runtime = 'nodejs'

/**
 * POST /api/account/delete
 * Self-deletion of account by the authenticated user.
 * Steps:
 * 1. Unlinks all partners invited by this user (ensures they have fallback orgs)
 * 2. Deletes the user's member document from the organization
 * 3. Deletes the Firebase Auth user
 */
export async function POST(req: NextRequest) {
  const ip = getClientIp(new Headers(req.headers))
  const rl = checkRateLimit(`account-delete:${ip}`, { limit: 3, windowSeconds: 60 })
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

  const callerEmail = req.headers.get('x-user-email')?.toLowerCase()
  const callerUid = req.headers.get('x-user-uid')

  if (!callerEmail || !callerUid) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }

  try {
    const { orgId, memberId, password } = await req.json()

    if (!orgId || !memberId) {
      return NextResponse.json({ error: 'missing required fields' }, { status: 400 })
    }

    const db = getAdminDb()
    const auth = getAdminAuth()

    // Verify the member belongs to the caller
    const memberRef = db.collection('organizations').doc(orgId).collection('members').doc(memberId)
    const memberDoc = await memberRef.get()

    if (!memberDoc.exists) {
      return NextResponse.json({ error: 'member not found' }, { status: 404 })
    }

    const memberData = memberDoc.data()!
    if (memberData.email !== callerEmail) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 })
    }

    // Verify the Firebase Auth user matches
    try {
      const authUser = await auth.getUser(callerUid)
      if (authUser.email?.toLowerCase() !== callerEmail) {
        return NextResponse.json({ error: 'auth mismatch' }, { status: 403 })
      }
    } catch {
      return NextResponse.json({ error: 'auth user not found' }, { status: 404 })
    }

    // 1. Unlink all partners invited by this user in this org
    const unlinkedCount = await unlinkLeaderPartners(db, callerEmail, orgId)

    // 2. Delete the user's member document
    await memberRef.delete()

    // 3. Delete Firebase Auth user
    try {
      await auth.deleteUser(callerUid)
    } catch (authErr) {
      console.error('[account/delete] Error deleting Firebase Auth user:', authErr)
      // Member doc already deleted — return partial success
      return NextResponse.json({ success: true, unlinkedPartners: unlinkedCount, authDeleted: false })
    }

    return NextResponse.json({ success: true, unlinkedPartners: unlinkedCount, authDeleted: true })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    console.error('[account/delete] Error:', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
