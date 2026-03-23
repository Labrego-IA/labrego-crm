import { NextRequest, NextResponse } from 'next/server'
import { getAdminDb, getAdminAuth } from '@/lib/firebaseAdmin'
import { ROLE_PRESETS, type RolePreset } from '@/types/permissions'
import { filterPagesByPlan, filterActionsByPlan } from '@/lib/planPermissions'
import type { PlanId } from '@/types/plan'

export const runtime = 'nodejs'

/**
 * POST /api/admin/members/respond-invite
 * Accept or reject a partner invitation.
 * On accept: updates member status from 'pending' to 'active' and applies role permissions.
 * On reject: deletes the pending member document.
 */
export async function POST(req: NextRequest) {
  const callerEmail = req.headers.get('x-user-email')?.toLowerCase()
  if (!callerEmail) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }

  try {
    const { orgId, memberId, action, notificationId } = await req.json()

    if (!orgId || !memberId || !action) {
      return NextResponse.json({ error: 'missing required fields' }, { status: 400 })
    }

    if (action !== 'accept' && action !== 'reject') {
      return NextResponse.json({ error: 'invalid action, must be accept or reject' }, { status: 400 })
    }

    const db = getAdminDb()

    // Fetch the pending member document
    const memberRef = db.collection('organizations').doc(orgId).collection('members').doc(memberId)
    const memberDoc = await memberRef.get()

    if (!memberDoc.exists) {
      return NextResponse.json({ error: 'invitation not found' }, { status: 404 })
    }

    const memberData = memberDoc.data()!

    // Verify the invitation belongs to the caller
    if (memberData.email !== callerEmail) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 })
    }

    // Verify the member is in pending status
    if (memberData.status !== 'pending') {
      return NextResponse.json({ error: 'invitation is no longer pending' }, { status: 409 })
    }

    if (action === 'accept') {
      // Get org data for plan filtering
      const orgDoc = await db.collection('organizations').doc(orgId).get()
      const orgData = orgDoc.data()
      const orgPlan = (orgData?.plan as PlanId) || 'free'

      // Apply role permissions filtered by plan
      const role = memberData.role as RolePreset
      const rolePreset = ROLE_PRESETS[role]
      const permissions = rolePreset
        ? {
            ...rolePreset,
            pages: filterPagesByPlan(rolePreset.pages, orgPlan),
            actions: filterActionsByPlan(rolePreset.actions, orgPlan),
          }
        : memberData.permissions

      await memberRef.update({
        status: 'active',
        permissions,
        planId: orgPlan,
        acceptedAt: new Date().toISOString(),
      })

      // Create reciprocal partner: add the inviter as a partner in the invited user's own org
      try {
        const inviterEmail = memberData.invitedBy
        if (inviterEmail) {
          // Find the invited user's own org (where they are NOT a partner — no invitedBy)
          const callerMemberships = await db.collectionGroup('members')
            .where('email', '==', callerEmail)
            .where('status', 'in', ['active', 'invited'])
            .limit(10)
            .get()

          let callerOwnOrgId: string | null = null
          for (const d of callerMemberships.docs) {
            const data = d.data()
            if (!data.invitedBy) {
              const mOrgRef = d.ref.parent.parent
              if (mOrgRef) {
                callerOwnOrgId = mOrgRef.id
                break
              }
            }
          }

          if (callerOwnOrgId && callerOwnOrgId !== orgId) {
            // Check if inviter is already a partner in caller's org
            const existingPartner = await db
              .collection('organizations').doc(callerOwnOrgId)
              .collection('members')
              .where('email', '==', inviterEmail)
              .where('invitedBy', '==', callerEmail)
              .limit(1)
              .get()

            if (existingPartner.empty) {
              // Get inviter info for the member doc
              const inviterAuth = await getAdminAuth().getUserByEmail(inviterEmail).catch(() => null)
              const inviterDisplayName = inviterAuth?.displayName || inviterEmail.split('@')[0]

              // Get caller's org plan
              const callerOrgDoc = await db.collection('organizations').doc(callerOwnOrgId).get()
              const callerOrgData = callerOrgDoc.data()
              const callerOrgPlan = (callerOrgData?.plan as PlanId) || 'free'

              const reciprocalRole = role as RolePreset
              const reciprocalPreset = ROLE_PRESETS[reciprocalRole]
              const reciprocalPermissions = reciprocalPreset
                ? {
                    ...reciprocalPreset,
                    pages: filterPagesByPlan(reciprocalPreset.pages, callerOrgPlan),
                    actions: filterActionsByPlan(reciprocalPreset.actions, callerOrgPlan),
                  }
                : permissions

              const now = new Date().toISOString()
              await db
                .collection('organizations').doc(callerOwnOrgId)
                .collection('members')
                .add({
                  userId: inviterAuth?.uid || '',
                  email: inviterEmail,
                  displayName: inviterDisplayName,
                  role: reciprocalRole,
                  permissions: reciprocalPermissions,
                  status: 'active',
                  joinedAt: now,
                  acceptedAt: now,
                  invitedBy: callerEmail,
                  planId: callerOrgPlan,
                })
            }
          }
        }
      } catch (reciprocalErr) {
        console.error('[respond-invite] Reciprocal partner creation error:', reciprocalErr)
        // Non-critical: the main invite was already accepted
      }
    } else {
      // Reject: delete the pending member document
      await memberRef.delete()
    }

    // Mark notification as read if provided
    if (notificationId) {
      try {
        await db.collection('notifications').doc(notificationId).update({ read: true })
      } catch {
        // Non-critical: notification might already be read or deleted
      }
    }

    // Send notification to the inviter about the response
    try {
      const inviterEmail = memberData.invitedBy
      if (inviterEmail) {
        const respondedByName = memberData.displayName || callerEmail

        // Find inviter's userId and orgIds to send notification
        const inviterMemberships = await db.collectionGroup('members')
          .where('email', '==', inviterEmail)
          .where('status', 'in', ['active', 'invited'])
          .limit(5)
          .get()

        const inviterOrgIds = new Set<string>()
        let inviterUserId = ''

        inviterMemberships.docs.forEach(d => {
          const memberOrgRef = d.ref.parent.parent
          if (memberOrgRef) {
            inviterOrgIds.add(memberOrgRef.id)
          }
          if (!inviterUserId) {
            inviterUserId = d.data().userId
          }
        })

        if (inviterUserId && inviterOrgIds.size > 0) {
          const now = new Date().toISOString()
          const notifType = action === 'accept' ? 'partner_invite_accepted' : 'partner_invite_rejected'
          const title = action === 'accept'
            ? 'Convite aceito!'
            : 'Convite recusado'
          const message = action === 'accept'
            ? `${respondedByName} aceitou seu convite de parceria e agora faz parte da sua organizacao.`
            : `${respondedByName} recusou seu convite de parceria.`

          for (const inviterOrgId of inviterOrgIds) {
            await db.collection('notifications').add({
              orgId: inviterOrgId,
              userId: inviterUserId,
              type: notifType,
              title,
              message,
              read: false,
              createdAt: now,
              metadata: {
                respondedByEmail: callerEmail,
                respondedByName: respondedByName,
                inviteOrgId: orgId,
                action,
              },
            })
          }
        }
      }
    } catch (notifErr) {
      console.error('[respond-invite] Notification to inviter error:', notifErr)
      // Non-critical: don't fail the response if notification fails
    }

    return NextResponse.json({ success: true, action })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    console.error('[respond-invite] Error:', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
