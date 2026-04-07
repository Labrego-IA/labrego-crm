/**
 * Agent Engine — Core compartilhado para agentes IA (WhatsApp + Email)
 *
 * Responsabilidades:
 * - Montar system prompt a partir do wizard + FAQ
 * - Processar mensagens incoming (texto, audio, imagem, documento)
 * - Gerenciar contexto de conversa
 * - Classificar intencao e decidir handoff
 * - Chamar LLM (GPT-4o-mini)
 * - Gerar audio via ElevenLabs (TTS)
 * - Transcrever audio via OpenAI Whisper (STT)
 */

import type {
  AgentConfig,
  AgentResponse,
  ChannelMessage,
  ConversationMessage,
  CRMAction,
  FAQItem,
  TextAgentWizardAnswers,
} from '@/types/agentConfig'

// ========== CONSTANTS ==========

const PHASE_WEIGHTS: Record<number, number> = {
  1: 25, // Identidade
  2: 25, // Conhecimento
  3: 15, // Comportamento
  4: 20, // Regras
  5: 15, // Personalizacao
}

const PHASE_FIELDS: Record<number, (keyof TextAgentWizardAnswers)[]> = {
  1: ['agentName', 'agentRole', 'companyName', 'toneDescription'],
  2: ['whatYouSell', 'keyInformation', 'differentials', 'targetAudience'],
  3: ['greetingMessage', 'offHoursMessage', 'maxTurnsBeforeHandoff'],
  4: ['handoffKeywords', 'forbiddenTopics', 'scopeDescription'],
  5: ['keyExpressions', 'signatureClosing', 'behaviorRules'],
}

const MAX_CONTEXT_MESSAGES = 20
const OPENAI_API_URL = 'https://api.openai.com/v1'
const ELEVENLABS_API_URL = 'https://api.elevenlabs.io/v1'

// ========== STRENGTH SCORE ==========

function isFieldFilled(value: unknown): boolean {
  if (value === null || value === undefined) return false
  if (typeof value === 'string') return value.trim().length > 0
  if (typeof value === 'number') return value > 0
  if (Array.isArray(value)) return value.length > 0
  return false
}

function phaseCompleteness(answers: TextAgentWizardAnswers, phase: number): number {
  const fields = PHASE_FIELDS[phase]
  if (!fields || fields.length === 0) return 0

  let filled = 0
  for (const field of fields) {
    if (isFieldFilled(answers[field])) filled++
  }
  return filled / fields.length
}

