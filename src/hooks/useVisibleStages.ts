'use client'

import { useCrmUser } from '@/contexts/CrmUserContext'

/**
 * Filters stages based on the member's funnelAccess configuration.
 * If no funnelAccess config for a funnel, all stages are visible (open by default).
 * Admins always see all stages.
 */
export function useVisibleStages(funnelId: string | undefined) {
  const { member } = useCrmUser()

  const filterStages = <T extends { id: string }>(stages: T[]): T[] => {
    if (!member || !funnelId) return stages
    if (member.role === 'admin') return stages

    const funnelAccess = (member as any).funnelAccess as
      | { funnelId: string; allStages: boolean; stageIds?: string[] }[]
      | undefined

    if (!funnelAccess || funnelAccess.length === 0) return stages

    const config = funnelAccess.find((fa) => fa.funnelId === funnelId)
    if (!config) return stages // No config = see all
    if (config.allStages) return stages

    const allowedIds = new Set(config.stageIds || [])
    return stages.filter((s) => allowedIds.has(s.id))
  }

  return { filterStages }
}
