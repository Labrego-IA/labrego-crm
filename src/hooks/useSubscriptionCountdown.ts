'use client'

import { useCrmUser } from '@/contexts/CrmUserContext'

const FREE_TRIAL_DAYS = 7
const PAID_PLAN_DAYS = 30

export interface SubscriptionCountdown {
  days: number
  hours: number
  minutes: number
  expired: boolean
  planLabel: string
}

export function useSubscriptionCountdown(currentTime: Date): SubscriptionCountdown | null {
  const { orgPlan, orgCreatedAt, orgPlanSubscribedAt } = useCrmUser()

  if (!orgPlan || !orgCreatedAt) return null

  const isFreePlan = orgPlan === 'free'
  const trialDays = isFreePlan ? FREE_TRIAL_DAYS : PAID_PLAN_DAYS

  // Free: conta a partir do createdAt da org
  // Pago: conta a partir do planSubscribedAt (fallback para createdAt se não existir)
  const startDate = isFreePlan
    ? orgCreatedAt
    : (orgPlanSubscribedAt || orgCreatedAt)

  const expiresAt = new Date(startDate)
  expiresAt.setDate(expiresAt.getDate() + trialDays)

  const diffMs = expiresAt.getTime() - currentTime.getTime()

  const planLabel = isFreePlan ? 'Teste gratuito' : 'Assinatura'

  if (diffMs <= 0) {
    return { days: 0, hours: 0, minutes: 0, expired: true, planLabel }
  }

  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))

  return { days, hours, minutes, expired: false, planLabel }
}
