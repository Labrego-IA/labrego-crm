'use client'

import { addDoc, collection, serverTimestamp } from 'firebase/firestore'

import { auth, db } from '@/lib/firebaseClient'
import { getScreenLabel } from '@/lib/screenLabels'

type MetadataInput = Record<string, string | number | boolean | Date | null | undefined>

type LogActivityInput = {
  action: string
  message?: string
  screenPath?: string | null
  screenLabel?: string | null
  type?: string
  metadata?: MetadataInput
  /**
   * Optional override for the entity that will receive the log entry.
   * Defaults to the current authenticated user inside the `users` collection.
   */
  entityType?: string
  entityId?: string | null
}

function normalizeMetadata(metadata?: MetadataInput | null): Record<string, string> | null {
  if (!metadata) return null

  const entries = Object.entries(metadata).reduce<Record<string, string>>((acc, [key, value]) => {
    if (!key || value === undefined || value === null) return acc

    if (value instanceof Date) {
      acc[key] = value.toISOString()
      return acc
    }

    acc[key] = String(value)
    return acc
  }, {})

  return Object.keys(entries).length > 0 ? entries : null
}

export async function logActivity({
  action,
  message,
  screenPath,
  screenLabel,
  type = 'activity',
  metadata,
  entityType = 'users',
  entityId,
}: LogActivityInput): Promise<void> {
  if (typeof window === 'undefined') return

  const currentUser = auth.currentUser
  const resolvedEntityId = entityId ?? currentUser?.email ?? currentUser?.uid ?? null

  if (!resolvedEntityId) return

  const resolvedScreenPath = screenPath ?? window.location.pathname
  const resolvedScreenLabel = screenLabel ?? getScreenLabel(resolvedScreenPath)
  const authorLabel = currentUser?.email ?? currentUser?.displayName ?? resolvedEntityId
  const normalizedMetadata = normalizeMetadata(metadata)

  const docRef = collection(db, entityType, resolvedEntityId, 'logs')

  try {
    await addDoc(docRef, {
      action,
      message: message ?? `Acessou a tela ${resolvedScreenLabel}`,
      type,
      author: authorLabel,
      authorId: currentUser?.uid ?? resolvedEntityId,
      email: currentUser?.email ?? null,
      screenPath: resolvedScreenPath,
      screenLabel: resolvedScreenLabel,
      metadata: normalizedMetadata,
      createdAt: serverTimestamp(),
    })
  } catch (error) {
    console.warn('[activity] Failed to persist log entry', error)
  }
}
