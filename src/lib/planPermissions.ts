import { ALL_PAGES } from '@/types/permissions'
import { PLAN_FEATURES, type PlanId, type FeatureKey } from '@/types/plan'
import type { MemberActions } from '@/types/organization'

/**
 * Maps page-level feature names (from ALL_PAGES) to plan-level feature keys (from PLAN_FEATURES).
 * Most map 1:1, but some page features use different names than the plan features.
 */
const PAGE_TO_PLAN_FEATURE: Record<string, FeatureKey> = {
  contacts: 'contacts',
  funnel: 'funnel',
  productivity: 'productivity',
  cadence: 'cadence',
  voice_agent: 'voice_agent',
  analytics: 'ai_reports',
  automation: 'crm_automation',
  campaigns: 'email_automation',
}

/**
 * Maps actions that require a specific plan feature.
 * Actions not listed here are allowed on all plans.
 */
const ACTION_REQUIRED_FEATURE: Partial<Record<keyof MemberActions, FeatureKey>> = {
  canTriggerCalls: 'voice_agent',
  canViewReports: 'ai_reports',
}

/**
 * Returns the set of page paths allowed by a given plan.
 */
export function getPlanAllowedPages(planId: PlanId): string[] {
  const planFeatures = PLAN_FEATURES[planId] || []
  return ALL_PAGES
    .filter(page => {
      const planFeature = PAGE_TO_PLAN_FEATURE[page.feature]
      if (!planFeature) return true
      return planFeatures.includes(planFeature)
    })
    .map(page => page.path)
}

/**
 * Filters a list of page paths to only those allowed by the plan.
 */
export function filterPagesByPlan(pages: string[], planId: PlanId): string[] {
  const allowed = new Set(getPlanAllowedPages(planId))
  return pages.filter(p => allowed.has(p))
}

/**
 * Filters actions to disable those that require features not in the plan.
 */
export function filterActionsByPlan(actions: MemberActions, planId: PlanId): MemberActions {
  const planFeatures = PLAN_FEATURES[planId] || []
  const filtered = { ...actions }

  for (const [action, requiredFeature] of Object.entries(ACTION_REQUIRED_FEATURE)) {
    if (requiredFeature && !planFeatures.includes(requiredFeature)) {
      filtered[action as keyof MemberActions] = false
    }
  }

  return filtered
}

/**
 * Checks if a specific page feature is available in the plan.
 */
export function isPageFeatureAvailable(pageFeature: string, planId: PlanId): boolean {
  const planFeature = PAGE_TO_PLAN_FEATURE[pageFeature]
  if (!planFeature) return true
  const planFeatures = PLAN_FEATURES[planId] || []
  return planFeatures.includes(planFeature)
}
