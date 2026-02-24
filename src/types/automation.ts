/**
 * Automation trigger types for event-driven workflows.
 * Triggers fire when specific events occur (stage change, inactivity, etc.)
 * and execute configured actions (notify, move, assign, email, tag).
 */

export type TriggerEventType =
  | 'stage_changed'
  | 'lead_created'
  | 'lead_inactive_days'
  | 'deal_value_set'
  | 'icp_matched'

export type TriggerActionType =
  | 'send_notification'
  | 'move_to_stage'
  | 'assign_to_user'
  | 'send_email'
  | 'add_tag'

export const EVENT_TYPE_LABELS: Record<TriggerEventType, string> = {
  stage_changed: 'Mudança de etapa',
  lead_created: 'Novo lead criado',
  lead_inactive_days: 'Lead inativo (dias)',
  deal_value_set: 'Valor do deal definido',
  icp_matched: 'ICP correspondido',
}

export const ACTION_TYPE_LABELS: Record<TriggerActionType, string> = {
  send_notification: 'Enviar notificação',
  move_to_stage: 'Mover para etapa',
  assign_to_user: 'Atribuir a vendedor',
  send_email: 'Enviar email',
  add_tag: 'Adicionar tag',
}

export interface TriggerCondition {
  field: string // e.g. 'funnelId', 'stageId', 'icpProfileId', 'assignedTo', 'dealValue'
  operator: 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'contains'
  value: string
}

export interface TriggerAction {
  type: TriggerActionType
  // Action-specific params
  notificationMessage?: string
  targetStageId?: string
  targetFunnelId?: string
  targetUserId?: string
  targetUserName?: string
  emailTemplateId?: string
  emailSubject?: string
  tagName?: string
}

export interface AutomationTrigger {
  id: string
  orgId: string
  name: string
  description: string
  eventType: TriggerEventType
  conditions: TriggerCondition[]
  actions: TriggerAction[]
  isActive: boolean
  // For lead_inactive_days
  inactiveDays?: number
  // For stage_changed
  fromStageId?: string
  toStageId?: string
  // Metadata
  createdAt: string
  updatedAt: string
  createdBy: string
  createdByName: string
  executionCount: number
  lastExecutedAt?: string
}

export interface AutomationLog {
  id: string
  orgId: string
  triggerId: string
  triggerName: string
  eventType: TriggerEventType
  contactId: string
  contactName: string
  actionsExecuted: {
    type: TriggerActionType
    success: boolean
    detail: string
  }[]
  executedAt: string
}