export function calculateTextAgentStrength(answers: TextAgentWizardAnswers): number {
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

// ========== PROMPT ASSEMBLY ==========

function buildIdentitySection(a: TextAgentWizardAnswers): string {
  const lines: string[] = []
  lines.push('## IDENTIDADE')
  lines.push('')
  if (a.agentName) lines.push(`Voce e ${a.agentName}, ${a.agentRole || 'atendente'} da ${a.companyName || 'empresa'}.`)
  if (a.toneDescription) lines.push(`Tom de voz: ${a.toneDescription}`)
  lines.push('Voce e uma inteligencia artificial especializada em atendimento ao cliente via mensagens de texto.')
  lines.push('Seu objetivo e ajudar os clientes de forma rapida, precisa e humanizada.')
  lines.push('')
  return lines.join('\n')
}

function buildKnowledgeSection(a: TextAgentWizardAnswers): string {
  const lines: string[] = []
  lines.push('## CONHECIMENTO DO NEGOCIO')
  lines.push('')
  if (a.whatYouSell) lines.push(`**O que oferecemos:** ${a.whatYouSell}`)
  if (a.targetAudience) lines.push(`**Publico-alvo:** ${a.targetAudience}`)
  if (a.differentials) lines.push(`**Diferenciais:** ${a.differentials}`)
  if (a.keyInformation) lines.push(`**Informacoes importantes:** ${a.keyInformation}`)
  lines.push('')
  return lines.join('\n')
}

function buildFAQSection(faq: FAQItem[]): string {
  if (!faq || faq.length === 0) return ''

  const lines: string[] = []
  lines.push('## PERGUNTAS FREQUENTES (FAQ)')
  lines.push('')
  lines.push('Use estas respostas como referencia. Adapte o tom conforme o contexto da conversa:')
  lines.push('')

  for (const item of faq) {
    if (item.question.trim() && item.answer.trim()) {
      lines.push(`**P:** ${item.question.trim()}`)
      lines.push(`**R:** ${item.answer.trim()}`)
      lines.push('')
    }
  }

  return lines.join('\n')
}

function buildBehaviorSection(a: TextAgentWizardAnswers): string {
  const lines: string[] = []
  lines.push('## COMPORTAMENTO')
  lines.push('')

  if (a.greetingMessage) {
    lines.push(`**Saudacao padrao:** "${a.greetingMessage}"`)
    lines.push('')
  }

  const styleMap = { formal: 'Formal e profissional', informal: 'Informal e descontraido', balanced: 'Equilibrado entre formal e informal' }
  lines.push(`**Estilo de resposta:** ${styleMap[a.responseStyle] || 'Equilibrado'}`)
  lines.push('')

  lines.push('**Principios:**')
  lines.push('1. Responda de forma concisa e direta — mensagens de texto devem ser curtas.')
  lines.push('2. Use emojis com moderacao quando apropriado ao tom.')
  lines.push('3. Nao envie mensagens muito longas — divida em partes se necessario.')
  lines.push('4. Se nao souber a resposta, diga honestamente e ofereça alternativas.')
  lines.push('5. Sempre que possivel, resolva a duvida na propria conversa.')
  lines.push('')

  return lines.join('\n')
}

function buildRulesSection(a: TextAgentWizardAnswers): string {
  const lines: string[] = []
  lines.push('## REGRAS E LIMITES')
  lines.push('')

  if (a.scopeDescription) {
    lines.push(`**Escopo de atuacao:** ${a.scopeDescription}`)
    lines.push('')
  }

  if (a.forbiddenTopics) {
    lines.push(`**Temas PROIBIDOS (nao abordar):** ${a.forbiddenTopics}`)
    lines.push('')
  }

  if (a.handoffKeywords && a.handoffKeywords.length > 0) {
    lines.push('**Transferir para humano quando:**')
    lines.push('- O cliente pedir explicitamente para falar com um humano')
    lines.push(`- O cliente usar palavras como: ${a.handoffKeywords.join(', ')}`)
    lines.push(`- A conversa ultrapassar ${a.maxTurnsBeforeHandoff || 10} mensagens sem resolucao`)
    lines.push('- O assunto estiver fora do seu escopo de atuacao')
    lines.push('')
  }

  return lines.join('\n')
}

function buildPersonalizationSection(a: TextAgentWizardAnswers): string {
  const lines: string[] = []
  lines.push('## PERSONALIZACAO')
  lines.push('')

  if (a.keyExpressions) {
    const expressions = a.keyExpressions.split(',').map(e => e.trim()).filter(Boolean)
    if (expressions.length > 0) {
      lines.push('**Expressoes-chave para usar:**')
      for (const expr of expressions) lines.push(`- "${expr}"`)
      lines.push('')
    }
  }

  if (a.signatureClosing) {
    lines.push(`**Encerramento:** ${a.signatureClosing}`)
    lines.push('')
  }

  if (a.behaviorRules) {
    lines.push('**Regras adicionais:**')
    lines.push(a.behaviorRules)
    lines.push('')
  }

  return lines.join('\n')
}

function buildMediaInstructions(): string {
  const lines: string[] = []
  lines.push('## INSTRUCOES PARA MIDIA')
  lines.push('')
  lines.push('- Se o cliente enviar uma **imagem**, voce recebera uma descricao da imagem. Responda com base no conteudo descrito.')
  lines.push('- Se o cliente enviar um **audio**, voce recebera a transcricao. Responda normalmente como se fosse texto.')
  lines.push('- Se o cliente enviar um **documento**, voce recebera o texto extraido. Use o conteudo para responder.')
  lines.push('- Sempre confirme que entendeu o conteudo da midia antes de responder.')
  lines.push('')
  return lines.join('\n')
}

function buildDynamicVariablesSection(): string {
  const lines: string[] = []
  lines.push('## VARIAVEIS DINAMICAS')
  lines.push('')
  lines.push('As seguintes informacoes serao fornecidas automaticamente:')
  lines.push('- Nome do contato (quando disponivel)')
  lines.push('- Data e hora atual')
  lines.push('- Historico recente da conversa')
  lines.push('')
  return lines.join('\n')
}

export function assembleTextAgentPrompt(
  answers: TextAgentWizardAnswers,
  faq: FAQItem[]
): string {
  const sections: string[] = []

  sections.push(buildIdentitySection(answers))
  sections.push(buildKnowledgeSection(answers))
  sections.push(buildFAQSection(faq))
  sections.push(buildBehaviorSection(answers))
  sections.push(buildRulesSection(answers))
  sections.push(buildPersonalizationSection(answers))
  sections.push(buildMediaInstructions())
  sections.push(buildDynamicVariablesSection())

  return sections.join('\n').trim()
}

// ========== MEDIA PROCESSING ==========

/** Transcreve audio usando OpenAI Whisper */
export async function transcribeAudio(audioUrl: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('OPENAI_API_KEY nao configurada')

  // Download do audio
  const audioResponse = await fetch(audioUrl)
  if (!audioResponse.ok) throw new Error(`Falha ao baixar audio: ${audioResponse.status}`)
  const audioBuffer = await audioResponse.arrayBuffer()

  // Enviar para Whisper
  const formData = new FormData()
  formData.append('file', new Blob([audioBuffer], { type: 'audio/ogg' }), 'audio.ogg')
  formData.append('model', 'whisper-1')
  formData.append('language', 'pt')

  const response = await fetch(`${OPENAI_API_URL}/audio/transcriptions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: formData,
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Whisper API error: ${error}`)
  }

  const result = await response.json()
  return result.text || ''
}

