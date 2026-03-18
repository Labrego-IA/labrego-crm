'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { collection, query, where, onSnapshot, doc, updateDoc, writeBatch } from 'firebase/firestore'
import { db } from '@/lib/firebaseClient'
import { useCrmUser } from '@/contexts/CrmUserContext'
import { usePermissions } from '@/hooks/usePermissions'
import { toast } from 'sonner'
import {
  CheckIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  ShieldCheckIcon,
} from '@heroicons/react/24/outline'

/* -------------------------------- Helpers -------------------------------- */

function normalize(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  manager: 'Gerente',
  seller: 'Vendedor',
  viewer: 'Visualizador',
}

const ROLE_ORDER: Record<string, number> = { admin: 0, manager: 1, seller: 2, viewer: 3 }

type SortColumn = 'name' | 'role' | 'summary'
type SortDirection = 'asc' | 'desc'

/* -------------------------------- Types --------------------------------- */

type MemberRow = {
  id: string
  displayName: string
  email: string
  role: string
  funnelAccess?: FunnelAccessEntry[]
}

type FunnelAccessEntry = {
  funnelId: string
  allStages: boolean
  stageIds?: string[]
}

type FunnelItem = {
  id: string
  name: string
  color: string
  isDefault: boolean
  visibleTo: string[]
}

type StageItem = {
  id: string
  name: string
  order: number
  funnelId: string
}

