export interface ProposalConfig {
  // Premissas de desconto
  developmentDiscount: number
  standardSpecDiscount: number
  standardTestDiscount: number
  // Condicoes de pagamento padrao
  defaultPaymentTerms: string
  // Quantidade minima de produtos para aplicar desconto de desenvolvimento
  minProductsForDevDiscount: number
}

export const DEFAULT_PROPOSAL_CONFIG: ProposalConfig = {
  developmentDiscount: 20,
  standardSpecDiscount: 70,
  standardTestDiscount: 50,
  defaultPaymentTerms: '',
  minProductsForDevDiscount: 2,
}
