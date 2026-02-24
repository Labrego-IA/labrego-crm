export type PlanId = 'basic' | 'standard' | 'pro'

export type FeatureKey =
  | 'funnel'
  | 'contacts'
  | 'proposals'
  | 'cadence'
  | 'productivity'
  | 'whatsapp_plugin'
  | 'email_automation'
  | 'crm_automation'
  | 'voice_agent'
  | 'whatsapp_agent'
  | 'ai_reports'

export interface Plan {
  id: PlanId
  displayName: string
  price: number // BRL per month
  features: FeatureKey[]
  limits: PlanLimits
  order: number // display order
}

export interface PlanLimits {
  maxUsers: number
  maxFunnels: number
  maxContacts: number
  monthlyCredits: number // minutes
}

export const PLAN_FEATURES: Record<PlanId, FeatureKey[]> = {
  basic: ['funnel', 'contacts', 'proposals'],
  standard: ['funnel', 'contacts', 'proposals', 'cadence', 'productivity', 'whatsapp_plugin'],
  pro: ['funnel', 'contacts', 'proposals', 'cadence', 'productivity', 'whatsapp_plugin', 'email_automation', 'crm_automation', 'voice_agent', 'whatsapp_agent', 'ai_reports'],
}

export const PLAN_LIMITS: Record<PlanId, PlanLimits> = {
  basic: { maxUsers: 3, maxFunnels: 1, maxContacts: 500, monthlyCredits: 0 },
  standard: { maxUsers: 10, maxFunnels: 3, maxContacts: 2000, monthlyCredits: 60 },
  pro: { maxUsers: 50, maxFunnels: 10, maxContacts: 10000, monthlyCredits: 300 },
}

export const PLAN_DISPLAY: Record<PlanId, { displayName: string; price: number }> = {
  basic: { displayName: 'Basic', price: 97 },
  standard: { displayName: 'Standard', price: 197 },
  pro: { displayName: 'Pro', price: 497 },
}

// Map features to human-readable labels
export const FEATURE_LABELS: Record<FeatureKey, string> = {
  funnel: 'Funil de vendas',
  contacts: 'Dados detalhados dos clientes',
  proposals: 'Geracao de propostas comerciais',
  cadence: 'Estrategia comercial',
  productivity: 'Gestao de produtividade',
  whatsapp_plugin: 'Plugin e Conexao com WhatsApp',
  email_automation: 'Envio automatico de e-mails',
  crm_automation: 'Automacao de CRM e nutricao de leads',
  voice_agent: 'Agente de prospeccao ativa por voz',
  whatsapp_agent: 'Agente de prospeccao ativa por WhatsApp',
  ai_reports: 'Relatorios da IA',
}
