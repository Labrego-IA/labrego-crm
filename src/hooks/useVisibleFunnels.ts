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
        const isAdmin = member?.role === 'admin'

        if (isAdmin || hasFullAccess) {
          setFunnels(all)
        } else if (allowedEmails) {
          // Non-admin: see funnels created by self + partners in the same group
          const visible = all.filter(f => {
            if (!f.createdBy) return true // backward compat: funnels without createdBy are visible
            return allowedEmails.has(f.createdBy.toLowerCase())
          })
          setFunnels(visible)
        } else {
          // Fallback while allowedEmails is loading: show own funnels
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
  }, [orgId, member?.id, member?.role, userEmail, allowedEmails, hasFullAccess])

  return { funnels, loading }
}
