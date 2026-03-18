'use client'

import { ReactNode } from 'react'
import { usePlan } from '@/hooks/usePlan'
import { usePermissions } from '@/hooks/usePermissions'
import type { FeatureKey } from '@/types/plan'
import UpgradePrompt from './UpgradePrompt'

interface PlanGateProps {
  feature: FeatureKey
  children: ReactNode
  showUpgrade?: boolean
  fallback?: ReactNode
}

export default function PlanGate({ feature, children, showUpgrade = true, fallback }: PlanGateProps) {
  const { hasFeature } = usePlan()
  const { role } = usePermissions()

  // Admin always has full access to all features
  if (role === 'admin') return <>{children}</>

  if (hasFeature(feature)) return <>{children}</>

  if (fallback) return <>{fallback}</>
  if (showUpgrade) return <UpgradePrompt feature={feature} />

  return null
}
