'use client'

import { ReactNode } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { usePermissions } from '@/hooks/usePermissions'
import { ShieldCheckIcon } from '@heroicons/react/24/outline'

// Páginas que não precisam de verificação de permissão
const PUBLIC_PATHS = ['/login', '/auth/', '/reset-password', '/perfil', '/guia']

interface PageAccessGuardProps {
  children: ReactNode
}

export default function PageAccessGuard({ children }: PageAccessGuardProps) {
  const pathname = usePathname()
  const router = useRouter()
  const { canAccessPage, role, isPartner } = usePermissions()

  // Admins tem acesso total
  if (role === 'admin') return <>{children}</>

  // Usuários não-parceiros (sem invitedBy) não têm restrições de acesso
  if (!isPartner) return <>{children}</>

  // Páginas públicas/utilitárias não precisam de verificação
  const isPublicPath = PUBLIC_PATHS.some(p => pathname.startsWith(p))
  if (isPublicPath) return <>{children}</>

  // Verifica se o usuário tem acesso à página atual (apenas para parceiros)
  if (!canAccessPage(pathname)) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center p-4">
        <div className="text-center space-y-4 p-8 bg-white border border-slate-200 rounded-2xl shadow-lg max-w-md">
          <div className="flex justify-center">
            <ShieldCheckIcon className="w-16 h-16 text-red-400" />
          </div>
          <h1 className="text-2xl font-bold text-slate-800">Acesso negado</h1>
          <p className="text-slate-500">
            Você não tem permissão para acessar esta página. Entre em contato com o administrador para solicitar acesso.
          </p>
          <button
            onClick={() => router.push('/contatos')}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#13DEFC] text-slate-900 font-medium rounded-lg hover:bg-[#13DEFC]/80 transition"
          >
            Voltar ao CRM
          </button>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
