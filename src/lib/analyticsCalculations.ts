/**
 * Pure calculation functions for the Analytics Dashboard.
 * All functions are client-side, operating on pre-fetched data.
 */

/* ================================= Types ================================= */

export type AgingBand = '0-7d' | '8-15d' | '16-30d' | '31-60d' | '61-90d' | '90d+'

export const AGING_BANDS: AgingBand[] = ['0-7d', '8-15d', '16-30d', '31-60d', '61-90d', '90d+']

export const AGING_COLORS: Record<AgingBand, string> = {
  '0-7d': 'bg-emerald-100 text-emerald-800',
  '8-15d': 'bg-emerald-50 text-emerald-700',
  '16-30d': 'bg-amber-50 text-amber-700',
  '31-60d': 'bg-amber-100 text-amber-800',
  '61-90d': 'bg-red-50 text-red-700',
  '90d+': 'bg-red-100 text-red-800',
}

export const CHART_COLORS = [
  '#13DEFC', '#47c799', '#fbbc05', '#f28b82',
  '#06B3D4', '#09B00F', '#171717', '#A3A3A3',
  '#3CD4F5', '#078EA9',
]

type Client = Record<string, unknown>
type Stage = { id: string; name: string; probability?: number; maxDays?: number; conversionType?: string; order: number }

/* ================================= Aging ================================= */

function daysBetween(from: string, to: Date): number {
  const diff = to.getTime() - new Date(from).getTime()
  return Math.max(0, Math.floor(diff / 86400000))
}

function getAgingBand(days: number): AgingBand {
  if (days <= 7) return '0-7d'
  if (days <= 15) return '8-15d'
  if (days <= 30) return '16-30d'
  if (days <= 60) return '31-60d'
  if (days <= 90) return '61-90d'
  return '90d+'
}

export function calcAgingMatrix(
  clients: Client[],
  stages: Stage[],
  dateField: string = 'lastFollowUpAt',
): { matrix: Record<string, Record<AgingBand, Client[]>>; stageNames: string[] } {
  const now = new Date()
  const matrix: Record<string, Record<AgingBand, Client[]>> = {}

  const unassignedLabel = 'Sem stage'

  for (const stage of stages) {
    matrix[stage.name] = {} as Record<AgingBand, Client[]>
    for (const band of AGING_BANDS) {
      matrix[stage.name][band] = []
    }
  }

  // Track if we have unassigned clients
  let hasUnassigned = false

  for (const c of clients) {
    const stageId = c.funnelStage as string
    const stage = stageId ? stages.find((s) => s.id === stageId) : undefined

    const dateVal = (c[dateField] || c.updatedAt || c.createdAt) as string | undefined
    if (!dateVal) continue

    const days = daysBetween(dateVal, now)
    const band = getAgingBand(days)

    if (stage) {
      matrix[stage.name][band].push(c)
    } else {
      // Include clients without funnelStage in "Sem stage" category
      if (!matrix[unassignedLabel]) {
        matrix[unassignedLabel] = {} as Record<AgingBand, Client[]>
        for (const b of AGING_BANDS) matrix[unassignedLabel][b] = []
        hasUnassigned = true
      }
      matrix[unassignedLabel][band].push(c)
    }
  }

  const stageNames = stages.map((s) => s.name)
  if (hasUnassigned) stageNames.push(unassignedLabel)

  return { matrix, stageNames }
}

/* ================================= Conversion ================================= */

export type ConversionDimension =
  | 'leadSource' | 'leadType' | 'industry' | 'porte_empresa'
  | 'estado' | 'tipo' | 'natureza_juridica' | 'assignedToName'

export const DIMENSION_LABELS: Record<ConversionDimension, string> = {
  leadSource: 'Origem do Lead',
  leadType: 'Tipo de Lead',
  industry: 'Segmento',
  porte_empresa: 'Porte da Empresa',
  estado: 'Estado',
  tipo: 'Tipo de Empresa',
  natureza_juridica: 'Natureza Jurídica',
  assignedToName: 'Responsável',
}

