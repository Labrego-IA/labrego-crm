'use client'

import { useCrmUser } from '@/contexts/CrmUserContext'
import { PLAN_FEATURES, PLAN_LIMITS, PLAN_DISPLAY, type FeatureKey, type PlanId } from '@/types/plan'

export function usePlan() {
  const { orgPlan } = useCrmUser()
  const plan = (orgPlan || 'basic') as PlanId

  const hasFeature = (feature: FeatureKey): boolean => {
    return PLAN_FEATURES[plan]?.includes(feature) ?? false
  }

  const limits = PLAN_LIMITS[plan] ?? PLAN_LIMITS.basic
  const display = PLAN_DISPLAY[plan] ?? PLAN_DISPLAY.basic

  return { plan, hasFeature, limits, display }
}
