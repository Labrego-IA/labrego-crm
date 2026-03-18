'use client'

import { useState, useEffect, useMemo } from 'react'
import { useCrmUser } from '@/contexts/CrmUserContext'
import { db } from '@/lib/firebaseClient'
import { collection, onSnapshot, query, where, addDoc, doc, updateDoc, deleteDoc } from 'firebase/firestore'
import PlanGate from '@/components/PlanGate'
import { toast } from 'sonner'
import {
  type AutomationTrigger,
  type AutomationLog,
  type TriggerEventType,
  type TriggerActionType,
  type TriggerAction,
  type TriggerCondition,
  EVENT_TYPE_LABELS,
  ACTION_TYPE_LABELS,
} from '@/types/automation'
import {
  PlusIcon,
  BoltIcon,
  TrashIcon,
  PencilIcon,
  PlayIcon,
  PauseIcon,
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline'
import NoOrgMessage from '@/components/NoOrgMessage'

/* ======================== Component ======================== */

function TriggersPageContent() {
  const { orgId, userUid, userEmail } = useCrmUser()

  const [triggers, setTriggers] = useState<AutomationTrigger[]>([])
  const [logs, setLogs] = useState<AutomationLog[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'triggers' | 'logs'>('triggers')

  // Form state
  const [formName, setFormName] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [formEventType, setFormEventType] = useState<TriggerEventType>('stage_changed')
  const [formConditions, setFormConditions] = useState<TriggerCondition[]>([])
  const [formActions, setFormActions] = useState<TriggerAction[]>([{ type: 'send_notification', notificationMessage: '' }])
  const [formInactiveDays, setFormInactiveDays] = useState(7)
  const [formFromStageId, setFormFromStageId] = useState('')
  const [formToStageId, setFormToStageId] = useState('')
  const [saving, setSaving] = useState(false)

  // When orgId is not available, stop loading immediately
  useEffect(() => {
    if (!orgId) setLoading(false)
  }, [orgId])

  /* ---- Real-time subscriptions ---- */
  useEffect(() => {
    if (!orgId) return

    const triggersQ = query(collection(db, 'automationTriggers'), where('orgId', '==', orgId))
    const unsubTriggers = onSnapshot(triggersQ, (snap) => {
      setTriggers(snap.docs.map((d) => ({ id: d.id, ...d.data() })) as AutomationTrigger[])
      setLoading(false)
    }, (err) => { console.error('Triggers listener error:', err); setLoading(false) })

    const logsQ = query(collection(db, 'automationLogs'), where('orgId', '==', orgId))
    const unsubLogs = onSnapshot(logsQ, (snap) => {
      const items = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as AutomationLog[]
      setLogs(items.sort((a, b) => b.executedAt.localeCompare(a.executedAt)).slice(0, 100))
    }, (err) => { console.error('Automation logs listener error:', err) })

    return () => { unsubTriggers(); unsubLogs() }
  }, [orgId])

  /* ---- Helpers ---- */
  const resetForm = () => {
    setFormName('')
    setFormDescription('')
    setFormEventType('stage_changed')
    setFormConditions([])
    setFormActions([{ type: 'send_notification', notificationMessage: '' }])
    setFormInactiveDays(7)
    setFormFromStageId('')
    setFormToStageId('')
    setEditingId(null)
  }

  const openEditForm = (t: AutomationTrigger) => {
    setFormName(t.name)
    setFormDescription(t.description)
    setFormEventType(t.eventType)
    setFormConditions(t.conditions || [])
    setFormActions(t.actions || [])
    setFormInactiveDays(t.inactiveDays || 7)
    setFormFromStageId(t.fromStageId || '')
    setFormToStageId(t.toStageId || '')
    setEditingId(t.id)
    setShowForm(true)
  }

  /* ---- CRUD ---- */
  const handleSave = async () => {
    if (!orgId || !formName.trim()) return
    setSaving(true)
    try {
      const data = {
        orgId,
        name: formName.trim(),
        description: formDescription.trim(),
        eventType: formEventType,
        conditions: formConditions,
        actions: formActions,
        isActive: true,
        inactiveDays: formEventType === 'lead_inactive_days' ? formInactiveDays : null,
        fromStageId: formEventType === 'stage_changed' ? formFromStageId || null : null,
        toStageId: formEventType === 'stage_changed' ? formToStageId || null : null,
        updatedAt: new Date().toISOString(),
      }

      if (editingId) {
        await updateDoc(doc(db, 'automationTriggers', editingId), data)
        toast.success('Trigger atualizado')
      } else {
        await addDoc(collection(db, 'automationTriggers'), {
          ...data,
          createdAt: new Date().toISOString(),
          createdBy: userUid || '',
          createdByName: userEmail || '',
          executionCount: 0,
        })
        toast.success('Trigger criado')
      }
      setShowForm(false)
      resetForm()
    } catch (error) {
      console.error('Error saving trigger:', error)
      toast.error('Erro ao salvar trigger')
    }
    setSaving(false)
  }

  const toggleActive = async (id: string, current: boolean) => {
    try {
      await updateDoc(doc(db, 'automationTriggers', id), { isActive: !current, updatedAt: new Date().toISOString() })
      toast.success(current ? 'Trigger desativado' : 'Trigger ativado')
    } catch (error) {
      console.error('Error toggling trigger:', error)
    }
  }

  const deleteTrigger = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'automationTriggers', id))
      toast.success('Trigger excluído')
    } catch (error) {
      console.error('Error deleting trigger:', error)
    }
  }

  /* ---- Actions form helpers ---- */
  const updateAction = (idx: number, updates: Partial<TriggerAction>) => {
    setFormActions((prev) => prev.map((a, i) => (i === idx ? { ...a, ...updates } : a)))
  }

  const addAction = () => {
    setFormActions((prev) => [...prev, { type: 'send_notification', notificationMessage: '' }])
  }

  const removeAction = (idx: number) => {
    setFormActions((prev) => prev.filter((_, i) => i !== idx))
  }

  /* ======================== Render ======================== */

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-200 border-t-primary-600" />
      </div>
    )
  }

  if (!orgId) return <NoOrgMessage />

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Automações — Triggers</h1>
          <p className="text-sm text-slate-500">Configure ações automáticas baseadas em eventos</p>
        </div>
        <button
          onClick={() => { resetForm(); setShowForm(true) }}
          className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors"
        >
          <PlusIcon className="h-4 w-4" />
          Novo Trigger
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1">
        <button
          onClick={() => setActiveTab('triggers')}
          className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
            activeTab === 'triggers' ? 'bg-primary-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          Triggers ({triggers.length})
        </button>
        <button
          onClick={() => setActiveTab('logs')}
          className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
            activeTab === 'logs' ? 'bg-primary-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          Logs ({logs.length})
        </button>
      </div>

      {/* Triggers list */}
      {activeTab === 'triggers' && (
        <div className="space-y-3">
          {triggers.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center">
              <BoltIcon className="h-10 w-10 text-slate-300 mx-auto mb-3" />
              <p className="text-sm text-slate-500">Nenhum trigger configurado</p>
              <p className="text-xs text-slate-400 mt-1">Crie seu primeiro trigger para automatizar ações</p>
            </div>
          ) : (
            triggers.map((t) => (
              <div key={t.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className={`rounded-full p-2 ${t.isActive ? 'bg-emerald-100' : 'bg-slate-100'}`}>
                      <BoltIcon className={`h-5 w-5 ${t.isActive ? 'text-emerald-600' : 'text-slate-400'}`} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-slate-900">{t.name}</h3>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${t.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                          {t.isActive ? 'Ativo' : 'Inativo'}
                        </span>
                      </div>
                      {t.description && <p className="text-xs text-slate-400 mt-0.5">{t.description}</p>}
                      <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
                        <span className="bg-slate-100 rounded px-1.5 py-0.5">{EVENT_TYPE_LABELS[t.eventType]}</span>
                        <span>{t.actions.length} ação(ões)</span>
                        {t.executionCount > 0 && <span>{t.executionCount}x executado</span>}
                        {t.lastExecutedAt && (
                          <span className="flex items-center gap-0.5">
                            <ClockIcon className="h-3 w-3" />
                            Último: {new Date(t.lastExecutedAt).toLocaleDateString('pt-BR')}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => toggleActive(t.id, t.isActive)} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors" title={t.isActive ? 'Desativar' : 'Ativar'}>
                      {t.isActive ? <PauseIcon className="h-4 w-4 text-amber-500" /> : <PlayIcon className="h-4 w-4 text-emerald-500" />}
                    </button>
                    <button onClick={() => openEditForm(t)} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors">
                      <PencilIcon className="h-4 w-4 text-slate-500" />
                    </button>
                    <button onClick={() => deleteTrigger(t.id)} className="p-1.5 hover:bg-red-50 rounded-lg transition-colors">
                      <TrashIcon className="h-4 w-4 text-red-500" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Logs list */}
      {activeTab === 'logs' && (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          {logs.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-sm text-slate-400">Nenhum log de execução ainda</p>
            </div>
          ) : (
            <div className="max-h-[600px] overflow-y-auto">
              <table className="min-w-full divide-y divide-slate-100">
                <thead className="bg-slate-50 sticky top-0">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500">Status</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500">Trigger</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500">Contato</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500">Ações</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500">Data</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {logs.map((log) => {
                    const allSuccess = log.actionsExecuted.every((a) => a.success)
                    return (
                      <tr key={log.id} className="hover:bg-slate-50">
                        <td className="px-4 py-2">
                          {allSuccess ? (
                            <CheckCircleIcon className="h-5 w-5 text-emerald-500" />
                          ) : (
                            <XCircleIcon className="h-5 w-5 text-red-500" />
                          )}
                        </td>
                        <td className="px-4 py-2">
                          <p className="text-sm text-slate-900">{log.triggerName}</p>
                          <p className="text-[10px] text-slate-400">{EVENT_TYPE_LABELS[log.eventType]}</p>
                        </td>
                        <td className="px-4 py-2 text-sm text-slate-600">{log.contactName || log.contactId}</td>
                        <td className="px-4 py-2">
                          <div className="flex flex-wrap gap-1">
                            {log.actionsExecuted.map((a, i) => (
                              <span
                                key={i}
                                className={`rounded px-1.5 py-0.5 text-[10px] ${a.success ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}
                              >
                                {ACTION_TYPE_LABELS[a.type]}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-2 text-xs text-slate-500">
                          {new Date(log.executedAt).toLocaleString('pt-BR')}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Create/Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 overflow-y-auto py-8">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-xl my-auto">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">
              {editingId ? 'Editar Trigger' : 'Novo Trigger'}
            </h3>

            <div className="space-y-4 max-h-[60vh] overflow-y-auto">
              {/* Name */}
              <label className="block">
                <span className="text-sm text-slate-600">Nome</span>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Ex: Notificar ao mudar etapa"
                  className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:ring-2 focus:ring-primary-300 outline-none"
                />
              </label>

              {/* Description */}
              <label className="block">
                <span className="text-sm text-slate-600">Descrição</span>
                <input
                  type="text"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Opcional"
                  className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:ring-2 focus:ring-primary-300 outline-none"
                />
              </label>

              {/* Event type */}
              <label className="block">
                <span className="text-sm text-slate-600">Quando</span>
                <select
                  value={formEventType}
                  onChange={(e) => setFormEventType(e.target.value as TriggerEventType)}
                  className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:ring-2 focus:ring-primary-300 outline-none"
                >
                  {Object.entries(EVENT_TYPE_LABELS).map(([val, label]) => (
                    <option key={val} value={val}>{label}</option>
                  ))}
                </select>
              </label>

              {/* Stage-specific fields */}
              {formEventType === 'stage_changed' && (
                <div className="grid grid-cols-2 gap-2">
                  <label className="block">
                    <span className="text-xs text-slate-500">De etapa (ID, opcional)</span>
                    <input
                      type="text"
                      value={formFromStageId}
                      onChange={(e) => setFormFromStageId(e.target.value)}
                      placeholder="Qualquer"
                      className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm outline-none"
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs text-slate-500">Para etapa (ID, opcional)</span>
                    <input
                      type="text"
                      value={formToStageId}
                      onChange={(e) => setFormToStageId(e.target.value)}
                      placeholder="Qualquer"
                      className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm outline-none"
                    />
                  </label>
                </div>
              )}

              {/* Inactive days */}
              {formEventType === 'lead_inactive_days' && (
                <label className="block">
                  <span className="text-sm text-slate-600">Dias de inatividade</span>
                  <input
                    type="number"
                    value={formInactiveDays}
                    onChange={(e) => setFormInactiveDays(+e.target.value)}
                    min={1}
                    className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none"
                  />
                </label>
              )}

              {/* Actions */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-slate-600">Então executar</span>
                  <button onClick={addAction} className="text-xs text-primary-600 hover:text-primary-700">
                    + Ação
                  </button>
                </div>
                <div className="space-y-2">
                  {formActions.map((action, idx) => (
                    <div key={idx} className="rounded-lg border border-slate-200 p-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <select
                          value={action.type}
                          onChange={(e) => updateAction(idx, { type: e.target.value as TriggerActionType })}
                          className="flex-1 rounded-lg border border-slate-200 px-2 py-1.5 text-sm outline-none"
                        >
                          {Object.entries(ACTION_TYPE_LABELS).map(([val, label]) => (
                            <option key={val} value={val}>{label}</option>
                          ))}
                        </select>
                        {formActions.length > 1 && (
                          <button onClick={() => removeAction(idx)} className="text-red-400 hover:text-red-600">
                            <TrashIcon className="h-4 w-4" />
                          </button>
                        )}
                      </div>

                      {action.type === 'send_notification' && (
                        <input
                          type="text"
                          value={action.notificationMessage || ''}
                          onChange={(e) => updateAction(idx, { notificationMessage: e.target.value })}
                          placeholder="Mensagem da notificação"
                          className="block w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm outline-none"
                        />
                      )}
                      {action.type === 'move_to_stage' && (
                        <input
                          type="text"
                          value={action.targetStageId || ''}
                          onChange={(e) => updateAction(idx, { targetStageId: e.target.value })}
                          placeholder="ID da etapa destino"
                          className="block w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm outline-none"
                        />
                      )}
                      {action.type === 'assign_to_user' && (
                        <input
                          type="text"
                          value={action.targetUserName || ''}
                          onChange={(e) => updateAction(idx, { targetUserName: e.target.value })}
                          placeholder="Nome do vendedor"
                          className="block w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm outline-none"
                        />
                      )}
                      {action.type === 'send_email' && (
                        <input
                          type="text"
                          value={action.emailSubject || ''}
                          onChange={(e) => updateAction(idx, { emailSubject: e.target.value })}
                          placeholder="Assunto do email"
                          className="block w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm outline-none"
                        />
                      )}
                      {action.type === 'add_tag' && (
                        <input
                          type="text"
                          value={action.tagName || ''}
                          onChange={(e) => updateAction(idx, { tagName: e.target.value })}
                          placeholder="Nome da tag"
                          className="block w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm outline-none"
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Modal actions */}
            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => { setShowForm(false); resetForm() }}
                className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={!formName.trim() || saving}
                className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors"
              >
                {saving ? 'Salvando...' : editingId ? 'Atualizar' : 'Criar trigger'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function TriggersPage() {
  return (
    <PlanGate feature="crm_automation">
      <TriggersPageContent />
    </PlanGate>
  )
}
