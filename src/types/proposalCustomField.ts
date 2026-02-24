export type ProposalCustomFieldType = 'text' | 'number' | 'textarea' | 'select' | 'checkbox'

export type ProposalCustomFieldPosition =
  | 'after_context'
  | 'after_products'
  | 'after_observations'
  | 'after_payment'

export interface ProposalCustomField {
  id: string
  key: string
  label: string
  type: ProposalCustomFieldType
  required: boolean
  position: ProposalCustomFieldPosition
  options?: string[]
  order: number
}