/** Descreve imagem usando GPT-4o vision */
export async function describeImage(imageUrl: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('OPENAI_API_KEY nao configurada')

  const response = await fetch(`${OPENAI_API_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Descreva o conteudo desta imagem de forma concisa em portugues. Se houver texto na imagem, transcreva-o.' },
            { type: 'image_url', image_url: { url: imageUrl } },
          ],
        },
      ],
      max_tokens: 500,
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Vision API error: ${error}`)
  }

  const result = await response.json()
  return result.choices?.[0]?.message?.content || 'Nao foi possivel descrever a imagem.'
}

/** Gera audio a partir de texto usando ElevenLabs */
export async function generateAudio(text: string, voiceId: string): Promise<Buffer> {
  const apiKey = process.env.ELEVENLABS_API_KEY
  if (!apiKey) throw new Error('ELEVENLABS_API_KEY nao configurada')
  if (!voiceId) throw new Error('Voice ID nao configurado')

  const response = await fetch(`${ELEVENLABS_API_URL}/text-to-speech/${voiceId}`, {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey,
      'Content-Type': 'application/json',
      Accept: 'audio/mpeg',
    },
    body: JSON.stringify({
      text,
      model_id: 'eleven_multilingual_v2',
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.75,
        style: 0.0,
        use_speaker_boost: true,
      },
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`ElevenLabs API error: ${error}`)
  }

  const arrayBuffer = await response.arrayBuffer()
  return Buffer.from(arrayBuffer)
}

// ========== INTENT CLASSIFICATION ==========

