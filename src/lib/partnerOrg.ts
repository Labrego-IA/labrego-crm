import { PLAN_LIMITS } from '@/types/plan'

/**
 * Ensures a partner user has their own free-plan organization to fall back to
 * when they are blocked or removed from a partner org.
 * If the user already has an active membership in another org (their own), does nothing.
 */
export async function ensurePartnerHasOwnOrg(
  db: FirebaseFirestore.Firestore,
  email: string,
  userId: string,
  displayName: string,
) {
  const normalizedEmail = email.toLowerCase()

  // Check if user already has an active membership in another org (their own org)
  const allMemberships = await db.collectionGroup('members')
    .where('email', '==', normalizedEmail)
    .get()

  const hasActiveOwnOrg = allMemberships.docs.some((d: FirebaseFirestore.QueryDocumentSnapshot) => {
    const data = d.data()
    return data.status === 'active' && !data.invitedBy
  })

  if (hasActiveOwnOrg) return

  // Create a new free-plan organization for the partner
  const now = new Date().toISOString()
  const orgName = displayName || normalizedEmail.split('@')[0]
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

  // Initialize credits
  await orgRef.collection('credits').doc('balance').set({
    balance: freeLimits.monthlyMinutes,
    totalPurchased: freeLimits.monthlyMinutes,
    totalConsumed: 0,
    lastRechargeAt: now,
    actionBalance: freeLimits.monthlyActions,
    actionTotalPurchased: freeLimits.monthlyActions,
    actionTotalConsumed: 0,
  })

  // Add user as admin of their own org (no invitedBy = owner)
  await orgRef.collection('members').doc().set({
    userId,
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
        canTransferLeads: true,
      },
      viewScope: 'all',
    },
    status: 'active',
    joinedAt: now,
  })
}
