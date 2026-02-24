'use client'

import { useState, useEffect } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '@/lib/firebaseClient'
import { useCrmUser } from '@/contexts/CrmUserContext'
import type { ProposalBranding } from '@/types/proposalBranding'
import { DEFAULT_PROPOSAL_BRANDING } from '@/types/proposalBranding'

export function useProposalBranding() {
  const { orgId, orgName } = useCrmUser()
  const [branding, setBranding] = useState<ProposalBranding>(DEFAULT_PROPOSAL_BRANDING)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!orgId) return

    const ref = doc(db, 'organizations', orgId, 'settings', 'proposalBranding')
    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (snap.exists()) {
          setBranding({ ...DEFAULT_PROPOSAL_BRANDING, ...(snap.data() as Partial<ProposalBranding>) })
        } else {
          setBranding({
            ...DEFAULT_PROPOSAL_BRANDING,
            companyName: orgName || '',
          })
        }
        setLoading(false)
      },
      (error) => {
        console.error('Error loading proposal branding:', error)
        setBranding({
          ...DEFAULT_PROPOSAL_BRANDING,
          companyName: orgName || '',
        })
        setLoading(false)
      }
    )

    return () => unsub()
  }, [orgId, orgName])

  return { branding, loading }
}
