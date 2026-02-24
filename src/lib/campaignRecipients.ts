import { getAdminDb } from './firebaseAdmin'
import type { CampaignRecipient } from '@/types/campaign'

function getRecipientsRef(orgId: string, campaignId: string) {
  const db = getAdminDb()
  return db
    .collection('organizations')
    .doc(orgId)
    .collection('campaigns')
    .doc(campaignId)
    .collection('recipients')
}

export async function addRecipients(
  orgId: string,
  campaignId: string,
  recipients: Omit<CampaignRecipient, 'id' | 'status' | 'sentAt' | 'error'>[]
): Promise<number> {
  const ref = getRecipientsRef(orgId, campaignId)
  const db = getAdminDb()

  // Firestore batch limit is 500
  const BATCH_SIZE = 500
  let count = 0

  for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
    const chunk = recipients.slice(i, i + BATCH_SIZE)
    const batch = db.batch()

    for (const r of chunk) {
      const docRef = ref.doc(r.clientId)
      batch.set(docRef, {
        clientId: r.clientId,
        name: r.name,
        email: r.email,
        company: r.company || '',
        status: 'pending',
        sentAt: '',
        error: '',
      })
      count++
    }

    await batch.commit()
  }

  return count
}

export async function getRecipients(
  orgId: string,
  campaignId: string,
  options?: { status?: 'pending' | 'sent' | 'failed'; limit?: number; startAfter?: string }
): Promise<CampaignRecipient[]> {
  const ref = getRecipientsRef(orgId, campaignId)
  let query: FirebaseFirestore.Query = ref

  if (options?.status) {
    query = query.where('status', '==', options.status)
  }

  query = query.orderBy('name')

  if (options?.startAfter) {
    const startDoc = await ref.doc(options.startAfter).get()
    if (startDoc.exists) {
      query = query.startAfter(startDoc)
    }
  }

  if (options?.limit) {
    query = query.limit(options.limit)
  }

  const snapshot = await query.get()
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CampaignRecipient))
}

export async function updateRecipientStatus(
  orgId: string,
  campaignId: string,
  clientId: string,
  status: 'sent' | 'failed',
  error?: string
): Promise<void> {
  const data: Record<string, string> = { status }

  if (status === 'sent') {
    data.sentAt = new Date().toISOString()
  }

  if (error) {
    data.error = error
  }

  await getRecipientsRef(orgId, campaignId).doc(clientId).update(data)
}

export async function getRecipientCounts(
  orgId: string,
  campaignId: string
): Promise<{ total: number; sent: number; failed: number; pending: number }> {
  const ref = getRecipientsRef(orgId, campaignId)
  const snapshot = await ref.get()

  let sent = 0
  let failed = 0
  let pending = 0

  snapshot.docs.forEach(doc => {
    const s = doc.data().status
    if (s === 'sent') sent++
    else if (s === 'failed') failed++
    else pending++
  })

  return { total: snapshot.size, sent, failed, pending }
}

export async function getFailedRecipients(
  orgId: string,
  campaignId: string
): Promise<CampaignRecipient[]> {
  return getRecipients(orgId, campaignId, { status: 'failed' })
}

export async function resetFailedRecipients(
  orgId: string,
  campaignId: string
): Promise<number> {
  const failed = await getFailedRecipients(orgId, campaignId)
  const db = getAdminDb()

  const BATCH_SIZE = 500
  let count = 0

  for (let i = 0; i < failed.length; i += BATCH_SIZE) {
    const chunk = failed.slice(i, i + BATCH_SIZE)
    const batch = db.batch()

    for (const r of chunk) {
      batch.update(getRecipientsRef(orgId, campaignId).doc(r.clientId), {
        status: 'pending',
        sentAt: '',
        error: '',
      })
      count++
    }

    await batch.commit()
  }

  return count
}
