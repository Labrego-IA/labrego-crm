// ═══════════════════════════════════════════════════════════
// ICP (Ideal Customer Profile) Module Types
// ═══════════════════════════════════════════════════════════

export interface IcpCriteria {
  industries: string[]
  porteEmpresa: string[]
  estados: string[]
  naturezaJuridica: string[]
  capitalSocialMin?: number
  capitalSocialMax?: number
  leadSources: string[]
  leadTypes: ('Inbound' | 'Outbound')[]
}

export interface IcpProfile {
  id: string
  orgId: string
  name: string
  description: string
  color: string
  criteria: IcpCriteria
  funnelIds: string[]
  productIds: string[]
  isActive: boolean
  priority: number
  createdBy?: string
  createdAt: string
  updatedAt: string
}

export const EMPTY_ICP_CRITERIA: IcpCriteria = {
  industries: [],
  porteEmpresa: [],
  estados: [],
  naturezaJuridica: [],
  leadSources: [],
  leadTypes: [],
}

export const EMPTY_ICP_PROFILE: Omit<IcpProfile, 'id' | 'orgId' | 'createdAt' | 'updatedAt'> = {
  name: '',
  description: '',
  color: '#06B6D4',
  criteria: { ...EMPTY_ICP_CRITERIA },
  funnelIds: [],
  productIds: [],
  isActive: true,
  priority: 0,
}

export const ICP_COLORS = [
  '#06B6D4', '#DC2626', '#D97706', '#059669',
  '#2563EB', '#7C3AED', '#DB2777', '#0891B2',
]

export const PORTE_EMPRESA_OPTIONS = [
  'MEI',
  'ME',
  'EPP',
  'Medio Porte',
  'Grande Porte',
]

export const ESTADOS_BR = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO',
  'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI',
  'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
]
