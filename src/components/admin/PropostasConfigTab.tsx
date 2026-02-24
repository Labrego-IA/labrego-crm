'use client'

import { useState, useEffect } from 'react'
import { useCrmUser } from '@/contexts/CrmUserContext'
import { db } from '@/lib/firebaseClient'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { toast } from 'sonner'
import type { ProposalConfig } from '@/types/proposalConfig'
import { DEFAULT_PROPOSAL_CONFIG } from '@/types/proposalConfig'

export default function PropostasConfigTab() {
  const { orgId } = useCrmUser()
  const [form, setForm] = useState<ProposalConfig>(DEFAULT_PROPOSAL_CONFIG)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!orgId) return
    const load = async () => {
      try {
        const snap = await getDoc(doc(db, 'organizations', orgId, 'settings', 'proposalConfig'))
        if (snap.exists()) {
          setForm({ ...DEFAULT_PROPOSAL_CONFIG, ...(snap.data() as Partial<ProposalConfig>) })
        }
      } catch (error) {
        console.error('Error loading config:', error)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [orgId])

  const handleSave = async () => {
    if (!orgId) return
    setSaving(true)
    try {
      await setDoc(doc(db, 'organizations', orgId, 'settings', 'proposalConfig'), form, { merge: true })
      toast.success('Configuracoes salvas!')
    } catch (error) {
      console.error('Save error:', error)
      toast.error('Erro ao salvar configuracoes.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-3 border-primary-200 border-t-primary-600" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Premissas de Desconto */}
      <section className="rounded-2xl bg-white border border-gray-200 p-6 space-y-5">
        <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">Premissas de Desconto</h3>
        <p className="text-xs text-gray-400">
          Esses valores sao usados como padrao ao criar uma nova proposta. O vendedor pode ajusta-los por proposta.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Desc. Desenvolvimento (&gt;N prod.)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={0}
                max={100}
                step={1}
                value={form.developmentDiscount}
                onChange={e => setForm(prev => ({ ...prev, developmentDiscount: parseFloat(e.target.value) || 0 }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/40"
              />
              <span className="text-sm text-gray-500">%</span>
            </div>
            <p className="text-xs text-gray-400 mt-1">Aplicado quando ha mais de N produtos</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Desc. Levantamento Padrao
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={0}
                max={100}
                step={1}
                value={form.standardSpecDiscount}
                onChange={e => setForm(prev => ({ ...prev, standardSpecDiscount: parseFloat(e.target.value) || 0 }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/40"
              />
              <span className="text-sm text-gray-500">%</span>
            </div>
            <p className="text-xs text-gray-400 mt-1">Para variante &quot;padrao&quot; na etapa de levantamento</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Desc. Testes Padrao
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={0}
                max={100}
                step={1}
                value={form.standardTestDiscount}
                onChange={e => setForm(prev => ({ ...prev, standardTestDiscount: parseFloat(e.target.value) || 0 }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/40"
              />
              <span className="text-sm text-gray-500">%</span>
            </div>
            <p className="text-xs text-gray-400 mt-1">Para variante &quot;padrao&quot; na etapa de testes</p>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Qtd. minima de produtos para desconto de desenvolvimento
          </label>
          <input
            type="number"
            min={1}
            value={form.minProductsForDevDiscount}
            onChange={e => setForm(prev => ({ ...prev, minProductsForDevDiscount: parseInt(e.target.value) || 2 }))}
            className="w-32 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/40"
          />
        </div>
      </section>

      {/* Condicoes de Pagamento */}
      <section className="rounded-2xl bg-white border border-gray-200 p-6 space-y-5">
        <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">Condicoes de Pagamento</h3>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Condicoes padrao</label>
          <textarea
            value={form.defaultPaymentTerms}
            onChange={e => setForm(prev => ({ ...prev, defaultPaymentTerms: e.target.value }))}
            placeholder="Ex: 50% na aprovacao, 50% na entrega"
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/40 resize-none"
          />
        </div>
      </section>

      {/* Save */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2.5 bg-primary-600 text-white rounded-xl text-sm font-medium hover:bg-primary-700 disabled:opacity-50 transition-colors shadow-sm"
        >
          {saving ? 'Salvando...' : 'Salvar Configuracoes'}
        </button>
      </div>
    </div>
  )
}
