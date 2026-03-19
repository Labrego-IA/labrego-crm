'use client'

import { useState, useCallback } from 'react'
import { usePlanExpiration } from '@/hooks/usePlanExpiration'
import { usePermissions } from '@/hooks/usePermissions'

export function useFreePlanGuard() {
  const { isExpired } = usePlanExpiration()
  const { role } = usePermissions()
  const [showDialog, setShowDialog] = useState(false)

  // Block when any plan (free or paid) is expired
  const isBlocked = isExpired && role !== 'admin'

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
