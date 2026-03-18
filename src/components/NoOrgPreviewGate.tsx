'use client'

import { ReactNode } from 'react'
import Link from 'next/link'
import { useCrmUser } from '@/contexts/CrmUserContext'

interface NoOrgPreviewGateProps {
  children: ReactNode
}

/**
 * Gate para usuarios sem organizacao/plano.
 * Mostra o conteudo da pagina por tras de um overlay semi-transparente,
 * permitindo que o usuario veja a estrutura da pagina mas sem interagir.
 */
export default function NoOrgPreviewGate({ children }: NoOrgPreviewGateProps) {
  const { orgId } = useCrmUser()

  if (orgId) {
    return <>{children}</>
  }

  return (
    <div className="relative">
      {/* Overlay */}
      <div className="absolute inset-0 z-40 bg-white/70 backdrop-blur-[1px] flex items-start justify-center pt-32">
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-8 max-w-md text-center mx-4">
          <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <h3 className="text-lg font-bold text-slate-900 mb-2">
            Assine um plano para testar nossas funcionalidades
          </h3>
          <p className="text-sm text-slate-600 mb-6">
            Escolha o plano ideal para sua empresa e tenha acesso completo a todas as ferramentas do CRM.
          </p>
          <Link
            href="/admin/plano"
            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-primary-600 to-purple-600 text-white text-sm font-semibold rounded-xl hover:from-primary-700 hover:to-purple-700 transition-all shadow-lg shadow-primary-200"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
            Ver planos disponíveis
          </Link>
        </div>
      </div>

      {/* Conteudo por tras (non-interactive) */}
      <div className="pointer-events-none select-none opacity-50 min-h-[60vh]">
        {children}
      </div>
    </div>
  )
}
