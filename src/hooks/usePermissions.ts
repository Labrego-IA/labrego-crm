'use client'

import { useCrmUser } from '@/contexts/CrmUserContext'
import type { MemberActions } from '@/types/organization'
import { ALL_PAGES } from '@/types/permissions'

// Set de caminhos conhecidos para verificação exata
const KNOWN_PAGE_PATHS = new Set(ALL_PAGES.map(p => p.path))

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
    const pages = member.permissions?.pages
    if (!pages) return false

    // Se o path é uma página conhecida (definida em ALL_PAGES), exigir permissão exata
    if (KNOWN_PAGE_PATHS.has(path)) {
      return pages.includes(path)
    }

    // Para rotas dinâmicas (ex: /funil/[funnelId]), verificar se o pai está permitido
    return pages.some(p => path.startsWith(p + '/'))
  }

  const viewScope = member?.role === 'admin' ? 'all' : (member?.permissions?.viewScope ?? 'own')

  return { can, canAccessPage, viewScope, role: member?.role ?? 'viewer' }
}
