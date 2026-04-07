/**
 * Z-API Connector — Cliente para a API da Z-API (WhatsApp)
 *
 * Gerencia instancias por org: criar, conectar (QR), enviar msgs, desconectar.
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
  value: string   // QR code base64 image or string
  connected: boolean
}

interface ZAPIMessageResponse {
  zapiMessageId: string
  messageId: string
  id: string
}

// ========== HELPERS ==========

function getInstanceUrl(instanceId: string): string {
  return `${ZAPI_BASE_URL}/instances/${instanceId}`
}

function getHeaders(instanceToken: string): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'Client-Token': ZAPI_CLIENT_TOKEN,
  }
}

function getAuthHeaders(instanceToken: string): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'Client-Token': ZAPI_CLIENT_TOKEN,
    'Authorization': `Bearer ${instanceToken}`,
  }
}

async function zapiRequest<T>(
  url: string,
  options: RequestInit & { instanceToken?: string } = {}
): Promise<T> {
  const { instanceToken, ...fetchOptions } = options
  const headers = instanceToken
    ? getAuthHeaders(instanceToken)
    : { 'Content-Type': 'application/json', 'Client-Token': ZAPI_CLIENT_TOKEN }

  const response = await fetch(url, { ...fetchOptions, headers })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Z-API error (${response.status}): ${errorText}`)
  }

  return response.json() as Promise<T>
}

// ========== INSTANCE MANAGEMENT ==========

/** Cria uma nova instancia Z-API para a org */
export async function createInstance(orgId: string): Promise<ZAPIInstanceInfo> {
  const result = await zapiRequest<{ id: string; token: string }>(`${ZAPI_BASE_URL}/instances`, {
    method: 'POST',
    body: JSON.stringify({
      name: `labrego-${orgId}`,
    }),
  })

  return {
    instanceId: result.id,
    token: result.token,
  }
}

/** Remove/deleta uma instancia Z-API */
export async function deleteInstance(instanceId: string, instanceToken: string): Promise<void> {
  await zapiRequest(`${getInstanceUrl(instanceId)}/delete`, {
    method: 'DELETE',
    instanceToken,
  })
}

// ========== CONNECTION ==========

/** Obtem QR code para conectar o WhatsApp */
export async function getQRCode(instanceId: string, instanceToken: string): Promise<ZAPIQRCode> {
  const result = await zapiRequest<{ value?: string; connected?: boolean }>(
    `${getInstanceUrl(instanceId)}/token/${instanceToken}/qr-code`,
    { method: 'GET', instanceToken }
  )

  return {
    value: result.value || '',
    connected: result.connected || false,
  }
}

/** Obtem QR code como imagem base64 */
export async function getQRCodeImage(instanceId: string, instanceToken: string): Promise<string> {
  const result = await zapiRequest<{ value?: string }>(
    `${getInstanceUrl(instanceId)}/token/${instanceToken}/qr-code/image`,
    { method: 'GET', instanceToken }
  )

  return result.value || ''
}

/** Verifica status da conexao */
export async function getConnectionStatus(
  instanceId: string,
  instanceToken: string
): Promise<ZAPIConnectionStatus> {
  try {
    const result = await zapiRequest<{
      connected?: boolean
      smartphoneConnected?: boolean
      session?: string
      error?: string
    }>(
      `${getInstanceUrl(instanceId)}/token/${instanceToken}/status`,
      { method: 'GET', instanceToken }
    )

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

/** Desconecta o WhatsApp (logout) sem deletar a instancia */
export async function disconnect(instanceId: string, instanceToken: string): Promise<void> {
  await zapiRequest(`${getInstanceUrl(instanceId)}/token/${instanceToken}/disconnect`, {
    method: 'POST',
    instanceToken,
  })
}

/** Reinicia a instancia */
export async function restartInstance(instanceId: string, instanceToken: string): Promise<void> {
  await zapiRequest(`${getInstanceUrl(instanceId)}/token/${instanceToken}/restart`, {
    method: 'POST',
    instanceToken,
  })
}

// ========== SEND MESSAGES ==========

/** Formata telefone para formato Z-API (apenas digitos com codigo do pais) */
function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  // Se ja comeca com 55, usa direto. Senao, adiciona 55.
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
  return zapiRequest<ZAPIMessageResponse>(
    `${getInstanceUrl(instanceId)}/token/${instanceToken}/send-text`,
    {
      method: 'POST',
      instanceToken,
      body: JSON.stringify({
        phone: formatPhone(to),
        message,
      }),
    }
  )
}

/** Envia audio (para resposta TTS via ElevenLabs) */
export async function sendAudioMessage(
  instanceId: string,
  instanceToken: string,
  to: string,
  audioBase64: string
): Promise<ZAPIMessageResponse> {
  return zapiRequest<ZAPIMessageResponse>(
    `${getInstanceUrl(instanceId)}/token/${instanceToken}/send-audio`,
    {
      method: 'POST',
      instanceToken,
      body: JSON.stringify({
        phone: formatPhone(to),
        audio: audioBase64,
        encoding: 'audio/mpeg',
      }),
    }
  )
}

/** Envia imagem */
export async function sendImageMessage(
  instanceId: string,
  instanceToken: string,
  to: string,
  imageUrl: string,
  caption?: string
): Promise<ZAPIMessageResponse> {
  return zapiRequest<ZAPIMessageResponse>(
    `${getInstanceUrl(instanceId)}/token/${instanceToken}/send-image`,
    {
      method: 'POST',
      instanceToken,
      body: JSON.stringify({
        phone: formatPhone(to),
        image: imageUrl,
        caption: caption || '',
      }),
    }
  )
}

/** Envia documento */
export async function sendDocumentMessage(
  instanceId: string,
  instanceToken: string,
  to: string,
  documentUrl: string,
  fileName: string
): Promise<ZAPIMessageResponse> {
  return zapiRequest<ZAPIMessageResponse>(
    `${getInstanceUrl(instanceId)}/token/${instanceToken}/send-document/{extension}`,
    {
      method: 'POST',
      instanceToken,
      body: JSON.stringify({
        phone: formatPhone(to),
        document: documentUrl,
        fileName,
      }),
    }
  )
}

// ========== WEBHOOK CONFIGURATION ==========

/** Configura a URL de webhook para receber mensagens da instancia */
export async function setWebhookUrl(
  instanceId: string,
  instanceToken: string,
  webhookUrl: string
): Promise<void> {
  await zapiRequest(`${getInstanceUrl(instanceId)}/token/${instanceToken}/update-webhook`, {
    method: 'PUT',
    instanceToken,
    body: JSON.stringify({
      value: webhookUrl,
    }),
  })
}

// ========== TYPING INDICATOR ==========

/** Mostra indicador "digitando..." no WhatsApp do contato */
export async function sendTypingIndicator(
  instanceId: string,
  instanceToken: string,
  to: string
): Promise<void> {
  await zapiRequest(`${getInstanceUrl(instanceId)}/token/${instanceToken}/typing`, {
    method: 'POST',
    instanceToken,
    body: JSON.stringify({
      phone: formatPhone(to),
      duration: 5000,
    }),
  }).catch(() => {
    // Typing indicator e best-effort, nao deve bloquear
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
    metadata: {
      contentType: 'audio/mpeg',
    },
  })

  await file.makePublic()

  return `https://storage.googleapis.com/${bucket.name}/${filePath}`
}
