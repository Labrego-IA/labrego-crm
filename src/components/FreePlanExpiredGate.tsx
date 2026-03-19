'use client'

import { ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { usePlanExpiration } from '@/hooks/usePlanExpiration'
import { usePermissions } from '@/hooks/usePermissions'
import { useSuperAdmin } from '@/hooks/useSuperAdmin'

const ALLOWED_PATHS = ['/plano', '/perfil', '/login']

function isAllowedPath(pathname: string): boolean {
  return ALLOWED_PATHS.some(p => pathname === p || pathname.startsWith(`${p}/`))
}

interface FreePlanExpiredGateProps {
  children: ReactNode
}

export default function FreePlanExpiredGate({ children }: FreePlanExpiredGateProps) {
  const pathname = usePathname()
  const { isExpired, isFreePlan } = usePlanExpiration()
  const { role } = usePermissions()
  const { isSuperAdmin } = useSuperAdmin()

  // Super admin and org admin always have full access
  if (isSuperAdmin || role === 'admin') return <>{children}</>

  // If plan is not expired or path is allowed, show content
  if (!isExpired || isAllowedPath(pathname)) {
    return <>{children}</>
  }

  // Expired plan - block access
  return (
    <div className="flex items-center justify-center min-h-full px-6 py-16">
      <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-10 max-w-lg text-center">
        <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <svg className="w-10 h-10 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>

        {isFreePlan ? (
          <>
            <h2 className="text-2xl font-bold text-slate-900 mb-3">
              Seu periodo de teste expirou
            </h2>
            <p className="text-slate-600 mb-2">
              O periodo gratuito de 7 dias chegou ao fim.
            </p>
            <p className="text-slate-500 text-sm mb-8">
              Para continuar usando o Voxium CRM, assine um dos nossos planos e tenha acesso completo a todas as funcionalidades.
            </p>
          </>
        ) : (
          <>
            <h2 className="text-2xl font-bold text-slate-900 mb-3">
              Sua assinatura expirou
            </h2>
            <p className="text-slate-600 mb-2">
              O periodo da sua assinatura atual chegou ao fim.
            </p>
            <p className="text-slate-500 text-sm mb-8">
              Para continuar usando o Voxium CRM, renove seu plano ou faca um upgrade para manter acesso a todas as funcionalidades.
            </p>
          </>
        )}

        <Link
          href="/plano"
          className="inline-flex items-center gap-2 px-6 py-3 bg-primary-600 text-white text-sm font-semibold rounded-xl hover:bg-primary-700 transition-colors shadow-sm"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
          {isFreePlan ? 'Ver planos e assinar' : 'Renovar ou fazer upgrade'}
        </Link>
      </div>
    </div>
  )
}
