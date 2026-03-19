'use client'

import { useCrmUser } from '@/contexts/CrmUserContext'
import type { MemberActions } from '@/types/organization'

export function usePermissions() {
  const { member } = useCrmUser()

  const can = (action: keyof MemberActions): boolean => {
    if (!member) return false
    if (member.role === 'admin') return true
    return member.permissions?.actions?.[action] ?? false
  }

  const canAccessPage = (path: string): boolean => {
    if (!member) return false
    if (member.role === 'admin') return true
    return member.permissions?.pages?.some(p => path === p || path.startsWith(p + '/')) ?? false
  }

  const viewScope = member?.role === 'admin' ? 'all' : (member?.permissions?.viewScope ?? 'own')

  return { can, canAccessPage, viewScope, role: member?.role ?? 'viewer' }
}
