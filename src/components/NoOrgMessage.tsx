'use client'

import Link from 'next/link'

export default function NoOrgMessage() {
  return (
    <div className="flex items-center justify-center min-h-[60vh] px-6">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-10 max-w-lg text-center">
        <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-5">
          <svg className="w-8 h-8 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </div>
        <h3 className="text-lg font-bold text-slate-800 mb-2">
          Assine um plano para testar nossas funcionalidades
        </h3>
        <p className="text-sm text-slate-500 mb-6">
          Escolha o plano ideal para sua empresa e tenha acesso completo a todas as ferramentas do CRM.
        </p>
        <Link
          href="/admin/plano"
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-primary-600 to-purple-600 text-white text-sm font-semibold rounded-xl hover:from-primary-700 hover:to-purple-700 transition-all shadow-lg shadow-primary-200"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
          Ver planos disponíveis
        </Link>
      </div>
    </div>
  )
}
