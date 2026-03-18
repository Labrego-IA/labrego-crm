'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useCrmUser } from '@/contexts/CrmUserContext'
import { db, storage } from '@/lib/firebaseClient'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage'
import { toast } from 'sonner'
import type { ProposalBranding } from '@/types/proposalBranding'
import { DEFAULT_PROPOSAL_BRANDING } from '@/types/proposalBranding'

interface PropostasBrandingTabProps {
  onDirtyChange?: (dirty: boolean) => void
  onResetRef?: (resetFn: () => void) => void
}

export default function PropostasBrandingTab({ onDirtyChange, onResetRef }: PropostasBrandingTabProps) {
  const { orgId } = useCrmUser()
  const [form, setForm] = useState<ProposalBranding>(DEFAULT_PROPOSAL_BRANDING)
  const [initialForm, setInitialForm] = useState<ProposalBranding>(DEFAULT_PROPOSAL_BRANDING)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [uploadingWatermark, setUploadingWatermark] = useState(false)
  const logoInputRef = useRef<HTMLInputElement>(null)
  const watermarkInputRef = useRef<HTMLInputElement>(null)

  const hasChanges = useCallback(() => {
    return JSON.stringify(form) !== JSON.stringify(initialForm)
  }, [form, initialForm])

  const resetForm = useCallback(() => {
    setForm(initialForm)
    onDirtyChange?.(false)
  }, [initialForm, onDirtyChange])

  useEffect(() => {
    onResetRef?.(resetForm)
  }, [onResetRef, resetForm])

  useEffect(() => {
    onDirtyChange?.(hasChanges())
  }, [form, hasChanges, onDirtyChange])

  useEffect(() => {
    if (!orgId) return
    const load = async () => {
      try {
        const snap = await getDoc(doc(db, 'organizations', orgId, 'settings', 'proposalBranding'))
        if (snap.exists()) {
          const loaded = { ...DEFAULT_PROPOSAL_BRANDING, ...(snap.data() as Partial<ProposalBranding>) }
          setForm(loaded)
          setInitialForm(loaded)
        }
      } catch (error) {
        console.error('Error loading branding:', error)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [orgId])

  const handleChange = (field: keyof ProposalBranding, value: string | number | boolean) => {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  const handleUpload = async (file: File, field: 'logoUrl' | 'watermarkUrl') => {
    if (!orgId) return
    const setUploading = field === 'logoUrl' ? setUploadingLogo : setUploadingWatermark
    setUploading(true)
    try {
      const ext = file.name.split('.').pop() || 'png'
      const path = `organizations/${orgId}/branding/${field === 'logoUrl' ? 'logo' : 'watermark'}.${ext}`
      const sRef = storageRef(storage, path)
      await uploadBytes(sRef, file)
      const url = await getDownloadURL(sRef)
      handleChange(field, url)
      toast.success(field === 'logoUrl' ? 'Logo enviado!' : 'Marca d\'agua enviada!')
    } catch (error) {
      console.error('Upload error:', error)
      toast.error('Erro ao enviar imagem.')
    } finally {
      setUploading(false)
    }
  }

  const handleSave = async () => {
    if (!orgId) return
    setSaving(true)
    try {
      await setDoc(doc(db, 'organizations', orgId, 'settings', 'proposalBranding'), form, { merge: true })
      setInitialForm(form)
      onDirtyChange?.(false)
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
      {/* Identidade Visual */}
      <section className="rounded-2xl bg-white border border-gray-200 p-6 space-y-5">
        <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">Identidade Visual</h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nome da Empresa</label>
            <input
              type="text"
              value={form.companyName}
              onChange={e => handleChange('companyName', e.target.value)}
              placeholder="Sua Empresa Ltda"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/40"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tagline</label>
            <input
              type="text"
              value={form.tagline}
              onChange={e => handleChange('tagline', e.target.value)}
              placeholder="Sua frase de impacto"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/40"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Cor Primaria</label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={form.primaryColor}
                onChange={e => handleChange('primaryColor', e.target.value)}
                className="h-10 w-14 rounded border border-gray-300 cursor-pointer"
              />
              <input
                type="text"
                value={form.primaryColor}
                onChange={e => {
                  const v = e.target.value
                  if (v === '' || /^#[0-9a-fA-F]{0,6}$/.test(v)) handleChange('primaryColor', v)
                }}
                onBlur={() => {
                  if (!/^#[0-9a-fA-F]{6}$/.test(form.primaryColor)) handleChange('primaryColor', '#6f3ccf')
                }}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary-500/40"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Validade da Proposta (dias)</label>
            <input
              type="number"
              min={1}
              value={form.validityDays}
              onChange={e => handleChange('validityDays', parseInt(e.target.value) || 7)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/40"
            />
          </div>
        </div>

        {/* Logo Upload */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Logo</label>
            <div className="flex items-center gap-3">
              {form.logoUrl ? (
                <img src={form.logoUrl} alt="Logo" className="h-12 w-auto rounded border border-gray-200 object-contain" />
              ) : (
                <div className="h-12 w-12 rounded border-2 border-dashed border-gray-300 flex items-center justify-center text-gray-400 text-xs">
                  Logo
                </div>
              )}
              <button
                type="button"
                onClick={() => logoInputRef.current?.click()}
                disabled={uploadingLogo}
                className="px-3 py-2 text-sm font-medium text-primary-600 hover:bg-primary-50 rounded-lg transition-colors disabled:opacity-50"
              >
                {uploadingLogo ? 'Enviando...' : 'Enviar Logo'}
              </button>
              <input
                ref={logoInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={e => {
                  const file = e.target.files?.[0]
                  if (file) handleUpload(file, 'logoUrl')
                  e.target.value = ''
                }}
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Marca d&apos;agua</label>
            <div className="flex items-center gap-3">
              {form.watermarkUrl ? (
                <img src={form.watermarkUrl} alt="Watermark" className="h-12 w-auto rounded border border-gray-200 object-contain opacity-50" />
              ) : (
                <div className="h-12 w-12 rounded border-2 border-dashed border-gray-300 flex items-center justify-center text-gray-400 text-xs">
                  WM
                </div>
              )}
              <button
                type="button"
                onClick={() => watermarkInputRef.current?.click()}
                disabled={uploadingWatermark}
                className="px-3 py-2 text-sm font-medium text-primary-600 hover:bg-primary-50 rounded-lg transition-colors disabled:opacity-50"
              >
                {uploadingWatermark ? 'Enviando...' : 'Enviar Marca d\'agua'}
              </button>
              <input
                ref={watermarkInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={e => {
                  const file = e.target.files?.[0]
                  if (file) handleUpload(file, 'watermarkUrl')
                  e.target.value = ''
                }}
              />
            </div>
          </div>
        </div>

        {/* Toggles */}
        <div className="flex flex-wrap gap-6">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.showPresentationPage}
              onChange={e => handleChange('showPresentationPage', e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            />
            <span className="text-sm text-gray-700">Exibir pagina de apresentacao</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.showLogosPage}
              onChange={e => handleChange('showLogosPage', e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            />
            <span className="text-sm text-gray-700">Exibir pagina de logos de clientes</span>
          </label>
        </div>
      </section>

      {/* Contato */}
      <section className="rounded-2xl bg-white border border-gray-200 p-6 space-y-5">
        <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">Informacoes de Contato</h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Telefone</label>
            <input
              type="text"
              value={form.phone}
              onChange={e => handleChange('phone', e.target.value)}
              placeholder="11 99999-9999"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/40"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={form.email}
              onChange={e => handleChange('email', e.target.value)}
              placeholder="contato@suaempresa.com"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/40"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Website</label>
            <input
              type="text"
              value={form.website}
              onChange={e => handleChange('website', e.target.value)}
              placeholder="suaempresa.com.br"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/40"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Instagram</label>
            <input
              type="text"
              value={form.instagram}
              onChange={e => handleChange('instagram', e.target.value)}
              placeholder="@suaempresa"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/40"
            />
          </div>
        </div>
      </section>

      {/* Textos */}
      <section className="rounded-2xl bg-white border border-gray-200 p-6 space-y-5">
        <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">Textos do PDF</h3>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Texto de Apresentacao</label>
          <textarea
            value={form.presentationText}
            onChange={e => handleChange('presentationText', e.target.value)}
            placeholder="Descreva sua empresa e experiencia... (aparece na pagina de apresentacao do PDF)"
            rows={4}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/40 resize-none"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Texto de Missao</label>
          <textarea
            value={form.missionText}
            onChange={e => handleChange('missionText', e.target.value)}
            placeholder="Qual e a missao da sua empresa? (aparece em destaque no PDF)"
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/40 resize-none"
          />
        </div>
      </section>

      {/* Preview de Cor */}
      <section className="rounded-2xl border border-gray-200 overflow-hidden">
        <div className="p-6 text-white" style={{ backgroundColor: form.primaryColor }}>
          <p className="text-xs font-medium opacity-70 uppercase tracking-wider">Preview da Capa</p>
          <h3 className="text-2xl font-bold mt-2">Proposta Comercial</h3>
          <p className="text-sm opacity-80 mt-1">{form.tagline || 'Sua tagline aqui'}</p>
        </div>
        <div className="bg-white p-4 flex items-center justify-between">
          <div className="text-sm text-gray-500">
            {form.companyName || 'Nome da empresa'} &middot; {form.phone || 'Telefone'} &middot; {form.email || 'Email'}
          </div>
          {form.logoUrl && (
            <img src={form.logoUrl} alt="Logo preview" className="h-8 w-auto object-contain" />
          )}
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
