'use client'

import { useState, useCallback, useEffect, useMemo } from 'react'
import { doc, updateDoc } from 'firebase/firestore'
import { db } from '@/lib/firebaseClient'
import { useSuperAdmin } from '@/hooks/useSuperAdmin'
import type { AgentWizardAnswers, SimpleAgentConfig } from '@/types/callRouting'
import { AGENT_STYLES } from '@/types/callRouting'
import {
  assemblePromptFromSimpleConfig,
  calculateSimpleConfigStrength,
  simpleConfigToWizardAnswers,
} from '@/lib/promptAssembler'
import type { CallAgentKnowledge } from '@/types/callRouting'
import PromptPreview from './PromptPreview'
import {
  SparklesIcon,
  CheckCircleIcon,
  DocumentTextIcon,
  ChevronDownIcon,
  PlusIcon,
  TrashIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline'

const EMPTY_SIMPLE_CONFIG: SimpleAgentConfig = {
  agentName: '',
  styleId: 'direto',
  companyName: '',
  aboutCompany: '',
  products: '',
  idealCustomer: '',
  specialistName: '',
  meetingDuration: 30,
  discoveryQuestions: [''],
  socialProof: [''],
  faq: [{ question: '', answer: '' }],
}

interface AgentWizardProps {
  orgId: string
  initialAnswers?: AgentWizardAnswers
  existingKnowledge?: CallAgentKnowledge
  onKnowledgeUpdate?: (updatedKnowledge: Partial<CallAgentKnowledge>) => void
}

export default function AgentWizard({ orgId, initialAnswers, existingKnowledge, onKnowledgeUpdate }: AgentWizardProps) {
  const { isSuperAdmin } = useSuperAdmin()

  const initialSimple: SimpleAgentConfig = initialAnswers?.simpleConfig || {
    agentName: initialAnswers?.agentName || existingKnowledge?.agentName || '',
    styleId: 'direto',
    companyName: initialAnswers?.companyName || existingKnowledge?.companyName || '',
    aboutCompany: initialAnswers?.valueProposition || existingKnowledge?.companyDescription || '',
    products: initialAnswers?.whatYouSell || existingKnowledge?.productsServices || '',
    idealCustomer: initialAnswers?.idealCustomer || existingKnowledge?.targetAudience || '',
    specialistName: initialAnswers?.specialistName || '',
    meetingDuration: initialAnswers?.meetingDuration || 30,
    discoveryQuestions: initialAnswers?.discoveryQuestions?.filter(q => q.trim()) || [''],
    socialProof: [''],
    faq: existingKnowledge?.faqItems?.map(f => ({ question: f.question, answer: f.answer })) || [{ question: '', answer: '' }],
  }

  const [config, setConfig] = useState<SimpleAgentConfig>(initialSimple)
  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)

  useEffect(() => {
    if (initialAnswers?.simpleConfig) {
      setConfig(initialAnswers.simpleConfig)
    }
  }, [initialAnswers])

  const strengthScore = useMemo(() => calculateSimpleConfigStrength(config), [config])

  const strengthLabel = strengthScore >= 86
    ? 'Agente forte'
    : strengthScore >= 61
      ? 'Agente bom'
      : strengthScore >= 31
        ? 'Agente razoável'
        : 'Agente fraco'

  const strengthColor = strengthScore >= 86
    ? 'text-emerald-600'
    : strengthScore >= 61
      ? 'text-blue-600'
      : strengthScore >= 31
        ? 'text-amber-600'
        : 'text-red-500'

  const updateField = useCallback((field: keyof SimpleAgentConfig, value: string | number) => {
    setConfig(prev => ({ ...prev, [field]: value }))
  }, [])

  const updateDiscoveryQuestion = useCallback((index: number, value: string) => {
    setConfig(prev => {
      const questions = [...(prev.discoveryQuestions || [''])]
      questions[index] = value
      return { ...prev, discoveryQuestions: questions }
    })
  }, [])

  const addDiscoveryQuestion = useCallback(() => {
    setConfig(prev => ({
      ...prev,
      discoveryQuestions: [...(prev.discoveryQuestions || []), ''],
    }))
  }, [])

  const removeDiscoveryQuestion = useCallback((index: number) => {
    setConfig(prev => ({
      ...prev,
      discoveryQuestions: (prev.discoveryQuestions || []).filter((_, i) => i !== index),
    }))
  }, [])

  const updateSocialProof = useCallback((index: number, value: string) => {
    setConfig(prev => {
      const proofs = [...(prev.socialProof || [''])]
      proofs[index] = value
      return { ...prev, socialProof: proofs }
    })
  }, [])

  const addSocialProof = useCallback(() => {
    setConfig(prev => ({
      ...prev,
      socialProof: [...(prev.socialProof || []), ''],
    }))
  }, [])

  const removeSocialProof = useCallback((index: number) => {
    setConfig(prev => ({
      ...prev,
      socialProof: (prev.socialProof || []).filter((_, i) => i !== index),
    }))
  }, [])

  const updateFaq = useCallback((index: number, field: 'question' | 'answer', value: string) => {
    setConfig(prev => {
      const faqs = [...(prev.faq || [{ question: '', answer: '' }])]
      faqs[index] = { ...faqs[index], [field]: value }
      return { ...prev, faq: faqs }
    })
  }, [])

  const addFaq = useCallback(() => {
    setConfig(prev => ({
      ...prev,
      faq: [...(prev.faq || []), { question: '', answer: '' }],
    }))
  }, [])

  const removeFaq = useCallback((index: number) => {
    setConfig(prev => ({
      ...prev,
      faq: (prev.faq || []).filter((_, i) => i !== index),
    }))
  }, [])

  const fieldWarnings = useMemo(() => {
    const warnings: Record<string, string> = {}
    if (config.aboutCompany.trim().length > 0 && config.aboutCompany.trim().length < 30)
      warnings.aboutCompany = 'Descricao muito curta — quanto mais detalhes, melhor o agente conversa'
    if (config.products.trim().length > 0 && config.products.trim().length < 20)
      warnings.products = 'Descreva melhor seus produtos para o agente nao ficar generico'
    if (config.idealCustomer.trim().length > 0 && config.idealCustomer.trim().length < 15)
      warnings.idealCustomer = 'Detalhe o perfil de cliente ideal para qualificacao mais precisa'
    return warnings
  }, [config.aboutCompany, config.products, config.idealCustomer])

  const handleFieldBlur = useCallback(async () => {
    if (!orgId) return
    setSaving(true)
    try {
      const wizardAnswers = simpleConfigToWizardAnswers(config)
      const configRef = doc(db, 'callRoutingConfig', orgId)
      await updateDoc(configRef, { 'agentKnowledge.wizardAnswers': wizardAnswers })
    } catch (error) {
      console.error('Error auto-saving:', error)
    } finally {
      setSaving(false)
    }
  }, [orgId, config])

  const handleSaveAgent = useCallback(async () => {
    if (!orgId) return
    setSaving(true)
    try {
      const prompt = assemblePromptFromSimpleConfig(config)
      const wizardAnswers = simpleConfigToWizardAnswers(config)
      wizardAnswers.strengthScore = strengthScore

      const faqItems = (config.faq || [])
        .filter(f => f.question.trim() && f.answer.trim())
        .map((f, i) => ({ id: `faq-${i}`, question: f.question.trim(), answer: f.answer.trim() }))

      const configRef = doc(db, 'callRoutingConfig', orgId)
      await updateDoc(configRef, {
        'agentKnowledge.wizardAnswers': wizardAnswers,
        'agentKnowledge.systemPrompt': prompt,
        'agentKnowledge.agentName': config.agentName,
        'agentKnowledge.agentRole': 'SDR Senior',
        'agentKnowledge.companyName': config.companyName,
        'agentKnowledge.companyDescription': config.aboutCompany,
        'agentKnowledge.productsServices': config.products,
        'agentKnowledge.targetAudience': config.idealCustomer,
        'agentKnowledge.faqItems': faqItems,
      })

      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)

      onKnowledgeUpdate?.({
        wizardAnswers,
        systemPrompt: prompt,
        agentName: config.agentName,
        agentRole: 'SDR Senior',
        companyName: config.companyName,
        companyDescription: config.aboutCompany,
        productsServices: config.products,
        targetAudience: config.idealCustomer,
        faqItems,
      })
    } catch (error) {
      console.error('Error saving agent:', error)
    } finally {
      setSaving(false)
    }
  }, [orgId, config, strengthScore, onKnowledgeUpdate])

  const handleSaveEditedPrompt = useCallback(async (editedPrompt: string) => {
    if (!orgId) return
    try {
      const wizardAnswers = simpleConfigToWizardAnswers(config)
      wizardAnswers.manuallyEdited = true

      const configRef = doc(db, 'callRoutingConfig', orgId)
      await updateDoc(configRef, {
        'agentKnowledge.wizardAnswers': wizardAnswers,
        'agentKnowledge.systemPrompt': editedPrompt,
      })

      onKnowledgeUpdate?.({
        wizardAnswers,
        systemPrompt: editedPrompt,
      })
    } catch (error) {
      console.error('Error saving edited prompt:', error)
      throw error
    }
  }, [orgId, config, onKnowledgeUpdate])

  const previewAnswers: AgentWizardAnswers = useMemo(() => simpleConfigToWizardAnswers(config), [config])
  const selectedStyle = AGENT_STYLES.find(s => s.id === config.styleId)

  return (
    <div className="space-y-6">
      {/* Strength indicator */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-amber-400 flex items-center justify-center text-white">
            <SparklesIcon className="w-6 h-6" />
          </div>
          <div>
            <h2 className="font-bold text-slate-800 dark:text-white">Configure seu Agente de Vendas</h2>
            <p className="text-sm text-slate-500">Preencha o basico e seu SDR IA estara pronto para prospectar.</p>
          </div>
        </div>
        <div className="text-right">
          <span className={`text-sm font-bold ${strengthColor}`}>{strengthScore}%</span>
          <p className={`text-xs ${strengthColor}`}>{strengthLabel}</p>
        </div>
      </div>

      {/* Strength bar */}
      <div className="w-full bg-slate-200 dark:bg-white/10 rounded-full h-2">
        <div
          className={`h-2 rounded-full transition-all duration-500 ${
            strengthScore >= 86 ? 'bg-emerald-500' :
            strengthScore >= 61 ? 'bg-blue-500' :
            strengthScore >= 31 ? 'bg-amber-500' : 'bg-red-500'
          }`}
          style={{ width: `${strengthScore}%` }}
        />
      </div>

      {/* Form */}
      <div className="bg-white dark:bg-surface-dark rounded-2xl border border-slate-200 dark:border-white/10 p-6 space-y-5">
        {/* Nome + Estilo */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Nome do Agente
            </label>
            <input
              type="text"
              value={config.agentName}
              onChange={(e) => updateField('agentName', e.target.value)}
              onBlur={handleFieldBlur}
              placeholder="Ex: Leo, Carol, Rafael"
              className="w-full px-3 py-2.5 border border-slate-200 dark:border-white/10 rounded-xl text-sm focus:outline-none focus:ring-4 focus:ring-primary/20 focus:border-primary/30 transition-all bg-white dark:bg-surface-dark"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Estilo de Abordagem
            </label>
            <div className="relative">
              <select
                value={config.styleId}
                onChange={(e) => {
                  updateField('styleId', e.target.value)
                  setTimeout(handleFieldBlur, 100)
                }}
                className="w-full px-3 py-2.5 border border-slate-200 dark:border-white/10 rounded-xl text-sm focus:outline-none focus:ring-4 focus:ring-primary/20 focus:border-primary/30 transition-all bg-white dark:bg-surface-dark appearance-none pr-10"
              >
                {AGENT_STYLES.map(style => (
                  <option key={style.id} value={style.id}>
                    {style.label}
                  </option>
                ))}
              </select>
              <ChevronDownIcon className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
            {selectedStyle && (
              <p className="text-xs text-slate-400 mt-1">{selectedStyle.description}</p>
            )}
          </div>
        </div>

        {/* Nome da empresa */}
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
            Nome da Empresa
          </label>
          <input
            type="text"
            value={config.companyName}
            onChange={(e) => updateField('companyName', e.target.value)}
            onBlur={handleFieldBlur}
            placeholder="Ex: Voxium, Labrego IA"
            className="w-full px-3 py-2.5 border border-slate-200 dark:border-white/10 rounded-xl text-sm focus:outline-none focus:ring-4 focus:ring-primary/20 focus:border-primary/30 transition-all bg-white dark:bg-surface-dark"
          />
        </div>

        {/* Sobre a empresa */}
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
            Sobre a Empresa
          </label>
          <textarea
            value={config.aboutCompany}
            onChange={(e) => updateField('aboutCompany', e.target.value)}
            onBlur={handleFieldBlur}
            placeholder="O que sua empresa faz? Qual o principal beneficio para quem contrata voces?"
            rows={3}
            className="w-full px-3 py-2.5 border border-slate-200 dark:border-white/10 rounded-xl text-sm focus:outline-none focus:ring-4 focus:ring-primary/20 focus:border-primary/30 transition-all resize-none bg-white dark:bg-surface-dark"
          />
          {fieldWarnings.aboutCompany && (
            <p className="flex items-center gap-1 mt-1 text-xs text-amber-600 dark:text-amber-400">
              <ExclamationTriangleIcon className="w-3.5 h-3.5 flex-shrink-0" />
              {fieldWarnings.aboutCompany}
            </p>
          )}
        </div>

        {/* Produtos / Servicos */}
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
            Produtos / Servicos
          </label>
          <textarea
            value={config.products}
            onChange={(e) => updateField('products', e.target.value)}
            onBlur={handleFieldBlur}
            placeholder="Descreva os principais produtos ou servicos que voces oferecem"
            rows={3}
            className="w-full px-3 py-2.5 border border-slate-200 dark:border-white/10 rounded-xl text-sm focus:outline-none focus:ring-4 focus:ring-primary/20 focus:border-primary/30 transition-all resize-none bg-white dark:bg-surface-dark"
          />
          {fieldWarnings.products && (
            <p className="flex items-center gap-1 mt-1 text-xs text-amber-600 dark:text-amber-400">
              <ExclamationTriangleIcon className="w-3.5 h-3.5 flex-shrink-0" />
              {fieldWarnings.products}
            </p>
          )}
        </div>

        {/* Cliente ideal */}
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
            Cliente Ideal
          </label>
          <textarea
            value={config.idealCustomer}
            onChange={(e) => updateField('idealCustomer', e.target.value)}
            onBlur={handleFieldBlur}
            placeholder="Qual o perfil do cliente perfeito? Ex: Empresas de 10 a 200 funcionarios..."
            rows={2}
            className="w-full px-3 py-2.5 border border-slate-200 dark:border-white/10 rounded-xl text-sm focus:outline-none focus:ring-4 focus:ring-primary/20 focus:border-primary/30 transition-all resize-none bg-white dark:bg-surface-dark"
          />
          {fieldWarnings.idealCustomer && (
            <p className="flex items-center gap-1 mt-1 text-xs text-amber-600 dark:text-amber-400">
              <ExclamationTriangleIcon className="w-3.5 h-3.5 flex-shrink-0" />
              {fieldWarnings.idealCustomer}
            </p>
          )}
        </div>

        {/* Perguntas de Discovery */}
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
            Perguntas de Discovery
            <span className="text-xs font-normal text-slate-400 ml-1">(opcional)</span>
          </label>
          <p className="text-xs text-slate-400 dark:text-slate-500 mb-2">
            Perguntas especificas do seu negocio para o agente fazer durante a ligacao.
          </p>
          <div className="space-y-2">
            {(config.discoveryQuestions || ['']).map((q, i) => (
              <div key={i} className="flex gap-2">
                <input
                  type="text"
                  value={q}
                  onChange={(e) => updateDiscoveryQuestion(i, e.target.value)}
                  onBlur={handleFieldBlur}
                  placeholder={
                    i === 0 ? 'Ex: Quantos vendedores tem na equipe hoje?'
                    : i === 1 ? 'Ex: Como voces fazem prospecao atualmente?'
                    : 'Adicione outra pergunta...'
                  }
                  className="flex-1 px-3 py-2 border border-slate-200 dark:border-white/10 rounded-xl text-sm focus:outline-none focus:ring-4 focus:ring-primary/20 focus:border-primary/30 transition-all bg-white dark:bg-surface-dark"
                />
                {(config.discoveryQuestions || []).length > 1 && (
                  <button
                    type="button"
                    onClick={() => { removeDiscoveryQuestion(i); setTimeout(handleFieldBlur, 100) }}
                    className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                  >
                    <TrashIcon className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
          {(config.discoveryQuestions || []).length < 5 && (
            <button
              type="button"
              onClick={addDiscoveryQuestion}
              className="flex items-center gap-1 mt-2 text-xs text-primary hover:text-primary/80 font-medium transition-colors"
            >
              <PlusIcon className="w-3.5 h-3.5" />
              Adicionar pergunta
            </button>
          )}
        </div>

        {/* Social Proof / Cases */}
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
            Resultados e Cases
            <span className="text-xs font-normal text-slate-400 ml-1">(opcional)</span>
          </label>
          <p className="text-xs text-slate-400 dark:text-slate-500 mb-2">
            Resultados reais de clientes para o agente usar como prova social.
          </p>
          <div className="space-y-2">
            {(config.socialProof || ['']).map((proof, i) => (
              <div key={i} className="flex gap-2">
                <input
                  type="text"
                  value={proof}
                  onChange={(e) => updateSocialProof(i, e.target.value)}
                  onBlur={handleFieldBlur}
                  placeholder={
                    i === 0 ? 'Ex: Empresa X aumentou 40% das vendas em 3 meses'
                    : i === 1 ? 'Ex: Reduzimos o tempo de prospecao em 60% para a Empresa Y'
                    : 'Adicione outro resultado...'
                  }
                  className="flex-1 px-3 py-2 border border-slate-200 dark:border-white/10 rounded-xl text-sm focus:outline-none focus:ring-4 focus:ring-primary/20 focus:border-primary/30 transition-all bg-white dark:bg-surface-dark"
                />
                {(config.socialProof || []).length > 1 && (
                  <button
                    type="button"
                    onClick={() => { removeSocialProof(i); setTimeout(handleFieldBlur, 100) }}
                    className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                  >
                    <TrashIcon className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
          {(config.socialProof || []).length < 5 && (
            <button
              type="button"
              onClick={addSocialProof}
              className="flex items-center gap-1 mt-2 text-xs text-primary hover:text-primary/80 font-medium transition-colors"
            >
              <PlusIcon className="w-3.5 h-3.5" />
              Adicionar resultado
            </button>
          )}
        </div>

        {/* FAQ */}
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
            Perguntas Frequentes (FAQ)
            <span className="text-xs font-normal text-slate-400 ml-1">(opcional)</span>
          </label>
          <p className="text-xs text-slate-400 dark:text-slate-500 mb-2">
            Perguntas que o prospect pode fazer e o agente precisa saber responder.
          </p>
          <div className="space-y-3">
            {(config.faq || [{ question: '', answer: '' }]).map((item, i) => (
              <div key={i} className="bg-slate-50 dark:bg-white/5 rounded-xl p-3 space-y-2">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={item.question}
                    onChange={(e) => updateFaq(i, 'question', e.target.value)}
                    onBlur={handleFieldBlur}
                    placeholder={
                      i === 0 ? 'Ex: Quanto custa o servico?'
                      : 'Pergunta do prospect...'
                    }
                    className="flex-1 px-3 py-2 border border-slate-200 dark:border-white/10 rounded-xl text-sm focus:outline-none focus:ring-4 focus:ring-primary/20 focus:border-primary/30 transition-all bg-white dark:bg-surface-dark"
                  />
                  {(config.faq || []).length > 1 && (
                    <button
                      type="button"
                      onClick={() => { removeFaq(i); setTimeout(handleFieldBlur, 100) }}
                      className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <textarea
                  value={item.answer}
                  onChange={(e) => updateFaq(i, 'answer', e.target.value)}
                  onBlur={handleFieldBlur}
                  placeholder={
                    i === 0 ? 'Ex: Nossos planos comecam a partir de R$297/mes, mas o valor exato depende do porte da empresa. Na reuniao o especialista apresenta a proposta personalizada.'
                    : 'Resposta que o agente deve dar...'
                  }
                  rows={2}
                  className="w-full px-3 py-2 border border-slate-200 dark:border-white/10 rounded-xl text-sm focus:outline-none focus:ring-4 focus:ring-primary/20 focus:border-primary/30 transition-all resize-none bg-white dark:bg-surface-dark"
                />
              </div>
            ))}
          </div>
          {(config.faq || []).length < 10 && (
            <button
              type="button"
              onClick={addFaq}
              className="flex items-center gap-1 mt-2 text-xs text-primary hover:text-primary/80 font-medium transition-colors"
            >
              <PlusIcon className="w-3.5 h-3.5" />
              Adicionar FAQ
            </button>
          )}
        </div>

        {/* Especialista + Duracao reuniao */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Nome do Especialista (para reuniao)
            </label>
            <input
              type="text"
              value={config.specialistName}
              onChange={(e) => updateField('specialistName', e.target.value)}
              onBlur={handleFieldBlur}
              placeholder="Ex: Lucas, Ana"
              className="w-full px-3 py-2.5 border border-slate-200 dark:border-white/10 rounded-xl text-sm focus:outline-none focus:ring-4 focus:ring-primary/20 focus:border-primary/30 transition-all bg-white dark:bg-surface-dark"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Duracao da Reuniao
            </label>
            <div className="relative">
              <select
                value={config.meetingDuration}
                onChange={(e) => {
                  updateField('meetingDuration', Number(e.target.value))
                  setTimeout(handleFieldBlur, 100)
                }}
                className="w-full px-3 py-2.5 border border-slate-200 dark:border-white/10 rounded-xl text-sm focus:outline-none focus:ring-4 focus:ring-primary/20 focus:border-primary/30 transition-all bg-white dark:bg-surface-dark appearance-none pr-10"
              >
                <option value={15}>15 minutos</option>
                <option value={30}>30 minutos</option>
                <option value={45}>45 minutos</option>
                <option value={60}>60 minutos</option>
              </select>
              <ChevronDownIcon className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Info box */}
        <div className="bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl p-4 text-xs text-slate-500 dark:text-slate-400 space-y-1">
          <p className="font-medium text-slate-600 dark:text-slate-300">O que ja vem pronto no seu agente:</p>
          <ul className="list-disc list-inside space-y-0.5">
            <li>Script de abertura adaptado ao estilo escolhido</li>
            <li>Framework SPIN Selling + BANT para qualificacao</li>
            <li>Tratamento de 6 objecoes com respostas no seu estilo</li>
            <li>Comportamento adaptativo por tipo de prospect</li>
            <li>Manejo de gatekeeper e script de voicemail</li>
            <li>Agendamento automatico via Google Calendar</li>
            <li>Controle de tempo e regras de desqualificacao</li>
          </ul>
        </div>

        {/* Actions */}
        <div className={`flex items-center ${isSuperAdmin ? 'justify-between' : 'justify-end'} pt-4 border-t border-slate-100 dark:border-white/5`}>
          {isSuperAdmin && (
            <button
              onClick={() => setPreviewOpen(true)}
              className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/15 rounded-xl transition-colors"
            >
              <DocumentTextIcon className="w-4 h-4" />
              Ver Prompt
            </button>
          )}

          <button
            onClick={handleSaveAgent}
            disabled={saving}
            className={`flex items-center gap-2 px-6 py-2.5 text-sm font-medium rounded-xl transition-all ${
              saveSuccess
                ? 'bg-emerald-600 text-white'
                : 'bg-primary text-white hover:bg-primary/90'
            }`}
          >
            {saveSuccess ? (
              <>
                <CheckCircleIcon className="w-4 h-4" />
                Salvo!
              </>
            ) : saving ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Salvando...
              </>
            ) : (
              'Salvar Agente'
            )}
          </button>
        </div>

        {saving && !saveSuccess && (
          <p className="text-xs text-slate-400 text-center animate-pulse">Salvando automaticamente...</p>
        )}
      </div>

      {/* Prompt Preview Drawer — apenas admin */}
      {isSuperAdmin && (
        <PromptPreview
          answers={previewAnswers}
          open={previewOpen}
          onClose={() => setPreviewOpen(false)}
          onSave={handleSaveEditedPrompt}
          savedCustomPrompt={undefined}
        />
      )}
    </div>
  )
}
