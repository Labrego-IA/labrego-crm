import { useState, useEffect } from 'react'
import { db } from '@/lib/firebaseClient'
import { doc, onSnapshot } from 'firebase/firestore'
import { useCrmUser } from '@/contexts/CrmUserContext'
import type { ProposalCustomField } from '@/types/proposalCustomField'

export function useProposalCustomFields() {
  const { orgId } = useCrmUser()
  const [fields, setFields] = useState<ProposalCustomField[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!orgId) {
      setLoading(false)
      return
    }

    const ref = doc(db, 'organizations', orgId, 'settings', 'proposalCustomFields')
    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (snap.exists()) {
          const data = snap.data()
          const raw = (data.fields ?? []) as ProposalCustomField[]
          setFields(raw.sort((a, b) => a.order - b.order))
        } else {
          setFields([])
        }
        setLoading(false)
      },
      (error) => {
        console.error('Error loading custom fields:', error)
        setLoading(false)
      }
    )

    return unsub
  }, [orgId])

  return { fields, loading }
}
