'use client'

import { createContext, useContext, ReactNode } from 'react'
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
  orgLoading: boolean
}

const CrmUserContext = createContext<CrmUserContextType>({
  userEmail: null,
  userUid: null,
  userPhoto: null,
  orgId: null,
  orgName: null,
  orgPlan: null,
  member: null,
  orgLoading: true,
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
  orgLoading = true,
}: CrmUserContextType & { children: ReactNode }) {
  return (
    <CrmUserContext.Provider value={{ userEmail, userUid, userPhoto, orgId, orgName, orgPlan, member, orgLoading }}>
      {children}
    </CrmUserContext.Provider>
  )
}

export function useCrmUser() {
  return useContext(CrmUserContext)
}
