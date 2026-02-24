/**
 * Prompt Assembler — Story 12.1
 * Monta um system prompt profissional a partir das respostas do wizard gamificado.
 * Calcula o Agent Strength Score (0-100) baseado na completude das fases.
 */

import type { AgentWizardAnswers, CallAgentKnowledge } from '@/types/callRouting'

/* ================================= Constants ================================= */

const PHASE_WEIGHTS: Record<number, number> = {
  1: 20, // Identidade
  2: 20, // Negocio
  3: 10, // Abertura
  4: 15, // Investigacao
  5: 15, // Proposta & Agendamento
  6: 15, // Objecoes
  7: 5,  // Linguagem & Regras
}

const PHASE_FIELDS: Record<number, (keyof AgentWizardAnswers)[]> = {
  1: ['agentName', 'agentRole', 'companyName', 'toneDescription'],
  2: ['whatYouSell', 'idealCustomer', 'differentials', 'valueProposition'],
  3: ['openingApproach', 'hookStrategy'],
  4: ['discoveryQuestions', 'qualificationCriteria'],
  5: ['solutionBridge', 'specialistName', 'meetingDuration'],
  6: ['objections'],
  7: ['forbiddenWords', 'keyExpressions', 'behaviorRules'],
}

/* ================================= Helpers ================================= */

function isFieldFilled(value: unknown): boolean {
  if (value === null || value === undefined) return false
  if (typeof value === 'string') return value.trim().length > 0
  if (typeof value === 'number') return value > 0
  if (Array.isArray(value)) return value.length > 0
  return false
}

function phaseCompleteness(answers: AgentWizardAnswers, phase: number): number {
  const fields = PHASE_FIELDS[phase]
  if (!fields || fields.length === 0) return 0

  let filled = 0
  for (const field of fields) {
    if (isFieldFilled(answers[field])) filled++
  }

  return filled / fields.length
}

/* ================================= Strength ================================= */

export function calculateAgentStrength(answers: AgentWizardAnswers): number {
  let weightedSum = 0
  let totalWeight = 0

  for (const [phaseStr, weight] of Object.entries(PHASE_WEIGHTS)) {
    const phase = Number(phaseStr)
    const completeness = phaseCompleteness(answers, phase)
    weightedSum += weight * completeness
    totalWeight += weight
  }

  return totalWeight > 0 ? Math.round((weightedSum / totalWeight) * 100) : 0
}

/* ================================= Prompt Assembly ================================= */

function buildIdentitySection(a: AgentWizardAnswers): string {
  const lines: string[] = []
  lines.push('## IDENTIDADE')
  lines.push('')
  if (a.agentName) lines.push(`Voce e ${a.agentName}, ${a.agentRole || 'assistente'} da ${a.companyName || 'empresa'}.`)
  if (a.toneDescription) lines.push(`Tom de voz: ${a.toneDescription}`)
  lines.push('Voce e uma inteligencia artificial especializada em prospectar clientes por telefone.')
  lines.push('Seu objetivo e qualificar leads e agendar reunioes com o especialista da empresa.')
  lines.push('')
  return lines.join('\n')
}

function buildPrinciplesSection(a: AgentWizardAnswers): string {
  const lines: string[] = []
  lines.push('## PRINCIPIOS DE COMPORTAMENTO')
  lines.push('')
  lines.push('1. ESCUTA ATIVA: Deixe o prospect falar, demonstre interesse genuino.')
  lines.push('2. EMPATIA: Valide sentimentos e preocupacoes do prospect antes de responder.')
  lines.push('3. OBJETIVIDADE: Seja direto sem ser agressivo, respeite o tempo do prospect.')
  lines.push('4. PERSISTENCIA INTELIGENTE: Nao desista no primeiro "nao", mas saiba quando recuar.')
  lines.push('5. NATURALIDADE: Fale como um humano, evite respostas roboticas.')
  lines.push('6. FOCO NO VALOR: Sempre conecte a conversa ao beneficio para o prospect.')
  lines.push('')
  return lines.join('\n')
}

