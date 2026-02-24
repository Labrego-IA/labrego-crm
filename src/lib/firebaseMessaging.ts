import { firebaseConfig, getFirebaseMessaging, auth } from './firebaseClient'
import { getToken } from 'firebase/messaging'
import { onAuthStateChanged } from 'firebase/auth'

let initPromise: Promise<string | null> | null = null
let authListenerRegistered = false
let lastRegisteredEmail: string | null = null

export function initFirebaseMessaging() {
  if (typeof window === 'undefined') return Promise.resolve(null)

  // Only proceed if permission is already granted.
  // Requesting permission outside a user gesture is blocked by browsers (Safari etc.)
  // and triggers "Notification prompting can only be done from a user gesture".
  // The RequestNotifications component handles the actual permission prompt via user click.
  if (!('Notification' in window) || Notification.permission !== 'granted') {
    if (!authListenerRegistered) {
      authListenerRegistered = true
      onAuthStateChanged(auth, user => {
        if (user?.email) {
          void initFirebaseMessaging()
        }
      })
    }
    return Promise.resolve(null)
  }

  const currentEmail = auth.currentUser?.email || undefined

  if (currentEmail) {
    if (initPromise && lastRegisteredEmail === currentEmail) {
      return initPromise
    }
    initPromise = requestNotificationPermission(currentEmail).catch(err => {
      console.error('[FCM] falha ao inicializar:', err)
      initPromise = null
      lastRegisteredEmail = null
      return null
    })
    lastRegisteredEmail = currentEmail
    return initPromise
  }

  if (!authListenerRegistered) {
    authListenerRegistered = true
    onAuthStateChanged(auth, user => {
      if (user?.email) {
        void initFirebaseMessaging()
      }
    })
  }

  return Promise.resolve(null)
}

export async function requestNotificationPermission(
  email?: string
): Promise<string | null> {
  if (
    typeof window === 'undefined' ||
    !('Notification' in window) ||
    !('serviceWorker' in navigator)
  )
    return null

  const messaging = await getFirebaseMessaging()
  if (!messaging) return null

  const userEmail = email || auth.currentUser?.email || undefined

  // 1) Pede permissão ao usuário
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return null

  // 2) Registra o service worker com sua config
  const swConfig = btoa(JSON.stringify(firebaseConfig))
  const swUrl = `/firebase-messaging-sw.js?config=${encodeURIComponent(swConfig)}`

  if (!swUrl.includes('config=')) {
    console.error('[FCM] parâmetro config ausente na URL do service worker')
    return null
  }

  const registration = await navigator.serviceWorker.register(swUrl)

  // 3) Gera o token
  const token = await getToken(messaging, {
    vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
    serviceWorkerRegistration: registration,
  })

  if (!token) {
    console.warn('[FCM] não conseguiu gerar token')
    return null
  }
  console.log('[FCM] token gerado:', token)

  // 4) Envia para a sua API e verifica o retorno
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (userEmail) headers['x-user-email'] = userEmail
  const res = await fetch('/api/fcm-token', {
    method: 'POST',
    headers,
    body: JSON.stringify({ token, email: userEmail ?? null }),
  })

  if (!res.ok) {
    // lê mensagem de erro, se houver
    let errMsg = `status ${res.status}`
    try {
      const json = await res.json()
      errMsg = json.error || errMsg
    } catch {}
    console.error('[FCM] falha ao salvar token:', errMsg)
    throw new Error(`Falha ao salvar token: ${errMsg}`)
  }

  console.log('[FCM] token salvo com sucesso')
  return token
}

if (typeof window !== 'undefined') {
  void initFirebaseMessaging()
}
