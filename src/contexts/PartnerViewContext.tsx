'use client'

import { createContext, useContext, useState, useCallback, ReactNode, useMemo } from 'react'
import type { OrgMember } from '@/types/organization'
import type { PlanId } from '@/types/plan'

export interface MembershipInfo {
  member: OrgMember
  orgId: string
  orgName: string
  orgPlan: PlanId
  orgCreatedAt: string | null
  orgPlanSubscribedAt: string | null
  isPartner: boolean
}

export type PartnerViewMode = 'personal' | 'partner'

interface PartnerViewContextType {
  activeView: PartnerViewMode
  activeMembership: MembershipInfo | null
  personalMembership: MembershipInfo | null
  partnerMembership: MembershipInfo | null
  hasMultipleViews: boolean
  switchView: (view: PartnerViewMode) => void
}

const PartnerViewContext = createContext<PartnerViewContextType>({
  activeView: 'personal',
  activeMembership: null,
  personalMembership: null,
  partnerMembership: null,
  hasMultipleViews: false,
  switchView: () => {},
})

export function PartnerViewProvider({
  children,
  memberships,
}: {
  children: ReactNode
  memberships: MembershipInfo[]
}) {
  const personalMembership = useMemo(
    () => memberships.find((m) => !m.isPartner) || null,
    [memberships],
  )
  const partnerMembership = useMemo(
    () => memberships.find((m) => m.isPartner) || null,
    [memberships],
  )

  const hasMultipleViews = !!personalMembership && !!partnerMembership

  // Default to personal view if available, otherwise partner
  const [activeView, setActiveView] = useState<PartnerViewMode>(
    personalMembership ? 'personal' : 'partner',
  )

  const activeMembership = useMemo(() => {
    if (activeView === 'personal' && personalMembership) return personalMembership
    if (activeView === 'partner' && partnerMembership) return partnerMembership
    // Fallback
    return personalMembership || partnerMembership || null
  }, [activeView, personalMembership, partnerMembership])

  const switchView = useCallback(
    (view: PartnerViewMode) => {
      if (view === 'personal' && personalMembership) setActiveView('personal')
      else if (view === 'partner' && partnerMembership) setActiveView('partner')
    },
    [personalMembership, partnerMembership],
  )

  const value = useMemo(
    () => ({
      activeView,
      activeMembership,
      personalMembership,
      partnerMembership,
      hasMultipleViews,
      switchView,
    }),
    [activeView, activeMembership, personalMembership, partnerMembership, hasMultipleViews, switchView],
  )

  return (
    <PartnerViewContext.Provider value={value}>
      {children}
    </PartnerViewContext.Provider>
  )
}

export function usePartnerView() {
  return useContext(PartnerViewContext)
}
