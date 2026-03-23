import { NextRequest, NextResponse } from 'next/server'
import { getAdminDb, getAdminAuth } from '@/lib/firebaseAdmin'
import { ROLE_PRESETS, type RolePreset } from '@/types/permissions'
import { filterPagesByPlan, filterActionsByPlan } from '@/lib/planPermissions'
import { sendWithFallback } from '@/lib/email/emailProvider'
import type { PlanId } from '@/types/plan'

export const runtime = 'nodejs'

/**
 * POST /api/admin/members/invite
 * Creates a pending partner invitation.
 * - If user exists in Firebase Auth: creates member with status 'pending' + in-app notification + invite email.
 * - If user doesn't exist: creates Firebase Auth user with provided password, member with status 'pending', + invite email.
 * The invitation must be accepted by the invited user before permissions are applied.
 */
export async function POST(req: NextRequest) {
  const callerEmail = req.headers.get('x-user-email')?.toLowerCase()
  if (!callerEmail) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }

  try {
    const { orgId, email, displayName, role, password } = await req.json()

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

    // Get org data (name + plan)
    const orgDoc = await db.collection('organizations').doc(orgId).get()
    const orgData = orgDoc.data()
    const orgName = orgData?.name || 'Voxium CRM'
    const orgPlan = (orgData?.plan as PlanId) || 'free'

    // Get or create Firebase Auth user
    const auth = getAdminAuth()
    let userId = ''
    let resolvedDisplayName = displayName || ''
    let isNewUser = false

    try {
      const existingUser = await auth.getUserByEmail(normalizedEmail).catch(() => null)
      if (existingUser) {
        userId = existingUser.uid
        // Use Auth display name if no name was provided
        if (!resolvedDisplayName) {
          resolvedDisplayName = existingUser.displayName || normalizedEmail.split('@')[0]
        }
      } else {
        // User doesn't exist in Auth — create with provided password or temp password
        const userPassword = password || `Voxium@${Math.random().toString(36).slice(2, 10)}`
        if (!resolvedDisplayName) {
          resolvedDisplayName = normalizedEmail.split('@')[0]
        }
        const newUser = await auth.createUser({
          email: normalizedEmail,
          password: userPassword,
          displayName: resolvedDisplayName,
        })
        userId = newUser.uid
        isNewUser = true
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

    // Send invite email
    try {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin
      const loginUrl = `${appUrl.replace(/\/$/, '')}/login`

      const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#0ea5e9,#6366f1);padding:32px 32px 24px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;">Convite de Parceria</h1>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              <p style="margin:0 0 16px;color:#374151;font-size:15px;line-height:1.6;">
                Ola <strong>${resolvedDisplayName}</strong>,
              </p>
              <p style="margin:0 0 16px;color:#374151;font-size:15px;line-height:1.6;">
                <strong>${callerDisplayName}</strong> convidou voce para ser parceiro(a) na organizacao <strong>${orgName}</strong>.
              </p>
              ${isNewUser ? `
              <div style="background-color:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:16px;margin:0 0 20px;">
                <p style="margin:0 0 8px;color:#166534;font-size:14px;font-weight:600;">Suas credenciais de acesso:</p>
                <p style="margin:0 0 4px;color:#374151;font-size:14px;"><strong>Email:</strong> ${normalizedEmail}</p>
                <p style="margin:0;color:#374151;font-size:14px;"><strong>Senha:</strong> A senha definida pelo administrador</p>
                <p style="margin:8px 0 0;color:#6b7280;font-size:12px;">Recomendamos alterar sua senha apos o primeiro acesso.</p>
              </div>
              ` : ''}
              <div style="background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:16px;margin:0 0 24px;">
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="color:#6b7280;font-size:13px;padding:4px 0;">Organizacao</td>
                    <td style="color:#111827;font-size:13px;font-weight:600;text-align:right;padding:4px 0;">${orgName}</td>
                  </tr>
                  <tr>
                    <td style="color:#6b7280;font-size:13px;padding:4px 0;">Convidado por</td>
                    <td style="color:#111827;font-size:13px;font-weight:600;text-align:right;padding:4px 0;">${callerDisplayName}</td>
                  </tr>
                </table>
              </div>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="${loginUrl}" style="display:inline-block;background:linear-gradient(135deg,#0ea5e9,#6366f1);color:#ffffff;text-decoration:none;padding:12px 32px;border-radius:10px;font-size:15px;font-weight:600;">
                      Acessar o App
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:24px 0 0;color:#9ca3af;font-size:12px;text-align:center;">
                Acesse o app e aceite o convite na area de notificacoes.
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color:#f8fafc;padding:20px 32px;text-align:center;border-top:1px solid #e5e7eb;">
              <p style="margin:0;color:#9ca3af;font-size:12px;">
                Este email foi enviado automaticamente pelo Voxium CRM.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`

      await sendWithFallback(
        orgId,
        normalizedEmail,
        `Convite de parceria - ${orgName}`,
        emailHtml,
      )
    } catch (emailErr) {
      console.error('[invite] Email send error:', emailErr)
      // Don't fail the request if email fails — member and notification were already created
    }

    return NextResponse.json({ memberId: memberRef.id, userId })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    console.error('[invite] Error:', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
