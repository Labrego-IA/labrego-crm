// Tipos para o sistema de Agentes IA (WhatsApp + Email)

// ========== WIZARD DO AGENTE DE TEXTO (5 fases) ==========

export interface TextAgentWizardAnswers {
  // Fase 1: Identidade
  agentName: string
  agentRole: string          // ex: "Atendente", "Consultor", "Suporte"
  companyName: string
  toneDescription: string    // ex: "Profissional e amigavel"

  // Fase 2: Conhecimento
  whatYouSell: string        // Produtos/servicos
  keyInformation: string     // Informacoes-chave do negocio
  differentials: string      // Diferenciais competitivos
  targetAudience: string     // Publico-alvo

  // Fase 3: Comportamento
  greetingMessage: string    // Saudacao inicial
  offHoursMessage: string    // Mensagem fora do horario
  maxTurnsBeforeHandoff: number  // Turnos antes de sugerir humano
  responseStyle: 'formal' | 'informal' | 'balanced'

  // Fase 4: Regras
  handoffKeywords: string[]       // Palavras que acionam handoff humano
  forbiddenTopics: string         // Temas que o agente nao deve abordar
  scopeDescription: string        // Escopo de atuacao do agente

  // Fase 5: Personalizacao
  keyExpressions: string          // Expressoes-chave (separadas por virgula)
  signatureClosing: string        // Assinatura de encerramento
  behaviorRules: string           // Regras adicionais de comportamento

  // Meta
  completedPhases: number[]
  strengthScore: number
  lastUpdated: string
}

// ========== FAQ ESTRUTURADO ==========

export interface FAQItem {
  id: string
  question: string
  answer: string
  category?: string    // Categoria opcional para organizacao
  order: number
}

// ========== CONFIGURACAO DO AGENTE ==========

export interface AgentChannelConfig {
  enabled: boolean
  wizardAnswers: TextAgentWizardAnswers
  systemPrompt: string
  strengthScore: number
}

export interface AgentWorkHours {
  enabled: boolean
  startHour: number     // 0-23
  endHour: number       // 0-23
  timezone: string      // ex: "America/Sao_Paulo"
  workDays: number[]    // 0=dom, 1=seg, ..., 6=sab
}

export interface AgentAudioConfig {
  enabled: boolean
  ttsProvider: 'elevenlabs'
  voiceId: string               // ElevenLabs voice ID
  sttProvider: 'openai'         // Whisper
  respondWithAudio: boolean     // Se true, responde com audio alem de texto
}

export interface AgentCRMActions {
  autoCreateContact: boolean
  defaultFunnelStageId: string
  autoTagContacts: boolean
  tags: string[]                 // Tags aplicadas automaticamente
}

export interface AgentTools {
  googleCalendar: {
    enabled: boolean
    calendarId: string           // Google Calendar ID
    bufferDays: number           // Dias a frente para buscar slots
    slotDuration: number         // Duracao do slot em minutos
    specialistName: string       // Nome do especialista para agendar
  }
  followUp: {
    enabled: boolean
    defaultDays: number          // Dias padrao para follow-up
    autoCreate: boolean          // Criar follow-up automaticamente apos conversa
  }
  funnelMove: {
    enabled: boolean
    autoMove: boolean            // Mover automaticamente baseado na conversa
    targetStageId: string        // Estagio destino padrao
  }
}

export interface AgentConfig {
  orgId: string
  whatsapp: AgentChannelConfig
  email: AgentChannelConfig
  shared: {
    llmModel: string             // 'gpt-4o-mini' padrao
    temperature: number          // 0.0-1.0
    maxTokens: number
    humanHandoffKeywords: string[]
    workHours: AgentWorkHours
    offHoursMessage: string
  }
  audio: AgentAudioConfig
  tools: AgentTools
  faq: FAQItem[]
  crmActions: AgentCRMActions
  createdAt: string
  updatedAt: string
  updatedBy: string
}

// ========== CONEXAO WHATSAPP (Z-API) ==========

export type WhatsAppConnectionStatus =
  | 'disconnected'
  | 'connecting'
  | 'qr_ready'
  | 'connected'
  | 'error'

export interface WhatsAppConnection {
  orgId: string
  provider: 'zapi'
  instanceId: string          // Z-API instance ID
  instanceToken: string       // Z-API instance token
  phoneNumber: string         // Numero conectado
  status: WhatsAppConnectionStatus
  qrCode: string              // QR code base64 atual
  qrExpiresAt: string
  connectedAt: string
  lastMessageAt: string
  errorMessage?: string
  updatedAt: string
}

// ========== MENSAGENS (Channel-agnostic) ==========

export type MessageContentType = 'text' | 'image' | 'audio' | 'document' | 'video'
export type MessageChannel = 'whatsapp' | 'email'
export type MessageRole = 'contact' | 'agent' | 'human' | 'system'

export interface ChannelMessage {
  externalMessageId: string      // ID da mensagem no provider (Z-API, email)
  channel: MessageChannel
  orgId: string
  from: string                   // Telefone ou email do remetente
  fromName: string               // Nome do remetente (se disponivel)
  content: string                // Texto da mensagem
  contentType: MessageContentType
  mediaUrl?: string              // URL da midia (audio, imagem, documento)
  mediaMimeType?: string         // MIME type do arquivo
  mediaFileName?: string         // Nome do arquivo (para documentos)
  timestamp: string
  // Email-specific
  emailSubject?: string
  emailThreadId?: string
  emailInReplyTo?: string
}

