'use client'

import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import Link from 'next/link'
import { PLAN_DISPLAY } from '@/types/plan'
import type { PlanId } from '@/types/plan'

function CanceladoContent() {
  const searchParams = useSearchParams()
  const planParam = searchParams.get('plan') as PlanId | null
  const planName = planParam && PLAN_DISPLAY[planParam] ? PLAN_DISPLAY[planParam].displayName : ''

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-lg text-center">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-amber-100">
          <svg className="h-10 w-10 text-amber-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>

        <h1 className="text-2xl font-bold text-slate-900">Checkout cancelado</h1>
        <p className="mt-3 text-sm text-slate-600">
          {planName
            ? `Voce cancelou a assinatura do plano ${planName}. Nenhuma cobranca foi realizada.`
            : 'Voce cancelou o processo de checkout. Nenhuma cobranca foi realizada.'
          }
        </p>
        <p className="mt-2 text-sm text-slate-500">
          Voce pode retornar a pagina de planos e tentar novamente quando quiser.
        </p>

        <div className="mt-8 space-y-3">
          <Link
            href="/plano"
            className="block w-full rounded-xl bg-primary-600 px-4 py-3 text-sm font-bold text-white hover:bg-primary-700 transition"
          >
            Voltar para planos
          </Link>
          <Link
            href="/"
            className="block w-full rounded-xl bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-200 transition"
          >
            Ir para o painel
          </Link>
        </div>
      </div>
    </div>
  )
}

export default function CheckoutCanceladoPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-slate-50">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-200 border-t-primary-600" />
        </div>
      }
    >
      <CanceladoContent />
    </Suspense>
  )
}
