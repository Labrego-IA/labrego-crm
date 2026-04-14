'use client'

import { useState, useEffect } from 'react'
import { useSuperAdmin } from '@/hooks/useSuperAdmin'
import { useRouter } from 'next/navigation'

interface OrgAIUsage {
  orgId: string
  orgName: string
  plan: string
  totalTokens: number
  totalMessages: number
  totalAudioMinutes: number
  totalImageDescriptions: number
  estimatedCostUSD: number
  lastActivityAt: string
}

// Precos estimados por 1M tokens (OpenAI)
const COST_PER_1M_INPUT_TOKENS = 0.15   // gpt-4o-mini input
const COST_PER_1M_OUTPUT_TOKENS = 0.60  // gpt-4o-mini output
const COST_PER_WHISPER_MINUTE = 0.006
const COST_PER_IMAGE_DESCRIPTION = 0.002
const COST_PER_ELEVENLABS_CHAR = 0.00003

export default function SuperAdminAIUsagePage() {
  const { isSuperAdmin } = useSuperAdmin()
  const router = useRouter()
  const [orgs, setOrgs] = useState<OrgAIUsage[]>([])
  const [loading, setLoading] = useState(true)
  const [sortBy, setSortBy] = useState<'tokens' | 'cost' | 'messages'>('cost')

  useEffect(() => {
    // isSuperAdmin pode ser undefined (loading), false (nao e admin), ou true
    if (isSuperAdmin === undefined) return // Ainda carregando
    if (isSuperAdmin === false) {
      router.replace('/')
      return
    }

    async function loadUsage() {
      try {
        // Carregar todas as orgs
        const orgsRes = await fetch('/api/super-admin/organizations')
        const orgsData = await orgsRes.json()
        const organizations = orgsData.organizations || orgsData || []

        // Para cada org, buscar logs de atividade e calcular uso
        const usagePromises = organizations.map(async (org: { id: string; name: string; plan: string }) => {
          try {
            const logsRes = await fetch(`/api/agent/logs?orgId=${org.id}&limit=500`)
            const logsData = await logsRes.json()
            const logs = logsData.logs || []

            let totalTokens = 0
            let totalMessages = 0
            let totalAudioMinutes = 0
            let totalImageDescriptions = 0
            let lastActivityAt = ''

            for (const log of logs) {
              if (log.action === 'ai_responded') {
                totalMessages++
                totalTokens += log.metadata?.tokensUsed || 500 // Estimativa se nao registrado
              }
              if (log.action === 'audio_transcribed') totalAudioMinutes += 0.5
              if (log.action === 'audio_generated') totalAudioMinutes += 0.3
              if (log.action === 'image_described') totalImageDescriptions++
              if (!lastActivityAt || log.createdAt > lastActivityAt) lastActivityAt = log.createdAt
            }

            const estimatedCostUSD =
              (totalTokens / 1_000_000) * (COST_PER_1M_INPUT_TOKENS + COST_PER_1M_OUTPUT_TOKENS) +
              totalAudioMinutes * COST_PER_WHISPER_MINUTE +
              totalImageDescriptions * COST_PER_IMAGE_DESCRIPTION

            return {
              orgId: org.id,
              orgName: org.name || org.id,
              plan: org.plan || 'free',
              totalTokens,
              totalMessages,
              totalAudioMinutes,
              totalImageDescriptions,
              estimatedCostUSD: Math.round(estimatedCostUSD * 100) / 100,
              lastActivityAt,
            }
          } catch {
            return {
              orgId: org.id,
              orgName: org.name || org.id,
              plan: org.plan || 'free',
              totalTokens: 0,
              totalMessages: 0,
              totalAudioMinutes: 0,
              totalImageDescriptions: 0,
              estimatedCostUSD: 0,
              lastActivityAt: '',
            }
          }
        })

        const usage = await Promise.all(usagePromises)
        setOrgs(usage.filter((o: OrgAIUsage) => o.totalMessages > 0 || o.totalTokens > 0))
      } catch (err) {
        console.error('Erro ao carregar uso de IA:', err)
      } finally {
        setLoading(false)
      }
    }

    loadUsage()
  }, [isSuperAdmin, router])

  const sorted = [...orgs].sort((a, b) => {
    if (sortBy === 'cost') return b.estimatedCostUSD - a.estimatedCostUSD
    if (sortBy === 'tokens') return b.totalTokens - a.totalTokens
    return b.totalMessages - a.totalMessages
  })

  const totals = orgs.reduce((acc, o) => ({
    tokens: acc.tokens + o.totalTokens,
    messages: acc.messages + o.totalMessages,
    cost: acc.cost + o.estimatedCostUSD,
    audio: acc.audio + o.totalAudioMinutes,
    images: acc.images + o.totalImageDescriptions,
  }), { tokens: 0, messages: 0, cost: 0, audio: 0, images: 0 })

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin w-8 h-8 border-2 border-cyan-600 border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Uso de IA por Empresa</h1>
        <p className="text-slate-500 mt-1">Consumo de tokens, mensagens e custos estimados dos agentes IA.</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <KPICard label="Total Tokens" value={totals.tokens.toLocaleString('pt-BR')} />
        <KPICard label="Mensagens IA" value={totals.messages.toString()} />
        <KPICard label="Custo Estimado" value={`US$ ${totals.cost.toFixed(2)}`} highlight />
        <KPICard label="Audio (min)" value={totals.audio.toFixed(1)} />
        <KPICard label="Imagens" value={totals.images.toString()} />
      </div>

      {/* Tabela */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
          <span className="text-sm font-medium text-slate-700">{orgs.length} empresas com uso de IA</span>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">Ordenar por:</span>
            {(['cost', 'tokens', 'messages'] as const).map(s => (
              <button
                key={s}
                onClick={() => setSortBy(s)}
                className={`px-2 py-1 rounded text-xs font-medium ${sortBy === s ? 'bg-cyan-50 text-cyan-700' : 'text-slate-400 hover:text-slate-600'}`}
              >
                {s === 'cost' ? 'Custo' : s === 'tokens' ? 'Tokens' : 'Msgs'}
              </button>
            ))}
          </div>
        </div>
        <table className="w-full">
          <thead className="sticky top-0 z-10 bg-slate-50 dark:bg-surface-dark/80">
            <tr className="bg-slate-50 border-b border-slate-100">
              <th className="text-left px-4 py-3 text-xs font-medium text-slate-500">Empresa</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-slate-500">Plano</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-slate-500">Tokens</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-slate-500">Mensagens</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-slate-500">Audio (min)</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-slate-500">Imagens</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-slate-500">Custo (USD)</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-slate-500">Ultima Atividade</th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr><td colSpan={8} className="text-center py-8 text-slate-400 text-sm">Nenhuma empresa com uso de IA registrado.</td></tr>
            ) : sorted.map(org => (
              <tr key={org.orgId} className="border-b border-slate-50 hover:bg-slate-50/50">
                <td className="px-4 py-3 text-sm font-medium text-slate-800 dark:text-white">{org.orgName}</td>
                <td className="px-4 py-3">
                  <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 text-xs">{org.plan}</span>
                </td>
                <td className="px-4 py-3 text-sm text-slate-600 text-right font-mono">{org.totalTokens.toLocaleString('pt-BR')}</td>
                <td className="px-4 py-3 text-sm text-slate-600 text-right">{org.totalMessages}</td>
                <td className="px-4 py-3 text-sm text-slate-600 text-right">{org.totalAudioMinutes.toFixed(1)}</td>
                <td className="px-4 py-3 text-sm text-slate-600 text-right">{org.totalImageDescriptions}</td>
                <td className="px-4 py-3 text-sm font-medium text-right">
                  <span className={org.estimatedCostUSD > 1 ? 'text-amber-600' : 'text-slate-600'}>
                    ${org.estimatedCostUSD.toFixed(2)}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-slate-400">
                  {org.lastActivityAt ? new Date(org.lastActivityAt).toLocaleDateString('pt-BR') : '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Referencia de custos */}
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
        <h3 className="text-sm font-medium text-slate-600 mb-2">Referencia de custos (OpenAI + ElevenLabs)</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs text-slate-500">
          <div>GPT-4o-mini: $0.15/1M input, $0.60/1M output</div>
          <div>GPT-4o: $2.50/1M input, $10/1M output</div>
          <div>Whisper: $0.006/minuto</div>
          <div>ElevenLabs: ~$0.30/1K caracteres</div>
        </div>
      </div>
    </div>
  )
}

function KPICard({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4">
      <div className={`text-xl font-bold ${highlight ? 'text-amber-600' : 'text-slate-800'}`}>{value}</div>
      <div className="text-slate-500 text-xs mt-1">{label}</div>
    </div>
  )
}