export interface AgentResponse {
  content: string                // Texto da resposta
  contentType: MessageContentType // 'text' ou 'audio'
  audioUrl?: string              // URL do audio gerado (se TTS ativado)
  shouldHandoff: boolean         // Se deve transferir para humano
  handoffReason?: string         // Motivo do handoff
  crmActions: CRMAction[]        // Acoes a executar no CRM
  tokensUsed: number             // Tokens LLM consumidos
  processingTimeMs: number       // Tempo de processamento
}

export interface CRMAction {
  type: 'create_contact' | 'update_contact' | 'move_pipeline' | 'add_tag' | 'create_note'
  data: Record<string, unknown>
}

// ========== CONVERSAS ==========

export type ConversationStatus = 'active' | 'human_handoff' | 'resolved' | 'expired'

export interface Conversation {
  id: string
  orgId: string
  contactId: string              // Ref para clients collection
  contactName: string
  contactPhone?: string          // Para WhatsApp
  contactEmail?: string          // Para Email
  channel: MessageChannel
  status: ConversationStatus
  assignedTo?: string            // userId quando em handoff humano
  aiEnabled: boolean             // false quando humano assume
  lastMessageAt: string
  lastMessagePreview: string
  unreadCount: number
  messageCount: number
  metadata: {
    emailSubject?: string        // Assunto do email (para email)
    emailThreadId?: string       // Thread ID do email
  }
  createdAt: string
  updatedAt: string
}

export interface ConversationMessage {
  id: string
  conversationId: string
  role: MessageRole
  content: string
  contentType: MessageContentType
  mediaUrl?: string              // URL da midia
  channel: MessageChannel
  externalMessageId: string      // ID no provider externo
  creditsUsed: number            // 0 para inbound, 1 para resposta IA
  tokensUsed: number             // Tokens LLM (0 para msgs humanas)
  sentAt: string
  createdAt: string
}

// ========== AGENT ACTIVITY LOG ==========

export type AgentActivityAction =
  | 'message_received'
  | 'ai_responded'
  | 'audio_transcribed'
  | 'audio_generated'
  | 'image_described'
  | 'document_extracted'
  | 'human_handoff'
  | 'human_responded'
  | 'ai_resumed'
  | 'contact_created'
  | 'pipeline_updated'
  | 'calendar_checked'
  | 'meeting_scheduled'
  | 'followup_created'
  | 'funnel_moved'
  | 'credit_deducted'
  | 'credit_insufficient'
  | 'off_hours_reply'
  | 'error'

export interface AgentActivityLog {
  id: string
  orgId: string
  channel: MessageChannel
  conversationId: string
  contactId: string
  action: AgentActivityAction
  detail: string
  metadata?: Record<string, unknown>
  createdAt: string
}

// ========== DEFAULTS ==========

export const DEFAULT_WIZARD_ANSWERS: TextAgentWizardAnswers = {
  agentName: '',
  agentRole: 'Atendente',
  companyName: '',
  toneDescription: 'Profissional e amigavel',
  whatYouSell: '',
  keyInformation: '',
  differentials: '',
  targetAudience: '',
  greetingMessage: 'Ola! Como posso ajudar voce hoje?',
  offHoursMessage: 'Obrigado pelo contato! Nosso horario de atendimento e de segunda a sexta, das 9h as 18h. Retornaremos assim que possivel.',
  maxTurnsBeforeHandoff: 10,
  responseStyle: 'balanced',
  handoffKeywords: ['falar com humano', 'atendente', 'pessoa real', 'gerente', 'supervisor'],
  forbiddenTopics: '',
  scopeDescription: '',
  keyExpressions: '',
  signatureClosing: '',
  behaviorRules: '',
  completedPhases: [],
  strengthScore: 0,
  lastUpdated: '',
}

export const DEFAULT_AGENT_CONFIG: Omit<AgentConfig, 'orgId' | 'createdAt' | 'updatedAt' | 'updatedBy'> = {
  whatsapp: {
    enabled: false,
    wizardAnswers: DEFAULT_WIZARD_ANSWERS,
    systemPrompt: '',
    strengthScore: 0,
  },
  email: {
    enabled: false,
    wizardAnswers: DEFAULT_WIZARD_ANSWERS,
    systemPrompt: '',
    strengthScore: 0,
  },
  shared: {
    llmModel: 'gpt-4o-mini',
    temperature: 0.7,
    maxTokens: 1024,
    humanHandoffKeywords: ['falar com humano', 'atendente', 'pessoa real'],
    workHours: {
      enabled: false,
      startHour: 9,
      endHour: 18,
      timezone: 'America/Sao_Paulo',
      workDays: [1, 2, 3, 4, 5],
    },
    offHoursMessage: 'Obrigado pelo contato! Nosso horario de atendimento e de segunda a sexta, das 9h as 18h. Retornaremos assim que possivel.',
  },
  audio: {
    enabled: false,
    ttsProvider: 'elevenlabs',
    voiceId: '',
    sttProvider: 'openai',
    respondWithAudio: false,
  },
  tools: {
    googleCalendar: {
      enabled: false,
      calendarId: '',
      bufferDays: 7,
      slotDuration: 30,
      specialistName: '',
    },
    followUp: {
      enabled: false,
      defaultDays: 3,
      autoCreate: true,
    },
    funnelMove: {
      enabled: false,
      autoMove: false,
      targetStageId: '',
    },
  },
  faq: [],
  crmActions: {
    autoCreateContact: true,
    defaultFunnelStageId: '',
    autoTagContacts: false,
    tags: [],
  },
}
