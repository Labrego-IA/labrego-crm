'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Users, Search, MoreVertical, Pencil, Ban, Trash2, CheckCircle, X, UserX } from 'lucide-react'
import { PLAN_DISPLAY } from '@/types/plan'
import { useCrmUser } from '@/contexts/CrmUserContext'
import ConfirmCloseDialog from '@/components/ConfirmCloseDialog'

interface UserRecord {
  uid: string
  email: string
  displayName: string
  disabled: boolean
  createdAt: string
  lastSignIn: string
  plan: string | null
  orgName: string | null
  orgId: string | null
  role: string | null
}

function timeAgo(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return 'Hoje'
  if (diffDays === 1) return '1 dia'
  if (diffDays < 30) return `${diffDays} dias`
  const diffMonths = Math.floor(diffDays / 30)
  if (diffMonths === 1) return '1 mes'
  if (diffMonths < 12) return `${diffMonths} meses`
  const diffYears = Math.floor(diffMonths / 12)
  if (diffYears === 1) return '1 ano'
  return `${diffYears} anos`
}

export default function SuperAdminUsuariosPage() {
  const { userEmail } = useCrmUser()
  const [users, setUsers] = useState<UserRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [openMenuUid, setOpenMenuUid] = useState<string | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  // Edit modal
  const [editingUser, setEditingUser] = useState<UserRecord | null>(null)
  const [editForm, setEditForm] = useState({ orgName: '', plan: '', createdAt: '', disabled: false })
  const [editInitialForm, setEditInitialForm] = useState({ orgName: '', plan: '', createdAt: '', disabled: false })
  const [editSubmitting, setEditSubmitting] = useState(false)
  const [editError, setEditError] = useState('')
  const [showConfirmClose, setShowConfirmClose] = useState(false)

  // Confirm action dialog
  const [confirmAction, setConfirmAction] = useState<{ uid: string; action: 'delete' | 'disable' | 'enable'; email: string } | null>(null)
  const [actionLoading, setActionLoading] = useState(false)

  const fetchUsers = useCallback(async () => {
    if (!userEmail) return
    try {
      const res = await fetch('/api/super-admin/users', {
        headers: { 'x-user-email': userEmail },
      })
      if (!res.ok) throw new Error('Erro ao carregar usuarios')
      const data = await res.json()
      setUsers(data.users as UserRecord[])
    } catch (err) {
      console.error('[super-admin/usuarios] fetch error:', err)
    } finally {
      setLoading(false)
    }
  }, [userEmail])

  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenuUid(null)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const filteredUsers = users.filter((u) => {
    const q = search.toLowerCase()
    return (
      u.email.toLowerCase().includes(q) ||
      u.displayName.toLowerCase().includes(q) ||
      (u.orgName && u.orgName.toLowerCase().includes(q))
    )
  })

  const executeAction = async (uid: string, action: string, extra?: Record<string, string>) => {
    if (!userEmail) return
    const res = await fetch('/api/super-admin/users', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'x-user-email': userEmail },
      body: JSON.stringify({ uid, action, ...extra }),
    })
    if (!res.ok) {
      const data = await res.json()
      throw new Error(data.error || 'Erro na operacao')
    }
  }

  const handleConfirmAction = async () => {
    if (!confirmAction) return
    setActionLoading(true)
    try {
      await executeAction(confirmAction.uid, confirmAction.action)
      if (confirmAction.action === 'delete') {
        setUsers((prev) => prev.filter((u) => u.uid !== confirmAction.uid))
      } else {
        setUsers((prev) =>
          prev.map((u) =>
            u.uid === confirmAction.uid
              ? { ...u, disabled: confirmAction.action === 'disable' }
              : u
          )
        )
      }
      setConfirmAction(null)
    } catch (err: any) {
      console.error('[super-admin/usuarios] action error:', err)
      alert(err.message)
    } finally {
      setActionLoading(false)
    }
  }

  const openEdit = (user: UserRecord) => {
    setEditingUser(user)
    const form = {
      orgName: user.orgName || '',
      plan: user.plan || '',
      createdAt: user.createdAt ? new Date(user.createdAt).toISOString().split('T')[0] : '',
      disabled: user.disabled,
    }
    setEditForm(form)
    setEditInitialForm(form)
    setEditError('')
    setOpenMenuUid(null)
  }

  const hasEditChanges = useCallback(() => {
    return (
      editForm.orgName !== editInitialForm.orgName ||
      editForm.plan !== editInitialForm.plan ||
      editForm.createdAt !== editInitialForm.createdAt ||
      editForm.disabled !== editInitialForm.disabled
    )
  }, [editForm, editInitialForm])

  const handleCloseEdit = useCallback(() => {
    if (hasEditChanges()) {
      setShowConfirmClose(true)
    } else {
      setEditingUser(null)
      setEditError('')
    }
  }, [hasEditChanges])

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingUser) return
    setEditSubmitting(true)
    setEditError('')
    try {
      await executeAction(editingUser.uid, 'update', {
        orgId: editingUser.orgId || '',
        orgName: editForm.orgName,
        plan: editForm.plan,
        disabled: String(editForm.disabled),
      })
      setUsers((prev) =>
        prev.map((u) =>
          u.uid === editingUser.uid
            ? { ...u, orgName: editForm.orgName, plan: editForm.plan, disabled: editForm.disabled }
            : u
        )
      )
      setEditingUser(null)
    } catch (err: any) {
      setEditError(err.message)
    } finally {
      setEditSubmitting(false)
    }
  }

  const getPlanLabel = (plan: string | null) => {
    if (!plan) return '—'
    return (PLAN_DISPLAY as Record<string, { displayName: string }>)[plan]?.displayName || plan
  }

  const getActionLabel = (action: string) => {
    switch (action) {
      case 'delete': return 'Excluir'
      case 'disable': return 'Bloquear'
      case 'enable': return 'Desbloquear'
      default: return action
    }
  }

  const getActionDescription = (action: string, email: string) => {
    switch (action) {
      case 'delete': return `Tem certeza que deseja excluir o usuario ${email}? Esta acao e irreversivel.`
      case 'disable': return `Tem certeza que deseja bloquear o usuario ${email}? Ele nao podera mais acessar o sistema.`
      case 'enable': return `Deseja desbloquear o usuario ${email}?`
      default: return ''
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg sm:text-xl font-bold text-gray-900">Usuarios</h2>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5 sm:mt-1">
            {loading ? 'Carregando...' : `${users.length} usuario${users.length !== 1 ? 's' : ''} registrado${users.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome, email ou empresa..."
            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/40"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
          <UserX className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">
            {search ? 'Nenhum usuario encontrado para essa busca.' : 'Nenhum usuario registrado.'}
          </p>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Nome</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Email</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Empresa</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Plano</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Cadastro</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-600">Status</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Acoes</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user) => (
                  <tr key={user.uid} className="border-b border-gray-50 hover:bg-gray-50 transition">
                    <td className="px-4 py-3 font-medium text-gray-900">{user.displayName || '—'}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{user.email}</td>
                    <td className="px-4 py-3 text-gray-600 text-xs">{user.orgName || '—'}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-primary-50 text-primary-700">
                        {getPlanLabel(user.plan)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs" title={user.createdAt ? new Date(user.createdAt).toLocaleString('pt-BR') : ''}>
                      {user.createdAt ? timeAgo(user.createdAt) : '—'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {user.disabled ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                          <Ban className="w-3 h-3" /> Bloqueado
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                          <CheckCircle className="w-3 h-3" /> Ativo
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right relative">
                      <button
                        onClick={() => setOpenMenuUid(openMenuUid === user.uid ? null : user.uid)}
                        className="p-1.5 rounded-lg hover:bg-gray-100 transition"
                      >
                        <MoreVertical className="w-4 h-4 text-gray-500" />
                      </button>
                      {openMenuUid === user.uid && (
                        <div ref={menuRef} className="absolute right-4 top-full mt-1 z-20 bg-white rounded-lg shadow-lg border border-gray-200 py-1 min-w-[160px]">
                          <button
                            onClick={() => { openEdit(user); }}
                            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition"
                          >
                            <Pencil className="w-3.5 h-3.5" /> Editar
                          </button>
                          <button
                            onClick={() => {
                              setConfirmAction({
                                uid: user.uid,
                                action: user.disabled ? 'enable' : 'disable',
                                email: user.email,
                              })
                              setOpenMenuUid(null)
                            }}
                            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition"
                          >
                            <Ban className="w-3.5 h-3.5" /> {user.disabled ? 'Desbloquear' : 'Bloquear'}
                          </button>
                          <button
                            onClick={() => {
                              setConfirmAction({ uid: user.uid, action: 'delete', email: user.email })
                              setOpenMenuUid(null)
                            }}
                            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition"
                          >
                            <Trash2 className="w-3.5 h-3.5" /> Excluir
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {filteredUsers.map((user) => (
              <div key={user.uid} className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="text-base font-semibold text-gray-900 truncate">
                      {user.displayName || '—'}
                    </h3>
                    <p className="text-sm text-gray-500 truncate mt-0.5">{user.email}</p>
                    {user.orgName && (
                      <p className="text-xs text-gray-400 mt-0.5">{user.orgName}</p>
                    )}
                  </div>
                  <div className="relative shrink-0">
                    <button
                      onClick={() => setOpenMenuUid(openMenuUid === user.uid ? null : user.uid)}
                      className="p-1.5 rounded-lg hover:bg-gray-100 transition"
                    >
                      <MoreVertical className="w-4 h-4 text-gray-500" />
                    </button>
                    {openMenuUid === user.uid && (
                      <div ref={menuRef} className="absolute right-0 top-full mt-1 z-20 bg-white rounded-lg shadow-lg border border-gray-200 py-1 min-w-[160px]">
                        <button
                          onClick={() => { openEdit(user); }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition"
                        >
                          <Pencil className="w-3.5 h-3.5" /> Editar
                        </button>
                        <button
                          onClick={() => {
                            setConfirmAction({
                              uid: user.uid,
                              action: user.disabled ? 'enable' : 'disable',
                              email: user.email,
                            })
                            setOpenMenuUid(null)
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition"
                        >
                          <Ban className="w-3.5 h-3.5" /> {user.disabled ? 'Desbloquear' : 'Bloquear'}
                        </button>
                        <button
                          onClick={() => {
                            setConfirmAction({ uid: user.uid, action: 'delete', email: user.email })
                            setOpenMenuUid(null)
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Excluir
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                  <div className="flex items-center gap-2">
                    {user.disabled ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                        <Ban className="w-3 h-3" /> Bloqueado
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                        <CheckCircle className="w-3 h-3" /> Ativo
                      </span>
                    )}
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-primary-50 text-primary-700">
                      {getPlanLabel(user.plan)}
                    </span>
                  </div>
                  <span className="text-xs text-gray-400" title={user.createdAt ? new Date(user.createdAt).toLocaleString('pt-BR') : ''}>
                    {user.createdAt ? timeAgo(user.createdAt) : '—'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Edit modal */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={handleCloseEdit}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">Editar Usuario</h3>
              <button onClick={handleCloseEdit} className="p-1 rounded-lg hover:bg-gray-100 transition">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <div className="mb-4 space-y-1">
              <p className="text-sm text-gray-600"><span className="font-medium text-gray-700">Nome:</span> {editingUser.displayName || '—'}</p>
              <p className="text-sm text-gray-600"><span className="font-medium text-gray-700">Email:</span> {editingUser.email}</p>
            </div>
            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Empresa</label>
                <input
                  type="text"
                  value={editForm.orgName}
                  onChange={(e) => setEditForm({ ...editForm, orgName: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/40"
                  placeholder="Nome da empresa"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Plano</label>
                <select
                  value={editForm.plan}
                  onChange={(e) => setEditForm({ ...editForm, plan: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/40 bg-white"
                >
                  <option value="">Sem plano</option>
                  {Object.entries(PLAN_DISPLAY).map(([id, info]) => (
                    <option key={id} value={id}>{(info as { displayName: string }).displayName}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cadastro</label>
                <input
                  type="date"
                  value={editForm.createdAt}
                  onChange={(e) => setEditForm({ ...editForm, createdAt: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/40"
                  disabled
                />
                <p className="text-xs text-gray-400 mt-1">Data de cadastro (somente leitura)</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select
                  value={editForm.disabled ? 'blocked' : 'active'}
                  onChange={(e) => setEditForm({ ...editForm, disabled: e.target.value === 'blocked' })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/40 bg-white"
                >
                  <option value="active">Ativo</option>
                  <option value="blocked">Bloqueado</option>
                </select>
              </div>
              {editError && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{editError}</p>}
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={handleCloseEdit} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition">
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={editSubmitting || !hasEditChanges()}
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50 transition"
                >
                  {editSubmitting ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirm action dialog */}
      {confirmAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => !actionLoading && setConfirmAction(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-gray-900 mb-2">{getActionLabel(confirmAction.action)}</h3>
            <p className="text-sm text-gray-600 mb-6">{getActionDescription(confirmAction.action, confirmAction.email)}</p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setConfirmAction(null)}
                disabled={actionLoading}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmAction}
                disabled={actionLoading}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition disabled:opacity-50 ${
                  confirmAction.action === 'delete'
                    ? 'bg-red-600 text-white hover:bg-red-700'
                    : 'bg-primary-600 text-white hover:bg-primary-700'
                }`}
              >
                {actionLoading ? 'Processando...' : getActionLabel(confirmAction.action)}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmCloseDialog
        isOpen={showConfirmClose}
        onConfirm={() => {
          setShowConfirmClose(false)
          setEditingUser(null)
          setEditError('')
        }}
        onCancel={() => setShowConfirmClose(false)}
      />
    </div>
  )
}
