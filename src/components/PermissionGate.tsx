'use client'

import { ReactNode } from 'react'
import { usePermissions } from '@/hooks/usePermissions'
import type { MemberActions } from '@/types/organization'

interface PermissionGateProps {
  action?: keyof MemberActions
  page?: string
  children: ReactNode
  fallback?: ReactNode
}

export default function PermissionGate({ action, page, children, fallback = null }: PermissionGateProps) {
  const { can, canAccessPage } = usePermissions()

  if (action && !can(action)) return <>{fallback}</>
  if (page && !canAccessPage(page)) return <>{fallback}</>

  return <>{children}</>
}
