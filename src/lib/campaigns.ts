import { getAdminDb } from './firebaseAdmin'
import type { Campaign, CampaignStatus } from '@/types/campaign'

function getCampaignsRef(orgId: string) {
  const db = getAdminDb()
  return db.collection('organizations').doc(orgId).collection('campaigns')
}

export async function createCampaign(
  orgId: string,
  data: Omit<Campaign, 'id' | 'orgId' | 'sentCount' | 'failedCount' | 'createdAt' | 'updatedAt'>
): Promise<Campaign> {
  const ref = getCampaignsRef(orgId)
  const now = new Date().toISOString()

  const campaignData = {
    orgId,
    name: data.name,
    subject: data.subject,
    body: data.body,
    bodyPlainText: data.bodyPlainText,
    status: data.status,
    type: data.type,
    filters: data.filters,
    savedSegmentId: data.savedSegmentId || '',
    totalRecipients: data.totalRecipients,
    scheduledAt: data.scheduledAt || '',
    ...(data.recurrence ? { recurrence: data.recurrence } : {}),
    sentCount: 0,
    failedCount: 0,
    lastSentAt: '',
    createdBy: data.createdBy,
    createdByName: data.createdByName,
    createdAt: now,
    updatedAt: now,
  }

  const docRef = ref.doc()
  await docRef.set(campaignData)

  return { id: docRef.id, ...campaignData }
}

export async function getCampaigns(
  orgId: string,
  options?: {
    status?: CampaignStatus
    limit?: number
    orderBy?: 'createdAt' | 'scheduledAt'
    direction?: 'asc' | 'desc'
  }
): Promise<Campaign[]> {
  const ref = getCampaignsRef(orgId)
  let query: FirebaseFirestore.Query = ref

  if (options?.status) {
    query = query.where('status', '==', options.status)
  }

  query = query.orderBy(options?.orderBy || 'createdAt', options?.direction || 'desc')

  if (options?.limit) {
    query = query.limit(options.limit)
  }

  const snapshot = await query.get()
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Campaign))
}

export async function getCampaign(orgId: string, campaignId: string): Promise<Campaign | null> {
  const doc = await getCampaignsRef(orgId).doc(campaignId).get()
  if (!doc.exists) return null
  return { id: doc.id, ...doc.data() } as Campaign
}

export async function updateCampaign(
  orgId: string,
  campaignId: string,
  data: Partial<Omit<Campaign, 'id' | 'orgId' | 'createdAt' | 'createdBy' | 'createdByName'>>
): Promise<void> {
  await getCampaignsRef(orgId).doc(campaignId).update({
    ...data,
    updatedAt: new Date().toISOString(),
  })
}

export async function deleteCampaign(orgId: string, campaignId: string): Promise<void> {
  const recipientsRef = getCampaignsRef(orgId).doc(campaignId).collection('recipients')
  const recipientDocs = await recipientsRef.get()

  const batch = getAdminDb().batch()
  recipientDocs.docs.forEach(doc => batch.delete(doc.ref))
  batch.delete(getCampaignsRef(orgId).doc(campaignId))
  await batch.commit()
}

export async function getScheduledCampaigns(): Promise<Campaign[]> {
  const db = getAdminDb()
  const now = new Date().toISOString()

  const scheduledSnap = await db
    .collectionGroup('campaigns')
    .where('status', '==', 'scheduled')
    .where('scheduledAt', '<=', now)
    .get()

  const recurringSnap = await db
    .collectionGroup('campaigns')
    .where('status', '==', 'scheduled')
    .where('recurrence.nextRunAt', '<=', now)
    .get()

  const map = new Map<string, Campaign>()
  for (const doc of [...scheduledSnap.docs, ...recurringSnap.docs]) {
    if (!map.has(doc.id)) {
      map.set(doc.id, { id: doc.id, ...doc.data() } as Campaign)
    }
  }

  return Array.from(map.values())
}
