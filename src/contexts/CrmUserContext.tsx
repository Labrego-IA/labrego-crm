'use client'

import { createContext, useContext, useMemo, ReactNode } from 'react'
import type { OrgMember } from '@/types/organization'
import type { PlanId } from '@/types/plan'
import { useImpersonation } from './ImpersonationContext'
import { usePartnerView } from './PartnerViewContext'

interface CrmUserContextType {
  userEmail: string | null
  userUid: string | null
  userPhoto: string | null
  orgId: string | null
  orgName: string | null
  orgPlan: PlanId | null
  orgCreatedAt: string | null
  orgPlanSubscribedAt: string | null
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
  orgPlanSubscribedAt: null,
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
  orgPlanSubscribedAt = null,
  member = null,
}: CrmUserContextType & { children: ReactNode }) {
  const { impersonatedMember, isImpersonating } = useImpersonation()
  const { activeMembership, hasMultipleViews } = usePartnerView()

  const value = useMemo(() => {
    // Priority: Impersonation > Partner View Switch > Default
    if (isImpersonating && impersonatedMember) {
      return {
        userEmail: impersonatedMember.email,
        userUid: impersonatedMember.userId,
        userPhoto: impersonatedMember.photoUrl || null,
        orgId,
        orgName,
        orgPlan,
        orgCreatedAt,
        orgPlanSubscribedAt,
        member: impersonatedMember,
      }
    }

    if (hasMultipleViews && activeMembership) {
      return {
        userEmail,
        userUid,
        userPhoto,
        orgId: activeMembership.orgId,
        orgName: activeMembership.orgName,
        orgPlan: activeMembership.orgPlan,
        orgCreatedAt: activeMembership.orgCreatedAt,
        orgPlanSubscribedAt: activeMembership.orgPlanSubscribedAt,
        member: activeMembership.member,
      }
    }

    return {
      userEmail,
      userUid,
      userPhoto,
      orgId,
      orgName,
      orgPlan,
      orgCreatedAt,
      orgPlanSubscribedAt,
      member,
    }
  }, [
    userEmail, userUid, userPhoto, orgId, orgName, orgPlan,
    orgCreatedAt, orgPlanSubscribedAt, member,
    impersonatedMember, isImpersonating,
    activeMembership, hasMultipleViews,
  ])

  return (
    <CrmUserContext.Provider value={value}>
      {children}
    </CrmUserContext.Provider>
  )
}

export function useCrmUser() {
  return useContext(CrmUserContext)
}
