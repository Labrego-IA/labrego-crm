'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useCrmUser } from '@/contexts/CrmUserContext'
import { useProposalDataAccess } from '@/hooks/useProposalDataAccess'
import { db } from '@/lib/firebaseClient'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { toast } from 'sonner'
import { PlusIcon, TrashIcon, PencilIcon } from '@heroicons/react/24/outline'
import {
  ChevronUpIcon,
  ChevronDownIcon,
} from '@heroicons/react/20/solid'
import Modal from '@/components/Modal'
import ConfirmCloseDialog from '@/components/ConfirmCloseDialog'
import type {
  ProposalCustomField,
  ProposalCustomFieldType,
  ProposalCustomFieldPosition,
} from '@/types/proposalCustomField'

const FIELD_TYPES: { value: ProposalCustomFieldType; label: string }[] = [
  { value: 'text', label: 'Texto curto' },
  { value: 'number', label: 'Numero' },
  { value: 'textarea', label: 'Texto longo' },
  { value: 'select', label: 'Selecao (dropdown)' },
  { value: 'checkbox', label: 'Checkbox (Sim/Nao)' },
]

const POSITIONS: { value: ProposalCustomFieldPosition; label: string }[] = [
  { value: 'after_context', label: 'Apos Contexto' },
  { value: 'after_products', label: 'Apos Produtos' },
  { value: 'after_observations', label: 'Apos Observacoes' },
  { value: 'after_payment', label: 'Apos Pagamento' },
]

const DEFAULT_SECTIONS = [
  { label: 'Nome da Proposta', position: 'header' },
  { label: 'Contexto', position: 'context' },
  { label: 'Produtos (tabela)', position: 'products' },
  { label: 'Observacoes Adicionais', position: 'observations' },
  { label: 'Forma de Pagamento + Desconto', position: 'payment' },
]

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
}

type EditingField = Omit<ProposalCustomField, 'id' | 'order'> & {
  id?: string
  optionsText?: string
}

const EMPTY_FIELD: EditingField = {
  key: '',
  label: '',
  type: 'text',
  required: false,
  position: 'after_context',
  optionsText: '',
}

