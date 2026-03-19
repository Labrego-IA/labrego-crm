import { NextRequest, NextResponse } from 'next/server'
import { getAdminDb, getAdminAuth } from '@/lib/firebaseAdmin'
import { PLAN_LIMITS } from '@/types/plan'

export async function POST(req: NextRequest) {
  try {
    const { email, uid, displayName } = await req.json()
    if (!email || !uid) {
      return NextResponse.json({ error: 'missing email or uid' }, { status: 400 })
    }

    const db = getAdminDb()
    const normalizedEmail = email.toLowerCase()

    // Check if user already has a usable membership in any org
    // Skip suspended partner memberships — they lost access and need their own org
    const memberSnap = await db.collectionGroup('members')
      .where('email', '==', normalizedEmail)
      .get()

    if (!memberSnap.empty) {
      // Find an active own-org membership (not a suspended partner)
      const usable = memberSnap.docs.find((d: FirebaseFirestore.QueryDocumentSnapshot) => {
        const data = d.data()
        // Skip suspended partner memberships
        if (data.status === 'suspended' && data.invitedBy) return false
        return true
      })

      if (usable) {
        const orgRef = usable.ref.parent.parent
        return NextResponse.json({ orgId: orgRef?.id, alreadyExists: true })
      }
    }

    // Create new organization with free plan
    const now = new Date().toISOString()
    const orgName = displayName ? `${displayName}` : normalizedEmail.split('@')[0]
    const slug = orgName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    const freeLimits = PLAN_LIMITS['free']

    const orgRef = db.collection('organizations').doc()
    await orgRef.set({
      name: orgName,
      slug: `${slug}-${orgRef.id.slice(0, 6)}`,
      plan: 'free',
      adminEmail: normalizedEmail,
      status: 'active',
      settings: { timezone: 'America/Sao_Paulo', currency: 'BRL' },
      limits: {
        maxUsers: freeLimits.maxUsers,
        maxFunnels: freeLimits.maxFunnels,
        maxContacts: freeLimits.maxContacts,
      },
      createdAt: now,
      updatedAt: now,
    })

    // Initialize credits subcollection
    await orgRef.collection('credits').doc('balance').set({
      balance: freeLimits.monthlyMinutes,
      totalPurchased: freeLimits.monthlyMinutes,
      totalConsumed: 0,
      lastRechargeAt: now,
      actionBalance: freeLimits.monthlyActions,
      actionTotalPurchased: freeLimits.monthlyActions,
      actionTotalConsumed: 0,
    })

    // Add user as admin member
    await orgRef.collection('members').doc().set({
      userId: uid,
      email: normalizedEmail,
      displayName: displayName || normalizedEmail.split('@')[0],
      role: 'admin',
      permissions: {
        pages: ['/contatos', '/funil', '/funil/produtividade', '/conversao', '/cadencia', '/ligacoes', '/admin/usuarios', '/admin/creditos', '/plano'],
        actions: {
          canCreateContacts: true,
          canEditContacts: true,
          canDeleteContacts: true,
          canCreateProposals: true,
          canExportData: true,
          canManageFunnels: true,
          canManageUsers: true,
          canTriggerCalls: true,
          canViewReports: true,
          canManageSettings: true,
        },
        viewScope: 'all',
      },
      status: 'active',
      joinedAt: now,
    })

    return NextResponse.json({ orgId: orgRef.id, created: true })
  } catch (error: any) {
    console.error('[auto-provision] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
