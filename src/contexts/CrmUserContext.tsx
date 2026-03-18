'use client'

import { createContext, useContext, useMemo, ReactNode } from 'react'
import type { OrgMember } from '@/types/organization'
import type { PlanId } from '@/types/plan'
import { useImpersonation } from './ImpersonationContext'

interface CrmUserContextType {
  userEmail: string | null
  userUid: string | null
  userPhoto: string | null
  orgId: string | null
  orgName: string | null
  orgPlan: PlanId | null
  orgCreatedAt: string | null
  member: OrgMember | null
}

const CrmUserContext = createContext<CrmUserContextType>({
  userEmail: null,
  userUid: null,
  userPhoto: null,
  orgId: null,
  orgName: null,
  orgPlan: null,
  orgCreatedAt: null,
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
  orgCreatedAt = null,
  member = null,
}: CrmUserContextType & { children: ReactNode }) {
  const { impersonatedMember, isImpersonating } = useImpersonation()

  const value = useMemo(
    () => ({
      userEmail: isImpersonating ? impersonatedMember!.email : userEmail,
      userUid: isImpersonating ? impersonatedMember!.userId : userUid,
      userPhoto: isImpersonating ? (impersonatedMember!.photoUrl || null) : userPhoto,
      orgId,
      orgName,
      orgPlan,
      orgCreatedAt,
      member: isImpersonating ? impersonatedMember : member,
    }),
    [userEmail, userUid, userPhoto, orgId, orgName, orgPlan, orgCreatedAt, member, impersonatedMember, isImpersonating],
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