export default function PropostasFieldsTab() {
  const { orgId } = useCrmUser()
  const { settingsOwnerId, loading: accessLoading } = useProposalDataAccess()
  const [fields, setFields] = useState<ProposalCustomField[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Modal state
  const [showModal, setShowModal] = useState(false)
  const [editingField, setEditingField] = useState<EditingField>(EMPTY_FIELD)
  const initialFieldRef = useRef(JSON.stringify(EMPTY_FIELD))
  const [showConfirmClose, setShowConfirmClose] = useState(false)
  const [deletingFieldId, setDeletingFieldId] = useState<string | null>(null)

  useEffect(() => {
    if (!orgId || accessLoading || !settingsOwnerId) return
    const load = async () => {
      try {
        const userDoc = doc(db, 'organizations', orgId, 'userSettings', settingsOwnerId, 'proposals', 'customFields')
        let snap = await getDoc(userDoc)
        if (!snap.exists()) {
          snap = await getDoc(doc(db, 'organizations', orgId, 'settings', 'proposalCustomFields'))
        }
        if (snap.exists()) {
          const data = snap.data()
          setFields(
            ((data.fields ?? []) as ProposalCustomField[]).sort(
              (a, b) => a.order - b.order
            )
          )
        }
      } catch (error) {
        console.error('Error loading custom fields:', error)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [orgId, accessLoading, settingsOwnerId])

  const saveFields = async (updated: ProposalCustomField[]) => {
    if (!orgId || !settingsOwnerId) return
    setSaving(true)
    try {
      // Remove undefined values to avoid Firestore errors
      const sanitized = updated.map((field) => {
        const clean: Record<string, unknown> = {}
        for (const [k, v] of Object.entries(field)) {
          if (v !== undefined) clean[k] = v
        }
        return clean
      })
      await setDoc(
        doc(db, 'organizations', orgId, 'userSettings', settingsOwnerId, 'proposals', 'customFields'),
        { fields: sanitized },
        { merge: true },
      )
      setFields(updated)
      toast.success('Campos salvos!')
    } catch (error) {
      console.error('Save error:', error)
      toast.error('Erro ao salvar campos.')
    } finally {
      setSaving(false)
    }
  }

  const openCreate = () => {
    setEditingField(EMPTY_FIELD)
    initialFieldRef.current = JSON.stringify(EMPTY_FIELD)
    setShowModal(true)
  }

  const openEdit = (field: ProposalCustomField) => {
    const fieldData = {
      ...field,
      optionsText: field.options?.join('\n') ?? '',
    }
    setEditingField(fieldData)
    initialFieldRef.current = JSON.stringify(fieldData)
    setShowModal(true)
  }

  const hasUnsavedChanges = useCallback(() => {
    return JSON.stringify(editingField) !== initialFieldRef.current
  }, [editingField])

  const handleCloseModal = useCallback(() => {
    if (hasUnsavedChanges()) {
      setShowConfirmClose(true)
    } else {
      setShowModal(false)
    }
  }, [hasUnsavedChanges])

  const confirmCloseModal = useCallback(() => {
    setShowConfirmClose(false)
    setShowModal(false)
  }, [])

  const handleSaveField = async () => {
    if (!editingField.label.trim()) {
      toast.error('O nome do campo e obrigatorio.')
      return
    }

    const key = editingField.key || slugify(editingField.label)
    const options =
      editingField.type === 'select'
        ? (editingField.optionsText ?? '')
            .split('\n')
            .map((s) => s.trim())
            .filter(Boolean)
        : undefined

    if (editingField.type === 'select' && (!options || options.length < 2)) {
      toast.error('Selecao precisa de pelo menos 2 opcoes.')
      return
    }

    let updated: ProposalCustomField[]

    if (editingField.id) {
      // Edit existing
      updated = fields.map((f) =>
        f.id === editingField.id
          ? {
              ...f,
              key,
              label: editingField.label.trim(),
              type: editingField.type,
              required: editingField.required,
              position: editingField.position,
              options,
            }
          : f
      )
    } else {
      // Create new
      const newField: ProposalCustomField = {
        id: crypto.randomUUID(),
        key,
        label: editingField.label.trim(),
        type: editingField.type,
        required: editingField.required,
        position: editingField.position,
        options,
        order: fields.length,
      }
      updated = [...fields, newField]
    }

    await saveFields(updated)
    setShowModal(false)
  }

  const handleDelete = async () => {
    if (!deletingFieldId) return
    const updated = fields
      .filter((f) => f.id !== deletingFieldId)
      .map((f, i) => ({ ...f, order: i }))
    await saveFields(updated)
    setDeletingFieldId(null)
  }

  const handleReorder = async (idx: number, dir: -1 | 1) => {
    const swapIdx = idx + dir
    if (swapIdx < 0 || swapIdx >= fields.length) return
    const copy = [...fields]
    const temp = copy[idx]
    copy[idx] = copy[swapIdx]
    copy[swapIdx] = temp
    const reordered = copy.map((f, i) => ({ ...f, order: i }))
    await saveFields(reordered)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Campos default (referencia) */}
      <div>
        <h3 className="text-sm font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-3">
          Campos padrao (fixos)
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {DEFAULT_SECTIONS.map((s) => (
            <div
              key={s.position}
              className="flex items-center gap-2 rounded-lg border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 px-3 py-2 text-sm text-gray-600 dark:text-slate-400"
            >
              <span className="inline-block h-2 w-2 rounded-full bg-gray-400" />
              {s.label}
            </div>
          ))}
        </div>
      </div>

      {/* Campos customizados */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">
            Campos personalizados
          </h3>
          <button
            type="button"
            onClick={openCreate}
            disabled={saving}
            className="hidden md:inline-flex items-center gap-1.5 rounded-lg bg-primary-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
          >
            <PlusIcon className="h-4 w-4" />
            Novo campo
          </button>
        </div>

        {/* Mobile: FAB flutuante */}
        <button
          onClick={openCreate}
          disabled={saving}
          className="md:hidden fixed bottom-6 right-6 z-40 flex items-center justify-center w-14 h-14 rounded-full bg-primary-600 text-white shadow-lg shadow-primary-600/30 hover:bg-primary-700 active:scale-95 transition-all disabled:opacity-50"
          aria-label="Novo campo"
        >
          <PlusIcon className="h-6 w-6" />
        </button>

        {fields.length === 0 ? (
          <div className="rounded-lg border-2 border-dashed border-gray-200 dark:border-white/10 p-8 text-center text-sm text-gray-400">
            Nenhum campo personalizado criado ainda.
          </div>
        ) : (
          <div className="space-y-2">
            {fields.map((field, idx) => (
              <div
                key={field.id}
                className="flex items-center gap-3 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-surface-dark px-4 py-3 shadow-sm"
              >
                <div className="flex flex-col gap-0.5">
                  <button
                    type="button"
                    onClick={() => handleReorder(idx, -1)}
                    disabled={idx === 0 || saving}
                    className="text-gray-400 hover:text-gray-600 dark:text-slate-400 disabled:opacity-30"
                  >
                    <ChevronUpIcon className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleReorder(idx, 1)}
                    disabled={idx === fields.length - 1 || saving}
                    className="text-gray-400 hover:text-gray-600 dark:text-slate-400 disabled:opacity-30"
                  >
                    <ChevronDownIcon className="h-4 w-4" />
                  </button>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900 dark:text-white truncate">
                      {field.label}
                    </span>
                    {field.required && (
                      <span className="text-xs text-red-500 font-medium">
                        Obrigatorio
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                    <span className="rounded bg-gray-100 dark:bg-white/10 px-1.5 py-0.5">
                      {FIELD_TYPES.find((t) => t.value === field.type)?.label ?? field.type}
                    </span>
                    <span>
                      {POSITIONS.find((p) => p.value === field.position)?.label ?? field.position}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => openEdit(field)}
                  disabled={saving}
                  className="text-gray-400 dark:text-slate-500 hover:text-primary-600 disabled:opacity-50"
                >
                  <PencilIcon className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setDeletingFieldId(field.id)}
                  disabled={saving}
                  className="text-gray-400 dark:text-slate-500 hover:text-red-600 disabled:opacity-50"
                >
                  <TrashIcon className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal */}
      <Modal
        isOpen={showModal}
        onClose={handleCloseModal}
        size="md"
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">
              {editingField.id ? 'Editar campo' : 'Novo campo'}
            </h3>
            <button
              type="button"
              onClick={handleCloseModal}
              className="text-gray-400 hover:text-gray-600 dark:text-slate-400 transition-colors"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
              Nome do campo *
            </label>
            <input
              type="text"
              value={editingField.label}
              onChange={(e) =>
                setEditingField((prev) => ({ ...prev, label: e.target.value }))
              }
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
              placeholder="Ex: Prazo de entrega"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
              Tipo do campo
            </label>
            <select
              value={editingField.type}
              onChange={(e) =>
                setEditingField((prev) => ({
                  ...prev,
                  type: e.target.value as ProposalCustomFieldType,
                }))
              }
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
            >
              {FIELD_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          {editingField.type === 'select' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                Opcoes (uma por linha)
              </label>
              <textarea
                value={editingField.optionsText}
                onChange={(e) =>
                  setEditingField((prev) => ({
                    ...prev,
                    optionsText: e.target.value,
                  }))
                }
                rows={4}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                placeholder={"Opcao 1\nOpcao 2\nOpcao 3"}
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
              Posicao no formulario
            </label>
            <select
              value={editingField.position}
              onChange={(e) =>
                setEditingField((prev) => ({
                  ...prev,
                  position: e.target.value as ProposalCustomFieldPosition,
                }))
              }
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
            >
              {POSITIONS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-slate-300">
            <input
              type="checkbox"
              checked={editingField.required}
              onChange={(e) =>
                setEditingField((prev) => ({
                  ...prev,
                  required: e.target.checked,
                }))
              }
              className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            />
            Campo obrigatorio
          </label>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={handleCloseModal}
              className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:bg-white/10"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSaveField}
              disabled={saving}
              className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
            >
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </div>
      </Modal>

      <ConfirmCloseDialog
        isOpen={showConfirmClose}
        onConfirm={confirmCloseModal}
        onCancel={() => setShowConfirmClose(false)}
      />

      <ConfirmCloseDialog
        isOpen={!!deletingFieldId}
        onConfirm={handleDelete}
        onCancel={() => setDeletingFieldId(null)}
        title="Excluir campo"
        message={`Tem certeza que deseja excluir o campo "${fields.find(f => f.id === deletingFieldId)?.label}"? Esta ação não pode ser desfeita.`}
        confirmText="Sim, excluir"
        cancelText="Cancelar"
      />
    </div>
  )
}
