'use client'

import { useState, useEffect } from 'react'
import { requestNotificationPermission } from '@/lib/firebaseMessaging'

export default function RequestNotifications() {
  const [enabled, setEnabled] = useState(false)
  const [visible, setVisible] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      setVisible(false)
      return
    }

    const status = localStorage.getItem('notifications-status')
    if (Notification.permission === 'granted' || status === 'granted') {
      setEnabled(true)
      localStorage.setItem('notifications-status', 'granted')
    } else if (status === 'denied') {
      setVisible(false)
    }
  }, [])

  if (enabled || !visible) return null

  const handleClick = async () => {
    try {
      const token = await requestNotificationPermission()
      if (token) {
        setEnabled(true)
        localStorage.setItem('notifications-status', 'granted')
      } else {
        localStorage.setItem('notifications-status', 'denied')
      }
    } catch (err: any) {
      setError(err.message)
    }
  }

  return (
    <div className="fixed bottom-4 left-4 md:left-[18rem] z-40 pointer-events-none">
      <div className="bg-white p-4 rounded shadow-lg max-w-xs text-sm flex items-start gap-2 pointer-events-auto">
        <span className="flex-1">Deseja ativar as notificações?</span>
        <button
          onClick={handleClick}
          className="btn bg-primary text-white shadow"
        >
          Permitir
        </button>
        <button
          onClick={() => {
            localStorage.setItem('notifications-status', 'denied')
            setVisible(false)
          }}
          className="text-gray-600 hover:text-gray-800"
          aria-label="Fechar"
        >
          &times;
        </button>
      </div>
      {error && <div className="text-red-500 text-xs mt-2">{error}</div>}
    </div>
  )
}
