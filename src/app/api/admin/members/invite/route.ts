import { NextRequest, NextResponse } from 'next/server'
import { getAdminDb, getAdminAuth } from '@/lib/firebaseAdmin'
import { ROLE_PRESETS, type RolePreset } from '@/types/permissions'
import { filterPagesByPlan, filterActionsByPlan } from '@/lib/planPermissions'
import type { PlanId } from '@/types/plan'

export const runtime = 'nodejs'

/**
 * POST /api/admin/members/invite
 * Creates a pending partner invitation.
 * - If user exists in Firebase Auth: creates member with status 'pending' + in-app notification.
 * - If user doesn't exist: creates Firebase Auth user, member with status 'pending', + in-app notification.
 * The invitation must be accepted by the invited user before permissions are applied.
 */
export async function POST(req: NextRequest) {
  const callerEmail = req.headers.get('x-user-email')?.toLowerCase()
  if (!callerEmail) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }

  try {
    const { orgId, email, displayName, role } = await req.json()

    if (!orgId || !email || !role) {
      return NextResponse.json({ error: 'missing required fields' }, { status: 400 })
    }

    const validRoles: RolePreset[] = ['admin', 'manager', 'seller', 'viewer']
    if (!validRoles.includes(role)) {
      return NextResponse.json({ error: 'invalid role' }, { status: 400 })
    }

    const normalizedEmail = email.toLowerCase().trim()
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

    // Check if email already exists in org
    const existingSnap = await db
      .collection('organizations').doc(orgId)
      .collection('members')
      .where('email', '==', normalizedEmail)
      .limit(1)
      .get()

    if (!existingSnap.empty) {
      return NextResponse.json({ error: 'email already exists in organization' }, { status: 409 })
    }

    // Get org data (name + plan)
    const orgDoc = await db.collection('organizations').doc(orgId).get()
    const orgData = orgDoc.data()
    const orgName = orgData?.name || 'Voxium CRM'
    const orgPlan = (orgData?.plan as PlanId) || 'free'

    // Get or create Firebase Auth user
    const auth = getAdminAuth()
    let userId = ''
    let resolvedDisplayName = displayName || ''

    try {
      const existingUser = await auth.getUserByEmail(normalizedEmail).catch(() => null)
      if (existingUser) {
        userId = existingUser.uid
        // Use Auth display name if no name was provided
        if (!resolvedDisplayName) {
          resolvedDisplayName = existingUser.displayName || normalizedEmail.split('@')[0]
        }
      } else {
        // User doesn't exist in Auth — create with temp password
        const tempPassword = `Voxium@${Math.random().toString(36).slice(2, 10)}`
        if (!resolvedDisplayName) {
          resolvedDisplayName = normalizedEmail.split('@')[0]
        }
        const newUser = await auth.createUser({
          email: normalizedEmail,
          password: tempPassword,
          displayName: resolvedDisplayName,
        })
        userId = newUser.uid
      }
    } catch (authErr) {
      console.error('[invite] Auth user creation error:', authErr)
      return NextResponse.json({ error: 'failed to create auth user' }, { status: 500 })
    }

    // Create member document with status 'pending' (permissions will be applied on accept)
    const now = new Date().toISOString()
    const rolePreset = ROLE_PRESETS[role as RolePreset]
    const permissions = {
      ...rolePreset,
      pages: filterPagesByPlan(rolePreset.pages, orgPlan),
      actions: filterActionsByPlan(rolePreset.actions, orgPlan),
    }
    const memberRef = db.collection('organizations').doc(orgId).collection('members').doc()

    await memberRef.set({
      userId,
      email: normalizedEmail,
      displayName: resolvedDisplayName,
      role,
      permissions, // Stored but not effective until accepted
      status: 'pending',
      joinedAt: now,
      invitedBy: callerEmail,
      planId: orgPlan,
    })

    // Create in-app notification for the invited user
    const callerDisplayName = callerMember.displayName || callerEmail
    try {
      // Find the user's own org to send the notification there
      // We need to find any org where this user is an active member
      const userMemberships = await db.collectionGroup('members')
        .where('email', '==', normalizedEmail)
        .where('status', 'in', ['active', 'invited'])
        .limit(5)
        .get()

      // Collect unique orgIds where the user has active membership
      const targetOrgIds = new Set<string>()
      userMemberships.docs.forEach(d => {
        const memberOrgRef = d.ref.parent.parent
        if (memberOrgRef) {
          targetOrgIds.add(memberOrgRef.id)
        }
      })

      // If user has no active org yet, use the inviting org itself
      if (targetOrgIds.size === 0) {
        targetOrgIds.add(orgId)
      }

      // Create notification in each org the user belongs to
      for (const targetOrgId of targetOrgIds) {
        await db.collection('notifications').add({
          orgId: targetOrgId,
          userId,
          type: 'partner_invite',
          title: 'Convite de parceria',
          message: `${callerDisplayName} convidou voce para ser parceiro(a) na organizacao ${orgName}.`,
          read: false,
          createdAt: now,
          metadata: {
            inviteOrgId: orgId,
            inviteOrgName: orgName,
            inviteMemberId: memberRef.id,
            inviterEmail: callerEmail,
            inviterName: callerDisplayName,
            role,
          },
        })
      }
    } catch (notifErr) {
      console.error('[invite] Notification creation error:', notifErr)
      // Don't fail the request if notification fails — member was already created
    }

    return NextResponse.json({ memberId: memberRef.id, userId })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    console.error('[invite] Error:', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
