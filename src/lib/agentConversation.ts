/**
 * Agent Conversation — CRUD Firestore para conversas e mensagens do agente IA
 *
 * Collections:
 * - organizations/{orgId}/conversations/{id}
 * - organizations/{orgId}/conversations/{id}/messages/{msgId}
 */

import { getAdminDb } from './firebaseAdmin'
import { FieldValue } from 'firebase-admin/firestore'
import type {
  Conversation,
  ConversationMessage,
  ConversationStatus,
  MessageChannel,
  MessageContentType,
  MessageRole,
} from '@/types/agentConfig'

// ========== HELPERS ==========

function getConversationsRef(orgId: string) {
  const db = getAdminDb()
  return db.collection('organizations').doc(orgId).collection('conversations')
}

function getMessagesRef(orgId: string, conversationId: string) {
  return getConversationsRef(orgId).doc(conversationId).collection('messages')
}

// ========== CREATE ==========

export async function createConversation(
  orgId: string,
  data: {
    contactId: string
    contactName: string
    contactPhone?: string
    contactEmail?: string
    channel: MessageChannel
    metadata?: Record<string, unknown>
  }
): Promise<Conversation> {
  const now = new Date().toISOString()

  const conversationData = {
    orgId,
    contactId: data.contactId,
    contactName: data.contactName,
    contactPhone: data.contactPhone || '',
    contactEmail: data.contactEmail || '',
    channel: data.channel,
    status: 'active' as ConversationStatus,
    assignedTo: '',
    aiEnabled: true,
    lastMessageAt: now,
    lastMessagePreview: '',
    unreadCount: 0,
    messageCount: 0,
    metadata: data.metadata || {},
    createdAt: now,
    updatedAt: now,
  }

  const ref = await getConversationsRef(orgId).add(conversationData)

  return { id: ref.id, ...conversationData }
}

// ========== ADD MESSAGE ==========

export async function addMessage(
  orgId: string,
  conversationId: string,
  data: {
    role: MessageRole
    content: string
    contentType: MessageContentType
    mediaUrl?: string
    channel: MessageChannel
    externalMessageId?: string
    creditsUsed?: number
    tokensUsed?: number
  }
): Promise<ConversationMessage> {
  const now = new Date().toISOString()

  const messageData = {
    conversationId,
    role: data.role,
    content: data.content,
    contentType: data.contentType,
    mediaUrl: data.mediaUrl || '',
    channel: data.channel,
    externalMessageId: data.externalMessageId || '',
    creditsUsed: data.creditsUsed || 0,
    tokensUsed: data.tokensUsed || 0,
    sentAt: now,
    createdAt: now,
  }

  const ref = await getMessagesRef(orgId, conversationId).add(messageData)

  // Atualizar conversa com preview e contadores
  const preview = data.content.length > 100 ? data.content.substring(0, 100) + '...' : data.content
  const updateData: Record<string, unknown> = {
    lastMessageAt: now,
    lastMessagePreview: preview,
    messageCount: FieldValue.increment(1),
    updatedAt: now,
  }

  // Incrementar unread se mensagem do contato
  if (data.role === 'contact') {
    updateData.unreadCount = FieldValue.increment(1)
  }

  await getConversationsRef(orgId).doc(conversationId).update(updateData)

  return { id: ref.id, ...messageData }
}

// ========== READ ==========

export async function getConversation(
  orgId: string,
  conversationId: string
): Promise<Conversation | null> {
  const doc = await getConversationsRef(orgId).doc(conversationId).get()
  if (!doc.exists) return null
  return { id: doc.id, ...doc.data() } as Conversation
}

/** Busca conversa ativa por telefone do contato */
export async function findActiveConversationByPhone(
  orgId: string,
  phone: string
): Promise<Conversation | null> {
  const phoneClean = phone.replace(/\D/g, '')

  const snap = await getConversationsRef(orgId)
    .where('contactPhone', '==', phoneClean)
    .where('channel', '==', 'whatsapp')
    .where('status', 'in', ['active', 'human_handoff'])
    .orderBy('lastMessageAt', 'desc')
    .limit(1)
    .get()

  if (snap.empty) return null
  return { id: snap.docs[0].id, ...snap.docs[0].data() } as Conversation
}

