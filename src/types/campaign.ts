// ═══════════════════════════════════════════════════════════
// Campaign Module Types
// ═══════════════════════════════════════════════════════════

export type CampaignStatus = 'draft' | 'scheduled' | 'sending' | 'completed' | 'partial_failure' | 'cancelled'
export type CampaignType = 'immediate' | 'scheduled' | 'recurring'
export type RecurrenceFrequency = 'daily' | 'weekly' | 'biweekly' | 'monthly'

export interface CampaignFilters {
  funnelId?: string
  stageIds?: string[]
  status?: string[]
  leadSource?: string[]
  leadType?: string[]
  industry?: string
  company?: string
  porteEmpresa?: string[]
  estado?: string[]
  municipio?: string[]
  tipo?: string[]
  naturezaJuridica?: string[]
  capitalSocialMin?: number
  capitalSocialMax?: number
  daysSinceLastContact?: number
  daysSinceLastActivity?: number
  assignedTo?: string
  createdAfter?: string
  createdBefore?: string
  hasEmail: boolean
}

export interface CampaignRecurrence {
  frequency: RecurrenceFrequency
  dayOfWeek?: number
  dayOfMonth?: number
  timeOfDay: string
  startDate: string
  endDate?: string
  nextRunAt: string
}

export interface Campaign {
  id: string
  orgId: string
  name: string
  subject: string
  body: string
  bodyPlainText: string
  status: CampaignStatus
  type: CampaignType

  filters: CampaignFilters
  savedSegmentId?: string
  totalRecipients: number

  scheduledAt?: string
  recurrence?: CampaignRecurrence

  sentCount: number
  failedCount: number
  lastSentAt?: string

  createdBy: string
  createdByName: string
  createdAt: string
  updatedAt: string
}

export interface CampaignRecipient {
  id: string
  clientId: string
  name: string
  email: string
  company?: string
  status: 'pending' | 'sent' | 'failed'
  sentAt?: string
  error?: string
}

export interface SavedSegment {
  id: string
  orgId: string
  name: string
  filters: CampaignFilters
  createdBy: string
  createdAt: string
}

export const CAMPAIGN_STATUS_LABELS: Record<CampaignStatus, string> = {
  draft: 'Rascunho',
  scheduled: 'Agendada',
  sending: 'Enviando',
  completed: 'Concluída',
  partial_failure: 'Falha parcial',
  cancelled: 'Cancelada',
}

export const CAMPAIGN_STATUS_COLORS: Record<CampaignStatus, string> = {
  draft: 'bg-slate-100 text-slate-700',
  scheduled: 'bg-blue-100 text-blue-700',
  sending: 'bg-amber-100 text-amber-700',
  completed: 'bg-emerald-100 text-emerald-700',
  partial_failure: 'bg-red-100 text-red-700',
  cancelled: 'bg-slate-100 text-slate-500',
}

export const CAMPAIGN_TYPE_LABELS: Record<CampaignType, string> = {
  immediate: 'Imediata',
  scheduled: 'Agendada',
  recurring: 'Recorrente',
}

export const RECURRENCE_LABELS: Record<RecurrenceFrequency, string> = {
  daily: 'Diário',
  weekly: 'Semanal',
  biweekly: 'Quinzenal',
  monthly: 'Mensal',
}

export const TEMPLATE_VARIABLES = [
  { key: '{{nome}}', label: 'Nome do contato', field: 'name' },
  { key: '{{empresa}}', label: 'Empresa', field: 'company' },
  { key: '{{email}}', label: 'Email', field: 'email' },
  { key: '{{responsavel}}', label: 'Responsável', field: 'assignedToName' },
] as const

export function replaceVariables(template: string, contact: Record<string, unknown>): string {
  return template
    .replace(/\{\{nome\}\}/g, (contact.name as string) || '')
    .replace(/\{\{empresa\}\}/g, (contact.company as string) || '')
    .replace(/\{\{email\}\}/g, (contact.email as string) || '')
    .replace(/\{\{responsavel\}\}/g, (contact.assignedToName as string) || '')
}

export function emptyCampaignFilters(): CampaignFilters {
  return { hasEmail: true }
}
