export interface PdfSection {
  key: string
  label: string
  enabled: boolean
}

export interface ProposalStructure {
  sections: PdfSection[]
}

export const ALL_PDF_SECTIONS: PdfSection[] = [
  { key: 'cover', label: 'Capa', enabled: true },
  { key: 'presentation', label: 'Apresentacao', enabled: true },
  { key: 'logos', label: 'Logos de Clientes', enabled: true },
  { key: 'context', label: 'Informacoes e Contexto', enabled: true },
  { key: 'modules', label: 'Modulos', enabled: true },
  { key: 'items', label: 'Itens da Proposta', enabled: true },
  { key: 'fees', label: 'Mensalidades', enabled: true },
  { key: 'schedule', label: 'Cronograma e Pagamento', enabled: true },
]

export const DEFAULT_PROPOSAL_STRUCTURE: ProposalStructure = {
  sections: ALL_PDF_SECTIONS,
}
