'use client'

import { ReactNode } from 'react'
import Link from 'next/link'
import { useCrmUser } from '@/contexts/CrmUserContext'
import { usePermissions } from '@/hooks/usePermissions'
import type { FeatureKey } from '@/types/plan'
import { FEATURE_LABELS } from '@/types/plan'

interface FreePlanPreviewGateProps {
  children: ReactNode
  feature?: FeatureKey
}

/**
 * Gate para usuarios do plano free.
 * Mostra um banner de preview sobre o conteudo da pagina,
 * indicando que o usuario precisa fazer upgrade para usar a funcionalidade.
 * Para features do plano free (funnel, contacts, proposals), permite acesso normal.
 */
export default function FreePlanPreviewGate({ children, feature }: FreePlanPreviewGateProps) {
  const { orgPlan } = useCrmUser()
  const { role } = usePermissions()

  // Admin always has full access regardless of plan status
  if (role === 'admin') return <>{children}</>

  // Se nao for free, renderiza normalmente
  if (orgPlan !== 'free') {
    return <>{children}</>
  }

  // Features disponiveis no plano free: renderiza normalmente
  const freeFeatures: FeatureKey[] = ['funnel', 'contacts', 'proposals']
  if (feature && freeFeatures.includes(feature)) {
    return <>{children}</>
  }

  // Para features que nao estao no plano free, mostra preview
  const featureLabel = feature ? FEATURE_LABELS[feature] : 'esta funcionalidade'

  return (
    <div className="relative">
      {/* Overlay de preview */}
      <div className="absolute inset-0 z-40 bg-white/80 backdrop-blur-[2px] flex items-start justify-center pt-20">
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-8 max-w-md text-center mx-4">
          <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          </div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-primary-50 text-primary-700 text-xs font-semibold rounded-full mb-4">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            Modo Preview
          </div>
          <h3 className="text-lg font-bold text-slate-900 mb-2">
            {featureLabel}
          </h3>
          <p className="text-sm text-slate-600 mb-6">
            Voce esta visualizando uma previa desta funcionalidade.
            Para utilizar todos os recursos, faca o upgrade do seu plano.
          </p>
          <Link
            href="/plano"
            className="inline-flex items-center gap-2 px-6 py-3 bg-primary-600 text-white text-sm font-semibold rounded-xl hover:bg-primary-700 transition-colors shadow-sm"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
            Ver planos e fazer upgrade
          </Link>
        </div>
      </div>

      {/* Conteudo por tras (blurred, non-interactive) */}
      <div className="pointer-events-none select-none opacity-60 min-h-[60vh]">
        {children}
      </div>
    </div>
  )
}
