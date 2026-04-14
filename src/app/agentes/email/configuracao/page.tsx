'use client'

import { useState, useEffect, useCallback } from 'react'
import { EnvelopeIcon } from '@heroicons/react/24/outline'
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
        const merged = {
          ...DEFAULT_AGENT_CONFIG,
          ...data,
          whatsapp: { ...DEFAULT_AGENT_CONFIG.whatsapp, ...(data.whatsapp || {}) },
          email: { ...DEFAULT_AGENT_CONFIG.email, ...(data.email || {}) },
          shared: { ...DEFAULT_AGENT_CONFIG.shared, ...(data.shared || {}), workHours: { ...DEFAULT_AGENT_CONFIG.shared.workHours, ...(data.shared?.workHours || {}) } },
          audio: { ...DEFAULT_AGENT_CONFIG.audio, ...(data.audio || {}) },
          tools: { googleCalendar: { ...DEFAULT_AGENT_CONFIG.tools.googleCalendar, ...(data.tools?.googleCalendar || {}) }, followUp: { ...DEFAULT_AGENT_CONFIG.tools.followUp, ...(data.tools?.followUp || {}) }, funnelMove: { ...DEFAULT_AGENT_CONFIG.tools.funnelMove, ...(data.tools?.funnelMove || {}) } },
          crmActions: { ...DEFAULT_AGENT_CONFIG.crmActions, ...(data.crmActions || {}) },
          orgId: data.orgId || orgId,
          createdAt: data.createdAt || '',
          updatedAt: data.updatedAt || '',
          updatedBy: data.updatedBy || '',
        } as AgentConfig
        setConfig(merged)
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
        <div className="animate-spin w-8 h-8 border-2 border-cyan-600 border-t-transparent rounded-full" />
      </div>
    )
  }

  const tabs: { id: TabId; label: string }[] = [
    { id: 'wizard', label: 'Conhecimento' },
    { id: 'faq', label: 'FAQ' },
    { id: 'configuracoes', label: 'Configuracoes' },
  ]

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-200 flex items-center gap-3">
            <EnvelopeIcon className="w-7 h-7 text-cyan-600" />
            Agente Email
          </h1>
          <p className="text-slate-500 mt-1">Configure seu agente de atendimento automatico por email.</p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <span className="text-slate-600 dark:text-slate-400 text-sm">{config.email.enabled ? 'Ativo' : 'Inativo'}</span>
            <button
              onClick={() => updateConfig({ email: { ...config.email, enabled: !config.email.enabled } })}
              className={`relative w-12 h-6 rounded-full transition-colors ${
                config.email.enabled ? 'bg-green-500' : 'bg-slate-600'
              }`}
            >
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white dark:bg-surface-dark rounded-full transition-transform ${
                config.email.enabled ? 'translate-x-6' : ''
              }`} />
            </button>
          </label>
          <button
            onClick={handleSave}
            disabled={!dirty || saving}
            className={`px-6 py-2 rounded-xl font-medium text-sm transition-all ${
              dirty ? 'bg-secondary text-slate-900 dark:text-slate-100 hover:bg-secondary-600' : 'bg-slate-200 text-slate-300 cursor-not-allowed'
            }`}
          >
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>

      {/* Info box — como configurar inbound */}
      <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4">
        <h3 className="text-blue-400 font-medium text-sm mb-2">Como receber emails automaticamente?</h3>
        <p className="text-slate-500 text-sm leading-relaxed">
          Configure o encaminhamento de emails do seu provider (Gmail, Resend ou SendGrid) para o webhook:
        </p>
        <code className="block mt-2 px-3 py-2 bg-slate-50 dark:bg-surface-dark/80 rounded-lg text-cyan-600 text-xs">
          {typeof window !== 'undefined' ? `${window.location.origin}/api/agent/email/webhook` : '/api/agent/email/webhook'}
        </code>
        <p className="text-slate-300 text-xs mt-2">
          Resend: Configure Inbound Emails. SendGrid: Configure Inbound Parse. Gmail: Configure encaminhamento.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200 dark:border-white/10 pb-px">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-t-xl transition-all ${
              activeTab === tab.id
                ? 'bg-white dark:bg-surface-dark text-secondary-700 border-b-2 border-secondary'
                : 'text-slate-500 hover:text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5'
            }`}
          >
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
            <div className="bg-white dark:bg-surface-dark border border-slate-200 dark:border-white/10 rounded-2xl p-6">
              <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-4">Modelo de IA</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-slate-600 dark:text-slate-400 text-sm font-medium mb-1">Modelo</label>
                  <select
                    value={config.shared.llmModel}
                    onChange={e => updateConfig({ shared: { ...config.shared, llmModel: e.target.value } })}
                    className="w-64 px-3 py-2 bg-white dark:bg-surface-dark border border-slate-300 rounded-lg text-slate-800 dark:text-slate-200 text-sm focus:outline-none focus:border-cyan-500"
                  >
                    <option value="gpt-4o-mini">GPT-4o Mini (Rapido e economico)</option>
                    <option value="gpt-4o">GPT-4o (Mais inteligente)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-600 dark:text-slate-400 text-sm font-medium mb-1">
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

            <div className="bg-white dark:bg-surface-dark border border-slate-200 dark:border-white/10 rounded-2xl p-6">
              <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-4">Acoes no CRM</h3>
              <div className="space-y-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.crmActions.autoCreateContact}
                    onChange={e => updateConfig({ crmActions: { ...config.crmActions, autoCreateContact: e.target.checked } })}
                    className="w-4 h-4 rounded border-slate-300 bg-slate-50 dark:bg-surface-dark/80 text-cyan-600"
                  />
                  <span className="text-slate-600 dark:text-slate-400 text-sm">Criar contato automaticamente no CRM</span>
                </label>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
