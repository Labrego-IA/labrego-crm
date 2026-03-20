'use client'

import { useState, useEffect } from 'react'
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore'
import { db } from '@/lib/firebaseClient'
import { useCrmUser } from '@/contexts/CrmUserContext'
import { useAllowedMemberIds } from './useAllowedMemberIds'
import type { Funnel } from '@/types/funnel'

export function useVisibleFunnels() {
  const { orgId, member, userEmail } = useCrmUser()
  const { allowedEmails, hasFullAccess } = useAllowedMemberIds()
  const [funnels, setFunnels] = useState<Funnel[]>([])
  const [loading, setLoading] = useState(true)

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

        if (hasFullAccess) {
          // Full access (admin without personal view restriction): sees all funnels
          setFunnels(all)
        } else if (allowedEmails) {
          // Restricted: see only funnels created by allowed emails
          const visible = all.filter(f =>
            f.createdBy && allowedEmails.has(f.createdBy.toLowerCase())
          )
          setFunnels(visible)
        } else {
          // Fallback while allowedEmails is loading: show own funnels only
          const email = (userEmail || '').toLowerCase()
          const visible = all.filter(f => f.createdBy === email)
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
  }, [orgId, member?.id, hasFullAccess, userEmail, allowedEmails])

  return { funnels, loading }
}
