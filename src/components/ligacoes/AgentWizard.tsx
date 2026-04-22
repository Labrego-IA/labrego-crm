'use client'

import { useState, useCallback, useEffect, useMemo } from 'react'
import { doc, updateDoc } from 'firebase/firestore'
import { db } from '@/lib/firebaseClient'
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
}

interface AgentWizardProps {
  orgId: string
  initialAnswers?: AgentWizardAnswers
  existingKnowledge?: CallAgentKnowledge
  onKnowledgeUpdate?: (updatedKnowledge: Partial<CallAgentKnowledge>) => void
}

export default function AgentWizard({ orgId, initialAnswers, existingKnowledge, onKnowledgeUpdate }: AgentWizardProps) {
  const initialSimple: SimpleAgentConfig = initialAnswers?.simpleConfig || {
    agentName: initialAnswers?.agentName || existingKnowledge?.agentName || '',
    styleId: 'direto',
    companyName: initialAnswers?.companyName || existingKnowledge?.companyName || '',
    aboutCompany: initialAnswers?.valueProposition || existingKnowledge?.companyDescription || '',
    products: initialAnswers?.whatYouSell || existingKnowledge?.productsServices || '',
    idealCustomer: initialAnswers?.idealCustomer || existingKnowledge?.targetAudience || '',
    specialistName: initialAnswers?.specialistName || '',
    meetingDuration: initialAnswers?.meetingDuration || 30,
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
            <li>Script de abertura e gancho de atencao</li>
            <li>Perguntas de qualificacao e investigacao</li>
            <li>Tratamento de 5 objecoes mais comuns</li>
            <li>Comportamento adaptativo por tipo de prospect</li>
            <li>Regras de linguagem e function calling</li>
            <li>Agendamento automatico via Google Calendar</li>
          </ul>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-white/5">
          <button
            onClick={() => setPreviewOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/15 rounded-xl transition-colors"
          >
            <DocumentTextIcon className="w-4 h-4" />
            Ver Prompt
          </button>

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

      {/* Prompt Preview Drawer */}
      <PromptPreview
        answers={previewAnswers}
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        onSave={handleSaveEditedPrompt}
        savedCustomPrompt={undefined}
      />
    </div>
  )
}
