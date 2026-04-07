/**
 * Z-API Connector — Cliente para a API da Z-API (WhatsApp)
 *
 * Formato correto da Z-API:
 * Base: https://api.z-api.io/instances/{instanceId}/token/{token}/{endpoint}
 *
 * Instancias sao criadas no painel da Z-API (https://developer.z-api.io/)
 * Cada cliente insere instanceId + token no CRM.
 *
 * Docs: https://developer.z-api.io/
 */

import { getAdminStorage } from '../firebaseAdmin'

const ZAPI_BASE_URL = process.env.ZAPI_BASE_URL || 'https://api.z-api.io'
const ZAPI_CLIENT_TOKEN = process.env.ZAPI_CLIENT_TOKEN || ''

// ========== TYPES ==========

export interface ZAPIInstanceInfo {
  instanceId: string
  token: string
  phone?: string
}

export interface ZAPIConnectionStatus {
  connected: boolean
  smartphoneConnected: boolean
  session: string
  error?: string
}

export interface ZAPIQRCode {
  value: string
  connected: boolean
}

interface ZAPIMessageResponse {
  zapiMessageId: string
  messageId: string
  id: string
}

// ========== HELPERS ==========

/** Monta a URL base da instancia: /instances/{id}/token/{token} */
function getInstanceBaseUrl(instanceId: string, instanceToken: string): string {
  return `${ZAPI_BASE_URL}/instances/${instanceId}/token/${instanceToken}`
}

