import { NextRequest, NextResponse } from 'next/server'
import { getAdminDb, getAdminAuth } from '@/lib/firebaseAdmin'

export const runtime = 'nodejs'

/**
 * POST /api/admin/members/block
 * Blocks or unblocks a user by:
 * 1. Updating their Firestore member status to 'suspended' or 'active'
 * 2. Disabling/enabling their Firebase Auth account (prevents login)
 */
export async function POST(req: NextRequest) {
  const callerEmail = req.headers.get('x-user-email')?.toLowerCase()
  if (!callerEmail) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }

  try {
    const { orgId, memberId, action } = await req.json()

    if (!orgId || !memberId || !action) {
      return NextResponse.json({ error: 'missing required fields' }, { status: 400 })
    }

    if (action !== 'block' && action !== 'unblock') {
      return NextResponse.json({ error: 'action must be "block" or "unblock"' }, { status: 400 })
    }

    const db = getAdminDb()

    // Verify caller is admin of this org
    const callerSnap = await db
      .collection('organizations').doc(orgId)
      .collection('members')
      .where('email', '==', callerEmail)
      .limit(1)
      .get()

    if (callerSnap.empty) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 })
    }

    const callerMember = callerSnap.docs[0].data()
    if (callerMember.role !== 'admin') {
      return NextResponse.json({ error: 'only admins can block/unblock members' }, { status: 403 })
    }

    // Get target member
    const memberRef = db.collection('organizations').doc(orgId).collection('members').doc(memberId)
    const memberDoc = await memberRef.get()

    if (!memberDoc.exists) {
      return NextResponse.json({ error: 'member not found' }, { status: 404 })
    }

    const memberData = memberDoc.data()!

    // Prevent self-blocking
    if (memberData.email === callerEmail) {
      return NextResponse.json({ error: 'you cannot block yourself' }, { status: 400 })
    }

    const auth = getAdminAuth()
    const newStatus = action === 'block' ? 'suspended' : 'active'

    // Update Firebase Auth disabled state
    if (memberData.userId) {
      try {
        await auth.updateUser(memberData.userId, {
          disabled: action === 'block',
        })
      } catch (authErr) {
        console.error('[block] Error updating Firebase Auth user:', authErr)
        return NextResponse.json({ error: 'failed to update auth state' }, { status: 500 })
      }
    }

    // Update Firestore member status
    await memberRef.update({ status: newStatus })

    return NextResponse.json({ success: true, status: newStatus })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    console.error('[block] Error:', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
