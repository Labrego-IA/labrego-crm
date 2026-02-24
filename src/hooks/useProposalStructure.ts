'use client'

import { useState, useEffect } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '@/lib/firebaseClient'
import { useCrmUser } from '@/contexts/CrmUserContext'
import type { ProposalStructure } from '@/types/proposalStructure'
import { DEFAULT_PROPOSAL_STRUCTURE } from '@/types/proposalStructure'

export function useProposalStructure() {
  const { orgId } = useCrmUser()
  const [structure, setStructure] = useState<ProposalStructure>(DEFAULT_PROPOSAL_STRUCTURE)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!orgId) return

    const ref = doc(db, 'organizations', orgId, 'settings', 'proposalStructure')
    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (snap.exists()) {
          setStructure({ ...DEFAULT_PROPOSAL_STRUCTURE, ...(snap.data() as Partial<ProposalStructure>) })
        } else {
          setStructure(DEFAULT_PROPOSAL_STRUCTURE)
        }
        setLoading(false)
      },
      (error) => {
        console.error('Error loading proposal structure:', error)
        setStructure(DEFAULT_PROPOSAL_STRUCTURE)
        setLoading(false)
      }
    )

    return () => unsub()
  }, [orgId])

  return { structure, loading }
}
