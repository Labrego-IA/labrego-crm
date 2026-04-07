'use client'

import { useState, useEffect, useCallback } from 'react'
import { useCrmUser } from '@/contexts/CrmUserContext'
import TextAgentWizard from '@/components/agentes/TextAgentWizard'
import FAQManager from '@/components/agentes/FAQManager'
import { calculateTextAgentStrength } from '@/lib/agentEngine'
import type { AgentConfig, TextAgentWizardAnswers, FAQItem } from '@/types/agentConfig'
import { DEFAULT_AGENT_CONFIG, DEFAULT_WIZARD_ANSWERS } from '@/types/agentConfig'

type TabId = 'wizard' | 'faq' | 'configuracoes'

export default function EmailConfigPage() {
  const { orgId } = useCrmUser()
  const [activeTab, setActiveTab] = useState<TabId>('wizard')
  const [config, setConfig] = useState<AgentConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    if (!orgId) return
    async function loadConfig() {
      try {
        const res = await fetch(`/api/agent/config?orgId=${orgId}`)
        const data = await res.json()
        setConfig(data as AgentConfig)
      } catch {
        setConfig({ ...DEFAULT_AGENT_CONFIG, orgId: orgId!, createdAt: '', updatedAt: '', updatedBy: '' })
      } finally {
        setLoading(false)
      }
    }
    loadConfig()
  }, [orgId])

  const handleSave = useCallback(async () => {
    if (!orgId || !config) return
    setSaving(true)
    try {
      await fetch('/api/agent/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...config, orgId }),
      })
      setDirty(false)
    } catch (err) {
      console.error('Erro ao salvar:', err)
    } finally {
      setSaving(false)
    }
  }, [orgId, config])

  const updateConfig = (partial: Partial<AgentConfig>) => {
    if (!config) return
    setConfig({ ...config, ...partial })
    setDirty(true)
  }

  const updateWizardAnswers = (answers: TextAgentWizardAnswers) => {
    if (!config) return
    const strength = calculateTextAgentStrength(answers)
    setConfig({
      ...config,
      email: { ...config.email, wizardAnswers: answers, strengthScore: strength },
    })
    setDirty(true)
  }

  const updateFAQ = (faq: FAQItem[]) => {
    if (!config) return
    setConfig({ ...config, faq })
    setDirty(true)
  }

  if (loading || !config) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin w-8 h-8 border-2 border-[#13DEFC] border-t-transparent rounded-full" />
      </div>
    )
  }

  const tabs: { id: TabId; label: string; icon: string }[] = [
    { id: 'wizard', label: 'Conhecimento', icon: '🧠' },
    { id: 'faq', label: 'FAQ', icon: '❓' },
    { id: 'configuracoes', label: 'Configuracoes', icon: '⚙️' },
  ]

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <span className="text-3xl">📧</span>
            Agente Email
          </h1>
          <p className="text-white/50 mt-1">Configure seu agente de atendimento automatico por email.</p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <span className="text-white/60 text-sm">{config.email.enabled ? 'Ativo' : 'Inativo'}</span>
            <button
              onClick={() => updateConfig({ email: { ...config.email, enabled: !config.email.enabled } })}
              className={`relative w-12 h-6 rounded-full transition-colors ${
                config.email.enabled ? 'bg-green-500' : 'bg-slate-600'
              }`}
            >
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                config.email.enabled ? 'translate-x-6' : ''
              }`} />
            </button>
          </label>
          <button
            onClick={handleSave}
            disabled={!dirty || saving}
            className={`px-6 py-2 rounded-xl font-medium text-sm transition-all ${
              dirty ? 'bg-[#13DEFC] text-slate-900 hover:bg-[#13DEFC]/90' : 'bg-slate-700 text-white/30 cursor-not-allowed'
            }`}
          >
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>

      {/* Info box — como configurar inbound */}
      <div className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-4">
        <h3 className="text-blue-400 font-medium text-sm mb-2">Como receber emails automaticamente?</h3>
        <p className="text-white/50 text-sm leading-relaxed">
          Configure o encaminhamento de emails do seu provider (Gmail, Resend ou SendGrid) para o webhook:
        </p>
        <code className="block mt-2 px-3 py-2 bg-slate-900/50 rounded-lg text-[#13DEFC] text-xs">
          {typeof window !== 'undefined' ? `${window.location.origin}/api/agent/email/webhook` : '/api/agent/email/webhook'}
        </code>
        <p className="text-white/30 text-xs mt-2">
          Resend: Configure Inbound Emails. SendGrid: Configure Inbound Parse. Gmail: Configure encaminhamento.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-700 pb-px">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-t-xl transition-all ${
              activeTab === tab.id
                ? 'bg-slate-800/80 text-[#13DEFC] border-b-2 border-[#13DEFC]'
                : 'text-white/50 hover:text-white/80 hover:bg-slate-800/30'
            }`}
          >
            <span>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === 'wizard' && (
          <TextAgentWizard
            answers={config.email.wizardAnswers || DEFAULT_WIZARD_ANSWERS}
            onChange={updateWizardAnswers}
            strengthScore={config.email.strengthScore || 0}
          />
        )}

        {activeTab === 'faq' && (
          <FAQManager items={config.faq || []} onChange={updateFAQ} />
        )}

        {activeTab === 'configuracoes' && (
          <div className="space-y-6">
            <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Modelo de IA</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-white/60 text-sm font-medium mb-1">Modelo</label>
                  <select
                    value={config.shared.llmModel}
                    onChange={e => updateConfig({ shared: { ...config.shared, llmModel: e.target.value } })}
                    className="w-64 px-3 py-2 bg-slate-900/50 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:border-[#13DEFC]/50"
                  >
                    <option value="gpt-4o-mini">GPT-4o Mini (Rapido e economico)</option>
                    <option value="gpt-4o">GPT-4o (Mais inteligente)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-white/60 text-sm font-medium mb-1">
                    Temperatura: {config.shared.temperature}
                  </label>
                  <input
                    type="range" min={0} max={1} step={0.1}
                    value={config.shared.temperature}
                    onChange={e => updateConfig({ shared: { ...config.shared, temperature: parseFloat(e.target.value) } })}
                    className="w-64"
                  />
                </div>
              </div>
            </div>

            <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Acoes no CRM</h3>
              <div className="space-y-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.crmActions.autoCreateContact}
                    onChange={e => updateConfig({ crmActions: { ...config.crmActions, autoCreateContact: e.target.checked } })}
                    className="w-4 h-4 rounded border-slate-600 bg-slate-900 text-[#13DEFC]"
                  />
                  <span className="text-white/60 text-sm">Criar contato automaticamente no CRM</span>
                </label>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
