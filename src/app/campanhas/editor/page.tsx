'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useCrmUser } from '@/contexts/CrmUserContext'
import { db } from '@/lib/firebaseClient'
import { collection, doc, getDoc, setDoc, addDoc, getDocs, query, where, orderBy, deleteDoc } from 'firebase/firestore'
import PlanGate from '@/components/PlanGate'
import { useFreePlanGuard } from '@/hooks/useFreePlanGuard'
import ConfirmCloseDialog from '@/components/ConfirmCloseDialog'
import EmailEditor from '@/components/email-editor/EmailEditor'
import { type EmailBlockData, type EmailTemplate, blocksToHtml } from '@/types/emailTemplate'
import { toast } from 'sonner'

function EditorPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const templateId = searchParams.get('templateId')
  const { orgId, userUid, userEmail } = useCrmUser()
  const { isBlocked: isPlanBlocked } = useFreePlanGuard()

  const [initialBlocks, setInitialBlocks] = useState<EmailBlockData[]>([])
  const [initialSubject, setInitialSubject] = useState('')
  const [currentTemplateId, setCurrentTemplateId] = useState<string | null>(templateId)
  const [currentTemplateName, setCurrentTemplateName] = useState('')
  const [loading, setLoading] = useState(!!templateId)

  // Modals
  const [showSaveModal, setShowSaveModal] = useState(false)
  const [showLoadModal, setShowLoadModal] = useState(false)
  const [saveName, setSaveName] = useState('')
  const [templates, setTemplates] = useState<EmailTemplate[]>([])
  const [loadingTemplates, setLoadingTemplates] = useState(false)

  // Pending save data (from editor)
  const [pendingSave, setPendingSave] = useState<{ blocks: EmailBlockData[]; html: string; subject: string } | null>(null)
  const [showConfirmCloseSave, setShowConfirmCloseSave] = useState(false)

  /* Load template from Firestore or sessionStorage */
  useEffect(() => {
    // Check sessionStorage for system template blocks
    const storedBlocks = sessionStorage.getItem('editorBlocks')
    const storedSubject = sessionStorage.getItem('editorSubject')
    if (storedBlocks && !templateId) {
      try {
        setInitialBlocks(JSON.parse(storedBlocks))
        setInitialSubject(storedSubject || '')
      } catch { /* ignore parse errors */ }
      sessionStorage.removeItem('editorBlocks')
      sessionStorage.removeItem('editorSubject')
      setLoading(false)
      return
    }

    if (!orgId || !templateId) { setLoading(false); return }
    const loadTemplate = async () => {
      try {
        const snap = await getDoc(doc(db, 'emailTemplates', templateId))
        if (snap.exists()) {
          const data = snap.data() as Omit<EmailTemplate, 'id'>
          // Verify template belongs to current org
          if (data.orgId && data.orgId !== orgId) {
            toast.error('Template não encontrado')
            setLoading(false)
            return
          }
          setInitialBlocks(data.blocks || [])
          setInitialSubject(data.subject || '')
          setCurrentTemplateName(data.name || '')
        }
      } catch (error) {
        console.error('Error loading template:', error)
        toast.error('Erro ao carregar template')
      }
      setLoading(false)
    }
    loadTemplate()
  }, [orgId, templateId])

  /* Load templates list */
  const loadTemplatesList = async () => {
    if (!orgId) return
    setLoadingTemplates(true)
    try {
      const q = query(
        collection(db, 'emailTemplates'),
        where('orgId', '==', orgId),
        orderBy('updatedAt', 'desc'),
      )
      const snap = await getDocs(q)
      setTemplates(snap.docs.map((d) => ({ id: d.id, ...d.data() })) as EmailTemplate[])
    } catch (error) {
      console.error('Error loading templates:', error)
    }
    setLoadingTemplates(false)
  }

  /* Handle save from editor */
  const handleEditorSave = (blocks: EmailBlockData[], html: string, subject: string) => {
    setPendingSave({ blocks, html, subject })
    setSaveName(currentTemplateName || '')
    setShowSaveModal(true)
  }

  /* Save template to Firestore */
  const saveTemplate = async () => {
    if (isPlanBlocked) return
    if (!orgId || !pendingSave || !saveName.trim()) return
    try {
      const data = {
        orgId,
        name: saveName.trim(),
        subject: pendingSave.subject,
        blocks: pendingSave.blocks,
        updatedAt: new Date().toISOString(),
      }

      if (currentTemplateId) {
        await setDoc(doc(db, 'emailTemplates', currentTemplateId), data, { merge: true })
        toast.success('Template atualizado')
      } else {
        const ref = await addDoc(collection(db, 'emailTemplates'), {
          ...data,
          createdAt: new Date().toISOString(),
          createdBy: userUid || '',
          createdByName: userEmail || '',
        })
        setCurrentTemplateId(ref.id)
        toast.success('Template salvo')
      }
      setCurrentTemplateName(saveName.trim())
      setShowSaveModal(false)
      setPendingSave(null)
    } catch (error) {
      console.error('Error saving template:', error)
      toast.error('Erro ao salvar template')
    }
  }

  /* Load a template */
  const handleLoadTemplate = (tmpl: EmailTemplate) => {
    setInitialBlocks(tmpl.blocks || [])
    setInitialSubject(tmpl.subject || '')
    setCurrentTemplateId(tmpl.id)
    setCurrentTemplateName(tmpl.name)
    setShowLoadModal(false)
    // Force re-mount editor with new data
    setLoading(true)
    setTimeout(() => setLoading(false), 50)
    toast.success(`Template "${tmpl.name}" carregado`)
  }

  /* Delete a template */
  const handleDeleteTemplate = async (id: string) => {
    if (isPlanBlocked) return
    if (!confirm('Tem certeza que deseja excluir este template?')) return
    try {
      await deleteDoc(doc(db, 'emailTemplates', id))
      setTemplates((prev) => prev.filter((t) => t.id !== id))
      toast.success('Template excluído')
    } catch (error) {
      console.error('Error deleting template:', error)
      toast.error('Erro ao excluir template')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[80vh]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-200 border-t-primary-600" />
      </div>
    )
  }

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col">
      {/* Template toolbar */}
      <div className="flex items-center justify-between px-4 py-2 bg-slate-50 border-b border-slate-200 shrink-0">
        <div className="flex items-center gap-2">
          {currentTemplateName && (
            <span className="text-xs text-slate-500">
              Template: <strong className="text-slate-700">{currentTemplateName}</strong>
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { loadTemplatesList(); setShowLoadModal(true) }}
            className="text-xs text-slate-600 border border-slate-200 px-3 py-1.5 rounded-lg hover:bg-white transition-colors"
          >
            Carregar template
          </button>
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1 overflow-hidden">
        <EmailEditor
          initialBlocks={initialBlocks}
          initialSubject={initialSubject}
          onSave={handleEditorSave}
          onBack={() => router.push('/campanhas')}
        />
      </div>

      {/* Save Modal */}
      {showSaveModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => {
            const hasChanges = saveName.trim() !== (currentTemplateName || '').trim()
            if (hasChanges) {
              setShowConfirmCloseSave(true)
            } else {
              setShowSaveModal(false)
              setPendingSave(null)
            }
          }}
        >
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Salvar template</h3>
            <label className="block mb-4">
              <span className="text-sm text-slate-600">Nome do template</span>
              <input
                type="text"
                value={saveName}
                onChange={(e) => setSaveName(e.target.value)}
                placeholder="Ex: Newsletter Semanal"
                className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:ring-2 focus:ring-primary-300 outline-none"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    const hasChanges = saveName.trim() !== (currentTemplateName || '').trim()
                    if (hasChanges) {
                      setShowConfirmCloseSave(true)
                    } else {
                      setShowSaveModal(false)
                      setPendingSave(null)
                    }
                  }
                }}
              />
            </label>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  const hasChanges = saveName.trim() !== (currentTemplateName || '').trim()
                  if (hasChanges) {
                    setShowConfirmCloseSave(true)
                  } else {
                    setShowSaveModal(false)
                    setPendingSave(null)
                  }
                }}
                className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={saveTemplate}
                disabled={!saveName.trim()}
                className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors"
              >
                {currentTemplateId ? 'Atualizar' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm close save modal */}
      <ConfirmCloseDialog
        isOpen={showConfirmCloseSave}
        onConfirm={() => {
          setShowConfirmCloseSave(false)
          setShowSaveModal(false)
          setPendingSave(null)
        }}
        onCancel={() => setShowConfirmCloseSave(false)}
      />

      {/* Load Modal */}
      {showLoadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-xl max-h-[80vh] flex flex-col">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Carregar template</h3>
            {loadingTemplates ? (
              <div className="flex items-center justify-center py-10">
                <div className="h-6 w-6 animate-spin rounded-full border-4 border-primary-200 border-t-primary-600" />
              </div>
            ) : templates.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-10">Nenhum template salvo</p>
            ) : (
              <div className="flex-1 overflow-y-auto space-y-2">
                {templates.map((tmpl) => (
                  <div
                    key={tmpl.id}
                    className="flex items-center justify-between rounded-lg border border-slate-200 p-3 hover:border-primary-300 transition-colors"
                  >
                    <button
                      onClick={() => handleLoadTemplate(tmpl)}
                      className="flex-1 text-left"
                    >
                      <p className="text-sm font-medium text-slate-900">{tmpl.name}</p>
                      <p className="text-xs text-slate-400">{tmpl.subject || 'Sem assunto'} &middot; {tmpl.blocks?.length || 0} blocos</p>
                    </button>
                    <button
                      onClick={() => handleDeleteTemplate(tmpl.id)}
                      className="text-xs text-red-500 hover:text-red-700 px-2 py-1"
                    >
                      Excluir
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex justify-end mt-4">
              <button
                onClick={() => setShowLoadModal(false)}
                className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function EmailEditorPage() {
  return (
    <PlanGate feature="email_automation">
      <EditorPageContent />
    </PlanGate>
  )
}
