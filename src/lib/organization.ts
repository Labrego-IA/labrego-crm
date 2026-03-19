import { getAdminDb } from './firebaseAdmin'
import type { Organization, OrgSettings, OrgLimits } from '@/types/organization'
import { PLAN_LIMITS } from '@/types/plan'
import type { PlanId } from '@/types/plan'

export function getOrgRef(orgId: string) {
  const db = getAdminDb()
  return db.collection('organizations').doc(orgId)
}

export async function getOrganization(orgId: string): Promise<Organization | null> {
  const doc = await getOrgRef(orgId).get()
  if (!doc.exists) return null
  return { id: doc.id, ...doc.data() } as Organization
}

export async function getOrganizationBySlug(slug: string): Promise<Organization | null> {
  const db = getAdminDb()
  const snap = await db.collection('organizations').where('slug', '==', slug).limit(1).get()
  if (snap.empty) return null
  const doc = snap.docs[0]
  return { id: doc.id, ...doc.data() } as Organization
}

export async function createOrganization(data: {
  name: string
  slug: string
  plan: PlanId
  logoUrl?: string
  adminEmail: string
}): Promise<Organization> {
  const db = getAdminDb()

  // Check slug uniqueness
  const existing = await getOrganizationBySlug(data.slug)
  if (existing) throw new Error('Slug already exists')

  const limits = PLAN_LIMITS[data.plan]
  const now = new Date().toISOString()

  const orgData: Record<string, unknown> = {
    name: data.name,
    slug: data.slug,
    plan: data.plan,
    logoUrl: data.logoUrl || '',
    settings: {
      timezone: 'America/Sao_Paulo',
      currency: 'BRL',
    } as OrgSettings,
    limits: {
      maxUsers: limits.maxUsers,
      maxFunnels: limits.maxFunnels,
      maxContacts: limits.maxContacts,
    } as OrgLimits,
    status: 'active' as const,
    createdAt: now,
    updatedAt: now,
  }
  if (data.plan !== 'free') {
    orgData.planSubscribedAt = now
  }

  const ref = db.collection('organizations').doc()
  await ref.set(orgData)

  // Initialize credits subcollection (dual: minutes + actions)
  await ref.collection('credits').doc('balance').set({
    balance: limits.monthlyMinutes,
    totalPurchased: limits.monthlyMinutes,
    totalConsumed: 0,
    lastRechargeAt: now,
    actionBalance: limits.monthlyActions,
    actionTotalPurchased: limits.monthlyActions,
    actionTotalConsumed: 0,
  })

  return { id: ref.id, ...orgData } as Organization
}

export async function updateOrganization(orgId: string, data: Partial<Pick<Organization, 'name' | 'logoUrl' | 'plan' | 'status' | 'settings' | 'limits'>>) {
  const ref = getOrgRef(orgId)
  const now = new Date().toISOString()
  const updateData: Record<string, unknown> = {
    ...data,
    updatedAt: now,
  }

  // Quando o plano muda, registrar a data da assinatura
  if (data.plan) {
    const current = await ref.get()
    const currentPlan = current.data()?.plan
    if (currentPlan !== data.plan) {
      updateData.planSubscribedAt = now
    }
  }

  await ref.update(updateData)
}

export async function listOrganizations(): Promise<Organization[]> {
  const db = getAdminDb()
  const snap = await db.collection('organizations').orderBy('createdAt', 'desc').get()
  return snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Organization))
}
