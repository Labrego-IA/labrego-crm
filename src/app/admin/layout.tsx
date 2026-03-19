'use client'

import { ReactNode } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { usePermissions } from '@/hooks/usePermissions'
import { useCrmUser } from '@/contexts/CrmUserContext'
import { ShieldCheckIcon } from '@heroicons/react/24/outline'

export default function AdminLayout({ children }: { children: ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const { role, canAccessPage, isImpersonating } = usePermissions()
  const { member } = useCrmUser()

  // Aguarda carregar os dados do membro
  if (!member) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-[#13DEFC]" />
      </div>
    )
  }

  // Admins tem acesso total (exceto quando impersonando); outros verificam permissão de página específica
  const hasAccess = (role === 'admin' && !isImpersonating) || canAccessPage(pathname)

  if (!hasAccess) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="text-center space-y-4 p-8 bg-slate-800 border border-slate-700 rounded-2xl shadow-lg max-w-md mx-4">
          <div className="flex justify-center">
            <ShieldCheckIcon className="w-16 h-16 text-red-400" />
          </div>
          <h1 className="text-2xl font-bold text-white">Acesso negado</h1>
          <p className="text-white/60">
            Você não tem permissão para acessar esta página.
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

  return (
    <div className="p-4 sm:p-6">
      {children}
    </div>
  )
}
