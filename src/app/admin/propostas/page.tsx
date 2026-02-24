'use client'

import { useState } from 'react'
import PermissionGate from '@/components/PermissionGate'
import Tabs from '@/components/Tabs'
import PropostasBrandingTab from '@/components/admin/PropostasBrandingTab'
import PropostasProdutosTab from '@/components/admin/PropostasProdutosTab'
import PropostasLogosTab from '@/components/admin/PropostasLogosTab'
import PropostasConfigTab from '@/components/admin/PropostasConfigTab'
import PropostasEstruturaTab from '@/components/admin/PropostasEstruturaTab'
import PropostasFieldsTab from '@/components/admin/PropostasFieldsTab'

const SUB_TABS = [
  { key: 'branding', label: 'Branding', content: <PropostasBrandingTab /> },
  { key: 'produtos', label: 'Produtos', content: <PropostasProdutosTab /> },
  { key: 'logos', label: 'Logos de Clientes', content: <PropostasLogosTab /> },
  { key: 'config', label: 'Configuracoes', content: <PropostasConfigTab /> },
  { key: 'estrutura', label: 'Estrutura do PDF', content: <PropostasEstruturaTab /> },
  { key: 'campos', label: 'Campos Personalizados', content: <PropostasFieldsTab /> },
]

export default function PropostasConfigPage() {
  const [activeTab, setActiveTab] = useState('branding')

  return (
    <PermissionGate action="canManageSettings">
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Configuracao de Propostas</h2>
          <p className="mt-1 text-sm text-gray-500">
            Configure o branding, produtos e logos que aparecem nos PDFs de propostas da sua organizacao.
          </p>
        </div>

        <Tabs items={SUB_TABS} active={activeTab} onChange={setActiveTab} />
      </div>
    </PermissionGate>
  )
}
