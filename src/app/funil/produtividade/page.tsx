'use client'

import { useState, useEffect, useMemo } from 'react'
import {
  collection,
  collectionGroup,
  getDocs,
  query,
  where,
} from 'firebase/firestore'
import { db } from '@/lib/firebaseClient'
import { useCrmUser } from '@/contexts/CrmUserContext'
import {
  ChartBarIcon,
  ArrowPathIcon,
  UserIcon,
  CalendarDaysIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline'

type ProductivityEntry = {
  author: string
  createdAt: unknown // Can be string, Date, or Firestore Timestamp
  source: 'followup' | 'log'
  clientId: string
  clientName: string
  clientStage: string
}

type DailyProductivity = {
  [author: string]: {
    [date: string]: number
  }
}

type ClientDetail = {
  name: string
  stage: string
}

type ProductivityDetails = {
  [key: string]: ClientDetail[] // key = "author|date"
}

// Helper para converter valor de data (string, Timestamp, ou Date) para Date
const parseDate = (value: unknown): Date | null => {
  if (!value) return null

  // Se for um Firestore Timestamp (tem método toDate)
  if (typeof value === 'object' && value !== null && 'toDate' in value && typeof (value as { toDate: () => Date }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate()
  }

  // Se já for uma Date
  if (value instanceof Date) {
    return isNaN(value.getTime()) ? null : value
  }

  // Se for uma string
  if (typeof value === 'string') {
    const date = new Date(value)
    return isNaN(date.getTime()) ? null : date
  }

  return null
}

// Helper para formatar data como YYYY-MM-DD
const formatDateKey = (date: Date): string => {
  return date.toISOString().split('T')[0]
}

// Helper para formatar data para exibição
const formatDateDisplay = (dateKey: string): string => {
  const date = new Date(dateKey + 'T12:00:00')
  const weekdays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
  const day = date.getDate().toString().padStart(2, '0')
  const month = (date.getMonth() + 1).toString().padStart(2, '0')
  return `${weekdays[date.getDay()]} ${day}/${month}`
}

// Gerar últimos N dias
const getLast7Days = (): string[] => {
  const days: string[] = []
  const today = new Date()
  for (let i = 6; i >= 0; i--) {
    const date = new Date(today)
    date.setDate(date.getDate() - i)
    days.push(formatDateKey(date))
  }
  return days
}

// Calcular produtividade por autor e dia
// Agrupa por cliente: múltiplas interações com o mesmo cliente em 1 hora = 1 ponto
// Interações com clientes diferentes = conta cada uma
const calculateProductivity = (entries: ProductivityEntry[]): { productivity: DailyProductivity; details: ProductivityDetails } => {
  const productivity: DailyProductivity = {}
  const details: ProductivityDetails = {}
  const last7Days = getLast7Days()

  // Agrupar entradas por autor e dia
  const entriesByAuthorAndDay: { [key: string]: ProductivityEntry[] } = {}

  for (const entry of entries) {
    if (!entry.author) continue

    const parsedDate = parseDate(entry.createdAt)
    if (!parsedDate) continue // Ignorar entradas com data inválida

    const dateKey = formatDateKey(parsedDate)

    // Ignorar entradas fora dos últimos 7 dias
    if (!last7Days.includes(dateKey)) continue

    const key = `${entry.author}|${dateKey}`
    if (!entriesByAuthorAndDay[key]) {
      entriesByAuthorAndDay[key] = []
    }
    entriesByAuthorAndDay[key].push(entry)
  }

  // Para cada autor/dia, agrupar por cliente em janelas de 1 hora
  for (const [key, dayEntries] of Object.entries(entriesByAuthorAndDay)) {
    const [author, date] = key.split('|')

    if (!productivity[author]) {
      productivity[author] = {}
      for (const day of last7Days) {
        productivity[author][day] = 0
      }
    }

    // Agrupar por cliente
    const entriesByClient: { [clientId: string]: ProductivityEntry[] } = {}
    for (const entry of dayEntries) {
      if (!entriesByClient[entry.clientId]) {
        entriesByClient[entry.clientId] = []
      }
      entriesByClient[entry.clientId].push(entry)
    }

    // Para cada cliente, contar interações únicas por hora
    let totalCount = 0
    const clientsContacted: ClientDetail[] = []

    for (const [, clientEntries] of Object.entries(entriesByClient)) {
      // Ordenar por data
      const sorted = [...clientEntries].sort((a, b) => {
        const dateA = parseDate(a.createdAt)
        const dateB = parseDate(b.createdAt)
        return (dateA?.getTime() || 0) - (dateB?.getTime() || 0)
      })

      // Agrupar em janelas de 1 hora
      let count = 0
      let lastTime: number | null = null
      const hourInMs = 60 * 60 * 1000

      for (const entry of sorted) {
        const parsedEntryDate = parseDate(entry.createdAt)
        if (!parsedEntryDate) continue // Ignorar entradas com data inválida

        const currentTime = parsedEntryDate.getTime()
        if (lastTime === null || currentTime - lastTime > hourInMs) {
          count++
          lastTime = currentTime
        }
      }

      totalCount += count

      // Adicionar cliente à lista de detalhes (apenas uma vez por cliente)
      if (count > 0 && sorted[0]) {
        clientsContacted.push({
          name: sorted[0].clientName || 'Cliente desconhecido',
          stage: sorted[0].clientStage || 'Sem etapa',
        })
      }
    }

    productivity[author][date] = totalCount
    details[key] = clientsContacted
  }

  return { productivity, details }
}

export default function ProdutividadePage() {
  const { orgId } = useCrmUser()
  const [entries, setEntries] = useState<ProductivityEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [popup, setPopup] = useState<{ author: string; date: string; clients: ClientDetail[] } | null>(null)

  const fetchProductivityData = async () => {
    try {
      const allEntries: ProductivityEntry[] = []

      // Calcular data de 7 dias atrás para filtrar no Firebase
      const sevenDaysAgo = new Date()
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
      const sevenDaysAgoStr = sevenDaysAgo.toISOString()

      // Buscar as etapas do funil para ter os nomes
      const funnelStagesSnap = await getDocs(query(collection(db, 'funnelStages'), where('orgId', '==', orgId)))
      const stagesMap: { [id: string]: string } = {}
      funnelStagesSnap.docs.forEach((doc) => {
        const data = doc.data()
        stagesMap[doc.id] = data.name || 'Sem etapa'
      })

      // Buscar todos os clientes para ter nome e etapa
      const clientsSnap = await getDocs(query(collection(db, 'clients'), where('orgId', '==', orgId)))
      const clientsMap: { [id: string]: { name: string; stage: string } } = {}
      clientsSnap.docs.forEach((doc) => {
        const data = doc.data()
        const stageName = data.funnelStage ? stagesMap[data.funnelStage] || 'Sem etapa' : 'Sem etapa'
        clientsMap[doc.id] = {
          name: data.name || data.empresa || 'Cliente desconhecido',
          stage: stageName,
        }
      })

      // Usar collectionGroup para buscar todos os followups de uma vez
      const followupsSnap = await getDocs(
        query(
          collectionGroup(db, 'followups'),
          where('createdAt', '>=', sevenDaysAgoStr)
        )
      )
      followupsSnap.docs.forEach((doc) => {
        const data = doc.data()
        // Extrair clientId do path: clients/{clientId}/followups/{docId}
        const pathParts = doc.ref.path.split('/')
        const clientId = pathParts[1] || ''
        const clientInfo = clientsMap[clientId] || { name: 'Cliente desconhecido', stage: 'Sem etapa' }
        if (data.author && data.createdAt && clientId) {
          allEntries.push({
            author: data.author,
            createdAt: data.createdAt,
            source: 'followup',
            clientId,
            clientName: clientInfo.name,
            clientStage: clientInfo.stage,
          })
        }
      })

      // Usar collectionGroup para buscar todos os logs de uma vez
      const logsSnap = await getDocs(
        query(
          collectionGroup(db, 'logs'),
          where('createdAt', '>=', sevenDaysAgoStr)
        )
      )
      logsSnap.docs.forEach((doc) => {
        const data = doc.data()
        // Extrair clientId do path: clients/{clientId}/logs/{docId}
        const pathParts = doc.ref.path.split('/')
        const clientId = pathParts[1] || ''
        const clientInfo = clientsMap[clientId] || { name: 'Cliente desconhecido', stage: 'Sem etapa' }
        if (data.author && data.createdAt && clientId) {
          allEntries.push({
            author: data.author,
            createdAt: data.createdAt,
            source: 'log',
            clientId,
            clientName: clientInfo.name,
            clientStage: clientInfo.stage,
          })
        }
      })

      setEntries(allEntries)
    } catch (error) {
      console.error('Erro ao carregar dados de produtividade:', error)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    if (!orgId) return
    fetchProductivityData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId])

  const handleRefresh = () => {
    setRefreshing(true)
    fetchProductivityData()
  }

  const { productivity, details } = useMemo(() => calculateProductivity(entries), [entries])
  const last7Days = useMemo(() => getLast7Days(), [])
  const authors = useMemo(() => Object.keys(productivity).sort(), [productivity])

  // Calcular totais
  const totalsByAuthor = useMemo(() => {
    const totals: { [author: string]: number } = {}
    for (const author of authors) {
      totals[author] = Object.values(productivity[author]).reduce((a, b) => a + b, 0)
    }
    return totals
  }, [authors, productivity])

  const totalsByDay = useMemo(() => {
    const totals: { [day: string]: number } = {}
    for (const day of last7Days) {
      totals[day] = authors.reduce((sum, author) => sum + (productivity[author]?.[day] || 0), 0)
    }
    return totals
  }, [authors, last7Days, productivity])

  const grandTotal = useMemo(() =>
    Object.values(totalsByAuthor).reduce((a, b) => a + b, 0),
    [totalsByAuthor]
  )

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
          <p className="text-slate-600 font-medium">Carregando dados de produtividade...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-primary-500 to-purple-600 rounded-xl shadow-lg shadow-primary-200">
              <ChartBarIcon className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-800">Produtividade</h1>
              <p className="text-sm text-slate-500">Acompanhamento de atividades por usuário</p>
            </div>
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-all disabled:opacity-50"
          >
            <ArrowPathIcon className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Atualizar</span>
          </button>
        </div>
      </div>

      {/* Info Card */}
      <div className="mb-6 bg-gradient-to-r from-primary-50 to-purple-50 border border-primary-100 rounded-2xl p-4">
        <div className="flex items-start gap-3">
          <CheckCircleIcon className="w-5 h-5 text-primary-600 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-primary-700">
            <p className="font-medium">Como funciona a contagem</p>
            <p className="text-primary-600 mt-1">
              Contabiliza follow-ups e logs registrados nos cards. Múltiplas ações com o mesmo cliente em 1 hora contam como 1 ponto. Ações com clientes diferentes são contadas separadamente.
            </p>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 text-slate-500 mb-2">
            <UserIcon className="w-4 h-4" />
            <span className="text-xs font-medium">Usuários Ativos</span>
          </div>
          <p className="text-2xl font-bold text-slate-800">{authors.length}</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 text-slate-500 mb-2">
            <CalendarDaysIcon className="w-4 h-4" />
            <span className="text-xs font-medium">Período</span>
          </div>
          <p className="text-2xl font-bold text-slate-800">7 dias</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 text-slate-500 mb-2">
            <ChartBarIcon className="w-4 h-4" />
            <span className="text-xs font-medium">Total Geral</span>
          </div>
          <p className="text-2xl font-bold text-primary-600">{grandTotal}</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 text-slate-500 mb-2">
            <ChartBarIcon className="w-4 h-4" />
            <span className="text-xs font-medium">Média/Dia</span>
          </div>
          <p className="text-2xl font-bold text-slate-800">
            {authors.length > 0 ? (grandTotal / 7).toFixed(1) : '0'}
          </p>
        </div>
      </div>

      {/* Productivity Matrix */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
        <div className="p-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-800">Matriz de Produtividade</h2>
          <p className="text-sm text-slate-500 mt-1">Últimos 7 dias por usuário</p>
        </div>

        {authors.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <UserIcon className="w-8 h-8 text-slate-400" />
            </div>
            <p className="text-slate-600 font-medium">Nenhuma atividade encontrada</p>
            <p className="text-sm text-slate-400 mt-1">
              Registre follow-ups ou logs nos cards do funil para ver a produtividade.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto pb-4">
            <table className="w-full" style={{ overflow: 'visible' }}>
              <thead>
                <tr className="bg-slate-50">
                  <th className="text-left px-4 py-3 text-sm font-semibold text-slate-700 sticky left-0 bg-slate-50 z-10 min-w-[180px]">
                    Usuário
                  </th>
                  {last7Days.map((day) => (
                    <th
                      key={day}
                      className="text-center px-3 py-3 text-sm font-semibold text-slate-600 min-w-[80px]"
                    >
                      {formatDateDisplay(day)}
                    </th>
                  ))}
                  <th className="text-center px-4 py-3 text-sm font-bold text-primary-700 bg-primary-50 min-w-[80px]">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody>
                {authors.map((author, idx) => (
                  <tr
                    key={author}
                    className={`border-t border-slate-100 ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}
                  >
                    <td className={`px-4 py-3 sticky left-0 z-10 ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}`}>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-500 to-purple-600 flex items-center justify-center text-white font-semibold text-sm">
                          {author.charAt(0).toUpperCase()}
                        </div>
                        <span className="font-medium text-slate-700 truncate max-w-[120px]" title={author}>
                          {author}
                        </span>
                      </div>
                    </td>
                    {last7Days.map((day) => {
                      const count = productivity[author]?.[day] || 0
                      const clientDetails = details[`${author}|${day}`] || []
                      return (
                        <td key={day} className="text-center px-3 py-3">
                          <button
                            onClick={() => {
                              if (clientDetails.length > 0) {
                                setPopup({ author, date: day, clients: clientDetails })
                              }
                            }}
                            className={`
                              inline-flex items-center justify-center w-10 h-10 rounded-xl font-semibold text-sm transition-transform
                              ${clientDetails.length > 0 ? 'cursor-pointer hover:scale-110' : 'cursor-default'}
                              ${count === 0
                                ? 'bg-slate-100 text-slate-400'
                                : count <= 2
                                  ? 'bg-amber-100 text-amber-700'
                                  : count <= 5
                                    ? 'bg-emerald-100 text-emerald-700'
                                    : 'bg-primary-100 text-primary-700'
                              }
                            `}
                          >
                            {count}
                          </button>
                        </td>
                      )
                    })}
                    <td className="text-center px-4 py-3 bg-primary-50/50">
                      <span className="inline-flex items-center justify-center w-12 h-10 rounded-xl bg-primary-100 text-primary-700 font-bold text-sm">
                        {totalsByAuthor[author]}
                      </span>
                    </td>
                  </tr>
                ))}
                {/* Totals row */}
                <tr className="border-t-2 border-slate-200 bg-slate-100">
                  <td className="px-4 py-3 sticky left-0 bg-slate-100 z-10">
                    <span className="font-bold text-slate-700">Total/Dia</span>
                  </td>
                  {last7Days.map((day) => (
                    <td key={day} className="text-center px-3 py-3">
                      <span className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-slate-200 text-slate-700 font-bold text-sm">
                        {totalsByDay[day]}
                      </span>
                    </td>
                  ))}
                  <td className="text-center px-4 py-3 bg-primary-100">
                    <span className="inline-flex items-center justify-center w-12 h-10 rounded-xl bg-primary-600 text-white font-bold text-sm">
                      {grandTotal}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-slate-500">
        <span className="font-medium">Legenda:</span>
        <div className="flex items-center gap-2">
          <span className="w-6 h-6 rounded-lg bg-slate-100" />
          <span>0</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-6 h-6 rounded-lg bg-amber-100" />
          <span>1-2</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-6 h-6 rounded-lg bg-emerald-100" />
          <span>3-5</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-6 h-6 rounded-lg bg-primary-100" />
          <span>6+</span>
        </div>
      </div>

      {/* Popup de detalhes dos contatos */}
      {popup && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={() => setPopup(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 max-h-[80vh] flex flex-col animate-in fade-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <div>
                <h3 className="text-lg font-bold text-slate-800">Contatos Realizados</h3>
                <p className="text-sm text-slate-500 mt-0.5">
                  {popup.author} &middot; {formatDateDisplay(popup.date)}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-primary-100 text-primary-700 text-sm font-semibold">
                  {popup.clients.length} cliente{popup.clients.length > 1 ? 's' : ''}
                </span>
                <button
                  onClick={() => setPopup(null)}
                  className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            </div>
            {/* Lista de contatos */}
            <div className="overflow-y-auto flex-1 p-2">
              <ul className="divide-y divide-slate-100">
                {popup.clients.map((client, i) => (
                  <li key={i} className="flex items-center gap-3 px-3 py-3 hover:bg-slate-50 rounded-xl">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary-500 to-purple-600 flex items-center justify-center text-white font-semibold text-sm flex-shrink-0">
                      {client.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-slate-800 truncate">{client.name}</p>
                      <p className="text-xs text-slate-500 truncate">{client.stage}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
            {/* Footer */}
            <div className="p-4 border-t border-slate-100">
              <button
                onClick={() => setPopup(null)}
                className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-xl transition-colors text-sm"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