async function zapiRequest<T>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(ZAPI_CLIENT_TOKEN ? { 'Client-Token': ZAPI_CLIENT_TOKEN } : {}),
  }

  const response = await fetch(url, {
    ...options,
    headers: { ...headers, ...(options.headers as Record<string, string> || {}) },
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Z-API error (${response.status}): ${errorText}`)
  }

  const text = await response.text()
  if (!text) return {} as T
  return JSON.parse(text) as T
}

// ========== CONNECTION ==========

/** Obtem QR code para conectar o WhatsApp */
export async function getQRCode(instanceId: string, instanceToken: string): Promise<ZAPIQRCode> {
  const baseUrl = getInstanceBaseUrl(instanceId, instanceToken)
  const result = await zapiRequest<{ value?: string; connected?: boolean }>(
    `${baseUrl}/qr-code`,
    { method: 'GET' }
  )
  return {
    value: result.value || '',
    connected: result.connected || false,
  }
}

/** Obtem QR code como imagem base64 */
export async function getQRCodeImage(instanceId: string, instanceToken: string): Promise<string> {
  const baseUrl = getInstanceBaseUrl(instanceId, instanceToken)
  const result = await zapiRequest<{ value?: string }>(
    `${baseUrl}/qr-code/image`,
    { method: 'GET' }
  )
  return result.value || ''
}

/** Verifica status da conexao */
export async function getConnectionStatus(
  instanceId: string,
  instanceToken: string
): Promise<ZAPIConnectionStatus> {
  try {
    const baseUrl = getInstanceBaseUrl(instanceId, instanceToken)
    const result = await zapiRequest<{
      connected?: boolean
      smartphoneConnected?: boolean
      session?: string
      error?: string
    }>(`${baseUrl}/status`, { method: 'GET' })

    return {
      connected: result.connected || false,
      smartphoneConnected: result.smartphoneConnected || false,
      session: result.session || '',
      error: result.error,
    }
  } catch (error) {
    return {
      connected: false,
      smartphoneConnected: false,
      session: '',
      error: error instanceof Error ? error.message : 'Erro desconhecido',
    }
  }
}

/** Desconecta o WhatsApp (logout) */
export async function disconnect(instanceId: string, instanceToken: string): Promise<void> {
  const baseUrl = getInstanceBaseUrl(instanceId, instanceToken)
  await zapiRequest(`${baseUrl}/disconnect`, { method: 'POST' })
}

/** Reinicia a instancia */
export async function restartInstance(instanceId: string, instanceToken: string): Promise<void> {
  const baseUrl = getInstanceBaseUrl(instanceId, instanceToken)
  await zapiRequest(`${baseUrl}/restart`, { method: 'POST' })
}

// ========== SEND MESSAGES ==========

/** Formata telefone para formato Z-API (apenas digitos com codigo do pais) */
function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.startsWith('55') && digits.length >= 12) return digits
  return `55${digits}`
}

/** Envia mensagem de texto */
export async function sendTextMessage(
  instanceId: string,
  instanceToken: string,
  to: string,
  message: string
): Promise<ZAPIMessageResponse> {
  const baseUrl = getInstanceBaseUrl(instanceId, instanceToken)
  return zapiRequest<ZAPIMessageResponse>(`${baseUrl}/send-text`, {
    method: 'POST',
    body: JSON.stringify({
      phone: formatPhone(to),
      message,
    }),
  })
}

/** Envia audio */
export async function sendAudioMessage(
  instanceId: string,
  instanceToken: string,
  to: string,
  audioUrl: string
): Promise<ZAPIMessageResponse> {
  const baseUrl = getInstanceBaseUrl(instanceId, instanceToken)
  return zapiRequest<ZAPIMessageResponse>(`${baseUrl}/send-audio`, {
    method: 'POST',
    body: JSON.stringify({
      phone: formatPhone(to),
      audio: audioUrl,
    }),
  })
}

/** Envia imagem */
export async function sendImageMessage(
  instanceId: string,
  instanceToken: string,
  to: string,
  imageUrl: string,
  caption?: string
): Promise<ZAPIMessageResponse> {
  const baseUrl = getInstanceBaseUrl(instanceId, instanceToken)
  return zapiRequest<ZAPIMessageResponse>(`${baseUrl}/send-image`, {
    method: 'POST',
    body: JSON.stringify({
      phone: formatPhone(to),
      image: imageUrl,
      caption: caption || '',
    }),
  })
}

/** Envia documento */
export async function sendDocumentMessage(
  instanceId: string,
  instanceToken: string,
  to: string,
  documentUrl: string,
  fileName: string
): Promise<ZAPIMessageResponse> {
  const baseUrl = getInstanceBaseUrl(instanceId, instanceToken)
  return zapiRequest<ZAPIMessageResponse>(`${baseUrl}/send-document/pdf`, {
    method: 'POST',
    body: JSON.stringify({
      phone: formatPhone(to),
      document: documentUrl,
      fileName,
    }),
  })
}

// ========== WEBHOOK CONFIGURATION ==========

/** Configura a URL de webhook para receber mensagens da instancia */
export async function setWebhookUrl(
  instanceId: string,
  instanceToken: string,
  webhookUrl: string
): Promise<void> {
  const baseUrl = getInstanceBaseUrl(instanceId, instanceToken)
  await zapiRequest(`${baseUrl}/update-webhook`, {
    method: 'PUT',
    body: JSON.stringify({ value: webhookUrl }),
  })
}

// ========== TYPING INDICATOR ==========

/** Mostra indicador "digitando..." */
export async function sendTypingIndicator(
  instanceId: string,
  instanceToken: string,
  to: string
): Promise<void> {
  const baseUrl = getInstanceBaseUrl(instanceId, instanceToken)
  await zapiRequest(`${baseUrl}/typing`, {
    method: 'POST',
    body: JSON.stringify({
      phone: formatPhone(to),
      duration: 5000,
    }),
  }).catch(() => {
    // Best-effort, nao deve bloquear
  })
}

// ========== AUDIO UPLOAD HELPER ==========

/** Faz upload de audio para Firebase Storage e retorna a URL publica */
export async function uploadAudioToStorage(
  orgId: string,
  audioBuffer: Buffer,
  fileName: string
): Promise<string> {
  const storage = getAdminStorage()
  const bucket = storage.bucket()
  const filePath = `agent-audio/${orgId}/${Date.now()}-${fileName}`
  const file = bucket.file(filePath)

  await file.save(audioBuffer, {
    metadata: { contentType: 'audio/mpeg' },
  })

  await file.makePublic()
  return `https://storage.googleapis.com/${bucket.name}/${filePath}`
}
