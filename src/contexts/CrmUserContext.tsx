'use client'

import { createContext, useContext, useMemo, ReactNode } from 'react'
import type { OrgMember } from '@/types/organization'
import type { PlanId } from '@/types/plan'

interface CrmUserContextType {
  userEmail: string | null
  userUid: string | null
  userPhoto: string | null
  orgId: string | null
  orgName: string | null
  orgPlan: PlanId | null
  member: OrgMember | null
}

const CrmUserContext = createContext<CrmUserContextType>({
  userEmail: null,
  userUid: null,
  userPhoto: null,
  orgId: null,
  orgName: null,
  orgPlan: null,
  member: null,
})

export function CrmUserProvider({
  children,
  userEmail,
  userUid,
  userPhoto,
  orgId = null,
  orgName = null,
  orgPlan = null,
  member = null,
}: CrmUserContextType & { children: ReactNode }) {
  const value = useMemo(
    () => ({ userEmail, userUid, userPhoto, orgId, orgName, orgPlan, member }),
    [userEmail, userUid, userPhoto, orgId, orgName, orgPlan, member],
  )
  return (
    <CrmUserContext.Provider value={value}>
      {children}
    </CrmUserContext.Provider>
  )
}

export function useCrmUser() {
  return useContext(CrmUserContext)
}
