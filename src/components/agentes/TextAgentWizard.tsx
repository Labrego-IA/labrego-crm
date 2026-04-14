'use client'

import { useState } from 'react'
import { CheckCircleIcon } from '@heroicons/react/24/solid'
import type { TextAgentWizardAnswers } from '@/types/agentConfig'

interface TextAgentWizardProps {
  answers: TextAgentWizardAnswers
  onChange: (answers: TextAgentWizardAnswers) => void
  strengthScore: number
}

const PHASES = [
  { id: 1, name: 'Identidade', description: 'Quem e seu agente?' },
  { id: 2, name: 'Conhecimento', description: 'O que ele sabe?' },
  { id: 3, name: 'Comportamento', description: 'Como ele age?' },
  { id: 4, name: 'Regras', description: 'Quais sao os limites?' },
  { id: 5, name: 'Personalizacao', description: 'Detalhes finais' },
]

export default function TextAgentWizard({ answers, onChange, strengthScore }: TextAgentWizardProps) {
  const [activePhase, setActivePhase] = useState(1)

  const update = (field: keyof TextAgentWizardAnswers, value: unknown) => {
    const updated = { ...answers, [field]: value, lastUpdated: new Date().toISOString() }

    // Atualizar completedPhases
    const completedPhases = [...(updated.completedPhases || [])]
    if (!completedPhases.includes(activePhase)) {
      completedPhases.push(activePhase)
    }
    updated.completedPhases = completedPhases

    onChange(updated)
  }

  const isPhaseComplete = (phaseId: number): boolean => {
    return answers.completedPhases?.includes(phaseId) || false
  }

  return (
    <div className="space-y-6">
      {/* Strength Score */}
      <div className="bg-white dark:bg-surface-dark border border-slate-200 dark:border-white/10 rounded-2xl p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-slate-600 dark:text-slate-400 text-sm">Forca do Agente</span>
          <span className={`text-lg font-bold ${
            strengthScore >= 80 ? 'text-green-400' :
            strengthScore >= 50 ? 'text-yellow-400' :
            'text-red-400'
          }`}>
            {strengthScore}%
          </span>
        </div>
        <div className="w-full bg-slate-200 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all duration-500 ${
              strengthScore >= 80 ? 'bg-green-400' :
              strengthScore >= 50 ? 'bg-yellow-400' :
              'bg-red-400'
            }`}
            style={{ width: `${strengthScore}%` }}
          />
        </div>
      </div>

      {/* Phase Navigation */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {PHASES.map(phase => (
          <button
            key={phase.id}
            onClick={() => setActivePhase(phase.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
              activePhase === phase.id
                ? 'bg-cyan-50 text-cyan-600 border border-cyan-300'
                : isPhaseComplete(phase.id)
                  ? 'bg-green-50 text-green-400 border border-green-200'
                  : 'bg-white dark:bg-surface-dark text-slate-500 border border-slate-200 dark:border-white/10 hover:bg-slate-100'
            }`}
          >
            <span>{phase.name}</span>
            {isPhaseComplete(phase.id) && <CheckCircleIcon className="w-4 h-4 text-green-400" />}
          </button>
        ))}
      </div>

      {/* Phase Content */}
      <div className="bg-white dark:bg-surface-dark border border-slate-200 dark:border-white/10 rounded-2xl p-6">
        <h3 className="text-lg font-semibold text-slate-800 dark:text-white mb-1">
          {PHASES[activePhase - 1].name}
        </h3>
        <p className="text-slate-500 text-sm mb-6">{PHASES[activePhase - 1].description}</p>

        {/* Fase 1: Identidade */}
        {activePhase === 1 && (
          <div className="space-y-4">
            <Field label="Nome do Agente" placeholder="Ex: Bia, Max, Luna"
              value={answers.agentName} onChange={v => update('agentName', v)} />
            <Field label="Papel/Funcao" placeholder="Ex: Atendente, Consultor, Suporte Tecnico"
              value={answers.agentRole} onChange={v => update('agentRole', v)} />
            <Field label="Nome da Empresa" placeholder="Nome da sua empresa"
              value={answers.companyName} onChange={v => update('companyName', v)} />
            <Field label="Tom de Voz" placeholder="Ex: Profissional e amigavel, Descontraido, Formal"
              value={answers.toneDescription} onChange={v => update('toneDescription', v)} />
          </div>
        )}

        {/* Fase 2: Conhecimento */}
        {activePhase === 2 && (
          <div className="space-y-4">
            <TextArea label="O que voce vende/oferece?" placeholder="Descreva seus produtos ou servicos..."
              value={answers.whatYouSell} onChange={v => update('whatYouSell', v)} />
            <TextArea label="Informacoes-chave" placeholder="Horarios, precos, politicas, enderecos..."
              value={answers.keyInformation} onChange={v => update('keyInformation', v)} />
            <TextArea label="Diferenciais" placeholder="O que diferencia voce da concorrencia?"
              value={answers.differentials} onChange={v => update('differentials', v)} />
            <Field label="Publico-alvo" placeholder="Quem sao seus clientes?"
              value={answers.targetAudience} onChange={v => update('targetAudience', v)} />
          </div>
        )}

        {/* Fase 3: Comportamento */}
        {activePhase === 3 && (
          <div className="space-y-4">
            <TextArea label="Mensagem de Saudacao" placeholder="A primeira mensagem que o agente envia..."
              value={answers.greetingMessage} onChange={v => update('greetingMessage', v)} />
            <TextArea label="Mensagem Fora do Horario" placeholder="Mensagem quando nao esta no horario de atendimento..."
              value={answers.offHoursMessage} onChange={v => update('offHoursMessage', v)} />
            <div>
              <label className="block text-slate-600 dark:text-slate-400 text-sm font-medium mb-1">Maximo de mensagens antes de sugerir humano</label>
              <input
                type="number"
                min={3}
                max={50}
                value={answers.maxTurnsBeforeHandoff || 10}
                onChange={e => update('maxTurnsBeforeHandoff', parseInt(e.target.value) || 10)}
                className="w-32 px-3 py-2 bg-white dark:bg-surface-dark border border-slate-300 rounded-lg text-slate-800 dark:text-white text-sm focus:outline-none focus:border-cyan-500"
              />
            </div>
            <div>
              <label className="block text-slate-600 dark:text-slate-400 text-sm font-medium mb-2">Estilo de Resposta</label>
              <div className="flex gap-3">
                {(['formal', 'balanced', 'informal'] as const).map(style => (
                  <button
                    key={style}
                    onClick={() => update('responseStyle', style)}
                    className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                      answers.responseStyle === style
                        ? 'bg-cyan-50 text-cyan-600 border border-cyan-300'
                        : 'bg-slate-100 dark:bg-white/10 text-slate-500 border border-slate-300 hover:bg-slate-200'
                    }`}
                  >
                    {style === 'formal' ? 'Formal' : style === 'balanced' ? 'Equilibrado' : 'Informal'}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Fase 4: Regras */}
        {activePhase === 4 && (
          <div className="space-y-4">
            <div>
              <label className="block text-slate-600 dark:text-slate-400 text-sm font-medium mb-1">Palavras-chave para Handoff Humano</label>
              <p className="text-slate-300 text-xs mb-2">Quando o cliente usar essas palavras, o agente transfere para um humano.</p>
              <input
                type="text"
                value={answers.handoffKeywords?.join(', ') || ''}
                onChange={e => update('handoffKeywords', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                placeholder="falar com humano, atendente, gerente, reclamacao"
                className="w-full px-3 py-2 bg-white dark:bg-surface-dark border border-slate-300 rounded-lg text-slate-800 dark:text-white text-sm placeholder:text-slate-400 focus:outline-none focus:border-cyan-500"
              />
            </div>
            <TextArea label="Temas Proibidos" placeholder="Temas que o agente NAO deve abordar..."
              value={answers.forbiddenTopics} onChange={v => update('forbiddenTopics', v)} />
            <TextArea label="Escopo de Atuacao" placeholder="O que o agente pode e deve fazer (ex: responder duvidas, agendar, informar precos)..."
              value={answers.scopeDescription} onChange={v => update('scopeDescription', v)} />
          </div>
        )}

        {/* Fase 5: Personalizacao */}
        {activePhase === 5 && (
          <div className="space-y-4">
            <Field label="Expressoes-chave" placeholder="Separadas por virgula: com certeza, fico feliz em ajudar"
              value={answers.keyExpressions} onChange={v => update('keyExpressions', v)} />
            <Field label="Assinatura de Encerramento" placeholder="Ex: Atenciosamente, Equipe XYZ"
              value={answers.signatureClosing} onChange={v => update('signatureClosing', v)} />
            <TextArea label="Regras Adicionais de Comportamento" placeholder="Qualquer regra extra para o agente seguir..."
              value={answers.behaviorRules} onChange={v => update('behaviorRules', v)} />
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex justify-between">
        <button
          onClick={() => setActivePhase(Math.max(1, activePhase - 1))}
          disabled={activePhase === 1}
          className="px-4 py-2 text-slate-500 hover:text-slate-600 dark:text-slate-400 text-sm transition-colors disabled:opacity-30"
        >
          Anterior
        </button>
        <button
          onClick={() => setActivePhase(Math.min(5, activePhase + 1))}
          disabled={activePhase === 5}
          className="px-6 py-2 bg-cyan-50 hover:bg-secondary/20 text-secondary-700 font-medium rounded-xl transition-colors text-sm disabled:opacity-30"
        >
          Proximo
        </button>
      </div>
    </div>
  )
}

// ========== FIELD COMPONENTS ==========

function Field({ label, placeholder, value, onChange }: {
  label: string; placeholder: string; value: string; onChange: (v: string) => void
}) {
  return (
    <div>
      <label className="block text-slate-600 dark:text-slate-400 text-sm font-medium mb-1">{label}</label>
      <input
        type="text"
        value={value || ''}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 bg-white dark:bg-surface-dark border border-slate-300 rounded-lg text-slate-800 dark:text-white text-sm placeholder:text-slate-400 focus:outline-none focus:border-cyan-500"
      />
    </div>
  )
}

function TextArea({ label, placeholder, value, onChange }: {
  label: string; placeholder: string; value: string; onChange: (v: string) => void
}) {
  return (
    <div>
      <label className="block text-slate-600 dark:text-slate-400 text-sm font-medium mb-1">{label}</label>
      <textarea
        value={value || ''}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        rows={3}
        className="w-full px-3 py-2 bg-white dark:bg-surface-dark border border-slate-300 rounded-lg text-slate-800 dark:text-white text-sm placeholder:text-slate-400 focus:outline-none focus:border-cyan-500 resize-none"
      />
    </div>
  )
}