function buildBusinessSection(a: AgentWizardAnswers): string {
  const lines: string[] = []
  lines.push('## CONHECIMENTO DO NEGOCIO')
  lines.push('')
  if (a.whatYouSell) lines.push(`**O que vendemos:** ${a.whatYouSell}`)
  if (a.idealCustomer) lines.push(`**Cliente ideal:** ${a.idealCustomer}`)
  if (a.differentials) lines.push(`**Diferenciais:** ${a.differentials}`)
  if (a.valueProposition) lines.push(`**Proposta de valor:** ${a.valueProposition}`)
  lines.push('')
  return lines.join('\n')
}

function buildConversationFlowSection(a: AgentWizardAnswers): string {
  const lines: string[] = []
  lines.push('## FLUXO DE CONVERSA')
  lines.push('')

  // Abertura
  lines.push('### Abertura')
  if (a.openingApproach) {
    lines.push(a.openingApproach)
  } else {
    lines.push('Apresente-se de forma breve e profissional. Confirme o nome do prospect.')
  }
  if (a.hookStrategy) {
    lines.push(`**Gancho de atencao:** ${a.hookStrategy}`)
  }
  lines.push('')

  // Investigacao
  lines.push('### Investigacao')
  lines.push('Faca perguntas para entender a situacao e dor do prospect:')
  if (a.discoveryQuestions && a.discoveryQuestions.length > 0) {
    for (const q of a.discoveryQuestions) {
      if (q.trim()) lines.push(`- "${q.trim()}"`)
    }
  } else {
    lines.push('- Faca perguntas abertas para descobrir necessidades e desafios.')
  }
  if (a.qualificationCriteria) {
    lines.push('')
    lines.push(`**Criterios de qualificacao:** ${a.qualificationCriteria}`)
  }
  lines.push('')

  // Proposta
  lines.push('### Proposta de Valor')
  if (a.solutionBridge) {
    lines.push(a.solutionBridge)
  } else {
    lines.push('Conecte a dor identificada a solucao da empresa. Mostre como a solucao resolve o problema especifico do prospect.')
  }
  lines.push('')

  // Agendamento
  lines.push('### Agendamento')
  const specialist = a.specialistName || 'nosso especialista'
  const duration = a.meetingDuration || 30
  lines.push(`Proponha uma reuniao com ${specialist} de ${duration} minutos.`)
  lines.push('Use a funcao check_calendar_availability para verificar horarios disponiveis.')
  lines.push('Ofereca 2-3 opcoes de horario. Confirme data, horario e email do prospect.')
  lines.push('Use a funcao book_meeting para agendar apos confirmacao.')
  lines.push('')

  return lines.join('\n')
}

function buildObjectionsSection(a: AgentWizardAnswers): string {
  const lines: string[] = []
  lines.push('## TRATAMENTO DE OBJECOES')
  lines.push('')

  if (a.objections && a.objections.length > 0) {
    for (const obj of a.objections) {
      if (obj.objection.trim()) {
        lines.push(`**Objecao:** "${obj.objection.trim()}"`)
        lines.push(`**Resposta:** ${obj.response.trim()}`)
        lines.push('')
      }
    }
  }

  // Objecoes padrao sempre inclusas
  lines.push('**Objecao generica:** Se o prospect levantar uma objecao nao listada acima:')
  lines.push('1. Valide a preocupacao ("Entendo perfeitamente...")')
  lines.push('2. Recontextualize o valor')
  lines.push('3. Proponha um proximo passo de baixo compromisso')
  lines.push('')

  return lines.join('\n')
}

function buildAdaptiveBehaviorSection(): string {
  const lines: string[] = []
  lines.push('## COMPORTAMENTO ADAPTATIVO')
  lines.push('')
  lines.push('- Se o prospect parecer apressado: seja mais direto, va ao ponto.')
  lines.push('- Se o prospect parecer interessado: aprofunde a conversa, faca mais perguntas.')
  lines.push('- Se o prospect parecer cético: use dados e casos de sucesso.')
  lines.push('- Se o prospect nao for o decisor: descubra quem e e proponha incluir na reuniao.')
  lines.push('- Se o prospect pedir para enviar material: envie, mas ja sugira um horario para a reuniao.')
  lines.push('')
  return lines.join('\n')
}

