'use client'

import { ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { usePlanExpiration } from '@/hooks/usePlanExpiration'
import { useSuperAdmin } from '@/hooks/useSuperAdmin'
import { usePartnerView } from '@/contexts/PartnerViewContext'

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
  const { role, isPartner } = usePermissions()
  const { isSuperAdmin } = useSuperAdmin()
  const { activeView } = usePartnerView()

  // Super admin always has full access (platform management)
  if (isSuperAdmin) return <>{children}</>
  const isViewingAsPartner = isPartner || activeView === 'partner'

  // Super admin always has full access
  if (isSuperAdmin) return <>{children}</>

  // Org admin has full access ONLY when not viewing as partner
  if (role === 'admin' && !isViewingAsPartner) return <>{children}</>

  // Plan not expired — allow access
  if (!isExpired) return <>{children}</>

  // Partner viewing expired owner plan — block all access (no /plano since they can't upgrade)
  if (isViewingAsPartner) {
    // Allow only /perfil and /login for partners (NOT /plano)
    if (pathname === '/perfil' || pathname.startsWith('/perfil/') ||
        pathname === '/login' || pathname.startsWith('/login/')) {
      return <>{children}</>
    }

    return (
      <div className="flex items-center justify-center min-h-full px-6 py-16">
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-10 max-w-lg text-center">
          <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.832c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>

          <h2 className="text-2xl font-bold text-slate-900 mb-3">
            Plano expirado
          </h2>
          <p className="text-slate-600 mb-2">
            O plano da organizacao que voce faz parte como parceiro expirou.
          </p>
          <p className="text-slate-500 text-sm mb-4">
            Aguarde o administrador renovar o plano para liberar o seu acesso.
          </p>

          <div className="inline-flex items-center gap-2 px-5 py-3 bg-amber-50 text-amber-700 text-sm font-medium rounded-xl border border-amber-200">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Aguardando renovacao do plano
          </div>
        </div>
      </div>
    )
  }

  // Non-partner with expired plan — allow /plano, /perfil, /login
  if (isAllowedPath(pathname)) {
    return <>{children}</>
  }

  // Expired plan for non-partner - block access with upgrade option
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
