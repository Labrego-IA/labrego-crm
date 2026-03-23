'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useCrmUser } from '@/contexts/CrmUserContext'
import { usePermissions } from '@/hooks/usePermissions'
import { usePlan } from '@/hooks/usePlan'
import { db } from '@/lib/firebaseClient'
import { collection, query, where, onSnapshot, doc, updateDoc } from 'firebase/firestore'
import { ROLE_PRESETS, ALL_PAGES, ALL_ACTIONS, type RolePreset } from '@/types/permissions'
import { filterPagesByPlan, filterActionsByPlan, isPageFeatureAvailable } from '@/lib/planPermissions'
import type { OrgMember, MemberPermissions, MemberActions } from '@/types/organization'
import { toast } from 'sonner'
import PermissionGate from '@/components/PermissionGate'
import Modal from '@/components/Modal'
import ConfirmCloseDialog from '@/components/ConfirmCloseDialog'
import { useFreePlanGuard } from '@/hooks/useFreePlanGuard'
import FreePlanDialog from '@/components/FreePlanDialog'

/* -------------------------------- Helpers -------------------------------- */

const ADMIN_ROLES = ['admin', 'manager', 'seller', 'viewer'] as const
type AdminRole = (typeof ADMIN_ROLES)[number]

const ROLE_LABELS: Record<AdminRole, string> = {
  admin: 'Admin',
  manager: 'Gerente',
  seller: 'Vendedor',
  viewer: 'Visualizador',
}

const ROLE_BADGE: Record<AdminRole, string> = {
  admin: 'bg-purple-100 text-purple-800',
  manager: 'bg-blue-100 text-blue-800',
  seller: 'bg-green-100 text-green-800',
  viewer: 'bg-gray-100 text-gray-800',
}

const STATUS_BADGE: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-800',
  invited: 'bg-amber-100 text-amber-800',
  pending: 'bg-sky-100 text-sky-800',
  suspended: 'bg-red-100 text-red-800',
}

const STATUS_LABELS: Record<string, string> = {
  active: 'Ativo',
  invited: 'Convidado',
  pending: 'Pendente',
  suspended: 'Suspenso',
}

function formatJoinedDate(iso: string): string {
  if (!iso) return '--'
  try {
    return new Date(iso).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
  } catch {
    return '--'
  }
}

