import { getAdminDb } from './firebaseAdmin'
import type { Funnel, FunnelColumn } from '@/types/funnel'

function getFunnelsRef(orgId: string) {
  const db = getAdminDb()
  return db.collection('organizations').doc(orgId).collection('funnels')
}

function getColumnsRef(orgId: string, funnelId: string) {
  return getFunnelsRef(orgId).doc(funnelId).collection('columns')
}

export async function getFunnels(orgId: string): Promise<Funnel[]> {
  const snap = await getFunnelsRef(orgId).orderBy('order', 'asc').get()
  return snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Funnel))
}

export async function getFunnel(orgId: string, funnelId: string): Promise<Funnel | null> {
  const doc = await getFunnelsRef(orgId).doc(funnelId).get()
  if (!doc.exists) return null
  return { id: doc.id, ...doc.data() } as Funnel
}

export async function getDefaultFunnel(orgId: string): Promise<Funnel | null> {
  const snap = await getFunnelsRef(orgId).where('isDefault', '==', true).limit(1).get()
  if (snap.empty) {
    // Fallback: first funnel by order
    const fallback = await getFunnelsRef(orgId).orderBy('order', 'asc').limit(1).get()
    if (fallback.empty) return null
    return { id: fallback.docs[0].id, ...fallback.docs[0].data() } as Funnel
  }
  return { id: snap.docs[0].id, ...snap.docs[0].data() } as Funnel
}

export async function createFunnel(orgId: string, data: {
  name: string
  description?: string
  color: string
  isDefault?: boolean
  createdBy?: string
}): Promise<Funnel> {
  const now = new Date().toISOString()

  // Get current max order
  const existing = await getFunnels(orgId)
  const maxOrder = existing.length > 0 ? Math.max(...existing.map(f => f.order)) : -1

  // If this is default, unset others
  if (data.isDefault) {
    for (const f of existing.filter(f => f.isDefault)) {
      await getFunnelsRef(orgId).doc(f.id).update({ isDefault: false })
    }
  }

  const funnelData = {
    orgId,
    name: data.name,
    description: data.description || '',
    color: data.color,
    isDefault: data.isDefault || existing.length === 0, // first funnel is always default
    order: maxOrder + 1,
    visibleTo: [] as string[],
    createdBy: data.createdBy || '',
    createdAt: now,
    updatedAt: now,
  }

  const ref = getFunnelsRef(orgId).doc()
  await ref.set(funnelData)

  return { id: ref.id, ...funnelData }
}

export async function updateFunnel(orgId: string, funnelId: string, data: Partial<Pick<Funnel, 'name' | 'description' | 'color' | 'isDefault' | 'visibleTo' | 'order'>>) {
  const ref = getFunnelsRef(orgId).doc(funnelId)
  await ref.update({
    ...data,
    updatedAt: new Date().toISOString(),
  })
}

export async function deleteFunnel(orgId: string, funnelId: string) {
  // Delete all columns first
  const columns = await getColumns(orgId, funnelId)
  for (const col of columns) {
    await getColumnsRef(orgId, funnelId).doc(col.id).delete()
  }
  await getFunnelsRef(orgId).doc(funnelId).delete()
}

// Columns
export async function getColumns(orgId: string, funnelId: string): Promise<FunnelColumn[]> {
  const snap = await getColumnsRef(orgId, funnelId).orderBy('order', 'asc').get()
  return snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as FunnelColumn))
}

export async function createColumn(orgId: string, funnelId: string, data: {
  name: string
  color?: string
  probability?: number
  maxDays?: number
  countsForMetrics?: boolean
  conversionType?: FunnelColumn['conversionType']
}): Promise<FunnelColumn> {
  const existing = await getColumns(orgId, funnelId)
  const maxOrder = existing.length > 0 ? Math.max(...existing.map(c => c.order)) : -1

  const colData = {
    funnelId,
    name: data.name,
    order: maxOrder + 1,
    color: data.color || '',
    probability: data.probability ?? 0,
    maxDays: data.maxDays ?? 0,
    countsForMetrics: data.countsForMetrics ?? true,
    conversionType: data.conversionType,
  }

  const ref = getColumnsRef(orgId, funnelId).doc()
  await ref.set(colData)

  return { id: ref.id, ...colData }
}

export async function updateColumn(orgId: string, funnelId: string, columnId: string, data: Partial<Pick<FunnelColumn, 'name' | 'order' | 'color' | 'probability' | 'maxDays' | 'countsForMetrics' | 'conversionType'>>) {
  await getColumnsRef(orgId, funnelId).doc(columnId).update(data)
}

export async function deleteColumn(orgId: string, funnelId: string, columnId: string) {
  await getColumnsRef(orgId, funnelId).doc(columnId).delete()
}

// Visibility helpers
export async function getVisibleFunnels(orgId: string, memberId: string): Promise<Funnel[]> {
  const allFunnels = await getFunnels(orgId)
  return allFunnels.filter(f => f.visibleTo.length === 0 || f.visibleTo.includes(memberId))
}
