/**
 * Shared types for the Funnel module.
 * Extracted from funil/[funnelId]/page.tsx to enable future component extraction.
 */

export type Cliente = {
  id: string
  name: string
  phone: string
  company?: string
  email?: string
  industry?: string
  document?: string
  description?: string
  birthday?: string
  returnAlert?: string
  photoUrl?: string
  leadSource?: string
  leadType?: 'Inbound' | 'Outbound'
  funnelStage?: string
  funnelStageUpdatedAt?: string
  firstContactAt?: string
  status?: string
  createdAt?: string
  updatedAt?: string
  lastFollowUpAt?: string
  needsDetail?: string
  scheduledReturn?: string
  partners?: string
  currentCadenceStepId?: string
  lastCadenceActionAt?: string
  lastCadenceStepResponded?: boolean
  capital_social?: string | number
  porte_empresa?: string
  municipio?: string
  estado?: string
  tipo?: string
  natureza_juridica?: string
  situacao?: string
  costCenterId?: string
  assignedTo?: string
  assignedToName?: string
  assignedAt?: string
  icpProfileId?: string
  dealValue?: number
  closingProbability?: number
}

export type FunnelStage = {
  id: string
  name: string
  order: number
  funnelId: string
  color?: string
  probability?: number
  maxDays?: number
  countsForMetrics?: boolean
  macroStageId?: string
  conversionType?: 'positive' | 'negative' | 'neutral' | 'final_conversion'
  isProspectionStage?: boolean
}

export type MacroStage = {
  id: string
  name: string
  order: number
  color?: string
}

export type CadenceStep = {
  id: string
  stageId: string
  order: number
  name: string
  contactMethod: 'whatsapp' | 'email' | 'phone' | 'meeting'
  daysAfterPrevious: number
  objective?: string
  messageTemplate?: string
  isActive: boolean
  parentStepId?: string | null
  condition?: 'responded' | 'not_responded' | null
}

export type FollowUpType = 'note' | 'whatsapp' | 'email' | 'call'

export type FollowUp = {
  id: string
  text?: string
  author?: string
  createdAt: string
  source?: 'followup' | 'log'
  type?: FollowUpType
  recordingUrl?: string
}

export type CostCenter = {
  id: string
  code: number
  name: string
}

export type ViewMode = 'kanban' | 'table' | 'calendar' | 'activity'
export type CalendarView = 'day' | 'week' | 'month'

export type TableSortKey = 'name' | 'status' | 'stageName' | 'currentStep' | 'daysInStage' | 'daysSinceLastFollowUp'

export type TableSortConfig = {
  key: TableSortKey | null
  direction: 'asc' | 'desc'
}

export const stageColorOptions = [
  { name: 'Azul', bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-200', gradient: 'from-blue-500 to-blue-600' },
  { name: 'Ciano', bg: 'bg-cyan-100', text: 'text-cyan-700', border: 'border-cyan-200', gradient: 'from-cyan-500 to-cyan-600' },
  { name: 'Verde', bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-200', gradient: 'from-emerald-500 to-emerald-600' },
  { name: 'Amarelo', bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-200', gradient: 'from-amber-500 to-amber-600' },
  { name: 'Laranja', bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-200', gradient: 'from-orange-500 to-orange-600' },
  { name: 'Roxo', bg: 'bg-primary-100', text: 'text-primary-700', border: 'border-primary-200', gradient: 'from-primary-500 to-primary-600' },
  { name: 'Rosa', bg: 'bg-pink-100', text: 'text-pink-700', border: 'border-pink-200', gradient: 'from-pink-500 to-pink-600' },
  { name: 'Vermelho', bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-200', gradient: 'from-red-500 to-red-600' },
  { name: 'Cinza', bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-200', gradient: 'from-slate-500 to-slate-600' },
  { name: 'Teal', bg: 'bg-teal-100', text: 'text-teal-700', border: 'border-teal-200', gradient: 'from-teal-500 to-teal-600' },
] as const

export type StageColor = typeof stageColorOptions[number]

export type ContactToday = Cliente & {
  stageName: string
  stageColor: StageColor
  daysInStage: number | null
  daysSinceLastFollowUp: number | null
  isOverdue: boolean
  isDueToday: boolean
  maxDays: number
  isScheduledReturn?: boolean
  currentStep?: CadenceStep | null
  nextStepDueIn?: number | null
}

// Helper functions
export function calculateDaysSince(dateString?: string): number | null {
  if (!dateString) return null
  const date = new Date(dateString)
  if (isNaN(date.getTime())) return null
  const now = new Date()
  const diffTime = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
  return diffDays >= 0 ? diffDays : null
}

export function formatDays(days: number | null): string {
  if (days === null) return '-'
  if (days === 0) return 'Hoje'
  if (days === 1) return '1 dia'
  return `${days} dias`
}

export function getColorByIndex(index: number): StageColor {
  if (isNaN(index)) return stageColorOptions[0]
  return stageColorOptions[index % stageColorOptions.length]
}

export function getClientProbability(client: { closingProbability?: number }, stage?: { probability?: number }): number {
  if (client.closingProbability != null) return client.closingProbability
  return stage?.probability ?? 0
}
