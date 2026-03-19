'use client'

import { useCrmUser } from '@/contexts/CrmUserContext'

const FREE_TRIAL_DAYS = 7

export function useFreePlanExpiration() {
  const { orgPlan, orgCreatedAt } = useCrmUser()

  // Users without a plan (null) are also considered free plan
  const isFreePlan = !orgPlan || orgPlan === 'free'

  if (!isFreePlan || !orgCreatedAt) {
    return { isFreePlan, isExpired: false, daysRemaining: 0 }
  }

  const createdDate = new Date(orgCreatedAt)
  const now = new Date()
  const diffMs = now.getTime() - createdDate.getTime()
  const diffDays = diffMs / (1000 * 60 * 60 * 24)
  const daysRemaining = Math.max(0, Math.ceil(FREE_TRIAL_DAYS - diffDays))
  const isExpired = diffDays >= FREE_TRIAL_DAYS

  return { isFreePlan, isExpired, daysRemaining }
}
