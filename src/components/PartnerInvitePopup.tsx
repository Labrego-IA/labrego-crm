'use client'

import { useState } from 'react'
import { useCrmUser } from '@/contexts/CrmUserContext'
import type { AppNotification } from '@/hooks/useNotifications'
import Modal from './Modal'
import { toast } from 'sonner'

interface PartnerInvitePopupProps {
  notification: AppNotification
  isOpen: boolean
  onClose: () => void
  onResponded: () => void
}

const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrador',
  manager: 'Gerente',
  seller: 'Vendedor',
  viewer: 'Visualizador',
}

export default function PartnerInvitePopup({
  notification,
  isOpen,
  onClose,
  onResponded,
}: PartnerInvitePopupProps) {
  const { userEmail } = useCrmUser()
  const [loading, setLoading] = useState(false)

  const meta = notification.metadata || {}
  const inviterName = meta.inviterName || meta.inviterEmail || 'Alguem'
  const orgName = meta.inviteOrgName || 'uma organizacao'
  const role = meta.role || 'viewer'
  const roleLabel = ROLE_LABELS[role] || role

  const handleResponse = async (action: 'accept' | 'reject') => {
    if (!userEmail) return
    setLoading(true)
    try {
      const res = await fetch('/api/admin/members/respond-invite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-email': userEmail,
        },
        body: JSON.stringify({
          orgId: meta.inviteOrgId,
          memberId: meta.inviteMemberId,
          action,
          notificationId: notification.id,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Erro ao responder convite')
      }

      if (action === 'accept') {
        toast.success(`Voce agora e parceiro(a) de ${orgName}!`)
      } else {
        toast.success('Convite recusado.')
      }
      onResponded()
      onClose()
    } catch (error: unknown) {
      console.error('Error responding to invite:', error)
      const message = error instanceof Error ? error.message : 'Erro ao responder convite'
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="sm" centered>
      <div className="space-y-5">
        {/* Icon + Header */}
        <div className="text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-primary-100">
            <svg className="h-7 w-7 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Convite de parceria</h3>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
            <span className="font-medium text-gray-700 dark:text-slate-300">{inviterName}</span> convidou voce para ser
            parceiro(a) na organizacao <span className="font-medium text-gray-700 dark:text-slate-300">{orgName}</span>.
          </p>
        </div>

        {/* Details */}
        <div className="rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500 dark:text-slate-400">Organizacao</span>
            <span className="text-sm font-medium text-gray-900 dark:text-white">{orgName}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500 dark:text-slate-400">Cargo</span>
            <span className="text-sm font-medium text-gray-900 dark:text-white">{roleLabel}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500 dark:text-slate-400">Convidado por</span>
            <span className="text-sm font-medium text-gray-900 dark:text-white">{inviterName}</span>
          </div>
        </div>

        <p className="text-xs text-gray-400 text-center">
          Ao aceitar, voce tera acesso aos dados da organizacao com as permissoes do cargo atribuido.
        </p>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => handleResponse('reject')}
            disabled={loading}
            className={`flex-1 inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 dark:border-white/10 px-3.5 py-2.5 text-sm font-medium text-gray-700 dark:text-slate-300 bg-white dark:bg-surface-dark hover:bg-gray-50 dark:bg-white/5 hover:border-gray-300 transition active:scale-[0.99] ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            Recusar
          </button>
          <button
            type="button"
            onClick={() => handleResponse('accept')}
            disabled={loading}
            className={`flex-1 inline-flex items-center justify-center gap-2 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-white bg-primary-600 hover:bg-primary-700 shadow-sm transition active:scale-[0.99] ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {loading ? (
              <>
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                Processando...
              </>
            ) : (
              'Aceitar convite'
            )}
          </button>
        </div>
      </div>
    </Modal>
  )
}
