'use client'

import { useState } from 'react'
import { PLAN_DISPLAY, PLAN_LIMITS, PLAN_OVERAGE, FEATURE_LABELS, type PlanId, type PlanCategory } from '@/types/plan'
import { toast } from 'sonner'

interface CheckoutDrawerProps {
  planId: PlanId
  orgId: string
  userEmail: string
  userName?: string
  onClose: () => void
}

function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatLimit(value: number): string {
  if (value === -1) return 'Ilimitado'
  if (value >= 1000) return value.toLocaleString('pt-BR')
  return String(value)
}

export default function CheckoutDrawer({ planId, orgId, userEmail, userName, onClose }: CheckoutDrawerProps) {
  const [loading, setLoading] = useState(false)
  const [phone, setPhone] = useState('')

  const display = PLAN_DISPLAY[planId]
  const limits = PLAN_LIMITS[planId]
  const overage = PLAN_OVERAGE[planId]
  const category = display.category

  const handleCheckout = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planId,
          orgId,
          userEmail,
          userName: userName || '',
          userPhone: phone,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error || 'Erro ao iniciar checkout')
        setLoading(false)
        return
      }

      if (data.url) {
        window.location.href = data.url
      }
    } catch (err) {
      console.error('[CheckoutDrawer] error:', err)
      toast.error('Erro ao iniciar checkout. Tente novamente.')
      setLoading(false)
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-50 bg-black/50 transition-opacity" onClick={onClose} />

      {/* Drawer */}
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-lg transform bg-white shadow-2xl transition-transform duration-300 ease-out flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
              aria-label="Voltar"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
              </svg>
            </button>
            <h2 className="text-lg font-bold text-slate-900">Resumo da assinatura</h2>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
            aria-label="Fechar"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content - scrollable */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
          {/* Plan Card (cart item) */}
          <div className="rounded-xl border-2 border-primary-100 bg-gradient-to-br from-primary-50 to-white p-5">
            <div className="flex items-start justify-between">
              <div>
                <span className="inline-block rounded-full bg-primary-100 px-2.5 py-0.5 text-xs font-semibold text-primary-700 mb-2">
                  {category === 'agency' ? 'Agency' : 'Direct'}
                </span>
                <h3 className="text-xl font-bold text-slate-900">{display.displayName}</h3>
                <p className="text-sm text-slate-500 mt-1">Assinatura mensal recorrente</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-primary-600">R$ {formatCurrency(display.price)}</p>
                <p className="text-xs text-slate-400">/{category === 'agency' ? 'projeto/mes' : 'mes'}</p>
              </div>
            </div>
          </div>

          {/* What's included */}
          <div>
            <h4 className="text-sm font-semibold text-slate-700 mb-3">O que esta incluso</h4>
            <div className="space-y-2">
              <div className="flex justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
                <span className="text-slate-500">Usuarios</span>
                <span className="font-semibold text-slate-800">{limits.maxUsers}</span>
              </div>
              <div className="flex justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
                <span className="text-slate-500">Contatos</span>
                <span className="font-semibold text-slate-800">{formatLimit(limits.maxContacts)}</span>
              </div>
              <div className="flex justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
                <span className="text-slate-500">Funis</span>
                <span className="font-semibold text-slate-800">{limits.maxFunnels}</span>
              </div>
              <div className="flex justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
                <span className="text-slate-500">Acoes/mes</span>
                <span className="font-semibold text-slate-800">{formatLimit(limits.monthlyActions)}</span>
              </div>
              <div className="flex justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
                <span className="text-slate-500">Minutos falados/mes</span>
                <span className="font-semibold text-slate-800">{formatLimit(limits.monthlyMinutes)}</span>
              </div>
              <div className="flex justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
                <span className="text-slate-500">Agentes simultaneos</span>
                <span className="font-semibold text-slate-800">{limits.maxConcurrentAgents}</span>
              </div>
              <div className="flex justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
                <span className="text-slate-500">Numeros dedicados</span>
                <span className="font-semibold text-slate-800">{limits.maxNumbers}</span>
              </div>
              <div className="flex justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
                <span className="text-slate-500">Cadencias</span>
                <span className="font-semibold text-slate-800">{formatLimit(limits.maxCadences)}</span>
              </div>
            </div>
          </div>

          {/* Features */}
          <div>
            <h4 className="text-sm font-semibold text-slate-700 mb-3">Funcionalidades</h4>
            <ul className="space-y-1.5">
              {Object.values(FEATURE_LABELS).map((label) => (
                <li key={label} className="flex items-center gap-2 text-sm">
                  <svg className="h-4 w-4 text-emerald-500 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                  <span className="text-slate-600">{label}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Overage info */}
          {(overage.perAction > 0 || overage.perMinute > 0) && (
            <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3">
              <p className="text-xs font-semibold text-amber-800 mb-1">Excedentes</p>
              <p className="text-xs text-amber-700">
                R$ {formatCurrency(overage.perAction)}/acao adicional &middot; R$ {formatCurrency(overage.perMinute)}/minuto adicional
              </p>
            </div>
          )}

          {/* Phone field */}
          <div>
            <label htmlFor="checkout-phone" className="block text-sm font-medium text-slate-700 mb-1">
              Telefone (opcional)
            </label>
            <input
              id="checkout-phone"
              type="tel"
              placeholder="(11) 99999-9999"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none transition"
            />
            <p className="mt-1 text-xs text-slate-400">
              Os demais dados serao solicitados na tela de pagamento seguro.
            </p>
          </div>
        </div>

        {/* Footer - total + CTA */}
        <div className="border-t border-slate-200 px-6 py-4 space-y-3 bg-white">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-500">Total mensal</span>
            <span className="text-xl font-bold text-slate-900">R$ {formatCurrency(display.price)}</span>
          </div>

          <button
            onClick={handleCheckout}
            disabled={loading}
            className="w-full rounded-xl bg-primary-600 px-4 py-3 text-sm font-bold text-white shadow-sm hover:bg-primary-700 active:scale-[0.98] transition disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Redirecionando para pagamento...
              </span>
            ) : (
              'Ir para pagamento seguro'
            )}
          </button>

          <button
            onClick={onClose}
            className="w-full rounded-xl bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-200 transition"
          >
            Voltar para planos
          </button>

          <div className="flex items-center justify-center gap-2 pt-1">
            <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
            </svg>
            <span className="text-xs text-slate-400">Pagamento seguro processado pela Stripe</span>
          </div>
        </div>
      </div>
    </>
  )
}
