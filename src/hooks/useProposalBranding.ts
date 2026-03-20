'use client'

import { useState, useEffect } from 'react'
import { doc, getDoc, onSnapshot } from 'firebase/firestore'
import { db } from '@/lib/firebaseClient'
import { useCrmUser } from '@/contexts/CrmUserContext'
import { useProposalDataAccess } from './useProposalDataAccess'
import type { ProposalBranding } from '@/types/proposalBranding'
import { DEFAULT_PROPOSAL_BRANDING } from '@/types/proposalBranding'

export function useProposalBranding() {
  const { orgId, orgName } = useCrmUser()
  const { settingsOwnerId, loading: accessLoading } = useProposalDataAccess()
  const [branding, setBranding] = useState<ProposalBranding>(DEFAULT_PROPOSAL_BRANDING)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!orgId || accessLoading || !settingsOwnerId) return

    let unsub: (() => void) | undefined

    const init = async () => {
      // Check if user-specific settings exist
      const userRef = doc(db, 'organizations', orgId, 'userSettings', settingsOwnerId, 'proposals', 'branding')
      const userSnap = await getDoc(userRef)

      const ref = userSnap.exists()
        ? userRef
        : doc(db, 'organizations', orgId, 'settings', 'proposalBranding')

      unsub = onSnapshot(
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
    }

    init().catch((error) => {
      console.error('Error initializing branding listener:', error)
      setLoading(false)
    })

    return () => unsub?.()
  }, [orgId, orgName, settingsOwnerId, accessLoading])

  return { branding, loading }
}
