'use client'

import { useState, useEffect } from 'react'
import Modal from './Modal'
import { toast } from 'sonner'

interface InviteTokenPopupProps {
  token: string
  userEmail: string
  onHandled: () => void
}

interface InviteInfo {
  orgId: string
  orgName: string
  memberId: string
  email: string
  role: string
  inviterEmail: string
  displayName: string
}

const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrador',
  manager: 'Gerente',
  seller: 'Vendedor',
  viewer: 'Visualizador',
  cliente: 'Cliente',
}

export default function InviteTokenPopup({ token, userEmail, onHandled }: InviteTokenPopupProps) {
  const [loading, setLoading] = useState(true)
  const [invite, setInvite] = useState<InviteInfo | null>(null)
  const [responding, setResponding] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Resolve the invite token
    fetch('/api/admin/members/resolve-invite-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json()
          setError(data.message || 'Convite nao encontrado ou ja foi utilizado.')
          setLoading(false)
          return
        }
        const data = await res.json()
        if (data.found && data.invite) {
          setInvite(data.invite)
        } else {
          setError('Convite nao encontrado.')
        }
        setLoading(false)
      })
      .catch(() => {
        setError('Erro ao carregar convite.')
        setLoading(false)
      })
  }, [token])

  const handleResponse = async (action: 'accept' | 'reject') => {
    if (!invite) return
    setResponding(true)
    try {
      const res = await fetch('/api/admin/members/respond-invite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-email': userEmail,
        },
        body: JSON.stringify({
          orgId: invite.orgId,
          memberId: invite.memberId,
          action,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Erro ao responder convite')
      }

      if (action === 'accept') {
        toast.success(`Voce agora e parceiro(a) de ${invite.orgName}!`)
      } else {
        toast.success('Convite recusado.')
      }
      onHandled()
    } catch (err: unknown) {
      console.error('Error responding to invite:', err)
      const message = err instanceof Error ? err.message : 'Erro ao responder convite'
      toast.error(message)
    } finally {
      setResponding(false)
    }
  }

  const handleClose = () => {
    // Just close without responding — user can still respond via in-app notification
    onHandled()
  }

  // Don't show if still loading
  if (loading) return null

  // If error, show briefly then dismiss
  if (error) {
    return (
      <Modal isOpen onClose={handleClose} size="sm" centered>
        <div className="space-y-4 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-100">
            <svg className="h-7 w-7 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900">Convite invalido</h3>
          <p className="text-sm text-gray-500">{error}</p>
          <button
            type="button"
            onClick={handleClose}
            className="inline-flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white bg-primary-600 hover:bg-primary-700 shadow-sm transition active:scale-[0.99]"
          >
            Fechar
          </button>
        </div>
      </Modal>
    )
  }

  if (!invite) return null

  const roleLabel = ROLE_LABELS[invite.role] || invite.role

  return (
    <Modal isOpen onClose={handleClose} size="sm" centered>
      <div className="space-y-5">
        {/* Icon + Header */}
        <div className="text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-primary-100">
            <svg className="h-7 w-7 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900">Convite de parceria</h3>
          <p className="text-sm text-gray-500 mt-1">
            <span className="font-medium text-gray-700">{invite.inviterEmail}</span> convidou voce para ser
            parceiro(a) na organizacao <span className="font-medium text-gray-700">{invite.orgName}</span>.
          </p>
        </div>

        {/* Details */}
        <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">Organizacao</span>
            <span className="text-sm font-medium text-gray-900">{invite.orgName}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">Cargo</span>
            <span className="text-sm font-medium text-gray-900">{roleLabel}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">Convidado por</span>
            <span className="text-sm font-medium text-gray-900">{invite.inviterEmail}</span>
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
            disabled={responding}
            className={`flex-1 inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 hover:border-gray-300 transition active:scale-[0.99] ${responding ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            Recusar
          </button>
          <button
            type="button"
            onClick={() => handleResponse('accept')}
            disabled={responding}
            className={`flex-1 inline-flex items-center justify-center gap-2 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-white bg-primary-600 hover:bg-primary-700 shadow-sm transition active:scale-[0.99] ${responding ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {responding ? (
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
