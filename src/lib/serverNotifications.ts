import admin from 'firebase-admin'
import { getAdminDb } from './firebaseAdmin'
import { FALLBACK_ADMIN_EMAILS } from './requireAdmin'


type NotificationTargets = {
  email?: string
  role?: string
}

type NotificationOptions = NotificationTargets & {
  url?: string
  action?: string
  data?: Record<string, string>
}

type TokenDoc = {
  token: string
  email?: string
}

type NotificationPreferenceDoc = {
  enabled?: boolean
  targetType?: string | null
  target?: string | null
}

export async function sendServerNotification(
  title: string,
  body: string,
  options: NotificationOptions = {},
) {
  const db = getAdminDb()
  const normalizeEmail = (value?: string) => value?.trim().toLowerCase() || undefined
  const normalizeRole = (value?: string | null) => value?.trim().toLowerCase() || ''
  const isAdminRole = (value?: string | null) => normalizeRole(value) === 'admin'
  const extractAdminTokenDocs = (
    snap: admin.firestore.QuerySnapshot<admin.firestore.DocumentData>,
  ): TokenDoc[] => {
    const out: TokenDoc[] = []
    snap.forEach(doc => {
      const data = doc.data() as {
        role?: string | null
        email?: string | null
        disabled?: boolean | null
      }
      if (data?.disabled) return
      if (isAdminRole(data?.role)) {
        out.push({
          token: doc.id,
          email: normalizeEmail(data?.email || undefined),
        })

      }
    })
    return out
  }


  const tokenDocs = new Map<string, TokenDoc>()
  const addTokenDocs = (docs: TokenDoc[]) => {
    docs.forEach(doc => {
      tokenDocs.set(doc.token, doc)
    })
  }

  const preferenceKey = typeof options.action === 'string' && options.action.length > 0 ? options.action : null
  let preference: NotificationPreferenceDoc | null = null
  if (preferenceKey) {
    try {
      const prefSnap = await db.collection('notificationPreferences').doc(preferenceKey).get()
      preference = prefSnap.exists ? ((prefSnap.data() as NotificationPreferenceDoc) || null) : null
    } catch (err) {
      console.error('[notifications] Failed to read preference', err)
    }
  }

  let normalizedTargetEmail = normalizeEmail(options.email)
  let normalizedTargetRoleRaw = normalizeRole(options.role)

  if (preference) {
    if (preference.targetType === 'email') {
      normalizedTargetEmail = normalizeEmail(preference.target || undefined)
      normalizedTargetRoleRaw = ''
    } else if (preference.targetType === 'role') {
      normalizedTargetEmail = undefined
      normalizedTargetRoleRaw = normalizeRole(preference.target)
    }
  }

  const normalizedTargetRole = normalizedTargetRoleRaw || null

  if (preference && preference.enabled === false) {
    await db.collection('serverNotificationLogs').add({
      title,
      body,
      targetEmail: normalizedTargetEmail ?? null,
      targetRole: normalizedTargetRole,
      url: options.url || null,
      action: options.action || null,
      data: options.data || null,
      recipients: [],
      recipientEmails: [],
      sentCount: 0,
      preferenceKey,
      preferenceApplied: true,
      preferenceDisabled: true,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    })
    return 0
  }

  if (preference?.targetType === 'email' && !normalizedTargetEmail) {
    await db.collection('serverNotificationLogs').add({
      title,
      body,
      targetEmail: null,
      targetRole: null,
      url: options.url || null,
      action: options.action || null,
      data: options.data || null,
      recipients: [],
      recipientEmails: [],
      sentCount: 0,
      preferenceKey,
      preferenceApplied: true,
      preferenceDisabled: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    })
    return 0
  }

  if (normalizedTargetEmail) {
    const email = normalizedTargetEmail
    if (!email) {
      await db.collection('serverNotificationLogs').add({
        title,
        body,
        targetEmail: null,
        targetRole: normalizedTargetRole,
        url: options.url || null,
        action: options.action || null,
        data: options.data || null,
        recipients: [],
        recipientEmails: [],
        sentCount: 0,
        preferenceKey,
        preferenceApplied: Boolean(preference),
        preferenceDisabled: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      })
      return 0
    }
    const snap = await db.collection('fcmTokens').where('email', '==', email).get()
    addTokenDocs(extractAdminTokenDocs(snap))
  } else if (normalizedTargetRoleRaw) {
    const role = normalizedTargetRoleRaw
    const roleUsersSnap = await db.collection('userRoles').where('role', '==', role).get()
    const roleTokens = (role === 'admin' ? 'admin' : role) === 'admin'
      ? extractAdminTokenDocs(await db.collection('fcmTokens').where('role', '==', 'admin').get())

      : []
    const roleEmails = roleUsersSnap.docs
      .map(d => normalizeEmail(d.id))
      .filter((email): email is string => Boolean(email))
    const fallbackEmails =
      role === 'admin'
        ? FALLBACK_ADMIN_EMAILS.map(normalizeEmail).filter(
            (email): email is string => Boolean(email),
          )
        : []

    const targetEmails = Array.from(new Set([...roleEmails, ...fallbackEmails]))


    const chunkSize = 10
    for (let i = 0; i < targetEmails.length; i += chunkSize) {
      const chunk = targetEmails.slice(i, i + chunkSize)
      if (chunk.length === 0) continue
      const snap = await db
        .collection('fcmTokens')
        .where('email', 'in', chunk)
        .get()
      addTokenDocs(extractAdminTokenDocs(snap))

    }
    addTokenDocs(roleTokens)
  } else {
    const snap = await db.collection('fcmTokens').where('role', '==', 'admin').get()
    addTokenDocs(extractAdminTokenDocs(snap))

  }

  const tokens = Array.from(tokenDocs.values()).map(doc => doc.token)
  const recipientDetails = Array.from(tokenDocs.values()).map(doc => ({
    token: doc.token,
    email: doc.email || null,
  }))
  const recipientEmails = Array.from(
    new Set(
      recipientDetails
        .map(recipient => recipient.email || undefined)
        .filter((email): email is string => Boolean(email)),
    ),
  )

  if (tokens.length === 0) {
    await db.collection('serverNotificationLogs').add({
      title,
      body,
      targetEmail: normalizedTargetEmail ?? null,
      targetRole: normalizedTargetRole,
      url: options.url || null,
      action: options.action || null,
      data: options.data || null,
      recipients: recipientDetails,
      recipientEmails,
      sentCount: 0,
      preferenceKey,
      preferenceApplied: Boolean(preference),
      preferenceDisabled: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    })
    return 0
  }

  const message: admin.messaging.MulticastMessage = {
    tokens,
    notification: { title, body },
  }

  const data: Record<string, string> = { ...(options.data || {}) }
  if (options.url) data.url = options.url
  if (options.action) data.action = options.action
  if (Object.keys(data).length > 0) {
    message.data = data
  }

  const res = await admin.messaging().sendEachForMulticast(message)

  await db.collection('serverNotificationLogs').add({
    title,
    body,
    targetEmail: normalizedTargetEmail ?? null,
    targetRole: normalizedTargetRole,
    url: options.url || null,
    action: options.action || null,
    data: options.data || null,
    recipients: recipientDetails,
    recipientEmails,
    sentCount: res.successCount,
    preferenceKey,
    preferenceApplied: Boolean(preference),
    preferenceDisabled: false,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  })

  return res.successCount
}