export interface ConversionRow {
  dimension: string
  total: number
  converted: number
  rate: number
  avgDays: number
}

export function calcConversionByDimension(
  clients: Client[],
  dimension: ConversionDimension,
  targetStatus: string = 'Ativo',
): ConversionRow[] {
  const groups = new Map<string, { total: number; converted: number; totalDays: number }>()

  for (const c of clients) {
    const key = (c[dimension] as string) || 'Não informado'
    if (!groups.has(key)) groups.set(key, { total: 0, converted: 0, totalDays: 0 })
    const g = groups.get(key)!
    g.total++

    if (c.status === targetStatus) {
      g.converted++
      const created = c.firstContactAt || c.createdAt
      if (created && c.updatedAt) {
        g.totalDays += daysBetween(created as string, new Date(c.updatedAt as string))
      }
    }
  }

  const rows: ConversionRow[] = []
  for (const [dim, g] of groups) {
    rows.push({
      dimension: dim,
      total: g.total,
      converted: g.converted,
      rate: g.total > 0 ? (g.converted / g.total) * 100 : 0,
      avgDays: g.converted > 0 ? Math.round(g.totalDays / g.converted) : 0,
    })
  }

  return rows.sort((a, b) => b.rate - a.rate)
}

/* ================================= KPIs ================================= */

export interface OverviewKPIs {
  totalContacts: number
  newLeads: number
  activeCount: number
  inactiveCount: number
  conversionRate: number
  avgConversionDays: number
  dormant30: number
  dormant60: number
}

export function calcOverviewKPIs(clients: Client[], periodStart: string): OverviewKPIs {
  const now = new Date()
  let newLeads = 0
  let activeCount = 0
  let inactiveCount = 0
  let converted = 0
  let totalDays = 0
  let dormant30 = 0
  let dormant60 = 0

  for (const c of clients) {
    const status = c.status as string | undefined
    if (status === 'Ativo') activeCount++
    if (status === 'Inativo' || status === 'Inatividade longa') inactiveCount++

    if (c.createdAt && (c.createdAt as string) >= periodStart) newLeads++

    if (status === 'Ativo' && c.firstContactAt) {
      converted++
      totalDays += daysBetween(c.firstContactAt as string, c.updatedAt ? new Date(c.updatedAt as string) : now)
    }

    const lastActivity = (c.lastFollowUpAt || c.updatedAt || c.createdAt) as string | undefined
    if (lastActivity) {
      const days = daysBetween(lastActivity, now)
      if (days >= 60) dormant60++
      else if (days >= 30) dormant30++
    }
  }

  return {
    totalContacts: clients.length,
    newLeads,
    activeCount,
    inactiveCount,
    conversionRate: clients.length > 0 ? (converted / clients.length) * 100 : 0,
    avgConversionDays: converted > 0 ? Math.round(totalDays / converted) : 0,
    dormant30,
    dormant60,
  }
}

/* ================================= Temporal ================================= */

export interface TemporalPoint {
  date: string
  newLeads: number
  converted: number
  lost: number
}

export function calcTemporalEvolution(
  clients: Client[],
  periodStart: string,
  periodEnd: string,
): TemporalPoint[] {
  const grouped = new Map<string, TemporalPoint>()

  for (const c of clients) {
    const created = c.createdAt as string | undefined
    if (!created || created < periodStart || created > periodEnd) continue

    const dateKey = created.slice(0, 10) // YYYY-MM-DD
    if (!grouped.has(dateKey)) {
      grouped.set(dateKey, { date: dateKey, newLeads: 0, converted: 0, lost: 0 })
    }
    const p = grouped.get(dateKey)!
    p.newLeads++

    const status = c.status as string | undefined
    if (status === 'Ativo') p.converted++
    if (status === 'Inativo' || status === 'Inatividade longa') p.lost++
  }

  return Array.from(grouped.values()).sort((a, b) => a.date.localeCompare(b.date))
}

