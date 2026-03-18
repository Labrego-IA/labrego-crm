'use client'

import { useState, useEffect } from 'react'
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore'
import { db } from '@/lib/firebaseClient'
import { useCrmUser } from '@/contexts/CrmUserContext'
import type { Funnel } from '@/types/funnel'

export function useVisibleFunnels() {
  const { orgId, member } = useCrmUser()
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
        // Filter by visibility: empty visibleTo = visible to all
        const memberId = member?.id
        const visible = all.filter(f =>
          f.visibleTo.length === 0 || (memberId && f.visibleTo.includes(memberId))
        )
        setFunnels(visible)
        setLoading(false)
      },
      (error) => {
        console.warn('[useVisibleFunnels] Permission error:', error.message)
        setFunnels([])
        setLoading(false)
      }
    )

    return () => unsub()
  }, [orgId, member?.id])

  return { funnels, loading }
}
