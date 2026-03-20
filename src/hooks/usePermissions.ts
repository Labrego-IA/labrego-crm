'use client'

import { useCrmUser } from '@/contexts/CrmUserContext'
import type { MemberActions } from '@/types/organization'
import { ALL_PAGES } from '@/types/permissions'

// Set de caminhos conhecidos para verificação exata
const KNOWN_PAGE_PATHS = new Set<string>(ALL_PAGES.map(p => p.path))

export function usePermissions() {
  const { member } = useCrmUser()

  // Usuários que não são parceiros (sem invitedBy) têm acesso total
  // Restrições de acesso só se aplicam a parceiros/companheiros vinculados a outro usuário
  const isPartner = !!member?.invitedBy

  // systemRole 'admin' (definido via super-admin) concede acesso total,
  // independente do role granular definido em /admin/usuarios
  const isSystemAdmin = member?.systemRole === 'admin'

  const can = (action: keyof MemberActions): boolean => {
    if (!member) return false
    if (isSystemAdmin || member.role === 'admin' || !isPartner) return true
    return member.permissions?.actions?.[action] ?? false
  }

  const canAccessPage = (path: string): boolean => {
    if (!member) return false
    if (isSystemAdmin || member.role === 'admin' || !isPartner) return true
    const pages = member.permissions?.pages
    if (!pages) return false

    // Se o path é uma página conhecida (definida em ALL_PAGES), exigir permissão exata
    if (KNOWN_PAGE_PATHS.has(path)) {
      return pages.includes(path)
    }

    // Para rotas dinâmicas (ex: /funil/[funnelId]), verificar se o pai está permitido
    return pages.some(p => path.startsWith(p + '/'))
  }

  // systemRole 'admin' sempre vê todos os dados; 'usuario' segue as permissões granulares
  const viewScope = (isSystemAdmin || member?.role === 'admin' || !isPartner) ? 'all' : (member?.permissions?.viewScope ?? 'own')

  return { can, canAccessPage, viewScope, role: member?.role ?? 'viewer', isPartner, isSystemAdmin }
}
