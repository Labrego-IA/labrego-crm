'use client'

import { usePathname, useRouter } from 'next/navigation'
import { usePermissions } from '@/hooks/usePermissions'
import { useImpersonation } from '@/contexts/ImpersonationContext'
import { ReactNode, useEffect } from 'react'

const PUBLIC_PATHS = ['/', '/login', '/auth', '/perfil', '/guia']

export default function PageAccessGate({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { canAccessPage, role } = usePermissions()
  const { isImpersonating } = useImpersonation()

  const isPublicPath = PUBLIC_PATHS.some(p => pathname === p || pathname.startsWith(`${p}/`))
  const isSuperAdminPath = pathname.startsWith('/super-admin')
  const hasAccess = isPublicPath || isSuperAdminPath || role === 'admin' || canAccessPage(pathname)

  if (hasAccess) {
    return <>{children}</>
  }

  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="text-center max-w-md">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
          <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
          </svg>
        </div>
        <h2 className="text-lg font-semibold text-slate-800 mb-2">Acesso Restrito</h2>
        <p className="text-sm text-slate-500 mb-4">
          {isImpersonating
            ? 'Este usuário não tem permissão para acessar esta página.'
            : 'Você não tem permissão para acessar esta página. Entre em contato com o administrador.'}
        </p>
        <button
          onClick={() => router.push('/contatos')}
          className="px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors"
        >
          Ir para página inicial
        </button>
      </div>
    </div>
  )
}
