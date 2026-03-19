'use client'

import { useState, useCallback } from 'react'
import { useFreePlanExpiration } from '@/hooks/useFreePlanExpiration'
import { usePermissions } from '@/hooks/usePermissions'

export function useFreePlanGuard() {
  const { isFreePlan, isExpired } = useFreePlanExpiration()
  const { role } = usePermissions()
  const [showDialog, setShowDialog] = useState(false)

  // Only block when free plan is expired (not during active 7-day trial)
  const isBlocked = isFreePlan && isExpired && role !== 'admin'

  const guard = useCallback(
    (action: () => void) => {
      if (isBlocked) {
        setShowDialog(true)
      } else {
        action()
      }
    },
    [isBlocked],
  )

  const closeDialog = useCallback(() => {
    setShowDialog(false)
  }, [])

  return { guard, showDialog, closeDialog, isBlocked }
}
