'use client'

import { ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { useFreePlanExpiration } from '@/hooks/useFreePlanExpiration'
import { usePermissions } from '@/hooks/usePermissions'

const ALLOWED_PATHS = ['/plano', '/perfil', '/login']

function isAllowedPath(pathname: string): boolean {
  return ALLOWED_PATHS.some(p => pathname === p || pathname.startsWith(`${p}/`))
}

interface FreePlanExpiredGateProps {
  children: ReactNode
}

export default function FreePlanExpiredGate({ children }: FreePlanExpiredGateProps) {
  const pathname = usePathname()
  const { isFreePlan, isExpired } = useFreePlanExpiration()
  const { role } = usePermissions()

  // Admin always has full access regardless of plan status
  if (role === 'admin') return <>{children}</>

  if (!isFreePlan || !isExpired || isAllowedPath(pathname)) {
    return <>{children}</>
  }

  return (
    <div className="flex items-center justify-center min-h-full px-6 py-16">
      <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-10 max-w-lg text-center">
        <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <svg className="w-10 h-10 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>

        <h2 className="text-2xl font-bold text-slate-900 mb-3">
          Seu periodo de teste expirou
        </h2>

        <p className="text-slate-600 mb-2">
          O periodo gratuito de 7 dias chegou ao fim.
        </p>
        <p className="text-slate-500 text-sm mb-8">
          Para continuar usando o Voxium CRM, assine um dos nossos planos e tenha acesso completo a todas as funcionalidades.
        </p>

        <Link
          href="/plano"
          className="inline-flex items-center gap-2 px-6 py-3 bg-primary-600 text-white text-sm font-semibold rounded-xl hover:bg-primary-700 transition-colors shadow-sm"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
          Ver planos e assinar
        </Link>
      </div>
    </div>
  )
}
