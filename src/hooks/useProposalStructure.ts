'use client'

import { useState, useEffect } from 'react'
import { doc, getDoc, onSnapshot } from 'firebase/firestore'
import { db } from '@/lib/firebaseClient'
import { useCrmUser } from '@/contexts/CrmUserContext'
import { useProposalDataAccess } from './useProposalDataAccess'
import type { ProposalStructure } from '@/types/proposalStructure'
import { DEFAULT_PROPOSAL_STRUCTURE } from '@/types/proposalStructure'

export function useProposalStructure() {
  const { orgId } = useCrmUser()
  const { settingsOwnerId, loading: accessLoading } = useProposalDataAccess()
  const [structure, setStructure] = useState<ProposalStructure>(DEFAULT_PROPOSAL_STRUCTURE)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!orgId || accessLoading || !settingsOwnerId) return

    let unsub: (() => void) | undefined

    const init = async () => {
      const userRef = doc(db, 'organizations', orgId, 'userSettings', settingsOwnerId, 'proposals', 'structure')
      const userSnap = await getDoc(userRef)

      const ref = userSnap.exists()
        ? userRef
        : doc(db, 'organizations', orgId, 'settings', 'proposalStructure')

      unsub = onSnapshot(
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
    }

    init().catch((error) => {
      console.error('Error initializing structure listener:', error)
      setLoading(false)
    })

    return () => unsub?.()
  }, [orgId, settingsOwnerId, accessLoading])

  return { structure, loading }
}
