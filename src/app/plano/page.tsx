'use client'

import { usePlan } from '@/hooks/usePlan'
import { PLAN_LIMITS, PLAN_OVERAGE, PLAN_DISPLAY, FEATURE_LABELS, type PlanId } from '@/types/plan'
import { toast } from 'sonner'
import EmailProviderSection from '@/components/EmailProviderSection'

/* -------------------------------- Helpers -------------------------------- */

function PlanLimitCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-50/80 border border-slate-100">
      <div className="w-8 h-8 rounded-lg bg-primary-100 text-primary-600 flex items-center justify-center flex-shrink-0">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wide">{label}</p>
        <p className="text-sm font-semibold text-slate-800 truncate">{value}</p>
      </div>
    </div>
  )
}

function PlanCard({
  planId,
  planInfo,
  isCurrent,
  currentOrder,
  allPlanKeys,
  onSelect,
}: {
  planId: string
  planInfo: { displayName: string; price: number }
  isCurrent: boolean
  currentOrder: number
  allPlanKeys: string[]
  onSelect: () => void
}) {
  const planLimits = PLAN_LIMITS[planId as PlanId]
  const planOrder = allPlanKeys.indexOf(planId)
  const isUpgrade = !isCurrent && planOrder > currentOrder
  const isDowngrade = !isCurrent && planOrder < currentOrder

  return (
    <div
      className={`rounded-xl border p-4 transition-all ${
        isCurrent
          ? 'border-2 border-primary-500 bg-primary-50 shadow-md ring-2 ring-primary-200 ring-offset-1'
          : 'border-slate-200 hover:border-primary-300 hover:shadow-sm bg-white'
      }`}
    >
      <div className="flex items-start justify-between mb-2 gap-1">
        <h4 className="text-sm font-bold text-slate-900 leading-tight">{planInfo.displayName}</h4>
        {isCurrent ? (
          <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-white bg-primary-500 px-2 py-0.5 rounded-full shadow-sm flex-shrink-0">
            <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
            Atual
          </span>
        ) : isUpgrade ? (
          <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full flex-shrink-0">
            <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 10l7-7m0 0l7 7m-7-7v18" /></svg>
            Upgrade
          </span>
        ) : isDowngrade ? (
          <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-orange-600 bg-orange-100 px-2 py-0.5 rounded-full flex-shrink-0">
            <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 14l-7 7m0 0l-7-7m7 7V3" /></svg>
            Downgrade
          </span>
        ) : null}
      </div>
      <p className="text-base font-bold text-slate-900">
        {planInfo.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
        <span className="text-xs font-normal text-slate-500">/mês</span>
      </p>
      <div className="mt-3 space-y-1.5 text-xs text-slate-600">
        <div className="flex items-center gap-1.5">
          <svg className="w-3 h-3 text-emerald-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
          <span>{planLimits.maxUsers} usuários</span>
        </div>
        <div className="flex items-center gap-1.5">
          <svg className="w-3 h-3 text-emerald-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
          <span>{planLimits.maxContacts.toLocaleString('pt-BR')} contatos</span>
        </div>
        <div className="flex items-center gap-1.5">
          <svg className="w-3 h-3 text-emerald-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
          <span>{planLimits.maxFunnels} funis</span>
        </div>
        <div className="flex items-center gap-1.5">
          <svg className="w-3 h-3 text-emerald-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
          <span>{planLimits.monthlyMinutes.toLocaleString('pt-BR')} min/mês</span>
        </div>
        <div className="flex items-center gap-1.5">
          <svg className="w-3 h-3 text-emerald-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
          <span>{planLimits.maxConcurrentAgents} agentes simultâneos</span>
        </div>
        <div className="flex items-center gap-1.5">
          <svg className="w-3 h-3 text-emerald-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
          <span>{planLimits.maxCadences === -1 ? 'Cadências ilimitadas' : `${planLimits.maxCadences} cadência${planLimits.maxCadences > 1 ? 's' : ''}`}</span>
        </div>
      </div>
      {isCurrent ? (
        <button disabled className="mt-4 w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-primary-600 bg-primary-50 border border-primary-200 cursor-not-allowed opacity-60">
          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
          Plano atual
        </button>
      ) : (
        <button
          onClick={onSelect}
          className={`mt-4 w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-colors ${
            isUpgrade
              ? 'text-white bg-primary-600 hover:bg-primary-700 border border-primary-600'
              : 'text-primary-600 bg-primary-50 border border-primary-200 hover:bg-primary-100'
          }`}
        >
          {isUpgrade ? (
            <>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" /></svg>
              Fazer upgrade
            </>
          ) : (
            <>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
              Selecionar plano
            </>
          )}
        </button>
      )}
    </div>
  )
}

const featureDetails: Record<string, { icon: React.ReactNode; description: string }> = {
  funnel: {
    icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z" /></svg>,
    description: 'Gerencie oportunidades em estágios visuais de venda',
  },
  contacts: {
    icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
    description: 'Perfil completo com histórico e dados detalhados dos clientes',
  },
  proposals: {
    icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>,
    description: 'Crie e envie propostas comerciais profissionais rapidamente',
  },
  cadence: {
    icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>,
    description: 'Sequências automáticas de follow-up e estratégia comercial',
  },
  productivity: {
    icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>,
    description: 'Métricas e dashboards de desempenho da equipe comercial',
  },
  whatsapp_plugin: {
    icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>,
    description: 'Conecte seu WhatsApp e atenda clientes direto no CRM',
  },
  email_automation: {
    icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>,
    description: 'Disparo automático de e-mails em sequências de nutrição',
  },
  crm_automation: {
    icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>,
    description: 'Automações inteligentes para mover leads no funil automaticamente',
  },
  voice_agent: {
    icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>,
    description: 'Agente de IA que realiza ligações de prospecção ativa',
  },
  whatsapp_agent: {
    icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>,
    description: 'Agente de IA que prospecta e qualifica leads via WhatsApp',
  },
  ai_reports: {
    icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>,
    description: 'Insights e análises gerados por IA sobre sua operação comercial',
  },
}

/* -------------------------------- Page ----------------------------------- */

export default function PlanoPage() {
  const { plan, limits, display } = usePlan()

  const overage = PLAN_OVERAGE[plan]
  const currentPlanOrder = PLAN_DISPLAY[plan] ? Object.keys(PLAN_DISPLAY).indexOf(plan) : -1

  const agencyPlans = Object.entries(PLAN_DISPLAY).filter(([, p]) => p.category === 'agency') as [PlanId, typeof PLAN_DISPLAY[PlanId]][]
  const directPlans = Object.entries(PLAN_DISPLAY).filter(([, p]) => p.category === 'direct') as [PlanId, typeof PLAN_DISPLAY[PlanId]][]

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6">
      <div className="space-y-6">
        {/* Current Plan Hero */}
        <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">
          <div className="relative p-6 bg-gradient-to-r from-primary-600 via-primary-500 to-accent overflow-hidden">
            <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48Y2lyY2xlIGN4PSIzMCIgY3k9IjMwIiByPSIxLjUiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4xKSIvPjwvc3ZnPg==')] opacity-40" />
            <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center flex-shrink-0">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                  </svg>
                </div>
                <div>
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-white/90 bg-white/20 px-2 py-0.5 rounded-full mb-1">
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                    Plano ativo
                  </span>
                  <h3 className="text-2xl font-bold text-white">{display.displayName}</h3>
                </div>
              </div>
              <div className="text-left sm:text-right">
                <p className="text-3xl font-bold text-white">
                  {display.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </p>
                <p className="text-sm text-white/70">por mês</p>
              </div>
            </div>
          </div>

          <div className="p-6">
            <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">Limites incluídos</h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <PlanLimitCard icon={
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
              } label="Usuários" value={`Até ${limits.maxUsers}`} />
              <PlanLimitCard icon={
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z" /></svg>
              } label="Funis" value={`Até ${limits.maxFunnels}`} />
              <PlanLimitCard icon={
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
              } label="Contatos" value={`Até ${limits.maxContacts.toLocaleString('pt-BR')}`} />
              <PlanLimitCard icon={
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
              } label="Min. mensais" value={`${limits.monthlyMinutes.toLocaleString('pt-BR')} min`} />
              <PlanLimitCard icon={
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
              } label="Agentes" value={`${limits.maxConcurrentAgents} simultâneos`} />
              <PlanLimitCard icon={
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" /></svg>
              } label="Números" value={`${limits.maxNumbers} dedicado${limits.maxNumbers > 1 ? 's' : ''}`} />
              <PlanLimitCard icon={
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
              } label="Cadências" value={limits.maxCadences === -1 ? 'Ilimitadas' : `${limits.maxCadences} cadência${limits.maxCadences > 1 ? 's' : ''}`} />
              <PlanLimitCard icon={
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
              } label="Ações mensais" value={`${limits.monthlyActions.toLocaleString('pt-BR')}`} />
            </div>

            {overage && (
              <div className="mt-5 pt-5 border-t border-slate-100">
                <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Preço excedente</h4>
                <div className="flex flex-wrap gap-3">
                  <div className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-50 border border-amber-100">
                    <svg className="w-4 h-4 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                    <div>
                      <p className="text-[10px] font-medium text-amber-600 uppercase tracking-wide">Por ação adicional</p>
                      <p className="text-sm font-bold text-amber-700">{overage.perAction.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                    </div>
                  </div>
                  <div className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-50 border border-amber-100">
                    <svg className="w-4 h-4 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                    <div>
                      <p className="text-[10px] font-medium text-amber-600 uppercase tracking-wide">Por minuto adicional</p>
                      <p className="text-sm font-bold text-amber-700">{overage.perMinute.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Features Cards */}
        <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-6">
          <h3 className="text-base font-semibold text-slate-900 mb-1 flex items-center gap-2">
            <svg className="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Funcionalidades incluídas
          </h3>
          <p className="text-sm text-slate-500 mb-5">Tudo que está disponível no seu plano atual.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {Object.entries(FEATURE_LABELS).map(([key, label]) => {
              const detail = featureDetails[key]
              return (
                <div
                  key={key}
                  className="flex items-start gap-3 p-3.5 rounded-xl bg-slate-50/80 border border-slate-100 hover:border-emerald-200 hover:bg-emerald-50/30 transition-all"
                >
                  <div className="w-9 h-9 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center flex-shrink-0">
                    {detail?.icon ?? (
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-800">{label}</p>
                    {detail?.description && (
                      <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{detail.description}</p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Plan Comparison */}
        <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-6">
          <h3 className="text-base font-semibold text-slate-900 mb-1 flex items-center gap-2">
            <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
            </svg>
            Trocar de plano
          </h3>
          <p className="text-sm text-slate-500 mb-6">
            Compare os planos e escolha o que melhor se adapta ao seu negócio.
          </p>

          {/* Agency Plans */}
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <div className="h-px flex-1 bg-slate-100" />
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-2">Para Agências</span>
              <div className="h-px flex-1 bg-slate-100" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {agencyPlans.map(([planId, planInfo]) => (
                <PlanCard
                  key={planId}
                  planId={planId}
                  planInfo={planInfo}
                  isCurrent={planId === plan}
                  currentOrder={currentPlanOrder}
                  allPlanKeys={Object.keys(PLAN_DISPLAY)}
                  onSelect={() => toast.info('Entre em contato com o suporte para trocar de plano.')}
                />
              ))}
            </div>
          </div>

          {/* Direct Plans */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="h-px flex-1 bg-slate-100" />
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-2">Para Empresas</span>
              <div className="h-px flex-1 bg-slate-100" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {directPlans.map(([planId, planInfo]) => (
                <PlanCard
                  key={planId}
                  planId={planId}
                  planInfo={planInfo}
                  isCurrent={planId === plan}
                  currentOrder={currentPlanOrder}
                  allPlanKeys={Object.keys(PLAN_DISPLAY)}
                  onSelect={() => toast.info('Entre em contato com o suporte para trocar de plano.')}
                />
              ))}
            </div>
          </div>

          {/* CTA Footer */}
          <div className="mt-6 pt-5 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-slate-700">Precisa de ajuda para escolher?</p>
              <p className="text-xs text-slate-500">Nossa equipe pode recomendar o plano ideal para o seu negócio.</p>
            </div>
            <button
              onClick={() => toast.info('Entre em contato com o suporte para trocar de plano.')}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-primary-600 hover:bg-primary-700 transition-colors shadow-sm flex-shrink-0"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
              Falar com suporte
            </button>
          </div>
        </div>

        {/* Email Provider Config */}
        <EmailProviderSection />
      </div>
    </div>
  )
}
