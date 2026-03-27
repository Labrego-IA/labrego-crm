'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useCrmUser } from '@/contexts/CrmUserContext'
import { useAllowedMemberIds } from '@/hooks/useAllowedMemberIds'
import { db } from '@/lib/firebaseClient'
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore'
import PlanGate from '@/components/PlanGate'
import { formatDate, formatDateTimeAt } from '@/lib/format'
import { toast } from 'sonner'
import {
  type Campaign,
  type CampaignStatus,
  type CampaignType,
  CAMPAIGN_STATUS_LABELS,
  CAMPAIGN_STATUS_COLORS,
  CAMPAIGN_TYPE_LABELS,
} from '@/types/campaign'
import {
  PlusIcon,
  MagnifyingGlassIcon,
  EnvelopeIcon,
  ExclamationTriangleIcon,
  ClockIcon,
  ChartBarIcon,
  FunnelIcon,
  PencilSquareIcon,
  TrashIcon,
} from '@heroicons/react/24/outline'
import Skeleton from '@/components/shared/Skeleton'
import EmptyState from '@/components/shared/EmptyState'

/* ================================= Constants ================================= */

const PAGE_SIZE = 20

const STATUS_OPTIONS: { value: CampaignStatus | ''; label: string }[] = [
  { value: '', label: 'Todos os status' },
  { value: 'draft', label: 'Rascunho' },
  { value: 'scheduled', label: 'Agendada' },
  { value: 'sending', label: 'Enviando' },
  { value: 'completed', label: 'Concluída' },
  { value: 'partial_failure', label: 'Falha parcial' },
  { value: 'cancelled', label: 'Cancelada' },
]

const TYPE_OPTIONS: { value: CampaignType | ''; label: string }[] = [
  { value: '', label: 'Todos os tipos' },
  { value: 'immediate', label: 'Imediata' },
  { value: 'scheduled', label: 'Agendada' },
  { value: 'recurring', label: 'Recorrente' },
]

/* -------------------------------- Helpers -------------------------------- */

