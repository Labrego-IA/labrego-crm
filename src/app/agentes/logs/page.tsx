'use client'

import { useState, useEffect } from 'react'
import { useCrmUser } from '@/contexts/CrmUserContext'
import type { AgentActivityLog, AgentActivityAction, MessageChannel } from '@/types/agentConfig'

const ACTION_CONFIG: Record<AgentActivityAction, { label: string; color: string; icon: string }> = {
  message_received: { label: 'Mensagem recebida', color: 'bg-blue-50 text-blue-700', icon: 'IN' },
  ai_responded: { label: 'IA respondeu', color: 'bg-cyan-50 text-cyan-700', icon: 'IA' },
  audio_transcribed: { label: 'Audio transcrito', color: 'bg-indigo-50 text-indigo-700', icon: 'STT' },
  audio_generated: { label: 'Audio gerado', color: 'bg-violet-50 text-violet-700', icon: 'TTS' },
  image_described: { label: 'Imagem analisada', color: 'bg-purple-50 text-purple-700', icon: 'IMG' },
  document_extracted: { label: 'Documento lido', color: 'bg-amber-50 text-amber-700', icon: 'DOC' },
  human_handoff: { label: 'Transferido p/ humano', color: 'bg-yellow-50 text-yellow-700', icon: 'HH' },
  human_responded: { label: 'Humano respondeu', color: 'bg-green-50 text-green-700', icon: 'HU' },
  ai_resumed: { label: 'IA reativada', color: 'bg-teal-50 text-teal-700', icon: 'ON' },
  contact_created: { label: 'Contato criado', color: 'bg-emerald-50 text-emerald-700', icon: 'CRM' },
  pipeline_updated: { label: 'Funil atualizado', color: 'bg-lime-50 text-lime-700', icon: 'FNL' },
  credit_deducted: { label: 'Credito debitado', color: 'bg-orange-50 text-orange-700', icon: 'CR' },
  credit_insufficient: { label: 'Sem creditos', color: 'bg-red-50 text-red-700', icon: 'ERR' },
  calendar_checked: { label: 'Agenda verificada', color: 'bg-blue-50 text-blue-700', icon: 'CAL' },
  meeting_scheduled: { label: 'Reuniao agendada', color: 'bg-blue-50 text-blue-700', icon: 'MTG' },
  followup_created: { label: 'Follow-up criado', color: 'bg-green-50 text-green-700', icon: 'FUP' },
  funnel_moved: { label: 'Funil atualizado', color: 'bg-purple-50 text-purple-700', icon: 'FNL' },
  off_hours_reply: { label: 'Fora do horario', color: 'bg-slate-100 dark:bg-white/10 text-slate-600', icon: 'OFF' },
  error: { label: 'Erro', color: 'bg-red-50 text-red-700', icon: 'ERR' },
}

export default function AgentLogsPage() {
  const { orgId } = useCrmUser()
  const [logs, setLogs] = useState<AgentActivityLog[]>([])
  const [loading, setLoading] = useState(true)
  const [filterChannel, setFilterChannel] = useState<'all' | MessageChannel>('all')
  const [filterAction, setFilterAction] = useState<string>('all')

  useEffect(() => {
    if (!orgId) return
    async function loadLogs() {
      try {
        const params = new URLSearchParams({ orgId: orgId!, limit: '100' })
        if (filterChannel !== 'all') params.set('channel', filterChannel)
        if (filterAction !== 'all') params.set('action', filterAction)
        const res = await fetch(`/api/agent/logs?${params}`)
        const data = await res.json()
        setLogs(data.logs || [])
      } catch (err) {
        console.error('Erro ao carregar logs:', err)
      } finally {
        setLoading(false)
      }
    }
    loadLogs()
  }, [orgId, filterChannel, filterAction])

  const formatTime = (dateStr: string) => {
    if (!dateStr) return ''
    const d = new Date(dateStr)
    return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
  }

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Logs do Agente IA</h1>
        <p className="text-slate-500 mt-1">Acompanhe cada acao, recebimento, erro e ferramenta usada pelo agente.</p>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3 items-center">
        <select
          value={filterChannel}
          onChange={e => { setFilterChannel(e.target.value as 'all' | MessageChannel); setLoading(true) }}
          className="px-3 py-2 bg-white dark:bg-surface-dark border border-slate-300 rounded-lg text-slate-700 dark:text-slate-300 text-sm"
        >
          <option value="all">Todos os canais</option>
          <option value="whatsapp">WhatsApp</option>
          <option value="email">Email</option>
        </select>
        <select
          value={filterAction}
          onChange={e => { setFilterAction(e.target.value); setLoading(true) }}
          className="px-3 py-2 bg-white dark:bg-surface-dark border border-slate-300 rounded-lg text-slate-700 dark:text-slate-300 text-sm"
        >
          <option value="all">Todas as acoes</option>
          <option value="message_received">Mensagens recebidas</option>
          <option value="ai_responded">Respostas da IA</option>
          <option value="human_handoff">Handoff humano</option>
          <option value="contact_created">Contatos criados</option>
          <option value="credit_deducted">Creditos debitados</option>
          <option value="credit_insufficient">Sem creditos</option>
          <option value="error">Erros</option>
        </select>
      </div>

      {/* Logs */}
      <div className="bg-white dark:bg-surface-dark border border-slate-200 dark:border-white/10 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin w-6 h-6 border-2 border-cyan-600 border-t-transparent rounded-full" />
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <p className="text-sm">Nenhum log encontrado.</p>
            <p className="text-xs mt-1">Os logs aparecem quando o agente comeca a atender.</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50 dark:bg-white/5">
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 w-40">Data/Hora</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 w-16">Canal</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 w-44">Acao</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500">Detalhes</th>
              </tr>
            </thead>
            <tbody>
              {logs.map(log => {
                const actionCfg = ACTION_CONFIG[log.action] || ACTION_CONFIG.error
                return (
                  <tr key={log.id} className="border-b border-slate-50 hover:bg-slate-50 dark:bg-white/5/50">
                    <td className="px-4 py-3 text-xs text-slate-500 font-mono">{formatTime(log.createdAt)}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                        log.channel === 'whatsapp' ? 'bg-green-50 text-green-700' : 'bg-blue-50 text-blue-700'
                      }`}>
                        {log.channel === 'whatsapp' ? 'WA' : 'Email'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium ${actionCfg.color}`}>
                        <span className="text-[10px] font-bold">{actionCfg.icon}</span>
                        {actionCfg.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-400 max-w-md truncate">{log.detail}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
