'use client'

import { useState, useEffect, useCallback } from 'react'
import { useCrmUser } from '@/contexts/CrmUserContext'
import WhatsAppQRConnect from '@/components/agentes/WhatsAppQRConnect'
import TextAgentWizard from '@/components/agentes/TextAgentWizard'
import FAQManager from '@/components/agentes/FAQManager'
import { calculateTextAgentStrength } from '@/lib/agentEngine'
import { ChatBubbleLeftRightIcon } from '@heroicons/react/24/outline'
import type { AgentConfig, TextAgentWizardAnswers, FAQItem, WhatsAppConnectionStatus } from '@/types/agentConfig'
import { DEFAULT_AGENT_CONFIG, DEFAULT_WIZARD_ANSWERS } from '@/types/agentConfig'

type TabId = 'conexao' | 'wizard' | 'faq' | 'ferramentas' | 'configuracoes'

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
    { id: 'conexao', label: 'Conexao', icon: '' },
    { id: 'wizard', label: 'Conhecimento', icon: '' },
    { id: 'faq', label: 'FAQ', icon: '' },
    { id: 'ferramentas', label: 'Ferramentas', icon: '' },
    { id: 'configuracoes', label: 'Ajustes', icon: '' },
  ]

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
            <ChatBubbleLeftRightIcon className="w-7 h-7 text-green-600" />
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

        {/* Ferramentas */}
        {activeTab === 'ferramentas' && (
          <div className="space-y-6">
            {/* Acoes automaticas */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6">
              <h3 className="text-lg font-semibold text-slate-800 mb-2">Acoes Automaticas</h3>
              <p className="text-slate-500 text-sm mb-4">Ative o que o agente pode fazer automaticamente durante as conversas.</p>
              <div className="space-y-3">
                {[
                  { key: 'autoCreateContact', label: 'Salvar contato no CRM', desc: 'Quando alguem novo envia mensagem, o contato e salvo automaticamente.', icon: '' },
                  { key: 'autoTagContacts', label: 'Aplicar etiquetas', desc: 'Marcar contatos com tags para organizar sua base.', icon: '' },
                ].map(tool => (
                  <label key={tool.key} className="flex items-start gap-3 p-4 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer transition-colors">
                    <input
                      type="checkbox"
                      checked={tool.key === 'autoCreateContact' ? config.crmActions.autoCreateContact : config.crmActions.autoTagContacts}
                      onChange={e => updateConfig({ crmActions: { ...config.crmActions, [tool.key]: e.target.checked } })}
                      className="w-4 h-4 mt-0.5 rounded border-slate-300 text-cyan-600"
                    />
                    <div className="flex-1">
                      <span className="text-slate-700 text-sm font-medium">{tool.icon} {tool.label}</span>
                      <p className="text-slate-400 text-xs mt-0.5">{tool.desc}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Google Calendar */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center text-sm font-bold text-blue-600">CAL</div>
                  <div>
                    <h3 className="text-slate-800 text-sm font-semibold">Google Agenda</h3>
                    <p className="text-slate-400 text-xs">O agente verifica horarios e agenda reunioes automaticamente.</p>
                  </div>
                </div>
                <button
                  onClick={() => updateConfig({ tools: { ...config.tools, googleCalendar: { ...config.tools.googleCalendar, enabled: !config.tools.googleCalendar.enabled } } })}
                  className={`relative w-12 h-6 rounded-full transition-colors ${config.tools.googleCalendar.enabled ? 'bg-green-500' : 'bg-slate-300'}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${config.tools.googleCalendar.enabled ? 'translate-x-6' : ''}`} />
                </button>
              </div>
              {config.tools.googleCalendar.enabled && (
                <div className="mt-4 space-y-3 pl-[52px]">
                  <div>
                    <label className="block text-slate-600 text-xs font-medium mb-1">ID do Calendario Google</label>
                    <input type="text" value={config.tools.googleCalendar.calendarId}
                      onChange={e => updateConfig({ tools: { ...config.tools, googleCalendar: { ...config.tools.googleCalendar, calendarId: e.target.value } } })}
                      placeholder="seu-email@gmail.com ou ID do calendario"
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-800 text-sm placeholder:text-slate-400 focus:outline-none focus:border-cyan-500" />
                  </div>
                  <div>
                    <label className="block text-slate-600 text-xs font-medium mb-1">Nome do especialista</label>
                    <input type="text" value={config.tools.googleCalendar.specialistName}
                      onChange={e => updateConfig({ tools: { ...config.tools, googleCalendar: { ...config.tools.googleCalendar, specialistName: e.target.value } } })}
                      placeholder="Nome de quem fara a reuniao"
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-800 text-sm placeholder:text-slate-400 focus:outline-none focus:border-cyan-500" />
                  </div>
                  <div className="flex gap-4">
                    <div>
                      <label className="block text-slate-600 text-xs font-medium mb-1">Duracao (min)</label>
                      <select value={config.tools.googleCalendar.slotDuration}
                        onChange={e => updateConfig({ tools: { ...config.tools, googleCalendar: { ...config.tools.googleCalendar, slotDuration: parseInt(e.target.value) } } })}
                        className="px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-800 text-sm">
                        <option value={15}>15 min</option>
                        <option value={30}>30 min</option>
                        <option value={45}>45 min</option>
                        <option value={60}>60 min</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-slate-600 text-xs font-medium mb-1">Buscar ate</label>
                      <select value={config.tools.googleCalendar.bufferDays}
                        onChange={e => updateConfig({ tools: { ...config.tools, googleCalendar: { ...config.tools.googleCalendar, bufferDays: parseInt(e.target.value) } } })}
                        className="px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-800 text-sm">
                        <option value={3}>3 dias</option>
                        <option value={7}>7 dias</option>
                        <option value={14}>14 dias</option>
                        <option value={30}>30 dias</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Follow-up */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center text-sm font-bold text-green-600">FUP</div>
                  <div>
                    <h3 className="text-slate-800 text-sm font-semibold">Follow-up automatico</h3>
                    <p className="text-slate-400 text-xs">Cria lembretes de retorno com o contato apos a conversa.</p>
                  </div>
                </div>
                <button
                  onClick={() => updateConfig({ tools: { ...config.tools, followUp: { ...config.tools.followUp, enabled: !config.tools.followUp.enabled } } })}
                  className={`relative w-12 h-6 rounded-full transition-colors ${config.tools.followUp.enabled ? 'bg-green-500' : 'bg-slate-300'}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${config.tools.followUp.enabled ? 'translate-x-6' : ''}`} />
                </button>
              </div>
              {config.tools.followUp.enabled && (
                <div className="mt-4 space-y-3 pl-[52px]">
                  <div>
                    <label className="block text-slate-600 text-xs font-medium mb-1">Dias para retorno</label>
                    <select value={config.tools.followUp.defaultDays}
                      onChange={e => updateConfig({ tools: { ...config.tools, followUp: { ...config.tools.followUp, defaultDays: parseInt(e.target.value) } } })}
                      className="px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-800 text-sm">
                      <option value={1}>1 dia</option>
                      <option value={2}>2 dias</option>
                      <option value={3}>3 dias</option>
                      <option value={5}>5 dias</option>
                      <option value={7}>7 dias</option>
                    </select>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={config.tools.followUp.autoCreate}
                      onChange={e => updateConfig({ tools: { ...config.tools, followUp: { ...config.tools.followUp, autoCreate: e.target.checked } } })}
                      className="w-4 h-4 rounded border-slate-300 text-cyan-600" />
                    <span className="text-slate-600 text-sm">Criar automaticamente ao encerrar conversa</span>
                  </label>
                </div>
              )}
            </div>

            {/* Mover no funil */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-purple-50 rounded-xl flex items-center justify-center text-sm font-bold text-purple-600">FNL</div>
                  <div>
                    <h3 className="text-slate-800 text-sm font-semibold">Mover no funil</h3>
                    <p className="text-slate-400 text-xs">Move contatos entre estagios do funil com base na conversa.</p>
                  </div>
                </div>
                <button
                  onClick={() => updateConfig({ tools: { ...config.tools, funnelMove: { ...config.tools.funnelMove, enabled: !config.tools.funnelMove.enabled } } })}
                  className={`relative w-12 h-6 rounded-full transition-colors ${config.tools.funnelMove.enabled ? 'bg-green-500' : 'bg-slate-300'}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${config.tools.funnelMove.enabled ? 'translate-x-6' : ''}`} />
                </button>
              </div>
              {config.tools.funnelMove.enabled && (
                <div className="mt-4 space-y-3 pl-[52px]">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={config.tools.funnelMove.autoMove}
                      onChange={e => updateConfig({ tools: { ...config.tools, funnelMove: { ...config.tools.funnelMove, autoMove: e.target.checked } } })}
                      className="w-4 h-4 rounded border-slate-300 text-cyan-600" />
                    <span className="text-slate-600 text-sm">Mover automaticamente quando a IA identificar intencao de compra</span>
                  </label>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Ajustes */}
        {activeTab === 'configuracoes' && (
          <div className="space-y-6">
            {/* Nivel de inteligencia */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6">
              <h3 className="text-lg font-semibold text-slate-800 mb-2">Nivel de Inteligencia</h3>
              <p className="text-slate-500 text-sm mb-4">Escolha como o agente deve responder.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  onClick={() => updateConfig({ shared: { ...config.shared, llmModel: 'gpt-4o-mini', temperature: 0.7 } })}
                  className={`p-4 rounded-xl border-2 text-left transition-all ${
                    config.shared.llmModel === 'gpt-4o-mini'
                      ? 'border-cyan-500 bg-cyan-50'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-cyan-600">R</span>
                    <span className="font-medium text-slate-800">Rapido</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">Respostas rapidas e objetivas. Ideal para a maioria dos atendimentos.</p>
                  {config.shared.llmModel === 'gpt-4o-mini' && <span className="inline-block mt-2 text-xs text-cyan-600 font-medium">Selecionado</span>}
                </button>
                <button
                  onClick={() => updateConfig({ shared: { ...config.shared, llmModel: 'gpt-4o', temperature: 0.5 } })}
                  className={`p-4 rounded-xl border-2 text-left transition-all ${
                    config.shared.llmModel === 'gpt-4o'
                      ? 'border-cyan-500 bg-cyan-50'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-indigo-600">A</span>
                    <span className="font-medium text-slate-800">Avancado</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">Respostas mais elaboradas e detalhadas. Para conversas complexas.</p>
                  {config.shared.llmModel === 'gpt-4o' && <span className="inline-block mt-2 text-xs text-cyan-600 font-medium">Selecionado</span>}
                </button>
              </div>
            </div>

            {/* Horario de atendimento */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <h3 className="text-lg font-semibold text-slate-800">Horario de Atendimento</h3>
                  <p className="text-slate-500 text-sm">Defina quando o agente deve responder automaticamente.</p>
                </div>
                <button
                  onClick={() => updateConfig({
                    shared: { ...config.shared, workHours: { ...config.shared.workHours, enabled: !config.shared.workHours.enabled } }
                  })}
                  className={`relative w-12 h-6 rounded-full transition-colors ${
                    config.shared.workHours.enabled ? 'bg-green-500' : 'bg-slate-300'
                  }`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                    config.shared.workHours.enabled ? 'translate-x-6' : ''
                  }`} />
                </button>
              </div>
              {!config.shared.workHours.enabled && (
                <p className="text-slate-400 text-xs mt-2">Desativado — o agente responde 24 horas por dia, 7 dias por semana.</p>
              )}
              {config.shared.workHours.enabled && (
                <div className="space-y-4 mt-4">
                  <div className="flex gap-4 items-end">
                    <div>
                      <label className="block text-slate-600 text-sm mb-1">De</label>
                      <select
                        value={config.shared.workHours.startHour}
                        onChange={e => updateConfig({ shared: { ...config.shared, workHours: { ...config.shared.workHours, startHour: parseInt(e.target.value) } } })}
                        className="px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-800 text-sm"
                      >
                        {Array.from({ length: 24 }, (_, i) => <option key={i} value={i}>{String(i).padStart(2, '0')}:00</option>)}
                      </select>
                    </div>
                    <span className="text-slate-400 pb-2.5">ate</span>
                    <div>
                      <label className="block text-slate-600 text-sm mb-1">Ate</label>
                      <select
                        value={config.shared.workHours.endHour}
                        onChange={e => updateConfig({ shared: { ...config.shared, workHours: { ...config.shared.workHours, endHour: parseInt(e.target.value) } } })}
                        className="px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-800 text-sm"
                      >
                        {Array.from({ length: 24 }, (_, i) => <option key={i} value={i}>{String(i).padStart(2, '0')}:00</option>)}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-slate-600 text-sm font-medium mb-2">Dias</label>
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
                            config.shared.workHours.workDays.includes(i) ? 'bg-cyan-50 text-cyan-600 border border-cyan-300' : 'bg-slate-50 text-slate-400 border border-slate-200'
                          }`}
                        >{day}</button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Voz do agente */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <h3 className="text-lg font-semibold text-slate-800">Voz do Agente</h3>
                  <p className="text-slate-500 text-sm">O agente pode enviar respostas em audio com voz realista.</p>
                </div>
                <button
                  onClick={() => updateConfig({ audio: { ...config.audio, enabled: !config.audio.enabled } })}
                  className={`relative w-12 h-6 rounded-full transition-colors ${
                    config.audio.enabled ? 'bg-green-500' : 'bg-slate-300'
                  }`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                    config.audio.enabled ? 'translate-x-6' : ''
                  }`} />
                </button>
              </div>
              {config.audio.enabled && (
                <div className="space-y-4 mt-4">
                  <div>
                    <label className="block text-slate-600 text-sm font-medium mb-2">Escolha uma voz</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {[
                        { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Sarah', desc: 'Feminina, profissional', lang: 'PT-BR' },
                        { id: '21m00Tcm4TlvDq8ikWAM', name: 'Rachel', desc: 'Feminina, acolhedora', lang: 'EN' },
                        { id: 'pNInz6obpgDQGcFmaJgB', name: 'Adam', desc: 'Masculina, confiante', lang: 'EN' },
                        { id: 'onwK4e9ZLuTAKqWW03F9', name: 'Daniel', desc: 'Masculino, amigavel', lang: 'PT-BR' },
                      ].map(voice => (
                        <button
                          key={voice.id}
                          onClick={() => updateConfig({ audio: { ...config.audio, voiceId: voice.id } })}
                          className={`flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all ${
                            config.audio.voiceId === voice.id ? 'border-cyan-500 bg-cyan-50' : 'border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center text-sm">
                            {voice.name[0]}
                          </div>
                          <div className="flex-1">
                            <div className="text-sm font-medium text-slate-800">{voice.name}</div>
                            <div className="text-xs text-slate-400">{voice.desc}</div>
                          </div>
                          <span className="text-[10px] text-slate-300 font-medium">{voice.lang}</span>
                        </button>
                      ))}
                    </div>
                    <p className="text-slate-400 text-xs mt-2">Ou cole um codigo de voz personalizado:</p>
                    <input
                      type="text"
                      value={config.audio.voiceId}
                      onChange={e => updateConfig({ audio: { ...config.audio, voiceId: e.target.value } })}
                      placeholder="Codigo da voz"
                      className="w-full mt-1 px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-800 text-sm placeholder:text-slate-400 focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config.audio.respondWithAudio}
                      onChange={e => updateConfig({ audio: { ...config.audio, respondWithAudio: e.target.checked } })}
                      className="w-4 h-4 rounded border-slate-300 text-cyan-600"
                    />
                    <span className="text-slate-600 text-sm">Enviar audio junto com a mensagem de texto</span>
                  </label>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
