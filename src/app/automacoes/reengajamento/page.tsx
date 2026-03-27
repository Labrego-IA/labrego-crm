'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import {
  collection,
  doc,
  getDocs,
  setDoc,
  query,
  where,
  onSnapshot,
  orderBy,
} from 'firebase/firestore'
import { db } from '@/lib/firebaseClient'
import { useCrmUser } from '@/contexts/CrmUserContext'
import PlanGate from '@/components/PlanGate'
import { useFreePlanGuard } from '@/hooks/useFreePlanGuard'
import FreePlanDialog from '@/components/FreePlanDialog'
import {
  ArrowPathIcon,
  BoltIcon,
  ChatBubbleLeftRightIcon,
  CheckCircleIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  ClockIcon,
  EnvelopeIcon,
  PhoneIcon,
  PlusIcon,
  TrashIcon,
  UserGroupIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline'
import { CONTACT_METHOD_LABELS, CONTACT_METHOD_COLORS } from '@/types/cadence'
import type { ContactMethod, ReengagementConfig, ReengagementStep, ReengagementEnrollment } from '@/types/cadence'

/* ═══════════════════════════════════════════════════════════ */
/*  TYPES                                                     */
/* ═══════════════════════════════════════════════════════════ */

type Tab = 'config' | 'dashboard'

type ReengagementLog = {
  id: string
  contactId: string
  contactName: string
  stepName: string
  channel: ContactMethod
  cycle: number
  executedAt: string
}

/* ═══════════════════════════════════════════════════════════ */
/*  HELPERS                                                   */
/* ═══════════════════════════════════════════════════════════ */

const CHANNEL_ICONS: Record<ContactMethod, typeof PhoneIcon> = {
  whatsapp: ChatBubbleLeftRightIcon,
  email: EnvelopeIcon,
  phone: PhoneIcon,
  meeting: PhoneIcon,
}

function generateId() {
  return Math.random().toString(36).slice(2, 10)
}

/* ═══════════════════════════════════════════════════════════ */
/*  PAGE                                                      */
/* ═══════════════════════════════════════════════════════════ */

function ReengajamentoContent() {
  const { orgId } = useCrmUser()
  const { guard, showDialog: showFreePlanDialog, closeDialog: closeFreePlanDialog } = useFreePlanGuard()
  const [tab, setTab] = useState<Tab>('config')
  const [config, setConfig] = useState<ReengagementConfig | null>(null)
  const [enrollments, setEnrollments] = useState<ReengagementEnrollment[]>([])
  const [logs, setLogs] = useState<ReengagementLog[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // When orgId is not available, stop loading immediately
  useEffect(() => {
    if (!orgId) setLoading(false)
  }, [orgId])

  // Load config
  useEffect(() => {
    if (!orgId) return

    const configQuery = query(
      collection(db, 'reengagementConfigs'),
      where('orgId', '==', orgId),
    )
    const unsubConfig = onSnapshot(configQuery, snap => {
      if (!snap.empty) {
        const d = snap.docs[0]
        setConfig({ id: d.id, ...d.data() } as ReengagementConfig)
      } else {
        // Create default config
        setConfig({
          id: `reeng-${orgId}`,
          orgId,
          enabled: false,
          inactiveDays: 14,
          includeLost: true,
          maxCycles: 3,
          steps: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
      }
      setLoading(false)
    }, (err) => { console.error('Reengagement config listener error:', err); setLoading(false) })

    return () => unsubConfig()
  }, [orgId])

  // Load enrollments
  useEffect(() => {
    if (!orgId) return

    const enrollQuery = query(
      collection(db, 'reengagementEnrollments'),
      where('orgId', '==', orgId),
    )
    const unsub = onSnapshot(enrollQuery, snap => {
      setEnrollments(snap.docs.map(d => ({ id: d.id, ...d.data() } as ReengagementEnrollment)))
    }, (err) => { console.error('Enrollments listener error:', err) })

    return () => unsub()
  }, [orgId])

  // Load logs
  useEffect(() => {
    if (!orgId) return

    const logsQuery = query(
      collection(db, 'reengagementLogs'),
      where('orgId', '==', orgId),
      orderBy('executedAt', 'desc'),
    )
    const unsub = onSnapshot(logsQuery, snap => {
      setLogs(snap.docs.map(d => ({ id: d.id, ...d.data() } as ReengagementLog)))
    }, (err) => { console.error('Reengagement logs listener error:', err) })

    return () => unsub()
  }, [orgId])

  const saveConfig = useCallback(async (updates: Partial<ReengagementConfig>) => {
    if (!config || !orgId) return
    setSaving(true)
    try {
      const updated = { ...config, ...updates, updatedAt: new Date().toISOString() }
      const configId = config.id || `reeng-${orgId}`
      await setDoc(doc(db, 'reengagementConfigs', configId), {
        orgId,
        enabled: updated.enabled,
        inactiveDays: updated.inactiveDays,
        includeLost: updated.includeLost,
        maxCycles: updated.maxCycles,
        steps: updated.steps,
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt,
      })
      setConfig({ ...updated, id: configId })
    } catch (err) {
      console.error('Error saving reengagement config:', err)
    } finally {
      setSaving(false)
    }
  }, [config, orgId])

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50/50 p-8">
        <div className="space-y-4 animate-pulse">
          {[...Array(3)].map((_, i) => <div key={i} className="bg-white rounded-2xl h-32 border border-slate-100" />)}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50/50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-4 md:px-8 py-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <ArrowPathIcon className="w-6 h-6 text-primary-600" />
            <h1 className="text-2xl font-bold text-slate-900">Reengajamento</h1>
            {config && (
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${config.enabled ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                <span className={`w-2 h-2 rounded-full ${config.enabled ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
                {config.enabled ? 'Ativo' : 'Inativo'}
              </span>
            )}
          </div>
          {config && (
            <button
              onClick={() => guard(() => saveConfig({ enabled: !config.enabled }))}
              className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl transition-all ${config.enabled ? 'bg-red-50 text-red-700 hover:bg-red-100 border border-red-200' : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'}`}
            >
              {config.enabled ? 'Desativar' : 'Ativar reengajamento'}
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mt-4">
          <button onClick={() => setTab('config')}
            className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all ${tab === 'config' ? 'bg-primary-50 text-primary-700' : 'text-slate-500 hover:bg-slate-50'}`}>
            <BoltIcon className="w-4 h-4" /> Configuração
          </button>
          <button onClick={() => setTab('dashboard')}
            className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all ${tab === 'dashboard' ? 'bg-primary-50 text-primary-700' : 'text-slate-500 hover:bg-slate-50'}`}>
            <UserGroupIcon className="w-4 h-4" /> Dashboard
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 md:p-8">
        {tab === 'config' && config ? (
          <ConfigSection config={config} onSave={saveConfig} saving={saving} />
        ) : (
          <DashboardSection enrollments={enrollments} logs={logs} />
        )}
      </div>

      <FreePlanDialog isOpen={showFreePlanDialog} onClose={closeFreePlanDialog} />
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════ */
/*  CONFIG SECTION                                            */
/* ═══════════════════════════════════════════════════════════ */

function ConfigSection({ config, onSave, saving }: {
  config: ReengagementConfig
  onSave: (updates: Partial<ReengagementConfig>) => Promise<void>
  saving: boolean
}) {
  const [expandSteps, setExpandSteps] = useState(true)

  const addStep = () => {
    const newStep: ReengagementStep = {
      id: generateId(),
      order: config.steps.length + 1,
      name: `Step ${config.steps.length + 1}`,
      contactMethod: 'email',
      daysAfterPrevious: config.steps.length === 0 ? 0 : 3,
      isActive: true,
    }
    onSave({ steps: [...config.steps, newStep] })
  }

  const updateStep = (stepId: string, updates: Partial<ReengagementStep>) => {
    onSave({
      steps: config.steps.map(s => s.id === stepId ? { ...s, ...updates } : s),
    })
  }

  const removeStep = (stepId: string) => {
    onSave({
      steps: config.steps.filter(s => s.id !== stepId).map((s, i) => ({ ...s, order: i + 1 })),
    })
  }

  const moveStep = (stepId: string, direction: 'up' | 'down') => {
    const idx = config.steps.findIndex(s => s.id === stepId)
    if (idx === -1) return
    const newIdx = direction === 'up' ? idx - 1 : idx + 1
    if (newIdx < 0 || newIdx >= config.steps.length) return
    const arr = [...config.steps]
    ;[arr[idx], arr[newIdx]] = [arr[newIdx], arr[idx]]
    onSave({ steps: arr.map((s, i) => ({ ...s, order: i + 1 })) })
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Trigger settings */}
      <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-700 mb-4">Configurações de Trigger</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Dias de inatividade</label>
            <input
              type="number"
              value={config.inactiveDays}
              min={1}
              max={365}
              onChange={e => onSave({ inactiveDays: parseInt(e.target.value) || 14 })}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
            />
            <p className="text-xs text-slate-400 mt-1">Lead sem atividade por X dias entra na cadência</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Máx. ciclos por lead</label>
            <input
              type="number"
              value={config.maxCycles}
              min={1}
              max={10}
              onChange={e => onSave({ maxCycles: parseInt(e.target.value) || 3 })}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
            />
            <p className="text-xs text-slate-400 mt-1">Limite de tentativas de reengajamento</p>
          </div>
          <div className="flex flex-col justify-center">
            <div className="flex items-center gap-3">
              <span className="text-sm text-slate-600">Incluir leads perdidos</span>
              <button
                onClick={() => onSave({ includeLost: !config.includeLost })}
                className={`relative w-11 h-6 rounded-full transition-colors ${config.includeLost ? 'bg-emerald-500' : 'bg-slate-300'}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${config.includeLost ? 'translate-x-5' : ''}`} />
              </button>
            </div>
            <p className="text-xs text-slate-400 mt-1">Leads em etapas negativas</p>
          </div>
        </div>
      </div>

      {/* Reengagement steps */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <button
          onClick={() => setExpandSteps(!expandSteps)}
          className="w-full flex items-center justify-between p-5 hover:bg-slate-50/50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <ArrowPathIcon className="w-5 h-5 text-primary-600" />
            <h3 className="text-sm font-semibold text-slate-800">Steps de Reengajamento</h3>
            <span className="text-xs text-slate-400">{config.steps.length} steps</span>
          </div>
          {expandSteps ? <ChevronUpIcon className="w-4 h-4 text-slate-400" /> : <ChevronDownIcon className="w-4 h-4 text-slate-400" />}
        </button>

        {expandSteps && (
          <div className="px-5 pb-5 border-t border-slate-50">
            {config.steps.length === 0 ? (
              <p className="text-sm text-slate-400 py-6 text-center">
                Nenhum step configurado. Adicione steps para definir a cadência de reengajamento.
              </p>
            ) : (
              <div className="relative mt-4">
                <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-slate-200" />
                {config.steps.sort((a, b) => a.order - b.order).map((step, i) => {
                  const Icon = CHANNEL_ICONS[step.contactMethod]
                  return (
                    <div key={step.id} className="relative flex items-start gap-4 mb-4 last:mb-0">
                      <div className={`relative z-10 w-10 h-10 rounded-full flex items-center justify-center shrink-0 border-2 ${step.isActive ? 'bg-primary-50 border-primary-300' : 'bg-slate-50 border-slate-200'}`}>
                        <Icon className={`w-4 h-4 ${step.isActive ? 'text-primary-600' : 'text-slate-400'}`} />
                      </div>

                      <div className={`flex-1 p-4 rounded-xl border transition-all ${step.isActive ? 'border-slate-200 bg-white' : 'border-slate-100 bg-slate-50 opacity-60'}`}>
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 flex-wrap">
                              <input
                                value={step.name}
                                onChange={e => updateStep(step.id, { name: e.target.value })}
                                className="text-sm font-medium text-slate-800 border-0 bg-transparent p-0 focus:ring-0 focus:outline-none"
                              />
                              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${CONTACT_METHOD_COLORS[step.contactMethod]}`}>
                                {CONTACT_METHOD_LABELS[step.contactMethod]}
                              </span>
                              {step.daysAfterPrevious > 0 && (
                                <span className="inline-flex items-center gap-1 text-xs text-slate-400">
                                  <ClockIcon className="w-3 h-3" /> Após {step.daysAfterPrevious}d
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1">
                              {i > 0 && (
                                <button onClick={() => moveStep(step.id, 'up')} className="p-1 rounded hover:bg-slate-100">
                                  <ChevronUpIcon className="w-4 h-4 text-slate-400" />
                                </button>
                              )}
                              {i < config.steps.length - 1 && (
                                <button onClick={() => moveStep(step.id, 'down')} className="p-1 rounded hover:bg-slate-100">
                                  <ChevronDownIcon className="w-4 h-4 text-slate-400" />
                                </button>
                              )}
                              <button onClick={() => removeStep(step.id)} className="p-1 rounded hover:bg-red-50">
                                <TrashIcon className="w-4 h-4 text-slate-400 hover:text-red-500" />
                              </button>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                            <div>
                              <label className="block text-xs text-slate-500 mb-1">Canal</label>
                              <select
                                value={step.contactMethod}
                                onChange={e => updateStep(step.id, { contactMethod: e.target.value as ContactMethod })}
                                className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white"
                              >
                                <option value="email">Email</option>
                                <option value="whatsapp">WhatsApp</option>
                                <option value="phone">Ligação</option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-xs text-slate-500 mb-1">Após X dias</label>
                              <input
                                type="number"
                                value={step.daysAfterPrevious}
                                min={0}
                                onChange={e => updateStep(step.id, { daysAfterPrevious: parseInt(e.target.value) || 0 })}
                                className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1.5"
                              />
                            </div>
                            <div className="flex items-end">
                              <button
                                onClick={() => updateStep(step.id, { isActive: !step.isActive })}
                                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${step.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-50 text-slate-500'}`}
                              >
                                {step.isActive ? 'Ativo' : 'Inativo'}
                              </button>
                            </div>
                          </div>

                          {step.contactMethod === 'email' && (
                            <div className="space-y-2">
                              <input
                                value={step.emailSubject || ''}
                                onChange={e => updateStep(step.id, { emailSubject: e.target.value })}
                                placeholder="Assunto do email..."
                                className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1.5"
                              />
                              <textarea
                                value={step.emailBody || ''}
                                onChange={e => updateStep(step.id, { emailBody: e.target.value })}
                                placeholder="Corpo do email..."
                                rows={2}
                                className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1.5 resize-none"
                              />
                            </div>
                          )}

                          {(step.contactMethod === 'whatsapp' || step.contactMethod === 'phone') && (
                            <textarea
                              value={step.messageTemplate || ''}
                              onChange={e => updateStep(step.id, { messageTemplate: e.target.value })}
                              placeholder="Template da mensagem..."
                              rows={2}
                              className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1.5 resize-none"
                            />
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            <button
              onClick={() => guard(addStep)}
              disabled={saving}
              className="mt-4 w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-slate-200 rounded-xl text-sm text-slate-500 hover:border-primary-300 hover:text-primary-600 hover:bg-primary-50/30 transition-all"
            >
              <PlusIcon className="w-4 h-4" /> Adicionar step
            </button>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="bg-blue-50 rounded-2xl p-5 border border-blue-100">
        <h4 className="text-sm font-semibold text-blue-800 mb-2">Como funciona</h4>
        <ul className="text-xs text-blue-700 space-y-1">
          <li>• Leads inativos por {config.inactiveDays} dias entram automaticamente na cadência</li>
          {config.includeLost && <li>• Leads em etapas &quot;perdidas&quot; também entram na cadência</li>}
          <li>• Se o lead responder (nova atividade registrada), sai automaticamente da cadência</li>
          <li>• Máximo de {config.maxCycles} ciclos de reengajamento por lead</li>
          <li>• Os steps são executados na ordem configurada, com o intervalo de dias definido</li>
        </ul>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════ */
/*  DASHBOARD SECTION                                         */
/* ═══════════════════════════════════════════════════════════ */

function DashboardSection({ enrollments, logs }: {
  enrollments: ReengagementEnrollment[]
  logs: ReengagementLog[]
}) {
  const stats = useMemo(() => {
    const active = enrollments.filter(e => e.status === 'active')
    const responded = enrollments.filter(e => e.status === 'responded')
    const completed = enrollments.filter(e => e.status === 'completed')
    const maxCycles = enrollments.filter(e => e.status === 'max_cycles')
    const total = enrollments.length
    const reactivationRate = total > 0 ? ((responded.length / total) * 100).toFixed(1) : '0.0'

    const byReason = {
      inactive: enrollments.filter(e => e.reason === 'inactive').length,
      lost: enrollments.filter(e => e.reason === 'lost').length,
    }

    const byCycle: Record<number, number> = {}
    for (const e of enrollments) {
      byCycle[e.cycle] = (byCycle[e.cycle] || 0) + 1
    }

    return { active, responded, completed, maxCycles, total, reactivationRate, byReason, byCycle }
  }, [enrollments])

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
          <p className="text-xs text-slate-500">Em cadência</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{stats.active.length}</p>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
          <p className="text-xs text-slate-500">Recuperados</p>
          <p className="text-2xl font-bold text-emerald-600 mt-1">{stats.responded.length}</p>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
          <p className="text-xs text-slate-500">Taxa de reativação</p>
          <p className="text-2xl font-bold text-primary-600 mt-1">{stats.reactivationRate}%</p>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
          <p className="text-xs text-slate-500">Cadência completa</p>
          <p className="text-2xl font-bold text-slate-600 mt-1">{stats.completed.length}</p>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
          <p className="text-xs text-slate-500">Máx. ciclos atingido</p>
          <p className="text-2xl font-bold text-amber-600 mt-1">{stats.maxCycles.length}</p>
        </div>
      </div>

      {/* By reason */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-700 mb-3">Por motivo de entrada</h3>
          <div className="space-y-2">
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-slate-600 flex items-center gap-2">
                <ClockIcon className="w-4 h-4 text-amber-500" /> Inatividade
              </span>
              <span className="text-sm font-semibold text-slate-800">{stats.byReason.inactive}</span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-slate-600 flex items-center gap-2">
                <XMarkIcon className="w-4 h-4 text-red-500" /> Lead perdido
              </span>
              <span className="text-sm font-semibold text-slate-800">{stats.byReason.lost}</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-700 mb-3">Por ciclo</h3>
          <div className="space-y-2">
            {Object.entries(stats.byCycle).sort(([a], [b]) => Number(a) - Number(b)).map(([cycle, count]) => (
              <div key={cycle} className="flex items-center justify-between py-2">
                <span className="text-sm text-slate-600">Ciclo {cycle}</span>
                <span className="text-sm font-semibold text-slate-800">{count}</span>
              </div>
            ))}
            {Object.keys(stats.byCycle).length === 0 && (
              <p className="text-sm text-slate-400 py-2">Nenhum dado disponível</p>
            )}
          </div>
        </div>
      </div>

      {/* Active enrollments table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100">
          <h3 className="text-sm font-semibold text-slate-700">Leads em cadência de reengajamento</h3>
        </div>
        {stats.active.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-400">Nenhum lead em cadência ativa</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-slate-600">
                  <th className="text-left p-3 font-medium">Contato</th>
                  <th className="text-center p-3 font-medium">Motivo</th>
                  <th className="text-center p-3 font-medium">Ciclo</th>
                  <th className="text-center p-3 font-medium">Step atual</th>
                  <th className="text-center p-3 font-medium">Status</th>
                  <th className="text-right p-3 font-medium">Inscrito em</th>
                </tr>
              </thead>
              <tbody>
                {stats.active.map(e => (
                  <tr key={e.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                    <td className="p-3">
                      <a href={`/contatos/${e.contactId}`} className="text-primary-600 hover:text-primary-800 font-medium">
                        {e.contactName || e.contactId}
                      </a>
                    </td>
                    <td className="p-3 text-center">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${e.reason === 'inactive' ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700'}`}>
                        {e.reason === 'inactive' ? 'Inativo' : 'Perdido'}
                      </span>
                    </td>
                    <td className="p-3 text-center text-slate-600">{e.cycle}</td>
                    <td className="p-3 text-center text-slate-600">Step {e.currentStepIndex + 1}</td>
                    <td className="p-3 text-center">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
                        <ArrowPathIcon className="w-3 h-3" /> Ativo
                      </span>
                    </td>
                    <td className="p-3 text-right text-slate-500 text-xs">
                      {new Date(e.enrolledAt).toLocaleDateString('pt-BR')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Recovered leads */}
      {stats.responded.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-100">
            <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
              <CheckCircleIcon className="w-5 h-5 text-emerald-500" /> Leads recuperados
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-slate-600">
                  <th className="text-left p-3 font-medium">Contato</th>
                  <th className="text-center p-3 font-medium">Motivo original</th>
                  <th className="text-center p-3 font-medium">Ciclo</th>
                  <th className="text-right p-3 font-medium">Respondeu em</th>
                </tr>
              </thead>
              <tbody>
                {stats.responded.slice(0, 20).map(e => (
                  <tr key={e.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                    <td className="p-3">
                      <a href={`/contatos/${e.contactId}`} className="text-primary-600 hover:text-primary-800 font-medium">
                        {e.contactName || e.contactId}
                      </a>
                    </td>
                    <td className="p-3 text-center">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${e.reason === 'inactive' ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700'}`}>
                        {e.reason === 'inactive' ? 'Inativo' : 'Perdido'}
                      </span>
                    </td>
                    <td className="p-3 text-center text-slate-600">{e.cycle}</td>
                    <td className="p-3 text-right text-slate-500 text-xs">
                      {e.respondedAt ? new Date(e.respondedAt).toLocaleDateString('pt-BR') : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Recent logs */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100">
          <h3 className="text-sm font-semibold text-slate-700">Ações recentes de reengajamento</h3>
        </div>
        {logs.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-400">Nenhuma ação registrada</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-slate-600">
                  <th className="text-left p-3 font-medium">Contato</th>
                  <th className="text-left p-3 font-medium">Step</th>
                  <th className="text-center p-3 font-medium">Canal</th>
                  <th className="text-center p-3 font-medium">Ciclo</th>
                  <th className="text-right p-3 font-medium">Data</th>
                </tr>
              </thead>
              <tbody>
                {logs.slice(0, 30).map(log => (
                  <tr key={log.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                    <td className="p-3">
                      <a href={`/contatos/${log.contactId}`} className="text-primary-600 hover:text-primary-800 font-medium">
                        {log.contactName || log.contactId}
                      </a>
                    </td>
                    <td className="p-3 text-slate-600">{log.stepName}</td>
                    <td className="p-3 text-center">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${CONTACT_METHOD_COLORS[log.channel]}`}>
                        {CONTACT_METHOD_LABELS[log.channel]}
                      </span>
                    </td>
                    <td className="p-3 text-center text-slate-600">{log.cycle}</td>
                    <td className="p-3 text-right text-slate-500 text-xs">
                      {new Date(log.executedAt).toLocaleDateString('pt-BR')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════ */
/*  EXPORT                                                    */
/* ═══════════════════════════════════════════════════════════ */

export default function ReengajamentoPage() {
  return (
    <PlanGate feature="crm_automation">
      <ReengajamentoContent />
    </PlanGate>
  )
}
