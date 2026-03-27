import { NextRequest, NextResponse } from 'next/server'
import { getAdminDb, getAdminAuth } from '@/lib/firebaseAdmin'
import { ensurePartnerHasOwnOrg } from '@/lib/partnerOrg'
import { unlinkLeaderPartners } from '@/lib/unlinkLeaderPartners'

export const runtime = 'nodejs'

/**
 * POST /api/admin/members/delete
 * Deletes a member by:
 * 1. Disabling their Firebase Auth account (revokes plan access)
 * 2. Deleting their Firestore member document (removes from list)
 */
export async function POST(req: NextRequest) {
  const callerEmail = req.headers.get('x-user-email')?.toLowerCase()
  if (!callerEmail) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }

  try {
    const { orgId, memberId, userId } = await req.json()

    if (!orgId || !memberId) {
      return NextResponse.json({ error: 'missing required fields' }, { status: 400 })
    }

    const db = getAdminDb()

    // Verify caller is member of this org
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

    // Get target member
    const membersCol = db.collection('organizations').doc(orgId).collection('members')
    let memberRef = membersCol.doc(memberId)
    let memberDoc = await memberRef.get()

    if (!memberDoc.exists && userId) {
      const byUserId = await membersCol.where('userId', '==', userId).limit(1).get()
      if (!byUserId.empty) {
        memberRef = byUserId.docs[0].ref
        memberDoc = byUserId.docs[0]
      }
    }

    if (!memberDoc.exists) {
      return NextResponse.json({ error: 'member not found' }, { status: 404 })
    }

    const memberData = memberDoc.data()!
    const isPartner = !!memberData.invitedBy

    // Authorization: admin OR canManageUsers OR inviter of the partner
    const isAdmin = callerMember.role === 'admin'
    const canManageUsers = callerMember.permissions?.actions?.canManageUsers === true
    const isInviter = isPartner && memberData.invitedBy === callerEmail
    if (!isAdmin && !canManageUsers && !isInviter) {
      return NextResponse.json({ error: 'insufficient permissions to delete members' }, { status: 403 })
    }

    // Prevent self-deletion
    if (memberData.email === callerEmail) {
      return NextResponse.json({ error: 'you cannot delete yourself' }, { status: 400 })
    }

    // For partners: ensure they have their own free org before removing them
    // This must happen BEFORE deleting the member doc so the collectionGroup query still finds them
    if (isPartner && (memberData.userId || userId)) {
      await ensurePartnerHasOwnOrg(db, memberData.email, memberData.userId || userId, memberData.displayName)
    }

    // If this member is a leader (invited partners), unlink all their partners first
    await unlinkLeaderPartners(db, memberData.email, orgId)

    // Disable Firebase Auth account — but NOT for partners (they need to log into their own org)
    const targetUserId = memberData.userId || userId
    if (targetUserId && !isPartner) {
      const auth = getAdminAuth()
      try {
        await auth.updateUser(targetUserId, { disabled: true })
      } catch (authErr) {
        console.error('[delete] Error disabling Firebase Auth user:', authErr)
      }
    }

    // Delete Firestore member document
    await memberRef.delete()

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    console.error('[delete] Error:', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
