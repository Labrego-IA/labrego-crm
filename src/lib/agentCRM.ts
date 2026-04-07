/**
 * Agent CRM — Acoes no CRM disparadas pelo agente IA
 *
 * - Buscar ou criar contato automaticamente
 * - Logar mensagens de conversa no historico do contato
 * - Atualizar pipeline/funil com base na conversa
 * - Aplicar tags automaticas
 */

import { getAdminDb } from './firebaseAdmin'
import type { AgentConfig, MessageChannel, AgentActivityLog, AgentActivityAction } from '@/types/agentConfig'

// ========== FIND OR CREATE CONTACT ==========

interface ContactIdentifier {
  phone?: string
  email?: string
  name?: string
}

interface ContactResult {
  contactId: string
  isNew: boolean
}

/** Busca contato existente por telefone ou email, ou cria um novo */
export async function findOrCreateContact(
  orgId: string,
  identifier: ContactIdentifier,
  config: AgentConfig
): Promise<ContactResult> {
  const db = getAdminDb()
  const clientsRef = db.collection('clients')

  // Tentar encontrar por telefone
  if (identifier.phone) {
    const phoneClean = identifier.phone.replace(/\D/g, '')
    const byPhone = await clientsRef
      .where('orgId', '==', orgId)
      .where('phone', '==', phoneClean)
      .limit(1)
      .get()

    if (!byPhone.empty) {
      return { contactId: byPhone.docs[0].id, isNew: false }
    }

    // Tentar com formato diferente (com +55, sem +55, etc.)
    const phonesVariants = [phoneClean, `+${phoneClean}`, `+55${phoneClean}`, phoneClean.replace(/^55/, '')]
    for (const variant of phonesVariants) {
      const byVariant = await clientsRef
        .where('orgId', '==', orgId)
        .where('phone', '==', variant)
        .limit(1)
        .get()

      if (!byVariant.empty) {
        return { contactId: byVariant.docs[0].id, isNew: false }
      }
    }
  }

  // Tentar encontrar por email
  if (identifier.email) {
    const byEmail = await clientsRef
      .where('orgId', '==', orgId)
      .where('email', '==', identifier.email.toLowerCase())
      .limit(1)
      .get()

    if (!byEmail.empty) {
      return { contactId: byEmail.docs[0].id, isNew: false }
    }
  }

  // Criar novo contato se autoCreateContact ativado
  if (!config.crmActions.autoCreateContact) {
    return { contactId: '', isNew: false }
  }

  const now = new Date().toISOString()
  const newContact: Record<string, unknown> = {
    orgId,
    name: identifier.name || identifier.phone || identifier.email || 'Contato sem nome',
    phone: identifier.phone ? identifier.phone.replace(/\D/g, '') : '',
    email: identifier.email?.toLowerCase() || '',
    status: 'Lead',
    source: 'AGENTE_IA',
    funnelStage: 'Novo',
    createdAt: now,
    updatedAt: now,
  }

  // Aplicar tags automaticas
  if (config.crmActions.autoTagContacts && config.crmActions.tags.length > 0) {
    newContact.tags = config.crmActions.tags
  }

  const docRef = await clientsRef.add(newContact)

  return { contactId: docRef.id, isNew: true }
}

// ========== CONVERSATION LOGGING ==========

/** Loga atividade do agente no historico do contato */
export async function logAgentActivity(
  orgId: string,
  contactId: string,
  channel: MessageChannel,
  action: string,
  detail: string
): Promise<void> {
  if (!contactId) return

  const db = getAdminDb()
  const now = new Date().toISOString()

  await db.collection('clients').doc(contactId).collection('logs').add({
    type: 'agent_activity',
    channel,
    action,
    detail,
    createdAt: now,
  })

  // Atualizar lastAgentInteractionAt no contato
  await db.collection('clients').doc(contactId).update({
    lastAgentInteractionAt: now,
    updatedAt: now,
  })
}

// ========== ACTIVITY LOG (ORG LEVEL) ==========

/** Registra atividade no log de atividade do agente (org-level) */
export async function logActivity(
  orgId: string,
  data: Omit<AgentActivityLog, 'id' | 'createdAt'>
): Promise<string> {
  const db = getAdminDb()
  const now = new Date().toISOString()

  const ref = await db
    .collection('organizations')
    .doc(orgId)
    .collection('agentActivityLog')
    .add({
      ...data,
      createdAt: now,
    })

  return ref.id
}

/** Helper para logar atividade de forma concisa */
export async function logAgentAction(
  orgId: string,
  channel: MessageChannel,
  conversationId: string,
  contactId: string,
  action: AgentActivityAction,
  detail: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  await logActivity(orgId, {
    orgId,
    channel,
    conversationId,
    contactId,
    action,
    detail,
    metadata,
  })
}

// ========== PIPELINE UPDATE ==========

/** Atualiza o estagio do contato no funil */
export async function updateContactPipelineStage(
  orgId: string,
  contactId: string,
  funnelStageId: string
): Promise<void> {
  if (!contactId || !funnelStageId) return

  const db = getAdminDb()
  const now = new Date().toISOString()

  await db.collection('clients').doc(contactId).update({
    funnelStage: funnelStageId,
    updatedAt: now,
  })
}

/** Adiciona tags a um contato */
export async function addTagsToContact(
  contactId: string,
  tags: string[]
): Promise<void> {
  if (!contactId || tags.length === 0) return

  const db = getAdminDb()
  const doc = await db.collection('clients').doc(contactId).get()
  if (!doc.exists) return

  const existingTags = (doc.data()?.tags as string[]) || []
  const mergedTags = [...new Set([...existingTags, ...tags])]

  await db.collection('clients').doc(contactId).update({
    tags: mergedTags,
    updatedAt: new Date().toISOString(),
  })
}

/** Adiciona nota ao contato */
export async function addNoteToContact(
  contactId: string,
  note: string,
  channel: MessageChannel
): Promise<void> {
  if (!contactId || !note) return

  const db = getAdminDb()
  const now = new Date().toISOString()

  await db.collection('clients').doc(contactId).collection('notes').add({
    content: note,
    source: `agente_ia_${channel}`,
    createdAt: now,
  })
}
