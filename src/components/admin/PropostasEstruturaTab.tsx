'use client'

import { useState, useEffect } from 'react'
import { useCrmUser } from '@/contexts/CrmUserContext'
import { useProposalDataAccess } from '@/hooks/useProposalDataAccess'
import { db } from '@/lib/firebaseClient'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { toast } from 'sonner'
import type { ProposalStructure, PdfSection } from '@/types/proposalStructure'
import { DEFAULT_PROPOSAL_STRUCTURE, ALL_PDF_SECTIONS } from '@/types/proposalStructure'

export default function PropostasEstruturaTab() {
  const { orgId } = useCrmUser()
  const { settingsOwnerId, loading: accessLoading } = useProposalDataAccess()
  const [sections, setSections] = useState<PdfSection[]>(ALL_PDF_SECTIONS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!orgId || accessLoading || !settingsOwnerId) return
    const load = async () => {
      try {
        const userDoc = doc(db, 'organizations', orgId, 'userSettings', settingsOwnerId, 'proposals', 'structure')
        let snap = await getDoc(userDoc)
        if (!snap.exists()) {
          snap = await getDoc(doc(db, 'organizations', orgId, 'settings', 'proposalStructure'))
        }
        if (snap.exists()) {
          const data = snap.data() as Partial<ProposalStructure>
          if (data.sections?.length) {
            // Merge saved sections with ALL_PDF_SECTIONS to handle new sections added after save
            const savedKeys = new Set(data.sections.map(s => s.key))
            const merged = [
              ...data.sections,
              ...ALL_PDF_SECTIONS.filter(s => !savedKeys.has(s.key)),
            ]
            setSections(merged)
          }
        }
      } catch (error) {
        console.error('Error loading structure:', error)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [orgId, accessLoading, settingsOwnerId])

  const toggleSection = (key: string) => {
    // Cover is always required
    if (key === 'cover') return
    setSections(prev =>
      prev.map(s => (s.key === key ? { ...s, enabled: !s.enabled } : s))
    )
  }

  const moveSection = (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1
    if (newIndex < 0 || newIndex >= sections.length) return
    const updated = [...sections]
    const [moved] = updated.splice(index, 1)
    updated.splice(newIndex, 0, moved)
    setSections(updated)
  }

  const handleSave = async () => {
    if (!orgId || !settingsOwnerId) return
    setSaving(true)
    try {
      const structure: ProposalStructure = { sections }
      await setDoc(
        doc(db, 'organizations', orgId, 'userSettings', settingsOwnerId, 'proposals', 'structure'),
        structure,
        { merge: true },
      )
      toast.success('Estrutura salva!')
    } catch (error) {
      console.error('Save error:', error)
      toast.error('Erro ao salvar estrutura.')
    } finally {
      setSaving(false)
    }
  }

  const handleReset = () => {
    setSections([...DEFAULT_PROPOSAL_STRUCTURE.sections])
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
      <section className="rounded-2xl bg-white border border-gray-200 p-6 space-y-5">
        <div>
          <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">Secoes do PDF</h3>
          <p className="text-xs text-gray-400 mt-1">
            Arraste para reordenar e ative/desative as secoes que aparecem no PDF de propostas.
          </p>
        </div>

        <div className="space-y-2">
          {sections.map((section, index) => (
            <div
              key={section.key}
              className={`flex items-center gap-3 rounded-xl border px-4 py-3 transition-colors ${
                section.enabled
                  ? 'border-gray-200 bg-white'
                  : 'border-gray-100 bg-gray-50 opacity-60'
              }`}
            >
              {/* Reorder buttons */}
              <div className="flex flex-col gap-0.5">
                <button
                  type="button"
                  onClick={() => moveSection(index, 'up')}
                  disabled={index === 0}
                  className="text-gray-400 hover:text-gray-600 disabled:opacity-30 text-xs leading-none"
                >
                  &#9650;
                </button>
                <button
                  type="button"
                  onClick={() => moveSection(index, 'down')}
                  disabled={index === sections.length - 1}
                  className="text-gray-400 hover:text-gray-600 disabled:opacity-30 text-xs leading-none"
                >
                  &#9660;
                </button>
              </div>

              {/* Position number */}
              <span className="w-6 text-center text-xs font-mono text-gray-400">
                {index + 1}
              </span>

              {/* Toggle */}
              <label className="relative inline-flex cursor-pointer items-center">
                <input
                  type="checkbox"
                  checked={section.enabled}
                  onChange={() => toggleSection(section.key)}
                  disabled={section.key === 'cover'}
                  className="peer sr-only"
                />
                <div className="h-5 w-9 rounded-full bg-gray-200 peer-checked:bg-primary-500 peer-disabled:opacity-50 transition-colors after:content-[''] after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-transform peer-checked:after:translate-x-full" />
              </label>

              {/* Label */}
              <span className={`text-sm font-medium ${section.enabled ? 'text-gray-900' : 'text-gray-400'}`}>
                {section.label}
              </span>

              {section.key === 'cover' && (
                <span className="text-xs text-gray-400 ml-auto">(obrigatoria)</span>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Preview */}
      <section className="rounded-2xl bg-white border border-gray-200 p-6">
        <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-3">Preview da Estrutura</h3>
        <div className="flex flex-wrap gap-2">
          {sections
            .filter(s => s.enabled)
            .map((s, i) => (
              <div
                key={s.key}
                className="flex items-center gap-1.5 rounded-lg bg-primary-50 border border-primary-200 px-3 py-1.5 text-xs font-medium text-primary-700"
              >
                <span className="font-mono text-primary-400">{i + 1}.</span>
                {s.label}
              </div>
            ))}
        </div>
      </section>

      {/* Actions */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={handleReset}
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          Restaurar padrao
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2.5 bg-primary-600 text-white rounded-xl text-sm font-medium hover:bg-primary-700 disabled:opacity-50 transition-colors shadow-sm"
        >
          {saving ? 'Salvando...' : 'Salvar Estrutura'}
        </button>
      </div>
    </div>
  )
}
