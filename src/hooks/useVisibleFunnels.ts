'use client'

import { useState, useEffect, useRef } from 'react'
import { collection, query, orderBy, onSnapshot, doc, updateDoc } from 'firebase/firestore'
import { db } from '@/lib/firebaseClient'
import { useCrmUser } from '@/contexts/CrmUserContext'
import { useAllowedMemberIds } from './useAllowedMemberIds'
import { usePartnerView } from '@/contexts/PartnerViewContext'
import type { Funnel } from '@/types/funnel'

export function useVisibleFunnels() {
  const { orgId, member, userEmail } = useCrmUser()
  const { allowedMemberIds, allowedEmails, hasFullAccess } = useAllowedMemberIds()
  const { activeView, hasMultipleViews } = usePartnerView()
  const [funnels, setFunnels] = useState<Funnel[]>([])
  const [loading, setLoading] = useState(true)
  const migratedRef = useRef<Set<string>>(new Set())

  // Only backfill in personal view to ensure correct ownership
  const isPersonalView = !hasMultipleViews || activeView === 'personal'

  useEffect(() => {
    if (!orgId) {
      setLoading(false)
      return
    }

    const q = query(
      collection(db, 'organizations', orgId, 'funnels'),
      orderBy('order', 'asc')
    )

    const unsub = onSnapshot(
      q,
      (snap) => {
        const all = snap.docs.map(d => ({ id: d.id, ...d.data() } as Funnel))

        // Backfill createdByMemberId — only from personal view
        if (isPersonalView && member?.id && userEmail) {
          const email = userEmail.toLowerCase()
          for (const f of all) {
            if (!f.createdByMemberId && f.createdBy === email && !migratedRef.current.has(f.id)) {
              migratedRef.current.add(f.id)
              updateDoc(doc(db, 'organizations', orgId, 'funnels', f.id), {
                createdByMemberId: member.id,
              }).catch((err) => {
                console.warn('[useVisibleFunnels] Failed to backfill createdByMemberId:', err.message)
                migratedRef.current.delete(f.id)
              })
            }
          }
        }

        if (hasFullAccess) {
          setFunnels(all)
        } else if (allowedMemberIds) {
          const currentEmail = (userEmail || '').toLowerCase()
          const isPartnerView = hasMultipleViews && activeView === 'partner'

          const visible = all.filter(f => {
            // If funnel has createdByMemberId, use it for member-based filtering
            if (f.createdByMemberId) {
              return allowedMemberIds.has(f.createdByMemberId)
            }

            // Funnel without createdByMemberId (legacy):
            // - In personal view: show if created by current user's email
            // - In partner view: show only if created by someone else (companion),
            //   NOT by current user (those belong to personal view)
            if (f.createdBy) {
              const funnelEmail = f.createdBy.toLowerCase()
              if (isPartnerView && funnelEmail === currentEmail) {
                // Current user's legacy funnel — belongs to personal view, hide in partner view
                return false
              }
              // Show if createdBy is in allowed emails (companion's funnel, or own in personal view)
              if (allowedEmails) {
                return allowedEmails.has(funnelEmail)
              }
            }
            return false
          })
          setFunnels(visible)
        } else {
          // Fallback while data is loading: show own funnels only
          const visible = all.filter(f => {
            if (f.createdByMemberId && member?.id) {
              return f.createdByMemberId === member.id
            }
            const email = (userEmail || '').toLowerCase()
            return f.createdBy === email
          })
          setFunnels(visible)
        }
        setLoading(false)
      },
      (error) => {
        console.warn('[useVisibleFunnels] Permission error:', error.message)
        setFunnels([])
        setLoading(false)
      }
    )

    return () => unsub()
  }, [orgId, member?.id, hasFullAccess, isPersonalView, hasMultipleViews, activeView, userEmail, allowedMemberIds, allowedEmails])

  return { funnels, loading }
}
