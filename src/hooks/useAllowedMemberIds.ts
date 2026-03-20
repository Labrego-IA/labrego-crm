'use client'

import { useState, useEffect } from 'react'
import { collection, query, where, getDocs } from 'firebase/firestore'
import { db } from '@/lib/firebaseClient'
import { useCrmUser } from '@/contexts/CrmUserContext'
import { usePermissions } from './usePermissions'

/**
 * Hook that computes the set of member IDs whose data the current user can see.
 *
 * Rules:
 * - Admin or viewScope !== 'own': returns null (no filter — see all)
 * - Partner (has invitedBy): sees own + inviter + companions (same invitedBy)
 * - Owner (no invitedBy): sees own + all partners they invited
 *
 * Returns:
 * - allowedMemberIds: Set of member IDs visible (null = no filter)
 * - allowedEmails: Set of emails visible (null = no filter) — useful for createdBy checks
 * - loading: whether the data is still loading
 */
export function useAllowedMemberIds() {
  const { orgId, member, userEmail } = useCrmUser()
  const { viewScope } = usePermissions()

  const [allowedMemberIds, setAllowedMemberIds] = useState<Set<string> | null>(null)
  const [allowedEmails, setAllowedEmails] = useState<Set<string> | null>(null)
  const [loading, setLoading] = useState(true)

  const hasFullAccess = viewScope !== 'own'

  useEffect(() => {
    if (!orgId || !member) {
      setLoading(false)
      return
    }

    if (hasFullAccess) {
      setAllowedMemberIds(null)
      setAllowedEmails(null)
      setLoading(false)
      return
    }

    const fetchAllowed = async () => {
      try {
        const membersSnap = await getDocs(
          query(
            collection(db, 'organizations', orgId, 'members'),
            where('status', '==', 'active'),
          ),
        )

        const ids = new Set<string>()
        const emails = new Set<string>()

        // Always include self
        if (member.id) ids.add(member.id)
        if (userEmail) emails.add(userEmail.toLowerCase())

        if (member.invitedBy) {
          // Current user is a partner: include companions (same invitedBy) + the inviter
          membersSnap.docs.forEach((d) => {
            const data = d.data()
            // Companions: same invitedBy value (siblings)
            if (data.invitedBy === member.invitedBy) {
              ids.add(d.id)
              if (data.email) emails.add(data.email.toLowerCase())
            }
            // The inviter themselves
            if (data.email === member.invitedBy) {
              ids.add(d.id)
              if (data.email) emails.add(data.email.toLowerCase())
            }
          })
        } else if (userEmail) {
          // Current user is org owner: include all partners they invited
          membersSnap.docs.forEach((d) => {
            const data = d.data()
            if (data.invitedBy === userEmail.toLowerCase()) {
              ids.add(d.id)
              if (data.email) emails.add(data.email.toLowerCase())
            }
          })
        }

        setAllowedMemberIds(ids)
        setAllowedEmails(emails)
      } catch (error) {
        console.error('[useAllowedMemberIds] Erro ao carregar parceiros:', error)
        // Fallback: only own data
        const fallbackIds = new Set<string>()
        const fallbackEmails = new Set<string>()
        if (member.id) fallbackIds.add(member.id)
        if (userEmail) fallbackEmails.add(userEmail.toLowerCase())
        setAllowedMemberIds(fallbackIds)
        setAllowedEmails(fallbackEmails)
      } finally {
        setLoading(false)
      }
    }

    fetchAllowed()
  }, [orgId, member, hasFullAccess, userEmail])

  return { allowedMemberIds, allowedEmails, loading, hasFullAccess }
}
