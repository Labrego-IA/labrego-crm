import type { MemberPermissions, MemberActions } from './organization'

export type RolePreset = 'admin' | 'manager' | 'seller' | 'viewer'

export const ROLE_PRESETS: Record<RolePreset, MemberPermissions> = {
  admin: {
    pages: ['/contatos', '/funil', '/funil/produtividade', '/conversao', '/cadencia', '/ligacoes', '/admin/usuarios', '/admin/creditos', '/admin/plano', '/admin/funis', '/admin/propostas'],
    actions: {
      canCreateContacts: true,
      canEditContacts: true,
      canDeleteContacts: true,
      canCreateProposals: true,
      canExportData: true,
      canManageFunnels: true,
      canManageUsers: true,
      canTriggerCalls: true,
      canViewReports: true,
      canManageSettings: true,
      canTransferLeads: true,
    },
    viewScope: 'all',
  },
  manager: {
    pages: ['/contatos', '/funil', '/funil/produtividade', '/conversao', '/cadencia', '/ligacoes'],
    actions: {
      canCreateContacts: true,
      canEditContacts: true,
      canDeleteContacts: true,
      canCreateProposals: true,
      canExportData: true,
      canManageFunnels: true,
      canManageUsers: false,
      canTriggerCalls: true,
      canViewReports: true,
      canManageSettings: false,
      canTransferLeads: true,
    },
    viewScope: 'all',
  },
  seller: {
    pages: ['/contatos', '/funil', '/conversao'],
    actions: {
      canCreateContacts: true,
      canEditContacts: true,
      canDeleteContacts: false,
      canCreateProposals: true,
      canExportData: false,
      canManageFunnels: false,
      canManageUsers: false,
      canTriggerCalls: false,
      canViewReports: false,
      canManageSettings: false,
      canTransferLeads: true,
    },
    viewScope: 'own',
  },
  viewer: {
    pages: ['/contatos', '/funil'],
    actions: {
      canCreateContacts: false,
      canEditContacts: false,
      canDeleteContacts: false,
      canCreateProposals: false,
      canExportData: false,
      canManageFunnels: false,
      canManageUsers: false,
      canTriggerCalls: false,
      canViewReports: false,
      canManageSettings: false,
      canTransferLeads: false,
    },
    viewScope: 'all',
  },
}

export const ALL_PAGES = [
  { path: '/contatos', label: 'Gestao de Contatos', feature: 'contacts' },
  { path: '/funil', label: 'Funil de Vendas', feature: 'funnel' },
  { path: '/funil/produtividade', label: 'Produtividade', feature: 'productivity' },
  { path: '/conversao', label: 'Conversao do Funil', feature: 'funnel' },
  { path: '/cadencia', label: 'Cadencia', feature: 'cadence' },
  { path: '/ligacoes', label: 'Agente de Ligacao', feature: 'voice_agent' },
  { path: '/admin/usuarios', label: 'Gerenciar Usuarios', feature: 'contacts' },
  { path: '/admin/creditos', label: 'Creditos', feature: 'voice_agent' },
  { path: '/admin/plano', label: 'Meu Plano', feature: 'contacts' },
  { path: '/admin/funis', label: 'Acesso a Funis', feature: 'funnel' },
  { path: '/admin/propostas', label: 'Config. Propostas', feature: 'contacts' },
] as const

export const ALL_ACTIONS: { key: keyof MemberActions; label: string }[] = [
  { key: 'canCreateContacts', label: 'Criar contatos' },
  { key: 'canEditContacts', label: 'Editar contatos' },
  { key: 'canDeleteContacts', label: 'Excluir contatos' },
  { key: 'canCreateProposals', label: 'Criar propostas' },
  { key: 'canExportData', label: 'Exportar dados' },
  { key: 'canManageFunnels', label: 'Gerenciar funis' },
  { key: 'canManageUsers', label: 'Gerenciar usuarios' },
  { key: 'canTriggerCalls', label: 'Disparar ligacoes' },
  { key: 'canViewReports', label: 'Ver relatorios' },
  { key: 'canManageSettings', label: 'Gerenciar configuracoes' },
  { key: 'canTransferLeads', label: 'Transferir leads' },
]