/** Busca conversa ativa por email do contato */
export async function findActiveConversationByEmail(
  orgId: string,
  email: string
): Promise<Conversation | null> {
  const snap = await getConversationsRef(orgId)
    .where('contactEmail', '==', email.toLowerCase())
    .where('channel', '==', 'email')
    .where('status', 'in', ['active', 'human_handoff'])
    .orderBy('lastMessageAt', 'desc')
    .limit(1)
    .get()

  if (snap.empty) return null
  return { id: snap.docs[0].id, ...snap.docs[0].data() } as Conversation
}

/** Lista conversas de uma org com paginacao */
export async function listConversations(
  orgId: string,
  options?: {
    channel?: MessageChannel
    status?: ConversationStatus | ConversationStatus[]
    limit?: number
    startAfter?: string  // lastMessageAt cursor
  }
): Promise<Conversation[]> {
  let query = getConversationsRef(orgId).orderBy('lastMessageAt', 'desc')

  if (options?.channel) {
    query = query.where('channel', '==', options.channel)
  }

  if (options?.status) {
    if (Array.isArray(options.status)) {
      query = query.where('status', 'in', options.status)
    } else {
      query = query.where('status', '==', options.status)
    }
  }

  if (options?.startAfter) {
    query = query.startAfter(options.startAfter)
  }

  const limit = options?.limit || 30
  const snap = await query.limit(limit).get()

  return snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Conversation))
}

/** Lista mensagens de uma conversa */
export async function listMessages(
  orgId: string,
  conversationId: string,
  limit: number = 50
): Promise<ConversationMessage[]> {
  const snap = await getMessagesRef(orgId, conversationId)
    .orderBy('createdAt', 'asc')
    .limitToLast(limit)
    .get()

  return snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as ConversationMessage))
}

// ========== UPDATE ==========

export async function updateConversationStatus(
  orgId: string,
  conversationId: string,
  status: ConversationStatus,
  assignedTo?: string
): Promise<void> {
  const updateData: Record<string, unknown> = {
    status,
    updatedAt: new Date().toISOString(),
  }

  if (status === 'human_handoff') {
    updateData.aiEnabled = false
    if (assignedTo) updateData.assignedTo = assignedTo
  } else if (status === 'active') {
    updateData.aiEnabled = true
  }

  await getConversationsRef(orgId).doc(conversationId).update(updateData)
}

/** Marca conversa como lida (zera unreadCount) */
export async function markConversationAsRead(
  orgId: string,
  conversationId: string
): Promise<void> {
  await getConversationsRef(orgId).doc(conversationId).update({
    unreadCount: 0,
    updatedAt: new Date().toISOString(),
  })
}

/** Re-ativa IA na conversa */
export async function resumeAI(
  orgId: string,
  conversationId: string
): Promise<void> {
  await getConversationsRef(orgId).doc(conversationId).update({
    status: 'active',
    aiEnabled: true,
    assignedTo: '',
    updatedAt: new Date().toISOString(),
  })
}

// ========== AGENT CONFIG CRUD ==========

export async function getAgentConfig(orgId: string) {
  const db = getAdminDb()
  const doc = await db.collection('agentConfigs').doc(orgId).get()
  if (!doc.exists) return null
  return doc.data()
}

export async function saveAgentConfig(
  orgId: string,
  config: Record<string, unknown>
): Promise<void> {
  const db = getAdminDb()
  await db.collection('agentConfigs').doc(orgId).set(
    {
      ...config,
      orgId,
      updatedAt: new Date().toISOString(),
    },
    { merge: true }
  )
}

// ========== WHATSAPP CONNECTION CRUD ==========

export async function getWhatsAppConnection(orgId: string) {
  const db = getAdminDb()
  const doc = await db.collection('whatsappConnections').doc(orgId).get()
  if (!doc.exists) return null
  return doc.data()
}

export async function saveWhatsAppConnection(
  orgId: string,
  data: Record<string, unknown>
): Promise<void> {
  const db = getAdminDb()
  await db.collection('whatsappConnections').doc(orgId).set(
    {
      ...data,
      orgId,
      updatedAt: new Date().toISOString(),
    },
    { merge: true }
  )
}
