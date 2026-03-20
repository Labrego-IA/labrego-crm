import { useState, useEffect } from 'react'
import { db } from '@/lib/firebaseClient'
import { doc, getDoc, onSnapshot } from 'firebase/firestore'
import { useCrmUser } from '@/contexts/CrmUserContext'
import { useProposalDataAccess } from './useProposalDataAccess'
import type { ProposalCustomField } from '@/types/proposalCustomField'

export function useProposalCustomFields() {
  const { orgId } = useCrmUser()
  const { settingsOwnerId, loading: accessLoading } = useProposalDataAccess()
  const [fields, setFields] = useState<ProposalCustomField[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!orgId || accessLoading || !settingsOwnerId) {
      if (!accessLoading) setLoading(false)
      return
    }

    let unsub: (() => void) | undefined

    const init = async () => {
      const userRef = doc(db, 'organizations', orgId, 'userSettings', settingsOwnerId, 'proposals', 'customFields')
      const userSnap = await getDoc(userRef)

      const ref = userSnap.exists()
        ? userRef
        : doc(db, 'organizations', orgId, 'settings', 'proposalCustomFields')

      unsub = onSnapshot(
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
    }

    init().catch((error) => {
      console.error('Error initializing custom fields listener:', error)
      setLoading(false)
    })

    return () => unsub?.()
  }, [orgId, settingsOwnerId, accessLoading])

  return { fields, loading }
}
