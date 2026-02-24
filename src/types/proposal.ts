export type ProposalItem = {
  productId: string
  name: string
  description: string
  qty: number
  price: number
}

export type ProposalScheduleEntry = { stage: string; days: number; hours?: number }

export type ProposalProduct = {
  id: string
  name: string
  price: number
  schedule?: ProposalScheduleEntry[]
  hourValue?: number
  margin?: number
  tax?: number
  description?: string
}

export type ProposalMonthlyFee = { description: string; amount: number }

export type ProposalFormData = {
  clientId: string
  projectName: string
  items: ProposalItem[]
  discountType: 'percent' | 'value'
  discount: number
  discountReason: string
  context: string
  proposalDescription: string
  observations: string
  paymentMethod: string
  status?: string
  customFields?: Record<string, any>
}

export type ProposalClient = {
  id: string
  name: string
  company?: string
  phone?: string
}