interface IntentClassification {
  shouldHandoff: boolean
  reason: string
  confidence: number
}

export function classifyHandoffIntent(
  messageContent: string,
  config: AgentConfig
): IntentClassification {
  const lowerContent = messageContent.toLowerCase().trim()

  // Verificar palavras-chave de handoff do config compartilhado
  const allKeywords = [
    ...config.shared.humanHandoffKeywords,
    ...(config.whatsapp.wizardAnswers.handoffKeywords || []),
  ]

  for (const keyword of allKeywords) {
    if (keyword && lowerContent.includes(keyword.toLowerCase())) {
      return {
        shouldHandoff: true,
        reason: `Cliente solicitou atendimento humano (palavra-chave: "${keyword}")`,
        confidence: 0.95,
      }
    }
  }

  return { shouldHandoff: false, reason: '', confidence: 0 }
}

// ========== WORK HOURS CHECK ==========

export function isWithinWorkHours(config: AgentConfig): boolean {
  const { workHours } = config.shared
  if (!workHours.enabled) return true // Se desativado, sempre disponivel

  const now = new Date()
  // Usar timezone configurada
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: workHours.timezone || 'America/Sao_Paulo',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
    weekday: 'short',
  })

  const parts = formatter.formatToParts(now)
  const hour = parseInt(parts.find(p => p.type === 'hour')?.value || '0')
  const dayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }
  const weekday = parts.find(p => p.type === 'weekday')?.value || 'Mon'
  const dayNum = dayMap[weekday] ?? 1

  if (!workHours.workDays.includes(dayNum)) return false
  if (hour < workHours.startHour || hour >= workHours.endHour) return false

  return true
}

// ========== MAIN PROCESSING ==========

