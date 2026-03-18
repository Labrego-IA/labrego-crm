'use client'

import { useState, useCallback, useRef } from 'react'
import PermissionGate from '@/components/PermissionGate'
import Tabs from '@/components/Tabs'
import PropostasBrandingTab from '@/components/admin/PropostasBrandingTab'
import PropostasProdutosTab from '@/components/admin/PropostasProdutosTab'
import PropostasLogosTab from '@/components/admin/PropostasLogosTab'
import PropostasConfigTab from '@/components/admin/PropostasConfigTab'
import PropostasEstruturaTab from '@/components/admin/PropostasEstruturaTab'
import PropostasFieldsTab from '@/components/admin/PropostasFieldsTab'
import ConfirmCloseDialog from '@/components/ConfirmCloseDialog'

export default function PropostasConfigPage() {
  const [activeTab, setActiveTab] = useState('branding')
  const [configDirty, setConfigDirty] = useState(false)
  const [brandingDirty, setBrandingDirty] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [pendingTab, setPendingTab] = useState<string | null>(null)
  const resetConfigRef = useRef<(() => void) | null>(null)
  const resetBrandingRef = useRef<(() => void) | null>(null)

  const handleResetRef = useCallback((fn: () => void) => {
    resetConfigRef.current = fn
  }, [])

  const handleBrandingResetRef = useCallback((fn: () => void) => {
    resetBrandingRef.current = fn
  }, [])

  const handleTabChange = useCallback((key: string) => {
    if (activeTab === 'config' && configDirty) {
      setPendingTab(key)
      setShowConfirm(true)
      return
    }
    if (activeTab === 'branding' && brandingDirty) {
      setPendingTab(key)
      setShowConfirm(true)
      return
    }
    setActiveTab(key)
  }, [activeTab, configDirty, brandingDirty])

  const handleConfirmLeave = useCallback(() => {
    if (activeTab === 'config') {
      resetConfigRef.current?.()
      setConfigDirty(false)
    }
    if (activeTab === 'branding') {
      resetBrandingRef.current?.()
      setBrandingDirty(false)
    }
    setShowConfirm(false)
    if (pendingTab) {
      setActiveTab(pendingTab)
      setPendingTab(null)
    }
  }, [pendingTab, activeTab])

  const handleCancelLeave = useCallback(() => {
    setShowConfirm(false)
    setPendingTab(null)
  }, [])

  const SUB_TABS = [
    { key: 'branding', label: 'Branding', content: <PropostasBrandingTab onDirtyChange={setBrandingDirty} onResetRef={handleBrandingResetRef} /> },
    { key: 'produtos', label: 'Produtos', content: <PropostasProdutosTab /> },
    { key: 'logos', label: 'Logos de Clientes', content: <PropostasLogosTab /> },
    { key: 'config', label: 'Configuracoes', content: <PropostasConfigTab onDirtyChange={setConfigDirty} onResetRef={handleResetRef} /> },
    { key: 'estrutura', label: 'Estrutura do PDF', content: <PropostasEstruturaTab /> },
    { key: 'campos', label: 'Campos Personalizados', content: <PropostasFieldsTab /> },
  ]

  return (
    <PermissionGate action="canManageSettings">
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Configuracao de Propostas</h2>
          <p className="mt-1 text-sm text-gray-500">
            Configure o branding, produtos e logos que aparecem nos PDFs de propostas da sua organizacao.
          </p>
        </div>

        <Tabs items={SUB_TABS} active={activeTab} onChange={handleTabChange} />
      </div>

      <ConfirmCloseDialog
        isOpen={showConfirm}
        onConfirm={handleConfirmLeave}
        onCancel={handleCancelLeave}
        title="Dados nao salvos"
        message="Voce tem alteracoes nao salvas nas configuracoes. Deseja sair sem salvar? As alteracoes serao perdidas."
        confirmText="Sim, sair"
        cancelText="Continuar editando"
      />
    </PermissionGate>
  )
}
