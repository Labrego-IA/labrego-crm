'use client'

import { useState, useEffect } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '@/lib/firebaseClient'
import { useCrmUser } from '@/contexts/CrmUserContext'
import type { Organization } from '@/types/organization'

export function useOrganization() {
  const { orgId } = useCrmUser()
  const [org, setOrg] = useState<Organization | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!orgId) {
      setLoading(false)
      return
    }

    const unsub = onSnapshot(
      doc(db, 'organizations', orgId),
      (snap) => {
        if (snap.exists()) {
          setOrg({ id: snap.id, ...snap.data() } as Organization)
        } else {
          setOrg(null)
        }
        setLoading(false)
      },
      (error) => {
        console.warn('[useOrganization] Permission error:', error.message)
        setOrg(null)
        setLoading(false)
      }
    )

    return () => unsub()
  }, [orgId])

  return { org, loading }
}
