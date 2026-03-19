'use client'

import { useCrmUser } from '@/contexts/CrmUserContext'

const FREE_TRIAL_DAYS = 7
const PAID_PLAN_DAYS = 30

export function usePlanExpiration() {
  const { orgPlan, orgCreatedAt, orgPlanSubscribedAt } = useCrmUser()

  if (!orgPlan || !orgCreatedAt) {
    return { isExpired: false, isFreePlan: false, daysRemaining: 0 }
  }

  const isFreePlan = orgPlan === 'free'
  const trialDays = isFreePlan ? FREE_TRIAL_DAYS : PAID_PLAN_DAYS

  const startDate = isFreePlan
    ? orgCreatedAt
    : (orgPlanSubscribedAt || orgCreatedAt)

  const createdDate = new Date(startDate)
  const now = new Date()
  const diffMs = now.getTime() - createdDate.getTime()
  const diffDays = diffMs / (1000 * 60 * 60 * 24)
  const daysRemaining = Math.max(0, Math.ceil(trialDays - diffDays))
  const isExpired = diffDays >= trialDays

  return { isExpired, isFreePlan, daysRemaining }
}
