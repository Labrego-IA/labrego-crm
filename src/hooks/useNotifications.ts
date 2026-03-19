'use client'

import { useState, useEffect, useCallback } from 'react'
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc, writeBatch, addDoc } from 'firebase/firestore'
import { db } from '@/lib/firebaseClient'

export interface AppNotification {
  id: string
  orgId: string
  userId: string
  type: 'plan_upgrade' | 'plan_expiring' | 'welcome' | 'system'
  title: string
  message: string
  read: boolean
  createdAt: string
}

export function useNotifications(orgId?: string, userId?: string) {
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [loading, setLoading] = useState(true)

  const unreadCount = notifications.filter(n => !n.read).length

  // Listener em tempo real para notificações do usuário
  useEffect(() => {
    if (!orgId || !userId) {
      setNotifications([])
      setLoading(false)
      return
    }

    const notifRef = collection(db, 'notifications')
    const q = query(
      notifRef,
      where('orgId', '==', orgId),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc')
    )

    const unsub = onSnapshot(q, (snap) => {
      const items = snap.docs.map(d => ({
        id: d.id,
        ...d.data(),
      })) as AppNotification[]
      setNotifications(items)
      setLoading(false)
    }, (err) => {
      console.error('[useNotifications] Listener error:', err)
      setLoading(false)
    })

    return () => unsub()
  }, [orgId, userId])

  // Marcar uma notificação como lida
  const markAsRead = useCallback(async (notificationId: string) => {
    try {
      await updateDoc(doc(db, 'notifications', notificationId), { read: true })
    } catch (err) {
      console.error('[useNotifications] markAsRead error:', err)
    }
  }, [])

  // Marcar todas como lidas
  const markAllAsRead = useCallback(async () => {
    const unread = notifications.filter(n => !n.read)
    if (unread.length === 0) return

    try {
      const batch = writeBatch(db)
      unread.forEach(n => {
        batch.update(doc(db, 'notifications', n.id), { read: true })
      })
      await batch.commit()
    } catch (err) {
      console.error('[useNotifications] markAllAsRead error:', err)
    }
  }, [notifications])

  // Criar notificação de expiração do plano (client-side check)
  const checkAndCreateExpirationNotification = useCallback(async (
    daysRemaining: number,
    planLabel: string,
  ) => {
    if (!orgId || !userId || daysRemaining > 1 || daysRemaining < 0) return

    // Verificar se já existe uma notificação de expiração recente (últimas 24h)
    const existing = notifications.find(n =>
      n.type === 'plan_expiring' &&
      new Date(n.createdAt).getTime() > Date.now() - 24 * 60 * 60 * 1000
    )
    if (existing) return

    try {
      await addDoc(collection(db, 'notifications'), {
        orgId,
        userId,
        type: 'plan_expiring',
        title: 'Seu plano esta prestes a expirar!',
        message: daysRemaining <= 0
          ? `Seu plano ${planLabel} expirou. Renove agora para continuar usando todos os recursos.`
          : `Falta apenas 1 dia para o seu plano ${planLabel} expirar. Renove para nao perder acesso aos recursos.`,
        read: false,
        createdAt: new Date().toISOString(),
      })
    } catch (err) {
      console.error('[useNotifications] checkAndCreateExpirationNotification error:', err)
    }
  }, [orgId, userId, notifications])

  return {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead,
    checkAndCreateExpirationNotification,
  }
}