function normalize(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

type SortColumn = 'name' | 'status' | 'type' | 'totalRecipients' | 'sentCount' | 'failedCount' | 'createdAt' | 'lastSentAt'
type SortDirection = 'asc' | 'desc'

const CAMPAIGN_STATUS_ORDER: Record<string, number> = {
  draft: 0,
  scheduled: 1,
  sending: 2,
  completed: 3,
  partial_failure: 4,
  cancelled: 5,
}

const CAMPAIGN_TYPE_ORDER: Record<string, number> = {
  immediate: 0,
  scheduled: 1,
  recurring: 2,
}

/* ================================= Component ================================= */

function CampanhasContent() {
  const router = useRouter()
  const { orgId } = useCrmUser()
  const { allowedUserIds, loading: allowedLoading, hasFullAccess } = useAllowedMemberIds()

  /* ----------------------------- State ---------------------------------- */

  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)

  // Filters
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<CampaignStatus | ''>('')
  const [typeFilter, setTypeFilter] = useState<CampaignType | ''>('')

  // Sort
  const [sortColumn, setSortColumn] = useState<SortColumn | null>(null)
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')

  // Pagination
  const [currentPage, setCurrentPage] = useState(1)

  // Delete confirmation
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)

  // When orgId is not available, stop loading immediately
  useEffect(() => {
    if (!orgId) {
      setLoading(false)
    }
  }, [orgId])

  /* ---------------------- Real-time subscription ------------------------ */

  useEffect(() => {
    if (!orgId) return
    const q = query(
      collection(db, 'organizations', orgId, 'campaigns'),
      orderBy('createdAt', 'desc')
    )
    const unsub = onSnapshot(
      q,
      (snap) => {
        const items: Campaign[] = snap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        })) as Campaign[]
        setCampaigns(items)
        setLoading(false)
      },
      (error) => {
        console.error('Error loading campaigns:', error)
        toast.error('Erro ao carregar campanhas')
        setLoading(false)
      },
    )
    return () => unsub()
  }, [orgId])

  /* ---------------------- Sort handler --------------------------------- */

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

  /* ----------------------------- Handlers -------------------------------- */

  const handleDelete = useCallback(async (campaignId: string) => {
    if (!orgId) return
    setDeletingId(campaignId)
    try {
      const res = await fetch(`/api/campaigns/${campaignId}?orgId=${encodeURIComponent(orgId)}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Erro ao excluir')
      }
      toast.success('Campanha excluída com sucesso')
    } catch (error) {
      console.error('Error deleting campaign:', error)
      toast.error(error instanceof Error ? error.message : 'Erro ao excluir campanha')
    }
    setDeletingId(null)
    setDeleteConfirmId(null)
  }, [orgId])

  /* ----------------------------- Derived -------------------------------- */

  // Campanhas visíveis ao usuário (filtragem por acesso — respeita visão pessoal/parceiro)
  const accessFiltered = useMemo(() => {
    if (hasFullAccess || allowedLoading) return campaigns
    if (!allowedUserIds) return campaigns
    return campaigns.filter(
      (c) => allowedUserIds.has(c.createdBy),
    )
  }, [campaigns, hasFullAccess, allowedLoading, allowedUserIds])

  const filtered = useMemo(() => {
    let result = accessFiltered

    if (searchQuery) {
      const q = normalize(searchQuery.trim())
      result = result.filter((c) => {
        const name = normalize(c.name || '')
        const subject = normalize(c.subject || '')
        const status = normalize(CAMPAIGN_STATUS_LABELS[c.status] || '')
        const type = normalize(CAMPAIGN_TYPE_LABELS[c.type] || '')
        return name.includes(q) || subject.includes(q) || status.includes(q) || type.includes(q)
      })
    }

    if (statusFilter) {
      result = result.filter((c) => c.status === statusFilter)
    }

    if (typeFilter) {
      result = result.filter((c) => c.type === typeFilter)
    }

    if (sortColumn) {
      result = [...result].sort((a, b) => {
        let cmp = 0
        switch (sortColumn) {
          case 'name':
            cmp = normalize(a.name || '').localeCompare(normalize(b.name || ''))
            break
          case 'status':
            cmp = (CAMPAIGN_STATUS_ORDER[a.status] ?? 99) - (CAMPAIGN_STATUS_ORDER[b.status] ?? 99)
            break
          case 'type':
            cmp = (CAMPAIGN_TYPE_ORDER[a.type] ?? 99) - (CAMPAIGN_TYPE_ORDER[b.type] ?? 99)
            break
          case 'totalRecipients':
            cmp = a.totalRecipients - b.totalRecipients
            break
          case 'sentCount':
            cmp = a.sentCount - b.sentCount
            break
          case 'failedCount':
            cmp = a.failedCount - b.failedCount
            break
          case 'createdAt':
            cmp = (a.createdAt || '').localeCompare(b.createdAt || '')
            break
          case 'lastSentAt':
            cmp = (a.lastSentAt || a.scheduledAt || '').localeCompare(b.lastSentAt || b.scheduledAt || '')
            break
        }
        return sortDirection === 'asc' ? cmp : -cmp
      })
    }

    return result
  }, [accessFiltered, searchQuery, statusFilter, typeFilter, sortColumn, sortDirection])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paginated = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  // Dashboard KPIs (baseados nas campanhas visíveis ao usuário)
  const dashboardStats = useMemo(() => {
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

    const thisMonth = accessFiltered.filter((c) => c.createdAt >= startOfMonth)
    const totalCampaignsMonth = thisMonth.length
    const totalSentMonth = thisMonth.reduce((sum, c) => sum + c.sentCount, 0)

    const totalSent = accessFiltered.reduce((sum, c) => sum + c.sentCount, 0)
    const totalFailed = accessFiltered.reduce((sum, c) => sum + c.failedCount, 0)
    const failureRate = totalSent + totalFailed > 0 ? (totalFailed / (totalSent + totalFailed)) * 100 : 0

    const scheduled = accessFiltered
      .filter((c) => c.status === 'scheduled' && c.scheduledAt)
      .sort((a, b) => (a.scheduledAt || '').localeCompare(b.scheduledAt || ''))
    const nextScheduled = scheduled[0]?.scheduledAt || null

    return { totalCampaignsMonth, totalSentMonth, failureRate, nextScheduled }
  }, [accessFiltered])

  // Reset page when filters or sort change
  useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery, statusFilter, typeFilter, sortColumn, sortDirection])

  /* ================================= Render ================================= */

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Campanhas</h1>
          <p className="text-sm text-slate-500 mt-1">Gerencie suas campanhas de email marketing</p>
        </div>
        <button
          onClick={() => router.push('/campanhas/nova')}
          className="hidden md:flex items-center gap-2 rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-primary-700 transition-colors"
        >
          <PlusIcon className="h-4 w-4" />
          Nova Campanha
        </button>
      </div>

      {/* Mobile: FAB flutuante */}
      <button
        onClick={() => router.push('/campanhas/nova')}
        className="md:hidden fixed bottom-6 right-6 z-40 flex items-center justify-center w-14 h-14 rounded-full bg-primary-600 text-white shadow-lg shadow-primary-600/30 hover:bg-primary-700 active:scale-95 transition-all"
        aria-label="Nova campanha"
      >
        <PlusIcon className="h-6 w-6" />
      </button>

      {/* Dashboard KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl bg-white border border-slate-200 p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary-50 p-2">
              <EnvelopeIcon className="h-5 w-5 text-primary-600" />
            </div>
            <div>
              <p className="text-xs text-slate-500">Campanhas este mês</p>
              <p className="text-xl font-bold text-slate-900">{dashboardStats.totalCampaignsMonth}</p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl bg-white border border-slate-200 p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-emerald-50 p-2">
              <ChartBarIcon className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-xs text-slate-500">Emails enviados (mês)</p>
              <p className="text-xl font-bold text-slate-900">{dashboardStats.totalSentMonth}</p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl bg-white border border-slate-200 p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-red-50 p-2">
              <ExclamationTriangleIcon className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <p className="text-xs text-slate-500">Taxa de falha</p>
              <p className="text-xl font-bold text-slate-900">{dashboardStats.failureRate.toFixed(1)}%</p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl bg-white border border-slate-200 p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-blue-50 p-2">
              <ClockIcon className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-slate-500">Próximo envio</p>
              <p className="text-sm font-semibold text-slate-900">
                {dashboardStats.nextScheduled ? formatDateTimeAt(dashboardStats.nextScheduled) : '—'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar campanha..."
            className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-10 pr-4 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as CampaignStatus | '')}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none"
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>

        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as CampaignType | '')}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none"
        >
          {TYPE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      {loading ? (
        <Skeleton variant="table-row" count={6} className="py-4" />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<FunnelIcon className="w-10 h-10" />}
          title="Nenhuma campanha encontrada"
          description={accessFiltered.length === 0 ? 'Crie sua primeira campanha para começar' : 'Tente ajustar os filtros'}
          action={accessFiltered.length === 0 ? { label: 'Nova Campanha', onClick: () => router.push('/campanhas/nova') } : undefined}
        />
      ) : (
        <>
          {/* Desktop Table */}
          <div className="hidden md:block overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  {([
                    { key: 'name' as SortColumn, label: 'Nome', align: 'left' },
                    { key: 'status' as SortColumn, label: 'Status', align: 'left' },
                    { key: 'type' as SortColumn, label: 'Tipo', align: 'left' },
                    { key: 'totalRecipients' as SortColumn, label: 'Destinatários', align: 'right' },
                    { key: 'sentCount' as SortColumn, label: 'Enviados', align: 'right' },
                    { key: 'failedCount' as SortColumn, label: 'Falhos', align: 'right' },
                    { key: 'createdAt' as SortColumn, label: 'Criado em', align: 'left' },
                    { key: 'lastSentAt' as SortColumn, label: 'Envio', align: 'left' },
                  ] as { key: SortColumn; label: string; align: string }[]).map((col) => (
                    <th
                      key={col.key}
                      className={`px-4 py-3 text-${col.align} text-xs font-semibold text-slate-500 uppercase tracking-wider`}
                    >
                      <button
                        type="button"
                        onClick={() => handleSort(col.key)}
                        className={`inline-flex items-center gap-1 hover:text-slate-900 transition ${
                          col.align === 'right' ? 'ml-auto' : col.align === 'center' ? 'mx-auto' : ''
                        }`}
                      >
                        {col.label}
                        <svg
                          className={`h-3.5 w-3.5 transition-colors ${
                            sortColumn === col.key ? 'text-primary-600' : 'text-slate-300'
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
                  <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginated.map((c) => (
                  <tr
                    key={c.id}
                    onClick={() => router.push(`/campanhas/${c.id}`)}
                    className="cursor-pointer hover:bg-slate-50 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-slate-900 truncate max-w-[250px]">{c.name}</p>
                      <p className="text-xs text-slate-500 truncate max-w-[250px]">{c.subject}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${CAMPAIGN_STATUS_COLORS[c.status]}`}>
                        {CAMPAIGN_STATUS_LABELS[c.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">{CAMPAIGN_TYPE_LABELS[c.type]}</td>
                    <td className="px-4 py-3 text-sm text-slate-600 text-right">{c.totalRecipients}</td>
                    <td className="px-4 py-3 text-sm text-emerald-600 text-right font-medium">{c.sentCount}</td>
                    <td className="px-4 py-3 text-sm text-red-600 text-right font-medium">{c.failedCount}</td>
                    <td className="px-4 py-3 text-sm text-slate-500">{formatDate(c.createdAt)}</td>
                    <td className="px-4 py-3 text-sm text-slate-500">
                      {c.lastSentAt ? formatDate(c.lastSentAt) : c.scheduledAt ? formatDateTimeAt(c.scheduledAt) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1" onClick={(e) => e.stopPropagation()}>
                        {['draft', 'scheduled'].includes(c.status) && (
                          <button
                            onClick={() => router.push(`/campanhas/${c.id}/editar`)}
                            className="rounded-lg p-1.5 text-slate-400 hover:text-primary-600 hover:bg-primary-50 transition-colors"
                            title="Editar campanha"
                          >
                            <PencilSquareIcon className="h-4 w-4" />
                          </button>
                        )}
                        {c.status !== 'sending' && (
                          <>
                            {deleteConfirmId === c.id ? (
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => handleDelete(c.id)}
                                  disabled={deletingId === c.id}
                                  className="rounded-lg px-2 py-1 text-xs font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 transition-colors"
                                >
                                  {deletingId === c.id ? '...' : 'Confirmar'}
                                </button>
                                <button
                                  onClick={() => setDeleteConfirmId(null)}
                                  className="rounded-lg px-2 py-1 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
                                >
                                  Cancelar
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setDeleteConfirmId(c.id)}
                                className="rounded-lg p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                                title="Excluir campanha"
                              >
                                <TrashIcon className="h-4 w-4" />
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden space-y-3">
            {paginated.map((c) => (
              <div
                key={c.id}
                onClick={() => router.push(`/campanhas/${c.id}`)}
                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm cursor-pointer hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">{c.name}</p>
                    <p className="text-xs text-slate-500 truncate">{c.subject}</p>
                  </div>
                  <span className={`ml-2 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ${CAMPAIGN_STATUS_COLORS[c.status]}`}>
                    {CAMPAIGN_STATUS_LABELS[c.status]}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-xs text-slate-500">
                  <span>{CAMPAIGN_TYPE_LABELS[c.type]}</span>
                  <span>{c.totalRecipients} destinatários</span>
                  <span className="text-emerald-600">{c.sentCount} enviados</span>
                  {c.failedCount > 0 && <span className="text-red-600">{c.failedCount} falhos</span>}
                </div>
                <div className="flex items-center justify-between mt-2">
                  <p className="text-xs text-slate-400">{formatDate(c.createdAt)}</p>
                  <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    {['draft', 'scheduled'].includes(c.status) && (
                      <button
                        onClick={() => router.push(`/campanhas/${c.id}/editar`)}
                        className="rounded-lg p-1.5 text-slate-400 hover:text-primary-600 hover:bg-primary-50 transition-colors"
                        title="Editar"
                      >
                        <PencilSquareIcon className="h-4 w-4" />
                      </button>
                    )}
                    {c.status !== 'sending' && (
                      <>
                        {deleteConfirmId === c.id ? (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleDelete(c.id)}
                              disabled={deletingId === c.id}
                              className="rounded-lg px-2 py-1 text-xs font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 transition-colors"
                            >
                              {deletingId === c.id ? '...' : 'Sim'}
                            </button>
                            <button
                              onClick={() => setDeleteConfirmId(null)}
                              className="rounded-lg px-2 py-1 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
                            >
                              Não
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setDeleteConfirmId(c.id)}
                            className="rounded-lg p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                            title="Excluir"
                          >
                            <TrashIcon className="h-4 w-4" />
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-1">
              <p className="text-sm text-slate-500">
                {filtered.length} campanha{filtered.length !== 1 ? 's' : ''}
              </p>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Anterior
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter((p) => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                  .map((p, idx, arr) => (
                    <span key={p}>
                      {idx > 0 && arr[idx - 1] !== p - 1 && (
                        <span className="px-1 text-slate-400">...</span>
                      )}
                      <button
                        onClick={() => setCurrentPage(p)}
                        className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                          p === currentPage
                            ? 'bg-primary-600 text-white'
                            : 'text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        {p}
                      </button>
                    </span>
                  ))}
                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Próxima
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

/* ================================= Page Export ================================= */

export default function CampanhasPage() {
  return (
    <PlanGate feature="email_automation">
      <CampanhasContent />
    </PlanGate>
  )
}
