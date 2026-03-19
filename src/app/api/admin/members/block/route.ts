import { NextRequest, NextResponse } from 'next/server'
import { getAdminDb, getAdminAuth } from '@/lib/firebaseAdmin'
import { ROLE_PRESETS, type RolePreset } from '@/types/permissions'
import { filterPagesByPlan, filterActionsByPlan } from '@/lib/planPermissions'
import { PLAN_LIMITS } from '@/types/plan'
import type { PlanId } from '@/types/plan'
import { ensurePartnerHasOwnOrg } from '@/lib/partnerOrg'

export const runtime = 'nodejs'

/**
 * POST /api/admin/members/block
 * Blocks or unblocks a user by:
 * 1. Updating their Firestore member status to 'suspended' or 'active'
 * 2. Disabling/enabling their Firebase Auth account (prevents login)
 * 3. On block: backs up permissions and clears them (removes plan access)
 * 4. On unblock: restores permissions from backup
 */
export async function POST(req: NextRequest) {
  const callerEmail = req.headers.get('x-user-email')?.toLowerCase()
  if (!callerEmail) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }

  try {
    const { orgId, memberId, userId, action } = await req.json()

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

    // Get target member — try by document ID first, then by userId field
    const membersCol = db.collection('organizations').doc(orgId).collection('members')
    let memberRef = membersCol.doc(memberId)
    let memberDoc = await memberRef.get()

    // If not found by doc ID (e.g. auth-only users with id "auth-{uid}"), search by userId field
    if (!memberDoc.exists && userId) {
      const byUserId = await membersCol.where('userId', '==', userId).limit(1).get()
      if (!byUserId.empty) {
        memberRef = byUserId.docs[0].ref
        memberDoc = byUserId.docs[0]
      }
    }

    const auth = getAdminAuth()
    const newStatus = action === 'block' ? 'suspended' : 'active'

    if (!memberDoc.exists) {
      // Auth-only user (exists in Firebase Auth but not in Firestore)
      // We can still disable/enable their Firebase Auth account
      if (!userId) {
        return NextResponse.json({ error: 'member not found' }, { status: 404 })
      }

      // Verify auth user exists and prevent self-blocking
      try {
        const authUser = await auth.getUser(userId)
        if (authUser.email?.toLowerCase() === callerEmail) {
          return NextResponse.json({ error: 'you cannot block yourself' }, { status: 400 })
        }
        await auth.updateUser(userId, { disabled: action === 'block' })
      } catch (authErr) {
        console.error('[block] Error updating Firebase Auth user:', authErr)
        return NextResponse.json({ error: 'failed to update auth state' }, { status: 500 })
      }

      return NextResponse.json({ success: true, status: newStatus })
    }

    const memberData = memberDoc.data()!
    const isPartner = !!memberData.invitedBy

    // Prevent self-blocking
    if (memberData.email === callerEmail) {
      return NextResponse.json({ error: 'you cannot block yourself' }, { status: 400 })
    }

    // Update Firebase Auth disabled state
    // Partners (invitedBy) should NOT have Auth disabled — they need to fall back to their own org
    if (memberData.userId && !isPartner) {
      try {
        await auth.updateUser(memberData.userId, {
          disabled: action === 'block',
        })
      } catch (authErr) {
        console.error('[block] Error updating Firebase Auth user:', authErr)
        return NextResponse.json({ error: 'failed to update auth state' }, { status: 500 })
      }
    }

    // Build Firestore update payload
    if (action === 'block') {
      // Back up current permissions and clear them — user loses all plan access
      await memberRef.update({
        status: newStatus,
        _permissionsBackup: memberData.permissions || null,
        permissions: {
          pages: [],
          actions: {
            canCreateContacts: false,
            canEditContacts: false,
            canDeleteContacts: false,
            canCreateProposals: false,
            canExportData: false,
            canManageFunnels: false,
            canManageUsers: false,
            canTriggerCalls: false,
            canViewReports: false,
            canManageSettings: false,
            canTransferLeads: false,
          },
          viewScope: 'own',
        },
      })

      // For partners: ensure they have their own free org to fall back to
      if (isPartner && memberData.userId) {
        await ensurePartnerHasOwnOrg(db, memberData.email, memberData.userId, memberData.displayName)
      }
    } else {
      // Unblock: restore permissions from backup, or regenerate from role + plan
      let restoredPermissions = memberData._permissionsBackup || null

      if (!restoredPermissions) {
        // No backup — regenerate permissions from role and current org plan
        const orgDoc = await db.collection('organizations').doc(orgId).get()
        const orgPlan = (orgDoc.data()?.plan as PlanId) || 'free'
        const role = (memberData.role as RolePreset) || 'viewer'
        const rolePreset = ROLE_PRESETS[role] || ROLE_PRESETS.viewer
        restoredPermissions = {
          pages: filterPagesByPlan([...rolePreset.pages], orgPlan),
          actions: filterActionsByPlan({ ...rolePreset.actions }, orgPlan),
          viewScope: rolePreset.viewScope,
        }
      }

      // Re-enable Firebase Auth if it was disabled (non-partner case)
      if (memberData.userId && !isPartner) {
        try {
          await auth.updateUser(memberData.userId, { disabled: false })
        } catch (authErr) {
          console.error('[block] Error re-enabling Firebase Auth user:', authErr)
        }
      }

      await memberRef.update({
        status: newStatus,
        permissions: restoredPermissions,
        _permissionsBackup: null,
      })
    }

    return NextResponse.json({ success: true, status: newStatus })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    console.error('[block] Error:', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
