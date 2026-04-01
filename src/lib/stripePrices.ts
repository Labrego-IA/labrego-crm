import type { PlanId } from '@/types/plan'

/**
 * Maps each PlanId to its corresponding Stripe Price ID.
 * Configure these in your .env file.
 */
export const STRIPE_PRICE_IDS: Partial<Record<PlanId, string>> = {
  agency_start: process.env.NEXT_PUBLIC_STRIPE_PRICE_AGENCY_START || '',
  agency_pro: process.env.NEXT_PUBLIC_STRIPE_PRICE_AGENCY_PRO || '',
  agency_scale: process.env.NEXT_PUBLIC_STRIPE_PRICE_AGENCY_SCALE || '',
  direct_starter: process.env.NEXT_PUBLIC_STRIPE_PRICE_DIRECT_STARTER || '',
  direct_growth: process.env.NEXT_PUBLIC_STRIPE_PRICE_DIRECT_GROWTH || '',
  direct_scale: process.env.NEXT_PUBLIC_STRIPE_PRICE_DIRECT_SCALE || '',
}

export function getStripePriceId(planId: PlanId): string | null {
  return STRIPE_PRICE_IDS[planId] || null
}

export function isPaidPlan(planId: PlanId): boolean {
  return planId !== 'free'
}