function normalize(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

type SortColumn = 'name' | 'email' | 'role' | 'status' | 'joinedAt'
type SortDirection = 'asc' | 'desc'

const ROLE_ORDER: Record<string, number> = { admin: 0, manager: 1, seller: 2, viewer: 3 }
const STATUS_ORDER: Record<string, number> = { active: 0, invited: 1, suspended: 2 }

function defaultActions(): MemberActions {
  return {
    canCreateContacts: false,
    canEditContacts: false,
    canDeleteContacts: false,
    canCreateProposals: false,
    canExportData: false,
    canManageFunnels: false,
    canManageUsers: false,
    canTriggerCalls: false,
    canViewReports: false,
    canManageSettings: false,
    canTransferLeads: false,
  }
}

function defaultPermissions(): MemberPermissions {
  return {
    pages: [],
    actions: defaultActions(),
    viewScope: 'own',
  }
}

/* -------------------------------- Styles -------------------------------- */

const ui = {
  btn: `inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 px-3.5 py-2 text-sm
        font-medium text-gray-700 bg-white hover:bg-gray-50 hover:border-gray-300 transition active:scale-[0.99]`,
  btnPrimary: `inline-flex items-center justify-center gap-2 rounded-xl px-3.5 py-2 text-sm font-semibold
        text-white bg-primary-600 hover:bg-primary-700 shadow-sm transition active:scale-[0.99]`,
  btnDanger: `inline-flex items-center justify-center gap-2 rounded-xl px-3.5 py-2 text-sm font-semibold
        text-white bg-rose-600 hover:bg-rose-700 shadow-sm transition active:scale-[0.99]`,
  input: `w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800
        placeholder:text-gray-400 focus:outline-none focus:ring-4 focus:ring-primary-100 focus:border-primary-300`,
  select: `w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800
        focus:outline-none focus:ring-4 focus:ring-primary-100 focus:border-primary-300`,
  card: 'bg-white rounded-2xl shadow-sm ring-1 ring-gray-200',
  label: 'block text-sm font-medium text-gray-700 mb-1',
}

/* ============================== Component =============================== */

export default function UsuariosPage() {
  const { orgId, userUid, userEmail } = useCrmUser()
  const { can } = usePermissions()
  const { limits, plan } = usePlan()
  const { guard, showDialog: showFreePlanDialog, closeDialog: closeFreePlanDialog } = useFreePlanGuard()

  /* ---------------------- Plan-filtered pages & actions ------------------ */

  const planAllowedPages = useMemo(
    () => ALL_PAGES.filter(page => isPageFeatureAvailable(page.feature, plan)),
    [plan],
  )

  const planAllowedPagePaths = useMemo(
    () => new Set(planAllowedPages.map(p => p.path)),
    [planAllowedPages],
  )

  /* ----------------------------- State ---------------------------------- */

  const [members, setMembers] = useState<OrgMember[]>([])
  const [loading, setLoading] = useState(true)

  // When orgId is not available, stop loading immediately
  useEffect(() => {
    if (!orgId) setLoading(false)
  }, [orgId])

  // Search & sort
  const [search, setSearch] = useState('')
  const [sortColumn, setSortColumn] = useState<SortColumn | null>(null)
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')

  // Add modal
  const [showAddModal, setShowAddModal] = useState(false)
  const addFormDefault = { email: '', displayName: '', role: 'seller' as RolePreset, password: '', confirmPassword: '' }
  const [addForm, setAddForm] = useState(addFormDefault)
  const [addLoading, setAddLoading] = useState(false)
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchResult, setSearchResult] = useState<{ found: boolean; user: { uid: string; email: string; displayName: string; photoUrl: string | null } | null } | null>(null)
  const [searchError, setSearchError] = useState<string | null>(null)

  const addHasChanges = addForm.email !== '' || addForm.role !== 'seller' || addForm.password !== '' || addForm.displayName !== ''

  // Edit modal
  const [editMember, setEditMember] = useState<OrgMember | null>(null)
  const [editDisplayName, setEditDisplayName] = useState('')
  const [editRole, setEditRole] = useState<RolePreset>('viewer')
  const [editPermissions, setEditPermissions] = useState<MemberPermissions>(defaultPermissions())
  const [editLoading, setEditLoading] = useState(false)

  // Snapshot of edit modal initial values for dirty detection
  const editInitialRef = useRef<{
    displayName: string
    role: RolePreset
    permissions: MemberPermissions
  } | null>(null)

  const editHasChanges = (() => {
    if (!editMember || !editInitialRef.current) return false
    const ini = editInitialRef.current
    if (editDisplayName !== ini.displayName) return true
    if (editRole !== ini.role) return true
    if (editPermissions.viewScope !== ini.permissions.viewScope) return true
    if (JSON.stringify([...editPermissions.pages].sort()) !== JSON.stringify([...ini.permissions.pages].sort())) return true
    if (JSON.stringify(editPermissions.actions) !== JSON.stringify(ini.permissions.actions)) return true
    return false
  })()

  // Delete confirmation
  const [deleteMember, setDeleteMember] = useState<OrgMember | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  // Block confirmation
  const [blockMember, setBlockMember] = useState<OrgMember | null>(null)
  const [blockLoading, setBlockLoading] = useState(false)

  // Actions menu
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  /* ---------------------- Real-time subscription ------------------------ */

  // Subscribe only to partners invited by the current user
  useEffect(() => {
    if (!orgId || !userEmail) return
    const q = query(
      collection(db, 'organizations', orgId, 'members'),
      where('invitedBy', '==', userEmail.toLowerCase()),
    )
    const unsub = onSnapshot(
      q,
      (snap) => {
        const items: OrgMember[] = snap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        })) as OrgMember[]
        setMembers(items)
        setLoading(false)
      },
      (error) => {
        console.error('Error loading members:', error)
        toast.error('Erro ao carregar membros')
        setLoading(false)
      },
    )
    return () => unsub()
  }, [orgId, userEmail])

  /* ---------------------- Search user by email --------------------------- */

  const handleSearchEmail = async () => {
    if (!orgId || !userEmail) return
    const emailVal = addForm.email.trim()
    if (!emailVal) {
      toast.error('Informe o email do usuario')
      return
    }

    // Basic email validation
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailVal)) {
      toast.error('Informe um email valido')
      return
    }

    setSearchLoading(true)
    setSearchResult(null)
    setSearchError(null)

    try {
      const res = await fetch('/api/admin/members/search-by-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-email': userEmail,
        },
        body: JSON.stringify({ orgId, email: emailVal }),
      })

      if (!res.ok) {
        const data = await res.json()
        if (res.status === 409) {
          if (data.error === 'already_partner_of_another') {
            setSearchError('Este usuario ja e parceiro de outro usuario')
          } else {
            setSearchError('Este email ja esta cadastrado como seu parceiro')
          }
        } else {
          throw new Error(data.error || 'Erro ao buscar usuario')
        }
        return
      }

      const data = await res.json()
      setSearchResult(data)

      if (data.found && data.user) {
        setAddForm((f) => ({ ...f, displayName: data.user.displayName || '' }))
      } else {
        setAddForm((f) => ({ ...f, displayName: '' }))
      }
    } catch (error: unknown) {
      console.error('Error searching email:', error)
      const message = error instanceof Error ? error.message : 'Erro ao buscar usuario'
      setSearchError(message)
    } finally {
      setSearchLoading(false)
    }
  }

  /* ---------------------- Add member handler ---------------------------- */

  const handleAdd = async () => {
    if (!orgId || !userEmail) return
    if (!addForm.email.trim()) {
      toast.error('Informe o email do usuario')
      return
    }

    const emailExists = members.some(
      (m) => m.email.toLowerCase() === addForm.email.trim().toLowerCase(),
    )
    if (emailExists) {
      toast.error('Este email ja esta cadastrado como parceiro')
      return
    }

    // Validate pre-registration fields for new users
    const isNewUser = searchResult && !searchResult.found
    if (isNewUser) {
      if (!addForm.displayName.trim()) {
        toast.error('Informe o nome do usuario')
        return
      }
      if (!addForm.password || addForm.password.length < 6) {
        toast.error('A senha deve ter pelo menos 6 caracteres')
        return
      }
      if (addForm.password !== addForm.confirmPassword) {
        toast.error('As senhas nao coincidem')
        return
      }
    }

    setAddLoading(true)
    try {
      const body: Record<string, string> = {
        orgId,
        email: addForm.email.trim(),
        displayName: searchResult?.user?.displayName || addForm.displayName.trim() || addForm.email.trim().split('@')[0],
        role: addForm.role,
      }

      // Include password for pre-registration of new users
      if (isNewUser && addForm.password) {
        body.password = addForm.password
      }

      const res = await fetch('/api/admin/members/invite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-email': userEmail,
        },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Erro ao convidar membro')
      }

      toast.success(
        isNewUser
          ? `Conta criada e convite enviado por email para ${addForm.email.trim()}.`
          : `Convite enviado para ${addForm.email.trim()}. O usuario recebera uma notificacao e um email para aceitar.`,
      )
      setAddForm({ email: '', displayName: '', role: 'seller', password: '', confirmPassword: '' })
      setSearchResult(null)
      setSearchError(null)
      setShowAddModal(false)
    } catch (error: unknown) {
      console.error('Error adding member:', error)
      const message = error instanceof Error ? error.message : 'Erro ao adicionar membro'
      toast.error(message)
    } finally {
      setAddLoading(false)
    }
  }

  /* ---------------------- Edit member handler --------------------------- */

  const openEditModal = (member: OrgMember) => {
    setEditMember(member)
    const name = member.displayName || ''
    setEditDisplayName(name)
    const validRoles: AdminRole[] = [...ADMIN_ROLES]
    const role = validRoles.includes(member.role as AdminRole)
      ? (member.role as AdminRole)
      : 'viewer'
    setEditRole(role)
    const perms: MemberPermissions = {
      pages: [...(member.permissions?.pages || [])],
      actions: { ...defaultActions(), ...(member.permissions?.actions || {}) },
      viewScope: member.permissions?.viewScope || 'own',
    }
    setEditPermissions(perms)
    editInitialRef.current = {
      displayName: name,
      role,
      permissions: {
        pages: [...perms.pages],
        actions: { ...perms.actions },
        viewScope: perms.viewScope,
      },
    }
  }

  const handleRoleChange = (role: RolePreset) => {
    setEditRole(role)
    const preset = ROLE_PRESETS[role]
    setEditPermissions({
      pages: filterPagesByPlan([...preset.pages], plan),
      actions: filterActionsByPlan({ ...preset.actions }, plan),
      viewScope: preset.viewScope,
    })
  }

  const togglePage = (path: string) => {
    // Only allow toggling pages that are in the current plan
    if (!planAllowedPagePaths.has(path as typeof ALL_PAGES[number]['path'])) return
    setEditPermissions((prev) => ({
      ...prev,
      pages: prev.pages.includes(path)
        ? prev.pages.filter((p) => p !== path)
        : [...prev.pages, path],
    }))
  }

  const toggleAction = (key: keyof MemberActions) => {
    setEditPermissions((prev) => ({
      ...prev,
      actions: { ...prev.actions, [key]: !prev.actions[key] },
    }))
  }

  const handleSaveEdit = async () => {
    if (!orgId || !editMember) return
    const validRoles: AdminRole[] = [...ADMIN_ROLES]
    if (!editRole || !validRoles.includes(editRole as AdminRole)) {
      toast.error('Selecione um cargo valido')
      return
    }
    if (!editDisplayName.trim()) {
      toast.error('O nome do usuario e obrigatorio')
      return
    }
    setEditLoading(true)
    try {
      // Ensure only plan-allowed pages/actions are saved
      const filteredPermissions = {
        ...editPermissions,
        pages: filterPagesByPlan(editPermissions.pages, plan),
        actions: filterActionsByPlan(editPermissions.actions, plan),
      }
      await updateDoc(doc(db, 'organizations', orgId, 'members', editMember.id), {
        displayName: editDisplayName.trim(),
        role: editRole,
        permissions: filteredPermissions,
        planId: plan,
      })
      toast.success(`${editDisplayName.trim()} atualizado com sucesso`)
      setEditMember(null)
    } catch (error) {
      console.error('Error updating member:', error)
      toast.error('Erro ao atualizar permissoes')
    } finally {
      setEditLoading(false)
    }
  }

  /* ---------------------- Delete member handler ------------------------- */

  const handleDelete = async () => {
    if (!orgId || !deleteMember || !userEmail) return
    setDeleteLoading(true)
    try {
      const res = await fetch('/api/admin/members/delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-email': userEmail,
        },
        body: JSON.stringify({ orgId, memberId: deleteMember.id, userId: deleteMember.userId }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Erro ao remover membro')
      }
      toast.success(`${deleteMember.displayName} removido dos parceiros`)
      setDeleteMember(null)
    } catch (error) {
      console.error('Error deleting member:', error)
      const message = error instanceof Error ? error.message : 'Erro ao remover membro'
      toast.error(message)
    } finally {
      setDeleteLoading(false)
    }
  }

  /* ---------------------- Block/Unblock handler ------------------------- */

  const handleBlock = async () => {
    if (!orgId || !blockMember || !userEmail) return
    const action = blockMember.status === 'suspended' ? 'unblock' : 'block'
    setBlockLoading(true)
    try {
      const res = await fetch('/api/admin/members/block', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-email': userEmail,
        },
        body: JSON.stringify({ orgId, memberId: blockMember.id, userId: blockMember.userId, action }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Erro ao atualizar status')
      }
      toast.success(
        action === 'block'
          ? `${blockMember.displayName} foi bloqueado`
          : `${blockMember.displayName} foi desbloqueado`,
      )
      setBlockMember(null)
    } catch (error) {
      console.error('Error blocking member:', error)
      const message = error instanceof Error ? error.message : 'Erro ao atualizar status'
      toast.error(message)
    } finally {
      setBlockLoading(false)
    }
  }

  /* ---------------------- Close actions menu on outside click ----------- */

  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!openMenuId) return
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node
      if (
        menuRef.current && !menuRef.current.contains(target) &&
        dropdownRef.current && !dropdownRef.current.contains(target)
      ) {
        setOpenMenuId(null)
        setMenuPos(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [openMenuId])

  /* ---------------------- Modal close handlers ------------------------- */

  // Unsaved changes confirmation state
  const [showAddConfirm, setShowAddConfirm] = useState(false)
  const [showEditConfirm, setShowEditConfirm] = useState(false)

  const closeAddModal = useCallback(() => {
    setShowAddModal(false)
    setShowAddConfirm(false)
    setAddForm({ email: '', displayName: '', role: 'seller' })
    setSearchResult(null)
    setSearchError(null)
  }, [])

  const closeEditModal = useCallback(() => {
    setEditMember(null)
    setShowEditConfirm(false)
    editInitialRef.current = null
  }, [])

  const requestCloseAddModal = useCallback(() => {
    if (addHasChanges) {
      setShowAddConfirm(true)
    } else {
      closeAddModal()
    }
  }, [addHasChanges, closeAddModal])

  const requestCloseEditModal = useCallback(() => {
    if (editHasChanges) {
      setShowEditConfirm(true)
    } else {
      closeEditModal()
    }
  }, [editHasChanges, closeEditModal])

  /* ---------------------- Search, filter & sort ------------------------ */

  const handleSort = useCallback((column: SortColumn) => {
    setSortColumn((prev) => {
      if (prev === column) {
        if (sortDirection === 'asc') {
          setSortDirection('desc')
          return prev
        }
        // desc → neutral: clear sort
        setSortDirection('asc')
        return null
      }
      setSortDirection('asc')
      return column
    })
  }, [sortDirection])

  const filteredMembers = useMemo(() => {
    const term = normalize(search.trim())

    let result = members.filter((m) => m.role !== 'cliente')
    if (term) {
      result = result.filter((m) => {
        const name = normalize(m.displayName || '')
        const email = normalize(m.email || '')
        const role = normalize(ROLE_LABELS[m.role as AdminRole] || m.role || '')
        const status = normalize(STATUS_LABELS[m.status] || m.status || '')
        return name.includes(term) || email.includes(term) || role.includes(term) || status.includes(term)
      })
    }

    if (sortColumn) {
      result = [...result].sort((a, b) => {
        let cmp = 0
        switch (sortColumn) {
          case 'name':
            cmp = normalize(a.displayName || '').localeCompare(normalize(b.displayName || ''))
            break
          case 'email':
            cmp = normalize(a.email || '').localeCompare(normalize(b.email || ''))
            break
          case 'role':
            cmp = (ROLE_ORDER[a.role] ?? 4) - (ROLE_ORDER[b.role] ?? 4)
            break
          case 'status':
            cmp = (STATUS_ORDER[a.status] ?? 4) - (STATUS_ORDER[b.status] ?? 4)
            break
          case 'joinedAt':
            cmp = (a.joinedAt || '').localeCompare(b.joinedAt || '')
            break
        }
        return sortDirection === 'asc' ? cmp : -cmp
      })
    }

    return result
  }, [members, search, sortColumn, sortDirection])

  /* ---------------------- Computed values ------------------------------- */

  const memberCount = members.length
  const maxUsers = limits.maxUsers
  const atLimit = memberCount >= maxUsers

  /* ============================== Render ================================ */

  return (
    <PermissionGate
      action="canManageUsers"
      fallback={
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className={`${ui.card} p-8 text-center max-w-md`}>
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-100">
              <svg className="h-7 w-7 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-1">Acesso restrito</h3>
            <p className="text-sm text-gray-500">Sem permissao para gerenciar parceiros</p>
          </div>
        </div>
      }
    >
      <div className="space-y-6">
        {/* =================== Header =================== */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-gray-900">Parceiros</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Gerencie os parceiros da sua conta. Cada parceiro podera visualizar os mesmos dados que voce.
            </p>
          </div>
          <button
            type="button"
            disabled={atLimit}
            onClick={() => guard(() => setShowAddModal(true))}
            className={`${ui.btnPrimary} hidden sm:inline-flex ${atLimit ? 'opacity-50 cursor-not-allowed' : ''}`}
            title={atLimit ? 'Limite do plano atingido' : 'Adicionar parceiro'}
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Adicionar parceiro
          </button>
        </div>

        {/* Mobile: FAB flutuante */}
        {!atLimit && (
          <button
            onClick={() => guard(() => setShowAddModal(true))}
            className="sm:hidden fixed bottom-6 right-6 z-40 flex items-center justify-center w-14 h-14 rounded-full bg-primary-600 text-white shadow-lg shadow-primary-600/30 hover:bg-primary-700 active:scale-95 transition-all"
            aria-label="Adicionar parceiro"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
          </button>
        )}

        {/* =================== Plan limit bar =================== */}
        <div className={`${ui.card} px-5 py-4`}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">
              Parceiros: {memberCount} / {maxUsers}
            </span>
            {atLimit && (
              <span className="text-xs font-medium text-amber-700 bg-amber-100 px-2.5 py-0.5 rounded-full">
                Limite atingido
              </span>
            )}
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all ${
                atLimit ? 'bg-amber-500' : 'bg-primary-500'
              }`}
              style={{ width: `${Math.min((memberCount / maxUsers) * 100, 100)}%` }}
            />
          </div>
          {atLimit && (
            <p className="text-xs text-gray-500 mt-2">
              Faca upgrade do plano para adicionar mais parceiros.
            </p>
          )}
        </div>

        {/* =================== Search bar =================== */}
        <div className="relative">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Pesquisar parceiro por nome, email, cargo ou status..."
            className={`${ui.input} pl-9`}
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* =================== Member list =================== */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-200 border-t-primary-600" />
          </div>
        ) : filteredMembers.length === 0 ? (
          <div className={`${ui.card} p-12 text-center`}>
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-slate-100">
              <svg className="h-7 w-7 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128H9m6 0a5.972 5.972 0 00-.786-3.07M9 19.128v-.003c0-1.113.285-2.16.786-3.07M9 19.128H3.375a4.125 4.125 0 017.533-2.493M9 19.128a5.972 5.972 0 01.786-3.07m4.428 0a9.36 9.36 0 00-4.428 0M12 10.5a3 3 0 100-6 3 3 0 000 6z" />
              </svg>
            </div>
            <h3 className="text-base font-semibold text-gray-900">
              {members.length === 0 ? 'Nenhum parceiro encontrado' : 'Nenhum resultado encontrado'}
            </h3>
            <p className="text-sm text-gray-500 mt-1">
              {members.length === 0
                ? 'Adicione o primeiro parceiro da sua conta.'
                : 'Tente ajustar os termos da pesquisa.'}
            </p>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className={`${ui.card} hidden sm:block`}>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-slate-50/80">
                      {([
                        { key: 'name' as SortColumn, label: 'Parceiro', align: 'left' },
                        { key: 'email' as SortColumn, label: 'Email', align: 'left' },
                        { key: 'role' as SortColumn, label: 'Cargo', align: 'center' },
                        { key: 'status' as SortColumn, label: 'Status', align: 'center' },
                        { key: 'joinedAt' as SortColumn, label: 'Entrada', align: 'center' },
                      ]).map((col) => (
                        <th
                          key={col.key}
                          className={`px-5 py-3 text-${col.align} font-medium text-gray-600`}
                        >
                          <button
                            type="button"
                            onClick={() => handleSort(col.key)}
                            className={`inline-flex items-center gap-1 hover:text-gray-900 transition ${
                              col.align === 'center' ? 'mx-auto' : ''
                            }`}
                          >
                            {col.label}
                            <svg
                              className={`h-3.5 w-3.5 transition-colors ${
                                sortColumn === col.key ? 'text-primary-600' : 'text-gray-300'
                              }`}
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              strokeWidth={2}
                            >
                              {sortColumn === col.key && sortDirection === 'asc' ? (
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
                              ) : sortColumn === col.key && sortDirection === 'desc' ? (
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                              ) : (
                                <>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 14l4 4 4-4" />
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 10l4-4 4 4" />
                                </>
                              )}
                            </svg>
                          </button>
                        </th>
                      ))}
                      <th className="px-5 py-3 text-center font-medium text-gray-600">Acoes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredMembers.map((m) => {
                      const initials = (m.displayName || '')
                        .split(/\s+/)
                        .slice(0, 2)
                        .map((w) => w[0]?.toUpperCase() ?? '')
                        .join('')
                      const isSelf = m.userId === userUid

                      return (
                        <tr key={m.id} className="hover:bg-slate-50/60 transition-colors">
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-3">
                              {m.photoUrl ? (
                                <img
                                  src={m.photoUrl}
                                  alt={m.displayName}
                                  className="h-9 w-9 rounded-full object-cover ring-1 ring-gray-200"
                                />
                              ) : (
                                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-100 text-xs font-semibold text-primary-700 ring-1 ring-primary-200">
                                  {initials || '?'}
                                </div>
                              )}
                              <div className="min-w-0">
                                <p className="font-medium text-gray-900 truncate flex items-center gap-1.5">
                                  {m.displayName}
                                  {m.status === 'suspended' && (
                                    <svg className="h-4 w-4 text-red-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-label="Bloqueado">
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                                    </svg>
                                  )}
                                  {isSelf && (
                                    <span className="ml-0.5 text-xs text-gray-400">(voce)</span>
                                  )}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-3 text-gray-600">{m.email}</td>
                          <td className="px-5 py-3 text-center">
                            {m.role ? (
                              <span
                                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${ROLE_BADGE[m.role as AdminRole] || 'bg-gray-100 text-gray-800'}`}
                              >
                                {ROLE_LABELS[m.role as AdminRole] || m.role}
                              </span>
                            ) : (
                              <span className="text-xs text-gray-400">&mdash;</span>
                            )}
                          </td>
                          <td className="px-5 py-3 text-center">
                            <span
                              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_BADGE[m.status] || 'bg-gray-100 text-gray-800'}`}
                            >
                              {STATUS_LABELS[m.status] || m.status}
                            </span>
                          </td>
                          <td className="px-5 py-3 text-center text-gray-500">
                            {formatJoinedDate(m.joinedAt)}
                          </td>
                          <td className="px-5 py-3 text-center">
                            <div className="relative inline-block" ref={openMenuId === m.id ? menuRef : undefined}>
                              <button
                                type="button"
                                onClick={(e) => {
                                  if (openMenuId === m.id) {
                                    setOpenMenuId(null)
                                    setMenuPos(null)
                                  } else {
                                    const rect = e.currentTarget.getBoundingClientRect()
                                    setMenuPos({ top: rect.bottom + 4, left: rect.right })
                                    setOpenMenuId(m.id)
                                  }
                                }}
                                className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 transition"
                                title="Acoes"
                              >
                                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 12.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 18.75a.75.75 0 110-1.5.75.75 0 010 1.5z" />
                                </svg>
                              </button>
                              {openMenuId === m.id && menuPos && (
                                <div
                                  ref={dropdownRef}
                                  className="fixed w-44 bg-white rounded-xl shadow-lg border border-gray-200 py-1 z-[9999] animate-scale-in"
                                  style={{ top: menuPos.top, left: menuPos.left - 176 }}
                                >
                                  <button
                                    type="button"
                                    onClick={() => guard(() => { openEditModal(m); setOpenMenuId(null); setMenuPos(null) })}
                                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition"
                                  >
                                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
                                    </svg>
                                    Editar
                                  </button>
                                  {!isSelf && (
                                    <button
                                      type="button"
                                      onClick={() => { setBlockMember(m); setOpenMenuId(null); setMenuPos(null) }}
                                      className={`w-full flex items-center gap-2 px-3 py-2 text-sm transition ${
                                        m.status === 'suspended'
                                          ? 'text-emerald-700 hover:bg-emerald-50'
                                          : 'text-amber-700 hover:bg-amber-50'
                                      }`}
                                    >
                                      {m.status === 'suspended' ? (
                                        <>
                                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 10.5V6.75a4.5 4.5 0 119 0v3.75M3.75 21.75h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H3.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                                          </svg>
                                          Desbloquear
                                        </>
                                      ) : (
                                        <>
                                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                                          </svg>
                                          Bloquear
                                        </>
                                      )}
                                    </button>
                                  )}
                                  {!isSelf && (
                                    <>
                                      <div className="border-t border-gray-100 my-1" />
                                      <button
                                        type="button"
                                        onClick={() => { setDeleteMember(m); setOpenMenuId(null); setMenuPos(null) }}
                                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition"
                                      >
                                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                          <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                                        </svg>
                                        Remover
                                      </button>
                                    </>
                                  )}
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Mobile cards */}
            <div className="sm:hidden space-y-3">
              {filteredMembers.map((m) => {
                const initials = (m.displayName || '')
                  .split(/\s+/)
                  .slice(0, 2)
                  .map((w) => w[0]?.toUpperCase() ?? '')
                  .join('')
                const isSelf = m.userId === userUid

                return (
                  <div key={m.id} className={`${ui.card} p-4 space-y-3`}>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3 min-w-0">
                        {m.photoUrl ? (
                          <img
                            src={m.photoUrl}
                            alt={m.displayName}
                            className="h-10 w-10 rounded-full object-cover ring-1 ring-gray-200"
                          />
                        ) : (
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-100 text-xs font-semibold text-primary-700 ring-1 ring-primary-200 shrink-0">
                            {initials || '?'}
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="font-medium text-gray-900 truncate flex items-center gap-1.5">
                            {m.displayName}
                            {m.status === 'suspended' && (
                              <svg className="h-4 w-4 text-red-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-label="Bloqueado">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                              </svg>
                            )}
                            {isSelf && (
                              <span className="ml-0.5 text-xs text-gray-400">(voce)</span>
                            )}
                          </p>
                          <p className="text-xs text-gray-500 truncate">{m.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {m.role ? (
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${ROLE_BADGE[m.role as AdminRole] || 'bg-gray-100 text-gray-800'}`}>
                            {ROLE_LABELS[m.role as AdminRole] || m.role}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">&mdash;</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 font-medium ${STATUS_BADGE[m.status] || 'bg-gray-100 text-gray-800'}`}>
                          {STATUS_LABELS[m.status] || m.status}
                        </span>
                        <span className="text-gray-400">{formatJoinedDate(m.joinedAt)}</span>
                      </div>
                      <div className="relative" ref={openMenuId === `mobile-${m.id}` ? menuRef : undefined}>
                        <button
                          type="button"
                          onClick={(e) => {
                            if (openMenuId === `mobile-${m.id}`) {
                              setOpenMenuId(null)
                              setMenuPos(null)
                            } else {
                              const rect = e.currentTarget.getBoundingClientRect()
                              setMenuPos({ top: rect.bottom + 4, left: rect.right })
                              setOpenMenuId(`mobile-${m.id}`)
                            }
                          }}
                          className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 transition"
                        >
                          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 12.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 18.75a.75.75 0 110-1.5.75.75 0 010 1.5z" />
                          </svg>
                        </button>
                        {openMenuId === `mobile-${m.id}` && menuPos && (
                          <div
                            ref={dropdownRef}
                            className="fixed w-44 bg-white rounded-xl shadow-lg border border-gray-200 py-1 z-[9999] animate-scale-in"
                            style={{ top: menuPos.top, left: menuPos.left - 176 }}
                          >
                            <button
                              type="button"
                              onClick={() => guard(() => { openEditModal(m); setOpenMenuId(null) })}
                              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition"
                            >
                              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
                              </svg>
                              Editar
                            </button>
                            {!isSelf && (
                              <button
                                type="button"
                                onClick={() => { setBlockMember(m); setOpenMenuId(null) }}
                                className={`w-full flex items-center gap-2 px-3 py-2 text-sm transition ${
                                  m.status === 'suspended'
                                    ? 'text-emerald-700 hover:bg-emerald-50'
                                    : 'text-amber-700 hover:bg-amber-50'
                                }`}
                              >
                                {m.status === 'suspended' ? (
                                  <>
                                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 10.5V6.75a4.5 4.5 0 119 0v3.75M3.75 21.75h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H3.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                                    </svg>
                                    Desbloquear
                                  </>
                                ) : (
                                  <>
                                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                                    </svg>
                                    Bloquear
                                  </>
                                )}
                              </button>
                            )}
                            {!isSelf && (
                              <>
                                <div className="border-t border-gray-100 my-1" />
                                <button
                                  type="button"
                                  onClick={() => { setDeleteMember(m); setOpenMenuId(null) }}
                                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition"
                                >
                                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                                  </svg>
                                  Remover
                                </button>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}

        {/* =================== Add Member Modal =================== */}
        {showAddModal && (
          <Modal isOpen onClose={requestCloseAddModal} size="md" centered>
            <div className="space-y-5">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Adicionar parceiro</h3>
                <p className="text-sm text-gray-500 mt-0.5">
                  Busque um usuario pelo email para convida-lo como parceiro. Ele recebera uma notificacao para aceitar o convite.
                </p>
              </div>

              <div className="space-y-4">
                {/* Email search field */}
                <div>
                  <label htmlFor="add-email" className={ui.label}>
                    Email do usuario
                  </label>
                  <div className="flex gap-2">
                    <input
                      id="add-email"
                      type="email"
                      value={addForm.email}
                      onChange={(e) => {
                        setAddForm((f) => ({ ...f, email: e.target.value }))
                        // Reset search when email changes
                        if (searchResult || searchError) {
                          setSearchResult(null)
                          setSearchError(null)
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          handleSearchEmail()
                        }
                      }}
                      placeholder="email@empresa.com"
                      className={ui.input}
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={handleSearchEmail}
                      disabled={searchLoading || !addForm.email.trim()}
                      className={`${ui.btnPrimary} shrink-0 ${searchLoading || !addForm.email.trim() ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      {searchLoading ? (
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                      ) : (
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>

                {/* Search error */}
                {searchError && (
                  <div className="flex items-center gap-2 rounded-xl bg-red-50 border border-red-200 px-3 py-2.5">
                    <svg className="h-4 w-4 text-red-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                    </svg>
                    <p className="text-sm text-red-700">{searchError}</p>
                  </div>
                )}

                {/* Search result: user found */}
                {searchResult?.found && searchResult.user && (
                  <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4 space-y-3">
                    <div className="flex items-center gap-3">
                      {searchResult.user.photoUrl ? (
                        <img
                          src={searchResult.user.photoUrl}
                          alt={searchResult.user.displayName}
                          className="h-10 w-10 rounded-full object-cover ring-1 ring-emerald-200"
                        />
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-sm font-semibold text-emerald-700 ring-1 ring-emerald-200">
                          {(searchResult.user.displayName || '?').charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="font-medium text-gray-900 truncate">{searchResult.user.displayName}</p>
                        <p className="text-xs text-gray-500">{searchResult.user.email}</p>
                      </div>
                      <svg className="h-5 w-5 text-emerald-500 shrink-0 ml-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <p className="text-xs text-emerald-700">Usuario encontrado! Selecione o cargo e envie o convite.</p>
                  </div>
                )}

                {/* Search result: user not found — show pre-registration form */}
                {searchResult && !searchResult.found && (
                  <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 space-y-4">
                    <div className="flex items-center gap-2">
                      <svg className="h-5 w-5 text-amber-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M18 7.5v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                      </svg>
                      <p className="text-sm font-medium text-amber-800">Usuario nao cadastrado</p>
                    </div>
                    <p className="text-xs text-amber-700">
                      Nenhum usuario cadastrado com este email. Preencha os dados abaixo para criar a conta e enviar o convite por email.
                    </p>

                    {/* Display name */}
                    <div>
                      <label htmlFor="add-displayName" className={ui.label}>
                        Nome do usuario
                      </label>
                      <input
                        id="add-displayName"
                        type="text"
                        value={addForm.displayName}
                        onChange={(e) => setAddForm((f) => ({ ...f, displayName: e.target.value }))}
                        placeholder="Nome completo"
                        className={ui.input}
                      />
                    </div>

                    {/* Password */}
                    <div>
                      <label htmlFor="add-password" className={ui.label}>
                        Senha
                      </label>
                      <input
                        id="add-password"
                        type="password"
                        value={addForm.password}
                        onChange={(e) => setAddForm((f) => ({ ...f, password: e.target.value }))}
                        placeholder="Minimo 6 caracteres"
                        className={ui.input}
                      />
                    </div>

                    {/* Confirm password */}
                    <div>
                      <label htmlFor="add-confirmPassword" className={ui.label}>
                        Confirmar senha
                      </label>
                      <input
                        id="add-confirmPassword"
                        type="password"
                        value={addForm.confirmPassword}
                        onChange={(e) => setAddForm((f) => ({ ...f, confirmPassword: e.target.value }))}
                        placeholder="Repita a senha"
                        className={ui.input}
                      />
                      {addForm.password && addForm.confirmPassword && addForm.password !== addForm.confirmPassword && (
                        <p className="text-xs text-red-500 mt-1">As senhas nao coincidem</p>
                      )}
                    </div>
                  </div>
                )}

                {/* Role selector — always visible */}
                <div>
                  <label htmlFor="add-role" className={ui.label}>
                    Cargo
                  </label>
                  <select
                    id="add-role"
                    value={addForm.role}
                    onChange={(e) => setAddForm((f) => ({ ...f, role: e.target.value as RolePreset }))}
                    className={ui.select}
                  >
                    {ADMIN_ROLES.map((role) => (
                      <option key={role} value={role}>
                        {ROLE_LABELS[role]}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-400 mt-1">
                    As permissoes serao preenchidas com base no cargo selecionado e limitadas pelo seu plano atual.
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
                <button type="button" onClick={requestCloseAddModal} className={ui.btn}>
                  Cancelar
                </button>
                {((searchResult?.found && !searchError) || (searchResult && !searchResult.found && !searchError)) && (
                  <button
                    type="button"
                    onClick={handleAdd}
                    disabled={addLoading}
                    className={`${ui.btnPrimary} ${addLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    {addLoading ? (
                      <>
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                        Enviando...
                      </>
                    ) : searchResult?.found ? (
                      'Enviar convite'
                    ) : (
                      'Criar conta e enviar convite'
                    )}
                  </button>
                )}
              </div>
            </div>
          </Modal>
        )}

        {/* =================== Edit Permissions Modal =================== */}
        {editMember && (
          <Modal isOpen onClose={requestCloseEditModal} size="xl" centered>
            <div className="space-y-5">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  Editar usuario - {editMember.displayName}
                </h3>
                <p className="text-sm text-gray-500 mt-0.5">{editMember.email}</p>
              </div>

              {/* Display name */}
              <div>
                <label htmlFor="edit-displayName" className={ui.label}>
                  Nome
                </label>
                <input
                  id="edit-displayName"
                  type="text"
                  value={editDisplayName}
                  onChange={(e) => setEditDisplayName(e.target.value)}
                  placeholder="Nome do usuario"
                  className={ui.input}
                />
              </div>

              {/* Role selector */}
              <div>
                <label htmlFor="edit-role" className={ui.label}>
                  Cargo
                </label>
                <select
                  id="edit-role"
                  value={editRole}
                  onChange={(e) => handleRoleChange(e.target.value as RolePreset)}
                  className={ui.select}
                >
                  {ADMIN_ROLES.map((role) => (
                    <option key={role} value={role}>
                      {ROLE_LABELS[role]}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-400 mt-1">
                  Alterar o cargo redefine as permissoes para o padrao. Voce pode personalizar abaixo.
                </p>
              </div>

              {/* View scope */}
              <div>
                <span className={ui.label}>Escopo de visualizacao</span>
                <div className="flex items-center gap-4 mt-1.5">
                  {(['own', 'team', 'all'] as const).map((scope) => {
                    const scopeLabels = { own: 'Proprio', team: 'Equipe', all: 'Todos' }
                    return (
                      <label key={scope} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="viewScope"
                          value={scope}
                          checked={editPermissions.viewScope === scope}
                          onChange={() =>
                            setEditPermissions((prev) => ({ ...prev, viewScope: scope }))
                          }
                          className="h-4 w-4 text-primary-600 border-gray-300 focus:ring-primary-500"
                        />
                        <span className="text-sm text-gray-700">{scopeLabels[scope]}</span>
                      </label>
                    )
                  })}
                </div>
              </div>

              {/* Pages checklist — only plan-allowed pages */}
              <div>
                <span className={ui.label}>Paginas permitidas</span>
                <p className="text-xs text-gray-400 mb-1">
                  Apenas paginas disponiveis no seu plano sao exibidas.
                </p>
                <div className="mt-1.5 grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto rounded-xl border border-gray-200 p-3 bg-slate-50/50">
                  {planAllowedPages.map((page) => (
                    <label
                      key={page.path}
                      className="flex items-center gap-2 cursor-pointer py-0.5"
                    >
                      <input
                        type="checkbox"
                        checked={editPermissions.pages.includes(page.path)}
                        onChange={() => togglePage(page.path)}
                        className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                      />
                      <span className="text-sm text-gray-700">{page.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Actions checklist */}
              <div>
                <span className={ui.label}>Acoes permitidas</span>
                <div className="mt-1.5 grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto rounded-xl border border-gray-200 p-3 bg-slate-50/50">
                  {ALL_ACTIONS.map((action) => (
                    <label
                      key={action.key}
                      className="flex items-center gap-2 cursor-pointer py-0.5"
                    >
                      <input
                        type="checkbox"
                        checked={editPermissions.actions[action.key]}
                        onChange={() => toggleAction(action.key)}
                        className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                      />
                      <span className="text-sm text-gray-700">{action.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
                <button type="button" onClick={requestCloseEditModal} className={ui.btn}>
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSaveEdit}
                  disabled={editLoading}
                  className={`${ui.btnPrimary} ${editLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {editLoading ? (
                    <>
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                      Salvando...
                    </>
                  ) : (
                    'Salvar alteracoes'
                  )}
                </button>
              </div>
            </div>
          </Modal>
        )}

        {/* =================== Block Confirmation Modal =================== */}
        {blockMember && (
          <Modal isOpen onClose={() => setBlockMember(null)} size="sm" centered>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className={`flex h-10 w-10 items-center justify-center rounded-full shrink-0 ${
                  blockMember.status === 'suspended' ? 'bg-emerald-100' : 'bg-amber-100'
                }`}>
                  {blockMember.status === 'suspended' ? (
                    <svg className="h-5 w-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 10.5V6.75a4.5 4.5 0 119 0v3.75M3.75 21.75h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H3.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                    </svg>
                  ) : (
                    <svg className="h-5 w-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                    </svg>
                  )}
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    {blockMember.status === 'suspended' ? 'Desbloquear' : 'Bloquear'} usuario
                  </h3>
                  <p className="text-sm text-gray-500 mt-1">
                    {blockMember.status === 'suspended' ? (
                      <>
                        Deseja desbloquear{' '}
                        <span className="font-medium text-gray-700">{blockMember.displayName}</span>{' '}
                        ({blockMember.email})? O usuario podera acessar o sistema novamente.
                      </>
                    ) : (
                      <>
                        Deseja bloquear{' '}
                        <span className="font-medium text-gray-700">{blockMember.displayName}</span>{' '}
                        ({blockMember.email})? O usuario nao podera fazer login enquanto estiver bloqueado.
                      </>
                    )}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
                <button type="button" onClick={() => setBlockMember(null)} className={ui.btn}>
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleBlock}
                  disabled={blockLoading}
                  className={`${blockMember.status === 'suspended' ? ui.btnPrimary : 'inline-flex items-center justify-center gap-2 rounded-xl px-3.5 py-2 text-sm font-semibold text-white bg-amber-600 hover:bg-amber-700 shadow-sm transition active:scale-[0.99]'} ${blockLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {blockLoading ? (
                    <>
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                      {blockMember.status === 'suspended' ? 'Desbloqueando...' : 'Bloqueando...'}
                    </>
                  ) : (
                    blockMember.status === 'suspended' ? 'Desbloquear' : 'Bloquear'
                  )}
                </button>
              </div>
            </div>
          </Modal>
        )}

        {/* =================== Delete Confirmation Modal =================== */}
        {deleteMember && (
          <Modal isOpen onClose={() => setDeleteMember(null)} size="sm" centered>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 shrink-0">
                  <svg className="h-5 w-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Remover parceiro</h3>
                  <p className="text-sm text-gray-500 mt-1">
                    Tem certeza que deseja remover{' '}
                    <span className="font-medium text-gray-700">{deleteMember.displayName}</span>{' '}
                    ({deleteMember.email}) dos seus parceiros? Esta acao nao pode ser desfeita.
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
                <button type="button" onClick={() => setDeleteMember(null)} className={ui.btn}>
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleteLoading}
                  className={`${ui.btnDanger} ${deleteLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {deleteLoading ? (
                    <>
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                      Removendo...
                    </>
                  ) : (
                    'Remover parceiro'
                  )}
                </button>
              </div>
            </div>
          </Modal>
        )}
        {/* =================== Unsaved Changes Dialogs =================== */}
        <ConfirmCloseDialog
          isOpen={showAddConfirm}
          onConfirm={closeAddModal}
          onCancel={() => setShowAddConfirm(false)}
        />
        <ConfirmCloseDialog
          isOpen={showEditConfirm}
          onConfirm={closeEditModal}
          onCancel={() => setShowEditConfirm(false)}
        />

        {/* Free Plan Guard Dialog */}
        <FreePlanDialog isOpen={showFreePlanDialog} onClose={closeFreePlanDialog} />
      </div>
    </PermissionGate>
  )
}
