'use client'

import { createContext, useContext, useState, useCallback, ReactNode } from 'react'
import type { OrgMember } from '@/types/organization'

interface ImpersonationContextType {
  impersonatedMember: OrgMember | null
  isImpersonating: boolean
  startImpersonation: (member: OrgMember) => void
  stopImpersonation: () => void
}

const ImpersonationContext = createContext<ImpersonationContextType>({
  impersonatedMember: null,
  isImpersonating: false,
  startImpersonation: () => {},
  stopImpersonation: () => {},
})

export function ImpersonationProvider({ children }: { children: ReactNode }) {
  const [impersonatedMember, setImpersonatedMember] = useState<OrgMember | null>(null)

  const startImpersonation = useCallback((member: OrgMember) => {
    setImpersonatedMember(member)
  }, [])

  const stopImpersonation = useCallback(() => {
    setImpersonatedMember(null)
  }, [])

  return (
    <ImpersonationContext.Provider
      value={{
        impersonatedMember,
        isImpersonating: !!impersonatedMember,
        startImpersonation,
        stopImpersonation,
      }}
    >
      {children}
    </ImpersonationContext.Provider>
  )
}

export function useImpersonation() {
  return useContext(ImpersonationContext)
}
