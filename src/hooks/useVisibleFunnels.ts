'use client'

import { useState, useEffect } from 'react'
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore'
import { db } from '@/lib/firebaseClient'
import { useCrmUser } from '@/contexts/CrmUserContext'
import type { Funnel } from '@/types/funnel'

export function useVisibleFunnels() {
  const { orgId, member, userEmail } = useCrmUser()
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

        if (isAdmin) {
          setFunnels(all)
        } else {
          // Não-admin vê apenas funis que ele próprio criou
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
  }, [orgId, member?.id, member?.role, userEmail])

  return { funnels, loading }
}
