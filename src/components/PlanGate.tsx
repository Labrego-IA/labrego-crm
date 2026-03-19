'use client'

import { ReactNode } from 'react'
import Link from 'next/link'
import { usePlan } from '@/hooks/usePlan'
import { usePermissions } from '@/hooks/usePermissions'
import type { FeatureKey } from '@/types/plan'
import { FEATURE_LABELS, PLAN_DISPLAY, PLAN_FEATURES, type PlanId } from '@/types/plan'

interface PlanGateProps {
  feature: FeatureKey
  children: ReactNode
  showUpgrade?: boolean
  fallback?: ReactNode
}

function getMinPlanForFeature(feature: FeatureKey): PlanId {
  const plans: PlanId[] = ['agency_start', 'direct_starter', 'agency_pro', 'direct_growth', 'agency_scale', 'direct_scale']
  for (const p of plans) {
    if (PLAN_FEATURES[p]?.includes(feature)) return p
  }
  return 'direct_starter'
}

export default function PlanGate({ feature, children, showUpgrade = true, fallback }: PlanGateProps) {
  const { hasFeature, plan } = usePlan()
  const { role } = usePermissions()

  // Admin always has full access to all features
  if (role === 'admin') return <>{children}</>

  if (hasFeature(feature)) return <>{children}</>

  if (fallback) return <>{fallback}</>

  if (showUpgrade) {
    const requiredPlan = getMinPlanForFeature(feature)
    const featureLabel = FEATURE_LABELS[feature]
    const planInfo = PLAN_DISPLAY[requiredPlan]

    return (
      <div className="relative">
        {/* Upgrade banner */}
        <div className="sticky top-0 z-30 bg-gradient-to-r from-primary-600 to-primary-700 text-white px-4 py-3 shadow-md">
          <div className="flex items-center justify-between max-w-7xl mx-auto">
            <div className="flex items-center gap-3">
              <svg className="w-5 h-5 text-primary-200 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <p className="text-sm">
                <strong>{featureLabel}</strong> esta disponivel a partir do plano{' '}
                <span className="font-semibold">{planInfo.displayName}</span>.
                <span className="hidden sm:inline text-primary-200 ml-1">
                  Seu plano atual: {PLAN_DISPLAY[plan]?.displayName || plan}
                </span>
              </p>
            </div>
            <Link
              href="/plano"
              className="shrink-0 inline-flex items-center px-4 py-1.5 bg-white text-primary-700 text-sm font-medium rounded-lg hover:bg-primary-50 transition-colors"
            >
              Ver planos
            </Link>
          </div>
        </div>

        {/* Content rendered but non-interactive */}
        <div className="pointer-events-none select-none opacity-75">
          {children}
        </div>
      </div>
    )
  }

  return null
}
