'use client'

import { useState, useEffect, useMemo } from 'react'
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
      })
    )

    unsubs.push(
      onSnapshot(query(collection(db, 'funnelStages'), where('orgId', '==', orgId)), (snap) => {
        const data = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as StageItem[]
        setStages(data.sort((a, b) => a.order - b.order))
        setLoading(false)
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

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider w-56">Membro</th>
                {funnels.map((f) => (
                  <th key={f.id} className="text-center px-3 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider min-w-[100px]">
                    <div className="flex items-center justify-center gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: f.color }} />
                      <span className="truncate max-w-[80px]">{f.name}</span>
                    </div>
                  </th>
                ))}
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Resumo</th>
              </tr>
            </thead>
            <tbody>
              {members.map((member) => {
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
    </div>
  )
}