/* ================================= Profile ================================= */

export interface DistributionItem {
  name: string
  value: number
  percent: number
}

export function calcDistribution(clients: Client[], field: string): DistributionItem[] {
  const counts = new Map<string, number>()
  const total = clients.length

  for (const c of clients) {
    const key = (c[field] as string) || 'Não informado'
    counts.set(key, (counts.get(key) || 0) + 1)
  }

  return Array.from(counts.entries())
    .map(([name, value]) => ({
      name,
      value,
      percent: total > 0 ? Math.round((value / total) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.value - a.value)
}

/* ================================= Opportunities ================================= */

export interface OpportunityItem {
  id: string
  name: string
  company: string
  stage: string
  probability: number
  daysInStage: number
  maxDays: number
  urgencyScore: number
  isOverdue: boolean
}

export function calcTopOpportunities(clients: Client[], stages: Stage[]): OpportunityItem[] {
  const now = new Date()
  const highProbStages = stages.filter((s) => (s.probability || 0) > 50)
  const stageIds = new Set(highProbStages.map((s) => s.id))

  const items: OpportunityItem[] = []

  for (const c of clients) {
    const stageId = c.funnelStage as string
    if (!stageIds.has(stageId)) continue

    const stage = highProbStages.find((s) => s.id === stageId)!
    const stageUpdated = (c.funnelStageUpdatedAt || c.updatedAt || c.createdAt) as string | undefined
    const daysInStage = stageUpdated ? daysBetween(stageUpdated, now) : 0
    const maxDays = stage.maxDays || 30

    items.push({
      id: c.id as string,
      name: c.name as string,
      company: (c.company as string) || '',
      stage: stage.name,
      probability: stage.probability || 0,
      daysInStage,
      maxDays,
      urgencyScore: (stage.probability || 0) * (daysInStage / maxDays),
      isOverdue: daysInStage > maxDays,
    })
  }

  return items.sort((a, b) => b.urgencyScore - a.urgencyScore)
}

export interface BottleneckStage {
  name: string
  avgDays: number
  maxDays: number
  contactCount: number
  overdueCount: number
}

export function calcBottleneckStages(clients: Client[], stages: Stage[]): BottleneckStage[] {
  const now = new Date()
  const bottlenecks: BottleneckStage[] = []

  for (const stage of stages) {
    const stageClients = clients.filter((c) => c.funnelStage === stage.id)
    if (stageClients.length === 0) continue

    let totalDays = 0
    let overdueCount = 0
    const maxDays = stage.maxDays || 30

    for (const c of stageClients) {
      const updated = (c.funnelStageUpdatedAt || c.updatedAt || c.createdAt) as string | undefined
      const days = updated ? daysBetween(updated, now) : 0
      totalDays += days
      if (days > maxDays) overdueCount++
    }

    const avgDays = Math.round(totalDays / stageClients.length)
    if (avgDays > maxDays || overdueCount > stageClients.length * 0.3) {
      bottlenecks.push({
        name: stage.name,
        avgDays,
        maxDays,
        contactCount: stageClients.length,
        overdueCount,
      })
    }
  }

  return bottlenecks.sort((a, b) => (b.avgDays / b.maxDays) - (a.avgDays / a.maxDays))
}

/* ================================= Funnel Visual ================================= */

export interface FunnelStageData {
  name: string
  count: number
  conversionRate: number
  avgDays: number
  color: string
}

export function calcFunnelData(clients: Client[], stages: Stage[]): FunnelStageData[] {
  const now = new Date()
  const sorted = [...stages].sort((a, b) => a.order - b.order)

  return sorted.map((stage, i) => {
    const stageClients = clients.filter((c) => c.funnelStage === stage.id)
    const prevCount = i > 0
      ? clients.filter((c) => c.funnelStage === sorted[i - 1].id).length
      : clients.length

    let totalDays = 0
    for (const c of stageClients) {
      const updated = (c.funnelStageUpdatedAt || c.createdAt) as string | undefined
      if (updated) totalDays += daysBetween(updated, now)
    }

    return {
      name: stage.name,
      count: stageClients.length,
      conversionRate: prevCount > 0 ? (stageClients.length / prevCount) * 100 : 0,
      avgDays: stageClients.length > 0 ? Math.round(totalDays / stageClients.length) : 0,
      color: CHART_COLORS[i % CHART_COLORS.length],
    }
  })
}

/* ================================= Pipeline & Ticket Medio ================================= */

export interface PipelineKPIs {
  totalPipelineValue: number
  ticketMedio: number
  clientsWithDeal: number
  totalClients: number
}

export function calcPipelineKPIs(clients: Client[]): PipelineKPIs {
  let total = 0
  let count = 0
  for (const c of clients) {
    const val = c.dealValue as number | undefined
    if (val != null && val > 0) {
      total += val
      count++
    }
  }
  return {
    totalPipelineValue: total,
    ticketMedio: count > 0 ? total / count : 0,
    clientsWithDeal: count,
    totalClients: clients.length,
  }
}

export interface ValueByStageItem {
  name: string
  value: number
  count: number
}

export function calcValueByStage(clients: Client[], stages: Stage[]): ValueByStageItem[] {
  const sorted = [...stages].sort((a, b) => a.order - b.order)
  return sorted.map((stage) => {
    let value = 0
    let count = 0
    for (const c of clients) {
      if (c.funnelStage === stage.id) {
        const dv = c.dealValue as number | undefined
        if (dv != null && dv > 0) {
          value += dv
          count++
        }
      }
    }
    return { name: stage.name, value, count }
  }).filter(s => s.value > 0 || s.count > 0)
}

/* ================================= FRT & SLA ================================= */

export interface FrtBySellerItem {
  seller: string
  avgFrtHours: number
  contactCount: number
  slaColor: 'green' | 'yellow' | 'red'
}

export interface FrtKPIs {
  avgFrtHours: number
  totalWithFrt: number
  totalWithoutFrt: number
  bySeller: FrtBySellerItem[]
}

function getSlaColor(hours: number): 'green' | 'yellow' | 'red' {
  if (hours <= 2) return 'green'
  if (hours <= 8) return 'yellow'
  return 'red'
}

export function calcFrtKPIs(clients: Client[]): FrtKPIs {
  const sellerMap: Record<string, { totalHours: number; count: number; name: string }> = {}
  let totalFrt = 0
  let totalWithFrt = 0
  let totalWithoutFrt = 0

  for (const c of clients) {
    const createdAt = c.createdAt as string | undefined
    const firstContactAt = c.firstContactAt as string | undefined

    if (!createdAt) continue

    if (firstContactAt) {
      const frt = (new Date(firstContactAt).getTime() - new Date(createdAt).getTime()) / (1000 * 60 * 60)
      if (frt >= 0) {
        totalFrt += frt
        totalWithFrt++

        const seller = (c.assignedToName as string) || 'Sem responsável'
        if (!sellerMap[seller]) sellerMap[seller] = { totalHours: 0, count: 0, name: seller }
        sellerMap[seller].totalHours += frt
        sellerMap[seller].count++
      }
    } else {
      totalWithoutFrt++
    }
  }

  const bySeller = Object.values(sellerMap)
    .map(s => ({
      seller: s.name,
      avgFrtHours: s.count > 0 ? s.totalHours / s.count : 0,
      contactCount: s.count,
      slaColor: getSlaColor(s.count > 0 ? s.totalHours / s.count : 0),
    }))
    .sort((a, b) => a.avgFrtHours - b.avgFrtHours)

  return {
    avgFrtHours: totalWithFrt > 0 ? totalFrt / totalWithFrt : 0,
    totalWithFrt,
    totalWithoutFrt,
    bySeller,
  }
}