export default function AdminFunisPage() {
  const { orgId } = useCrmUser()
  const { can } = usePermissions()

  const [members, setMembers] = useState<MemberRow[]>([])
  const [funnels, setFunnels] = useState<FunnelItem[]>([])
  const [stages, setStages] = useState<StageItem[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Search & sort
  const [search, setSearch] = useState('')
  const [sortColumn, setSortColumn] = useState<SortColumn | null>(null)
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')

  // Editable state: memberId -> funnelId -> { enabled, allStages, stageIds }
  const [accessMap, setAccessMap] = useState<Record<string, Record<string, { enabled: boolean; allStages: boolean; stageIds: string[] }>>>({})
  const [expandedRows, setExpandedRows] = useState<Record<string, string | null>>({}) // memberId -> expanded funnelId

  // Load data
  useEffect(() => {
    if (!orgId) return
    const unsubs: (() => void)[] = []

    unsubs.push(
      onSnapshot(query(collection(db, 'organizations', orgId, 'members'), where('status', '==', 'active')), (snap) => {
        const data = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as MemberRow[]
        setMembers(data.sort((a, b) => a.displayName.localeCompare(b.displayName)))
      }, (error) => {
        console.warn('[FunisPage] Firestore error:', error.message)
      })
    )

    unsubs.push(
      onSnapshot(query(collection(db, 'organizations', orgId, 'funnels')), (snap) => {
        const data = snap.docs.map((d) => {
          const raw = d.data()
          return {
            id: d.id,
            name: raw.name || '',
            color: raw.color || '#4f46e5',
            isDefault: raw.isDefault || false,
            visibleTo: Array.isArray(raw.visibleTo) ? raw.visibleTo : [],
          }
        })
        setFunnels(data.sort((a, b) => (a.isDefault ? -1 : b.isDefault ? 1 : a.name.localeCompare(b.name))))
      }, (error) => {
        console.warn('[FunisPage] Firestore error:', error.message)
      })
    )

    unsubs.push(
      onSnapshot(query(collection(db, 'funnelStages'), where('orgId', '==', orgId)), (snap) => {
        const data = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as StageItem[]
        setStages(data.sort((a, b) => a.order - b.order))
        setLoading(false)
      }, (error) => {
        console.warn('[FunisPage] Firestore error:', error.message)
      })
    )

    return () => unsubs.forEach((u) => u())
  }, [orgId])

  // Initialize access map from members' funnelAccess + funnels' visibleTo
  useEffect(() => {
    const map: typeof accessMap = {}
    for (const member of members) {
      map[member.id] = {}
      for (const funnel of funnels) {
        const hasAccess = funnel.visibleTo.length === 0 || funnel.visibleTo.includes(member.id)
        const config = member.funnelAccess?.find((fa) => fa.funnelId === funnel.id)
        map[member.id][funnel.id] = {
          enabled: hasAccess,
          allStages: config?.allStages ?? true,
          stageIds: config?.stageIds ?? [],
        }
      }
    }
    setAccessMap(map)
  }, [members, funnels])

  const stagesByFunnel = useMemo(() => {
    const grouped: Record<string, StageItem[]> = {}
    for (const funnel of funnels) {
      grouped[funnel.id] = stages.filter((s) => s.funnelId === funnel.id)
    }
    return grouped
  }, [funnels, stages])

  /* ---------------------- Search & Sort -------------------------------- */

  const handleSort = useCallback((column: SortColumn) => {
    setSortColumn((prev) => {
      if (prev === column) {
        if (sortDirection === 'asc') {
          setSortDirection('desc')
          return prev
        }
        setSortDirection('asc')
        return null
      }
      setSortDirection('asc')
      return column
    })
  }, [sortDirection])

  const getAccessCount = useCallback((memberId: string) => {
    if (members.find((m) => m.id === memberId)?.role === 'admin') return { funnelCount: funnels.length, stageCount: 999 }
    const memberAccess = accessMap[memberId] || {}
    let funnelCount = 0
    let stageCount = 0
    for (const funnel of funnels) {
      const access = memberAccess[funnel.id]
      if (access?.enabled) {
        funnelCount++
        const fStages = stagesByFunnel[funnel.id] || []
        stageCount += access.allStages ? fStages.length : access.stageIds.length
      }
    }
    return { funnelCount, stageCount }
  }, [members, funnels, accessMap, stagesByFunnel])

  const filteredMembers = useMemo(() => {
    const term = normalize(search.trim())

    let result = members
    if (term) {
      result = members.filter((m) => {
        const name = normalize(m.displayName || '')
        const email = normalize(m.email || '')
        const role = normalize(ROLE_LABELS[m.role] || m.role || '')
        return name.includes(term) || email.includes(term) || role.includes(term)
      })
    }

    if (sortColumn) {
      result = [...result].sort((a, b) => {
        let cmp = 0
        switch (sortColumn) {
          case 'name':
            cmp = normalize(a.displayName || '').localeCompare(normalize(b.displayName || ''))
            break
          case 'role':
            cmp = (ROLE_ORDER[a.role] ?? 4) - (ROLE_ORDER[b.role] ?? 4)
            break
          case 'summary': {
            const aCount = getAccessCount(a.id)
            const bCount = getAccessCount(b.id)
            cmp = aCount.funnelCount - bCount.funnelCount || aCount.stageCount - bCount.stageCount
            break
          }
        }
        return sortDirection === 'asc' ? cmp : -cmp
      })
    }

    return result
  }, [members, search, sortColumn, sortDirection, getAccessCount])

  /* ---------------------- Access toggles -------------------------------- */

  const toggleFunnelAccess = (memberId: string, funnelId: string) => {
    setAccessMap((prev) => ({
      ...prev,
      [memberId]: {
        ...prev[memberId],
        [funnelId]: {
          ...prev[memberId]?.[funnelId],
          enabled: !prev[memberId]?.[funnelId]?.enabled,
          allStages: true,
          stageIds: [],
        },
      },
    }))
  }

  const toggleStageAccess = (memberId: string, funnelId: string, stageId: string) => {
    setAccessMap((prev) => {
      const current = prev[memberId]?.[funnelId] || { enabled: true, allStages: true, stageIds: [] }
      const funnelStages = stagesByFunnel[funnelId] || []
      let newStageIds: string[]

      if (current.allStages) {
        // Switching from allStages to specific: include all except clicked
        newStageIds = funnelStages.filter((s) => s.id !== stageId).map((s) => s.id)
      } else {
        if (current.stageIds.includes(stageId)) {
          newStageIds = current.stageIds.filter((id) => id !== stageId)
        } else {
          newStageIds = [...current.stageIds, stageId]
        }
      }

      // If all stages are selected, switch back to allStages
      const isAll = newStageIds.length >= funnelStages.length

      return {
        ...prev,
        [memberId]: {
          ...prev[memberId],
          [funnelId]: {
            enabled: true,
            allStages: isAll,
            stageIds: isAll ? [] : newStageIds,
          },
        },
      }
    })
  }

  const handleSave = async () => {
    if (!orgId) return
    setSaving(true)
    try {
      const batch = writeBatch(db)

      for (const member of members) {
        if (member.role === 'admin') continue // Skip admins

        const memberAccess = accessMap[member.id] || {}
        const funnelAccessArray: FunnelAccessEntry[] = []
        const enabledFunnelIds: string[] = []

        for (const funnel of funnels) {
          const access = memberAccess[funnel.id]
          if (access?.enabled) {
            enabledFunnelIds.push(funnel.id)
            if (!access.allStages) {
              funnelAccessArray.push({
                funnelId: funnel.id,
                allStages: false,
                stageIds: access.stageIds,
              })
            } else {
              funnelAccessArray.push({ funnelId: funnel.id, allStages: true })
            }
          }
        }

        // Update member's funnelAccess
        const memberRef = doc(db, 'organizations', orgId, 'members', member.id)
        batch.update(memberRef, { funnelAccess: funnelAccessArray })
      }

      // Update funnels' visibleTo arrays
      for (const funnel of funnels) {
        const visibleTo: string[] = []
        let allHaveAccess = true
        for (const member of members) {
          if (member.role === 'admin') continue
          const access = accessMap[member.id]?.[funnel.id]
          if (access?.enabled) {
            visibleTo.push(member.id)
          } else {
            allHaveAccess = false
          }
        }

        const funnelRef = doc(db, 'organizations', orgId, 'funnels', funnel.id)
        // If all members have access, use empty array (means visible to all)
        batch.update(funnelRef, { visibleTo: allHaveAccess ? [] : visibleTo })
      }

      await batch.commit()
      toast.success('Configurações de acesso salvas!')
    } catch (error) {
      console.error('Error saving funnel access:', error)
      toast.error('Erro ao salvar configurações')
    } finally {
      setSaving(false)
    }
  }

  const getAccessSummary = (memberId: string) => {
    if (members.find((m) => m.id === memberId)?.role === 'admin') return 'Acesso total'
    const memberAccess = accessMap[memberId] || {}
    let funnelCount = 0
    let stageCount = 0
    for (const funnel of funnels) {
      const access = memberAccess[funnel.id]
      if (access?.enabled) {
        funnelCount++
        const fStages = stagesByFunnel[funnel.id] || []
        stageCount += access.allStages ? fStages.length : access.stageIds.length
      }
    }
    if (funnelCount === 0) return 'Sem acesso'
    return `${funnelCount} funil${funnelCount !== 1 ? 's' : ''}, ${stageCount} etapa${stageCount !== 1 ? 's' : ''}`
  }

  if (!can('canManageFunnels') && !can('canManageSettings')) {
    return (
      <div className="p-8 text-center text-slate-500">
        <ShieldCheckIcon className="w-12 h-12 mx-auto mb-3 text-slate-300" />
        <p>Você não tem permissão para acessar esta página.</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 bg-slate-200 rounded animate-pulse" />
        <div className="h-64 bg-slate-100 rounded-xl animate-pulse" />
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Acesso a Funis</h1>
          <p className="text-sm text-slate-500 mt-1">Configure quais membros podem ver cada funil e suas etapas</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-5 py-2.5 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 shadow-sm"
        >
          {saving ? 'Salvando...' : 'Salvar'}
        </button>
      </div>

      {/* Search bar */}
      <div className="relative mb-4">
        <svg
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Pesquisar por nome, email ou cargo..."
          className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 pl-9 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-4 focus:ring-primary-100 focus:border-primary-300"
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

      {filteredMembers.length === 0 && !loading ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-slate-100">
            <svg className="h-7 w-7 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128H9m6 0a5.972 5.972 0 00-.786-3.07M9 19.128v-.003c0-1.113.285-2.16.786-3.07M9 19.128H3.375a4.125 4.125 0 017.533-2.493M9 19.128a5.972 5.972 0 01.786-3.07m4.428 0a9.36 9.36 0 00-4.428 0M12 10.5a3 3 0 100-6 3 3 0 000 6z" />
            </svg>
          </div>
          <h3 className="text-base font-semibold text-gray-900">
            {members.length === 0 ? 'Nenhum membro encontrado' : 'Nenhum resultado encontrado'}
          </h3>
          <p className="text-sm text-gray-500 mt-1">
            {members.length === 0 ? 'Nenhum membro ativo na organização.' : 'Tente ajustar os termos da pesquisa.'}
          </p>
        </div>
      ) : (
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                {([
                  { key: 'name' as SortColumn, label: 'Membro', align: 'left' },
                ] as const).map((col) => (
                  <th key={col.key} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider w-56">
                    <button
                      type="button"
                      onClick={() => handleSort(col.key)}
                      className="inline-flex items-center gap-1 hover:text-slate-900 transition"
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
                {funnels.map((f) => (
                  <th key={f.id} className="text-center px-3 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider min-w-[100px]">
                    <div className="flex items-center justify-center gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: f.color }} />
                      <span className="truncate max-w-[80px]">{f.name}</span>
                    </div>
                  </th>
                ))}
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  <button
                    type="button"
                    onClick={() => handleSort('summary')}
                    className="inline-flex items-center gap-1 hover:text-slate-900 transition ml-auto"
                  >
                    Resumo
                    <svg
                      className={`h-3.5 w-3.5 transition-colors ${
                        sortColumn === 'summary' ? 'text-primary-600' : 'text-gray-300'
                      }`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      {sortColumn === 'summary' && sortDirection === 'asc' ? (
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
                      ) : sortColumn === 'summary' && sortDirection === 'desc' ? (
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
              </tr>
            </thead>
            <tbody>
              {filteredMembers.map((member) => {
                const isAdmin = member.role === 'admin'
                const expandedFunnel = expandedRows[member.id] || null

                return (
                  <tr key={member.id} className="border-b border-slate-100 last:border-0">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
                          <span className="text-xs font-bold text-primary-600">{member.displayName.charAt(0).toUpperCase()}</span>
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-slate-700 truncate">{member.displayName}</div>
                          <div className="text-xs text-slate-400">{member.role}</div>
                        </div>
                      </div>
                    </td>
                    {funnels.map((funnel) => {
                      const access = accessMap[member.id]?.[funnel.id]
                      const fStages = stagesByFunnel[funnel.id] || []
                      const isExpanded = expandedFunnel === funnel.id

                      return (
                        <td key={funnel.id} className="text-center px-3 py-3 align-top">
                          {isAdmin ? (
                            <div className="flex items-center justify-center">
                              <CheckIcon className="w-5 h-5 text-green-500" />
                            </div>
                          ) : (
                            <div>
                              <label className="flex items-center justify-center gap-1.5 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={access?.enabled || false}
                                  onChange={() => toggleFunnelAccess(member.id, funnel.id)}
                                  className="rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                                />
                                {access?.enabled && fStages.length > 0 && (
                                  <button
                                    onClick={(e) => {
                                      e.preventDefault()
                                      setExpandedRows((prev) => ({
                                        ...prev,
                                        [member.id]: isExpanded ? null : funnel.id,
                                      }))
                                    }}
                                    className="p-0.5 text-slate-400 hover:text-slate-600"
                                  >
                                    {isExpanded ? (
                                      <ChevronDownIcon className="w-3.5 h-3.5" />
                                    ) : (
                                      <ChevronRightIcon className="w-3.5 h-3.5" />
                                    )}
                                  </button>
                                )}
                              </label>
                              {isExpanded && access?.enabled && (
                                <div className="mt-2 text-left space-y-1 bg-slate-50 rounded-lg p-2">
                                  {fStages.map((stage) => {
                                    const checked = access.allStages || access.stageIds.includes(stage.id)
                                    return (
                                      <label key={stage.id} className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
                                        <input
                                          type="checkbox"
                                          checked={checked}
                                          onChange={() => toggleStageAccess(member.id, funnel.id, stage.id)}
                                          className="rounded border-slate-300 text-primary-600 focus:ring-primary-500 w-3.5 h-3.5"
                                        />
                                        <span className="truncate">{stage.name}</span>
                                      </label>
                                    )
                                  })}
                                </div>
                              )}
                            </div>
                          )}
                        </td>
                      )
                    })}
                    <td className="text-right px-4 py-3">
                      <span className={`text-xs font-medium ${isAdmin ? 'text-green-600' : 'text-slate-500'}`}>
                        {getAccessSummary(member.id)}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
      )}
    </div>
  )
}
