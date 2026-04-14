'use client'

import { useState, useEffect, useCallback } from 'react'
import { useCrmUser } from '@/contexts/CrmUserContext'
import { useProposalDataAccess } from '@/hooks/useProposalDataAccess'
import { db } from '@/lib/firebaseClient'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { toast } from 'sonner'
import type { ProposalConfig } from '@/types/proposalConfig'
import { DEFAULT_PROPOSAL_CONFIG } from '@/types/proposalConfig'
import { Pencil1Icon } from '@radix-ui/react-icons'

interface PropostasConfigTabProps {
  onDirtyChange?: (dirty: boolean) => void
  onResetRef?: (resetFn: () => void) => void
}

export default function PropostasConfigTab({ onDirtyChange, onResetRef }: PropostasConfigTabProps) {
  const { orgId } = useCrmUser()
  const { settingsOwnerId, loading: accessLoading } = useProposalDataAccess()
  const [form, setForm] = useState<ProposalConfig>(DEFAULT_PROPOSAL_CONFIG)
  const [initialForm, setInitialForm] = useState<ProposalConfig>(DEFAULT_PROPOSAL_CONFIG)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [isEditing, setIsEditing] = useState(false)

  const resetForm = useCallback(() => {
    setForm(initialForm)
    setIsEditing(false)
    onDirtyChange?.(false)
  }, [initialForm, onDirtyChange])

  useEffect(() => {
    onResetRef?.(resetForm)
  }, [onResetRef, resetForm])

  useEffect(() => {
    if (!orgId || accessLoading || !settingsOwnerId) return
    const load = async () => {
      try {
        const userDoc = doc(db, 'organizations', orgId, 'userSettings', settingsOwnerId, 'proposals', 'config')
        let snap = await getDoc(userDoc)
        if (!snap.exists()) {
          snap = await getDoc(doc(db, 'organizations', orgId, 'settings', 'proposalConfig'))
        }
        if (snap.exists()) {
          const loaded = { ...DEFAULT_PROPOSAL_CONFIG, ...(snap.data() as Partial<ProposalConfig>) }
          setForm(loaded)
          setInitialForm(loaded)
        }
      } catch (error) {
        console.error('Error loading config:', error)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [orgId, accessLoading, settingsOwnerId])

  const hasChanges = useCallback(() => {
    return (Object.keys(initialForm) as (keyof ProposalConfig)[]).some(
      key => form[key] !== initialForm[key]
    )
  }, [form, initialForm])

  useEffect(() => {
    if (isEditing) {
      onDirtyChange?.(hasChanges())
    }
  }, [form, isEditing, hasChanges, onDirtyChange])

  const handleSave = async () => {
    if (!orgId || !settingsOwnerId) return
    setSaving(true)
    try {
      await setDoc(
        doc(db, 'organizations', orgId, 'userSettings', settingsOwnerId, 'proposals', 'config'),
        form,
        { merge: true },
      )
      setInitialForm(form)
      setIsEditing(false)
      onDirtyChange?.(false)
      toast.success('Configuracoes salvas!')
    } catch (error) {
      console.error('Save error:', error)
      toast.error('Erro ao salvar configuracoes.')
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    setForm(initialForm)
    setIsEditing(false)
    onDirtyChange?.(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-3 border-primary-200 border-t-primary-600" />
      </div>
    )
  }

  const inputDisabledClass = !isEditing
    ? 'bg-gray-50 dark:bg-white/5 text-gray-500 dark:text-slate-400 cursor-not-allowed'
    : ''

  return (
    <div className="space-y-6">
      {/* Header com botao Editar */}
      <div className="flex items-center justify-between">
        <div />
        {!isEditing && (
          <button
            onClick={() => setIsEditing(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-primary-700 bg-primary-50 hover:bg-primary-100 border border-primary-200 transition-colors"
          >
            <Pencil1Icon className="w-4 h-4" />
            Editar
          </button>
        )}
      </div>

      {/* Premissas de Desconto */}
      <section className="rounded-2xl bg-white dark:bg-surface-dark border border-gray-200 dark:border-white/10 p-6 space-y-5">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider">Premissas de Desconto</h3>
        <p className="text-xs text-gray-400 dark:text-slate-500">
          Esses valores sao usados como padrao ao criar uma nova proposta. O vendedor pode ajusta-los por proposta.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
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
                disabled={!isEditing}
                className={`w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/40 ${inputDisabledClass}`}
              />
              <span className="text-sm text-gray-500 dark:text-slate-400">%</span>
            </div>
            <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">Aplicado quando ha mais de N produtos</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
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
                disabled={!isEditing}
                className={`w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/40 ${inputDisabledClass}`}
              />
              <span className="text-sm text-gray-500 dark:text-slate-400">%</span>
            </div>
            <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">Para variante &quot;padrao&quot; na etapa de levantamento</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
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
                disabled={!isEditing}
                className={`w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/40 ${inputDisabledClass}`}
              />
              <span className="text-sm text-gray-500 dark:text-slate-400">%</span>
            </div>
            <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">Para variante &quot;padrao&quot; na etapa de testes</p>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
            Qtd. minima de produtos para desconto de desenvolvimento
          </label>
          <input
            type="number"
            min={1}
            value={form.minProductsForDevDiscount}
            onChange={e => setForm(prev => ({ ...prev, minProductsForDevDiscount: parseInt(e.target.value) || 2 }))}
            disabled={!isEditing}
            className={`w-32 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/40 ${inputDisabledClass}`}
          />
        </div>
      </section>

      {/* Condicoes de Pagamento */}
      <section className="rounded-2xl bg-white dark:bg-surface-dark border border-gray-200 dark:border-white/10 p-6 space-y-5">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider">Condicoes de Pagamento</h3>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Condicoes padrao</label>
          <textarea
            value={form.defaultPaymentTerms}
            onChange={e => setForm(prev => ({ ...prev, defaultPaymentTerms: e.target.value }))}
            placeholder="Ex: 50% na aprovacao, 50% na entrega"
            rows={3}
            disabled={!isEditing}
            className={`w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/40 resize-none ${inputDisabledClass}`}
          />
        </div>
      </section>

      {/* Botoes de acao */}
      {isEditing && (
        <div className="flex justify-end gap-3">
          <button
            onClick={handleCancel}
            disabled={saving}
            className="px-5 py-2.5 rounded-xl text-sm font-medium text-gray-700 dark:text-slate-300 bg-white dark:bg-surface-dark border border-gray-300 hover:bg-gray-50 dark:bg-white/5 disabled:opacity-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2.5 bg-primary-600 text-white rounded-xl text-sm font-medium hover:bg-primary-700 disabled:opacity-50 transition-colors shadow-sm"
          >
            {saving ? 'Salvando...' : 'Salvar Configuracoes'}
          </button>
        </div>
      )}
    </div>
  )
}
