'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useCrmUser } from '@/contexts/CrmUserContext'
import { useNotifications, type AppNotification } from '@/hooks/useNotifications'
import { usePlanExpiration } from '@/hooks/usePlanExpiration'
import { PLAN_DISPLAY, type PlanId } from '@/types/plan'
import Link from 'next/link'
import PartnerInvitePopup from './PartnerInvitePopup'

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'agora'
  if (minutes < 60) return `${minutes}min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  return `${days}d`
}

const ICON_MAP: Record<string, { bg: string; icon: React.ReactNode }> = {
  plan_upgrade: {
    bg: 'bg-emerald-100 text-emerald-600',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
      </svg>
    ),
  },
  plan_expiring: {
    bg: 'bg-amber-100 text-amber-600',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
      </svg>
    ),
  },
  welcome: {
    bg: 'bg-primary-100 text-primary-600',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  system: {
    bg: 'bg-blue-100 text-blue-600',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  partner_invite: {
    bg: 'bg-purple-100 text-purple-600',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
      </svg>
    ),
  },
}

export default function NotificationBell() {
  const { orgId, userUid, orgPlan } = useCrmUser()
  const { notifications, unreadCount, markAsRead, markAllAsRead, checkAndCreateExpirationNotification } = useNotifications(orgId ?? undefined, userUid ?? undefined)
  const { daysRemaining, isFreePlan } = usePlanExpiration()
  const [open, setOpen] = useState(false)
  const [inviteNotification, setInviteNotification] = useState<AppNotification | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const handleInviteClick = useCallback((n: AppNotification) => {
    setInviteNotification(n)
    setOpen(false)
  }, [])

  const handleInviteResponded = useCallback(() => {
    setInviteNotification(null)
  }, [])

  // Fechar dropdown ao clicar fora
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [open])

  // Verificar notificação de expiração do plano
  useEffect(() => {
    if (!orgPlan || !orgId || !userUid) return
    const planLabel = isFreePlan ? 'Teste gratuito' : (PLAN_DISPLAY[orgPlan as PlanId]?.displayName || orgPlan)
    if (daysRemaining <= 1) {
      checkAndCreateExpirationNotification(daysRemaining, planLabel)
    }
  }, [daysRemaining, isFreePlan, orgPlan, orgId, userUid, checkAndCreateExpirationNotification])

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-xl hover:bg-slate-100 transition-colors"
        title="Notificacoes"
      >
        <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold leading-none">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Partner Invite Popup */}
      {inviteNotification && (
        <PartnerInvitePopup
          notification={inviteNotification}
          isOpen={!!inviteNotification}
          onClose={() => setInviteNotification(null)}
          onResponded={handleInviteResponded}
        />
      )}

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-white rounded-xl shadow-lg border border-slate-200 z-50 animate-scale-in overflow-hidden">
          {/* Header do dropdown */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <h3 className="text-sm font-semibold text-slate-800">Notificacoes</h3>
            {unreadCount > 0 && (
              <button
                onClick={() => markAllAsRead()}
                className="text-xs text-primary-600 hover:text-primary-700 font-medium transition-colors"
              >
                Marcar todas como lidas
              </button>
            )}
          </div>

          {/* Lista de notificações */}
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 px-4">
                <svg className="w-10 h-10 text-slate-300 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                <p className="text-sm text-slate-400">Nenhuma notificacao</p>
              </div>
            ) : (
              notifications.map((n) => {
                const iconInfo = ICON_MAP[n.type] || ICON_MAP.system
                const isExpiring = n.type === 'plan_expiring'
                const isPartnerInvite = n.type === 'partner_invite'

                const content = (
                  <div
                    key={n.id}
                    onClick={() => {
                      if (isPartnerInvite && !n.read) {
                        handleInviteClick(n)
                        return
                      }
                      if (!n.read) markAsRead(n.id)
                      if (!isExpiring) setOpen(false)
                    }}
                    className={`flex items-start gap-3 px-4 py-3 transition-colors cursor-pointer ${
                      n.read ? 'bg-white hover:bg-slate-50' : 'bg-primary-50/40 hover:bg-primary-50/60'
                    } border-b border-slate-100 last:border-b-0`}
                  >
                    <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${iconInfo.bg}`}>
                      {iconInfo.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className={`text-sm ${n.read ? 'text-slate-700' : 'text-slate-900 font-medium'}`}>
                          {n.title}
                        </p>
                        {!n.read && (
                          <span className="flex-shrink-0 w-2 h-2 rounded-full bg-primary-500 mt-1.5" />
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{n.message}</p>
                      {isPartnerInvite && !n.read && (
                        <span className="inline-flex items-center mt-1.5 text-[11px] font-medium text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full">
                          Clique para responder
                        </span>
                      )}
                      <p className="text-[10px] text-slate-400 mt-1">{timeAgo(n.createdAt)}</p>
                    </div>
                  </div>
                )

                if (isExpiring) {
                  return (
                    <Link key={n.id} href="/plano" onClick={() => { if (!n.read) markAsRead(n.id); setOpen(false) }}>
                      {content}
                    </Link>
                  )
                }

                return content
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
