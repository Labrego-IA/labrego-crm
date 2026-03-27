'use client'

import { useState, useCallback } from 'react'
import { usePlanExpiration } from '@/hooks/usePlanExpiration'
import { useSuperAdmin } from '@/hooks/useSuperAdmin'

export function useFreePlanGuard() {
  const { isExpired } = usePlanExpiration()
  const { isSuperAdmin } = useSuperAdmin()
  const [showDialog, setShowDialog] = useState(false)

  // Block ALL users (including admin) when plan is expired — only super admin exempt
  const isBlocked = isExpired && !isSuperAdmin

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
