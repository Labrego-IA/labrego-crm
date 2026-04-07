'use client'

import { useState, useEffect, useCallback } from 'react'
import { useCrmUser } from '@/contexts/CrmUserContext'
import WhatsAppQRConnect from '@/components/agentes/WhatsAppQRConnect'
import TextAgentWizard from '@/components/agentes/TextAgentWizard'
import FAQManager from '@/components/agentes/FAQManager'
import { calculateTextAgentStrength } from '@/lib/agentEngine'
import type { AgentConfig, TextAgentWizardAnswers, FAQItem, WhatsAppConnectionStatus } from '@/types/agentConfig'
import { DEFAULT_AGENT_CONFIG, DEFAULT_WIZARD_ANSWERS } from '@/types/agentConfig'

type TabId = 'conexao' | 'wizard' | 'faq' | 'configuracoes'

export default function WhatsAppConfigPage() {
  const { orgId } = useCrmUser()
  const [activeTab, setActiveTab] = useState<TabId>('conexao')
  const [config, setConfig] = useState<AgentConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [whatsappStatus, setWhatsappStatus] = useState<WhatsAppConnectionStatus>('disconnected')
  const [dirty, setDirty] = useState(false)

  // Carregar config
  useEffect(() => {
    if (!orgId) return
    async function loadConfig() {
      try {
        const res = await fetch(`/api/agent/config?orgId=${orgId}`)
        const data = await res.json()
        setConfig(data as AgentConfig)
      } catch (err) {
        console.error('Erro ao carregar config:', err)
        setConfig({ ...DEFAULT_AGENT_CONFIG, orgId: orgId!, createdAt: '', updatedAt: '', updatedBy: '' })
      } finally {
        setLoading(false)
      }
    }
    loadConfig()
  }, [orgId])

  // Salvar config
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
      whatsapp: {
        ...config.whatsapp,
        wizardAnswers: answers,
        strengthScore: strength,
      },
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

  const tabs: { id: TabId; label: string; icon: string }[] = [
    { id: 'conexao', label: 'Conexao', icon: '🔗' },
    { id: 'wizard', label: 'Conhecimento', icon: '🧠' },
    { id: 'faq', label: 'FAQ', icon: '❓' },
    { id: 'configuracoes', label: 'Configuracoes', icon: '⚙️' },
  ]

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
            <span className="text-3xl">🤖</span>
            Agente WhatsApp
          </h1>
          <p className="text-slate-500 mt-1">Configure seu agente de atendimento automatico por WhatsApp.</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Toggle Ativar/Desativar */}
          <label className="flex items-center gap-2 cursor-pointer">
            <span className="text-slate-600 text-sm">{config.whatsapp.enabled ? 'Ativo' : 'Inativo'}</span>
            <button
              onClick={() => updateConfig({
                whatsapp: { ...config.whatsapp, enabled: !config.whatsapp.enabled }
              })}
              className={`relative w-12 h-6 rounded-full transition-colors ${
                config.whatsapp.enabled ? 'bg-green-500' : 'bg-slate-600'
              }`}
            >
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                config.whatsapp.enabled ? 'translate-x-6' : ''
              }`} />
            </button>
          </label>

          {/* Botao Salvar */}
          <button
            onClick={handleSave}
            disabled={!dirty || saving}
            className={`px-6 py-2 rounded-xl font-medium text-sm transition-all ${
              dirty
                ? 'bg-[#13DEFC] text-slate-900 hover:bg-[#13DEFC]/90'
                : 'bg-slate-200 text-slate-300 cursor-not-allowed'
            }`}
          >
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200 pb-px">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-t-xl transition-all ${
              activeTab === tab.id
                ? 'bg-white text-cyan-600 border-b-2 border-[#13DEFC]'
                : 'text-slate-500 hover:text-slate-600 hover:bg-slate-50'
            }`}
          >
            <span>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div>
        {/* Conexao */}
        {activeTab === 'conexao' && orgId && (
          <WhatsAppQRConnect orgId={orgId} onStatusChange={setWhatsappStatus} />
        )}

        {/* Wizard */}
        {activeTab === 'wizard' && (
          <TextAgentWizard
            answers={config.whatsapp.wizardAnswers || DEFAULT_WIZARD_ANSWERS}
            onChange={updateWizardAnswers}
            strengthScore={config.whatsapp.strengthScore || 0}
          />
        )}

        {/* FAQ */}
        {activeTab === 'faq' && (
          <FAQManager items={config.faq || []} onChange={updateFAQ} />
        )}

        {/* Configuracoes */}
        {activeTab === 'configuracoes' && (
          <div className="space-y-6">
            {/* Modelo LLM */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6">
              <h3 className="text-lg font-semibold text-slate-800 mb-4">Modelo de IA</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-slate-600 text-sm font-medium mb-1">Modelo</label>
                  <select
                    value={config.shared.llmModel}
                    onChange={e => updateConfig({ shared: { ...config.shared, llmModel: e.target.value } })}
                    className="w-64 px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-800 text-sm focus:outline-none focus:border-cyan-500"
                  >
                    <option value="gpt-4o-mini">GPT-4o Mini (Rapido e economico)</option>
                    <option value="gpt-4o">GPT-4o (Mais inteligente)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-600 text-sm font-medium mb-1">
                    Temperatura: {config.shared.temperature}
                  </label>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.1}
                    value={config.shared.temperature}
                    onChange={e => updateConfig({ shared: { ...config.shared, temperature: parseFloat(e.target.value) } })}
                    className="w-64"
                  />
                  <p className="text-slate-300 text-xs mt-1">Mais baixo = mais preciso. Mais alto = mais criativo.</p>
                </div>
              </div>
            </div>

            {/* Horario de Atendimento */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-slate-800">Horario de Atendimento</h3>
                <button
                  onClick={() => updateConfig({
                    shared: {
                      ...config.shared,
                      workHours: { ...config.shared.workHours, enabled: !config.shared.workHours.enabled }
                    }
                  })}
                  className={`relative w-12 h-6 rounded-full transition-colors ${
                    config.shared.workHours.enabled ? 'bg-green-500' : 'bg-slate-600'
                  }`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                    config.shared.workHours.enabled ? 'translate-x-6' : ''
                  }`} />
                </button>
              </div>

              {config.shared.workHours.enabled && (
                <div className="space-y-4">
                  <div className="flex gap-4">
                    <div>
                      <label className="block text-slate-600 text-sm mb-1">Inicio</label>
                      <input
                        type="number"
                        min={0} max={23}
                        value={config.shared.workHours.startHour}
                        onChange={e => updateConfig({
                          shared: { ...config.shared, workHours: { ...config.shared.workHours, startHour: parseInt(e.target.value) } }
                        })}
                        className="w-20 px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-800 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-600 text-sm mb-1">Fim</label>
                      <input
                        type="number"
                        min={0} max={23}
                        value={config.shared.workHours.endHour}
                        onChange={e => updateConfig({
                          shared: { ...config.shared, workHours: { ...config.shared.workHours, endHour: parseInt(e.target.value) } }
                        })}
                        className="w-20 px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-800 text-sm"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-slate-600 text-sm font-medium mb-2">Dias de Atendimento</label>
                    <div className="flex gap-2">
                      {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'].map((day, i) => (
                        <button
                          key={i}
                          onClick={() => {
                            const days = [...config.shared.workHours.workDays]
                            if (days.includes(i)) {
                              updateConfig({ shared: { ...config.shared, workHours: { ...config.shared.workHours, workDays: days.filter(d => d !== i) } } })
                            } else {
                              updateConfig({ shared: { ...config.shared, workHours: { ...config.shared.workHours, workDays: [...days, i].sort() } } })
                            }
                          }}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                            config.shared.workHours.workDays.includes(i)
                              ? 'bg-cyan-50 text-cyan-600 border border-cyan-300'
                              : 'bg-slate-100 text-slate-400 border border-slate-300'
                          }`}
                        >
                          {day}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Audio (ElevenLabs) */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-slate-800">Respostas em Audio</h3>
                  <p className="text-slate-400 text-sm">Gerar audio das respostas via ElevenLabs</p>
                </div>
                <button
                  onClick={() => updateConfig({ audio: { ...config.audio, enabled: !config.audio.enabled } })}
                  className={`relative w-12 h-6 rounded-full transition-colors ${
                    config.audio.enabled ? 'bg-green-500' : 'bg-slate-600'
                  }`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                    config.audio.enabled ? 'translate-x-6' : ''
                  }`} />
                </button>
              </div>

              {config.audio.enabled && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-slate-600 text-sm font-medium mb-1">Voice ID (ElevenLabs)</label>
                    <input
                      type="text"
                      value={config.audio.voiceId}
                      onChange={e => updateConfig({ audio: { ...config.audio, voiceId: e.target.value } })}
                      placeholder="Cole o Voice ID do ElevenLabs"
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-800 text-sm placeholder:text-slate-400 focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config.audio.respondWithAudio}
                      onChange={e => updateConfig({ audio: { ...config.audio, respondWithAudio: e.target.checked } })}
                      className="w-4 h-4 rounded border-slate-300 bg-slate-50 text-cyan-600"
                    />
                    <span className="text-slate-600 text-sm">Enviar audio junto com texto nas respostas</span>
                  </label>
                </div>
              )}
            </div>

            {/* Acoes CRM */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6">
              <h3 className="text-lg font-semibold text-slate-800 mb-4">Acoes no CRM</h3>
              <div className="space-y-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.crmActions.autoCreateContact}
                    onChange={e => updateConfig({ crmActions: { ...config.crmActions, autoCreateContact: e.target.checked } })}
                    className="w-4 h-4 rounded border-slate-300 bg-slate-50 text-cyan-600"
                  />
                  <span className="text-slate-600 text-sm">Criar contato automaticamente no CRM</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.crmActions.autoTagContacts}
                    onChange={e => updateConfig({ crmActions: { ...config.crmActions, autoTagContacts: e.target.checked } })}
                    className="w-4 h-4 rounded border-slate-300 bg-slate-50 text-cyan-600"
                  />
                  <span className="text-slate-600 text-sm">Aplicar tags automaticas nos contatos</span>
                </label>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
