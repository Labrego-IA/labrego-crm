'use client'

import { useState, useEffect } from 'react'
import { useCrmUser } from '@/contexts/CrmUserContext'
import { usePermissions } from './usePermissions'
import { db } from '@/lib/firebaseClient'
import { collection, query, where, getDocs } from 'firebase/firestore'

/**
 * Hook that determines data access scope for the /admin/propostas page.
 *
 * Rules:
 * - Admin (systemRole=admin or role=admin): sees ALL data (allowedUserIds = null)
 * - Non-partner owner: sees own data + data from partners they invited
 * - Partner: sees own data + inviter's data + companions (same invitedBy)
 *
 * Returns:
 * - isAdmin: whether current user is admin
 * - allowedUserIds: array of userIds whose data is visible (null = no filter)
 * - settingsOwnerId: userId under which settings are stored/read
 * - loading: whether the access data is still being loaded
 */
export function useProposalDataAccess() {
  const { orgId, userUid, userEmail, member } = useCrmUser()
  const { isSystemAdmin } = usePermissions()

  const [allowedUserIds, setAllowedUserIds] = useState<string[] | null>(null)
  const [settingsOwnerId, setSettingsOwnerId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const isAdmin = isSystemAdmin || member?.role === 'admin'
  const isPartner = !!member?.invitedBy

  useEffect(() => {
    if (!orgId || !userUid || !member) {
      setLoading(false)
      return
    }

    // Admin sees all data
    if (isAdmin) {
      setAllowedUserIds(null)
      setSettingsOwnerId(userUid)
      setLoading(false)
      return
    }

    const loadAccess = async () => {
      try {
        if (isPartner && member.invitedBy) {
          // Partner user: find only the inviter
          const membersSnap = await getDocs(
            query(
              collection(db, 'organizations', orgId, 'members'),
              where('status', '==', 'active'),
            ),
          )

          const ids = [userUid]
          let inviterUserId: string | null = null

          membersSnap.docs.forEach((d) => {
            const data = d.data()
            // The inviter (their email matches our invitedBy)
            if (data.email === member.invitedBy) {
              ids.push(data.userId)
              inviterUserId = data.userId
            }
          })

          setAllowedUserIds([...new Set(ids)])
          setSettingsOwnerId(inviterUserId || userUid)
        } else {
          // Non-partner owner: find all partners they invited
          const partnersSnap = await getDocs(
            query(
              collection(db, 'organizations', orgId, 'members'),
              where('status', '==', 'active'),
              where('invitedBy', '==', (userEmail || '').toLowerCase()),
            ),
          )

          const ids = [userUid]
          partnersSnap.docs.forEach((d) => {
            const data = d.data()
            if (data.userId) ids.push(data.userId)
          })

          setAllowedUserIds([...new Set(ids)])
          setSettingsOwnerId(userUid)
        }
      } catch (error) {
        console.error('Error loading proposal data access:', error)
        // Fallback: only own data
        setAllowedUserIds([userUid])
        setSettingsOwnerId(userUid)
      } finally {
        setLoading(false)
      }
    }

    loadAccess()
  }, [orgId, userUid, userEmail, member, isAdmin, isPartner])

  /**
   * Filters an array of items by createdBy field.
   * Admin sees all; others see only items from allowed users.
   * Items without createdBy are visible to all (backward compatibility).
   */
  const filterByAccess = <T extends { createdBy?: string }>(items: T[]): T[] => {
    if (isAdmin || !allowedUserIds) return items
    return items.filter(
      (item) => !item.createdBy || allowedUserIds.includes(item.createdBy),
    )
  }

  return { isAdmin, allowedUserIds, settingsOwnerId, loading, filterByAccess }
}
