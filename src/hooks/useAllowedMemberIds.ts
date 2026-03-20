'use client'

import { useState, useEffect } from 'react'
import { collection, query, where, getDocs } from 'firebase/firestore'
import { db } from '@/lib/firebaseClient'
import { useCrmUser } from '@/contexts/CrmUserContext'
import { usePermissions } from './usePermissions'
import { usePartnerView } from '@/contexts/PartnerViewContext'

/**
 * Hook that computes the set of member IDs whose data the current user can see.
 *
 * Rules (when user has multiple views — personal + partner):
 * - Personal view: sees ONLY own data (regardless of admin status)
 * - Partner view: sees own data + inviter's data
 *
 * Rules (when user has a single view):
 * - Admin or viewScope !== 'own': returns null (no filter — see all)
 * - Partner (has invitedBy): sees own data + inviter's data
 * - Owner (no invitedBy): sees own data only
 *
 * Returns:
 * - allowedMemberIds: Set of member IDs visible (null = no filter)
 * - allowedEmails: Set of emails visible (null = no filter) — useful for createdBy checks
 * - loading: whether the data is still loading
 */
export function useAllowedMemberIds() {
  const { orgId, member, userEmail } = useCrmUser()
  const { viewScope } = usePermissions()
  const { activeView, hasMultipleViews } = usePartnerView()

  const [allowedMemberIds, setAllowedMemberIds] = useState<Set<string> | null>(null)
  const [allowedEmails, setAllowedEmails] = useState<Set<string> | null>(null)
  const [loading, setLoading] = useState(true)

  // When user has multiple views and is in personal view, always filter to own data only
  const isPersonalViewWithMultipleViews = hasMultipleViews && activeView === 'personal'
  const hasFullAccess = viewScope !== 'own' && !isPersonalViewWithMultipleViews

  useEffect(() => {
    if (!orgId || !member) {
      setLoading(false)
      return
    }

    // Personal view with multiple views: always restrict to own data only
    if (isPersonalViewWithMultipleViews) {
      const ids = new Set<string>()
      const emails = new Set<string>()
      if (member.id) ids.add(member.id)
      if (userEmail) emails.add(userEmail.toLowerCase())
      setAllowedMemberIds(ids)
      setAllowedEmails(emails)
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
          // Current user is a partner: include ONLY the inviter
          membersSnap.docs.forEach((d) => {
            const data = d.data()
            if (data.email === member.invitedBy) {
              ids.add(d.id)
              if (data.email) emails.add(data.email.toLowerCase())
            }
          })
        }
        // Note: org owners without invitedBy only see their own data

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
  }, [orgId, member, hasFullAccess, isPersonalViewWithMultipleViews, userEmail])

  return { allowedMemberIds, allowedEmails, loading, hasFullAccess }
}