function buildRulesSection(a: AgentWizardAnswers): string {
  const lines: string[] = []
  lines.push('## REGRAS DE LINGUAGEM')
  lines.push('')

  if (a.keyExpressions) {
    const expressions = a.keyExpressions.split(',').map(e => e.trim()).filter(Boolean)
    if (expressions.length > 0) {
      lines.push('**Expressoes-chave para usar:**')
      for (const expr of expressions) lines.push(`- "${expr}"`)
      lines.push('')
    }
  }

  if (a.forbiddenWords) {
    const forbidden = a.forbiddenWords.split(',').map(w => w.trim()).filter(Boolean)
    if (forbidden.length > 0) {
      lines.push('**Palavras/expressoes PROIBIDAS:**')
      for (const word of forbidden) lines.push(`- "${word}"`)
      lines.push('')
    }
  }

  if (a.behaviorRules) {
    lines.push('**Regras adicionais:**')
    lines.push(a.behaviorRules)
    lines.push('')
  }

  lines.push('## REGRAS DE FUNCTION CALLING')
  lines.push('')
  lines.push('- Use `check_calendar_availability` para verificar horarios antes de propor.')
  lines.push('- Use `book_meeting` somente apos confirmar data, horario e email com o prospect.')
  lines.push('- Use `end_call` quando: reuniao agendada com sucesso, prospect pede para encerrar, ou prospect claramente desqualificado.')
  lines.push('')

  return lines.join('\n')
}

function buildDynamicVariablesSection(): string {
  const lines: string[] = []
  lines.push('## VARIAVEIS DINAMICAS')
  lines.push('')
  lines.push('As seguintes variaveis serao substituidas automaticamente em cada ligacao:')
  lines.push('- {{contactName}} — Nome do prospect')
  lines.push('- {{prospectCompany}} — Empresa do prospect')
  lines.push('- {{prospectSegment}} — Segmento do prospect')
  lines.push('- {{todayDate}} — Data de hoje')
  lines.push('')
  return lines.join('\n')
}

/* ================================= Migration ================================= */

export function migrateKnowledgeToWizard(k: CallAgentKnowledge): AgentWizardAnswers {
  return {
    agentName: k.agentName || '',
    agentRole: k.agentRole || '',
    companyName: k.companyName || '',
    toneDescription: k.toneOfVoice || '',
    whatYouSell: k.productsServices || '',
    idealCustomer: k.targetAudience || '',
    differentials: k.competitiveDifferentials || '',
    valueProposition: k.valueProposition || '',
    openingApproach: k.firstMessage || '',
    hookStrategy: '',
    discoveryQuestions: [],
    qualificationCriteria: '',
    solutionBridge: '',
    specialistName: '',
    meetingDuration: 30,
    objections: k.commonObjections?.map(o => ({ objection: o.objection, response: o.response })) || [],
    forbiddenWords: k.forbiddenPhrases?.join(', ') || '',
    keyExpressions: k.keyPhrases?.join(', ') || '',
    behaviorRules: '',
    completedPhases: [],
    strengthScore: 0,
    lastUpdated: new Date().toISOString(),
  }
}

/* ================================= Prompt Assembly ================================= */

export function assemblePromptFromWizard(answers: AgentWizardAnswers): string {
  const sections: string[] = []

  sections.push(buildIdentitySection(answers))
  sections.push(buildPrinciplesSection(answers))
  sections.push(buildBusinessSection(answers))
  sections.push(buildConversationFlowSection(answers))
  sections.push(buildObjectionsSection(answers))
  sections.push(buildAdaptiveBehaviorSection())
  sections.push(buildRulesSection(answers))
  sections.push(buildDynamicVariablesSection())

  return sections.join('\n').trim()
}
