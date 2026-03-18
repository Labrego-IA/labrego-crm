'use client'

import { useState, useCallback } from 'react'
import { usePlan } from '@/hooks/usePlan'
import { usePermissions } from '@/hooks/usePermissions'

export function useFreePlanGuard() {
  const { plan } = usePlan()
  const { role } = usePermissions()
  const [showDialog, setShowDialog] = useState(false)

  const isBlocked = plan === 'free' && role !== 'admin'

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