export async function processIncomingMessage(
  message: ChannelMessage,
  config: AgentConfig,
  conversationHistory: ConversationMessage[]
): Promise<AgentResponse> {
  const startTime = Date.now()
  const crmActions: CRMAction[] = []

  // 1. Verificar horario de funcionamento
  if (!isWithinWorkHours(config)) {
    return {
      content: config.shared.offHoursMessage,
      contentType: 'text',
      shouldHandoff: false,
      crmActions: [],
      tokensUsed: 0,
      processingTimeMs: Date.now() - startTime,
    }
  }

  // 2. Processar midia se necessario
  let processedContent = message.content
  let mediaContext = ''

  if (message.contentType === 'audio' && message.mediaUrl) {
    try {
      processedContent = await transcribeAudio(message.mediaUrl)
      mediaContext = `[O cliente enviou um audio. Transcricao: "${processedContent}"]`
    } catch (error) {
      console.error('Erro ao transcrever audio:', error)
      processedContent = '[Audio recebido - nao foi possivel transcrever]'
      mediaContext = processedContent
    }
  } else if (message.contentType === 'image' && message.mediaUrl) {
    try {
      const description = await describeImage(message.mediaUrl)
      mediaContext = `[O cliente enviou uma imagem. Descricao: "${description}"]`
      processedContent = mediaContext
    } catch (error) {
      console.error('Erro ao descrever imagem:', error)
      processedContent = '[Imagem recebida - nao foi possivel descrever]'
      mediaContext = processedContent
    }
  } else if (message.contentType === 'document' && message.mediaUrl) {
    mediaContext = `[O cliente enviou um documento: ${message.mediaFileName || 'arquivo'}]`
    processedContent = mediaContext
  }

  // 3. Verificar se deve transferir para humano
  const handoffCheck = classifyHandoffIntent(processedContent, config)
  if (handoffCheck.shouldHandoff) {
    return {
      content: 'Entendi! Vou transferir voce para um de nossos atendentes. Aguarde um momento, por favor.',
      contentType: 'text',
      shouldHandoff: true,
      handoffReason: handoffCheck.reason,
      crmActions,
      tokensUsed: 0,
      processingTimeMs: Date.now() - startTime,
    }
  }

  // 4. Verificar limite de turnos
  const channelConfig = message.channel === 'whatsapp' ? config.whatsapp : config.email
  const maxTurns = channelConfig.wizardAnswers.maxTurnsBeforeHandoff || 10
  const agentMessages = conversationHistory.filter(m => m.role === 'agent').length
  if (agentMessages >= maxTurns) {
    return {
      content: 'Parece que precisamos de um atendimento mais especializado. Vou transferir voce para um de nossos atendentes humanos.',
      contentType: 'text',
      shouldHandoff: true,
      handoffReason: `Limite de ${maxTurns} turnos atingido`,
      crmActions,
      tokensUsed: 0,
      processingTimeMs: Date.now() - startTime,
    }
  }

  // 5. Montar system prompt
  const systemPrompt = channelConfig.systemPrompt || assembleTextAgentPrompt(
    channelConfig.wizardAnswers,
    config.faq
  )

  // 6. Montar historico de conversa para o LLM
  const contextMessages = conversationHistory
    .slice(-MAX_CONTEXT_MESSAGES)
    .map(msg => ({
      role: msg.role === 'contact' ? 'user' as const : 'assistant' as const,
      content: msg.content,
    }))

  // Adicionar mensagem atual
  const currentContent = mediaContext || processedContent
  contextMessages.push({ role: 'user' as const, content: currentContent })

  // 7. Chamar LLM
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('OPENAI_API_KEY nao configurada')

  const now = new Date()
  const dateStr = now.toLocaleDateString('pt-BR', { timeZone: config.shared.workHours.timezone || 'America/Sao_Paulo' })
  const timeStr = now.toLocaleTimeString('pt-BR', { timeZone: config.shared.workHours.timezone || 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' })

  const systemMessage = [
    systemPrompt,
    '',
    `Data atual: ${dateStr}, ${timeStr}`,
    message.fromName ? `Nome do cliente: ${message.fromName}` : '',
  ].filter(Boolean).join('\n')

  const llmResponse = await fetch(`${OPENAI_API_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: config.shared.llmModel || 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemMessage },
        ...contextMessages,
      ],
      temperature: config.shared.temperature ?? 0.7,
      max_tokens: config.shared.maxTokens || 1024,
    }),
  })

  if (!llmResponse.ok) {
    const error = await llmResponse.text()
    console.error('LLM API error:', error)
    return {
      content: 'Desculpe, estou com uma dificuldade tecnica no momento. Por favor, tente novamente em alguns instantes.',
      contentType: 'text',
      shouldHandoff: false,
      crmActions,
      tokensUsed: 0,
      processingTimeMs: Date.now() - startTime,
    }
  }

  const llmResult = await llmResponse.json()
  const responseText = llmResult.choices?.[0]?.message?.content || 'Desculpe, nao consegui processar sua mensagem.'
  const tokensUsed = llmResult.usage?.total_tokens || 0

  // 8. Gerar audio se configurado
  let audioUrl: string | undefined
  let responseContentType: 'text' | 'audio' = 'text'

  if (config.audio.enabled && config.audio.respondWithAudio && config.audio.voiceId) {
    try {
      const audioBuffer = await generateAudio(responseText, config.audio.voiceId)
      // Audio sera armazenado pelo conector do canal (Z-API/email)
      // Retornamos o buffer como base64 para o conector lidar com o upload
      audioUrl = `data:audio/mpeg;base64,${audioBuffer.toString('base64')}`
      responseContentType = 'audio'
    } catch (error) {
      console.error('Erro ao gerar audio:', error)
      // Fallback para texto se TTS falhar
    }
  }

  return {
    content: responseText,
    contentType: responseContentType,
    audioUrl,
    shouldHandoff: false,
    crmActions,
    tokensUsed,
    processingTimeMs: Date.now() - startTime,
  }
}
