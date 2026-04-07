'use client'

import { useState, useEffect } from 'react'
import { useCrmUser } from '@/contexts/CrmUserContext'
import {
  ChatBubbleLeftRightIcon,
  EnvelopeIcon,
  UserPlusIcon,
  ArrowsRightLeftIcon,
  CpuChipIcon,
  ClockIcon,
  CreditCardIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline'
import type { Conversation } from '@/types/agentConfig'

interface DashboardStats {
  totalConversations: number
  activeConversations: number
  handoffConversations: number
  resolvedConversations: number
  whatsappCount: number
  emailCount: number
  // Calculados
  handoffRate: number
  resolutionRate: number
}

export default function AgentesDashboardPage() {
  const { orgId } = useCrmUser()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!orgId) return
    async function loadData() {
      try {
        const res = await fetch(`/api/agent/conversations?orgId=${orgId}&status=all&limit=100`)
        const data = await res.json()
        const convs = (data.conversations || []) as Conversation[]
        setConversations(convs)

        const total = convs.length
        const active = convs.filter(c => c.status === 'active').length
        const handoff = convs.filter(c => c.status === 'human_handoff').length
        const resolved = convs.filter(c => c.status === 'resolved').length
        const whatsapp = convs.filter(c => c.channel === 'whatsapp').length
        const email = convs.filter(c => c.channel === 'email').length

        setStats({
          totalConversations: total,
          activeConversations: active,
          handoffConversations: handoff,
          resolvedConversations: resolved,
          whatsappCount: whatsapp,
          emailCount: email,
          handoffRate: total > 0 ? Math.round((handoff / total) * 100) : 0,
          resolutionRate: total > 0 ? Math.round((resolved / total) * 100) : 0,
        })
      } catch (err) {
        console.error('Erro ao carregar dashboard:', err)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [orgId])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin w-8 h-8 border-2 border-cyan-600 border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
          <SparklesIcon className="w-7 h-7 text-cyan-600" />
          Painel de Agentes IA
        </h1>
        <p className="text-slate-500 mt-1">Visao geral do atendimento automatizado.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          icon={<ChatBubbleLeftRightIcon className="w-5 h-5" />}
          label="Total Conversas"
          value={stats?.totalConversations || 0}
          color="text-cyan-600"
          bgColor="bg-cyan-50"
        />
        <StatCard
          icon={<CpuChipIcon className="w-5 h-5" />}
          label="Atendimento IA"
          value={stats?.activeConversations || 0}
          color="text-cyan-600"
          bgColor="bg-cyan-50"
        />
        <StatCard
          icon={<ArrowsRightLeftIcon className="w-5 h-5" />}
          label="Handoff Humano"
          value={stats?.handoffConversations || 0}
          color="text-yellow-400"
          bgColor="bg-yellow-50"
          subtitle={stats ? `${stats.handoffRate}% do total` : ''}
        />
        <StatCard
          icon={<UserPlusIcon className="w-5 h-5" />}
          label="Resolvidas"
          value={stats?.resolvedConversations || 0}
          color="text-green-400"
          bgColor="bg-green-50"
          subtitle={stats ? `${stats.resolutionRate}% do total` : ''}
        />
      </div>

      {/* Channel Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-6">
          <h3 className="text-slate-800 font-semibold mb-4 flex items-center gap-2">
            <ChatBubbleLeftRightIcon className="w-5 h-5 text-green-400" />
            WhatsApp
          </h3>
          <div className="text-3xl font-bold text-slate-800 mb-1">{stats?.whatsappCount || 0}</div>
          <p className="text-slate-400 text-sm">conversas</p>
          <a href="/agentes/whatsapp/conversas" className="mt-4 inline-block text-cyan-600 text-sm hover:underline">
            Ver conversas →
          </a>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-6">
          <h3 className="text-slate-800 font-semibold mb-4 flex items-center gap-2">
            <EnvelopeIcon className="w-5 h-5 text-blue-400" />
            Email
          </h3>
          <div className="text-3xl font-bold text-slate-800 mb-1">{stats?.emailCount || 0}</div>
          <p className="text-slate-400 text-sm">conversas</p>
          <a href="/agentes/email/conversas" className="mt-4 inline-block text-cyan-600 text-sm hover:underline">
            Ver conversas →
          </a>
        </div>
      </div>

      {/* Recent Conversations */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6">
        <h3 className="text-slate-800 font-semibold mb-4 flex items-center gap-2">
          <ClockIcon className="w-5 h-5 text-slate-400" />
          Conversas Recentes
        </h3>
        {conversations.length === 0 ? (
          <p className="text-slate-300 text-sm py-8 text-center">Nenhuma conversa ainda. Conecte seu WhatsApp ou Email para comecar.</p>
        ) : (
          <div className="space-y-2">
            {conversations.slice(0, 10).map(conv => (
              <a
                key={conv.id}
                href={`/agentes/${conv.channel}/conversas`}
                className="flex items-center gap-4 p-3 rounded-xl hover:bg-slate-50 transition-colors"
              >
                {/* Avatar */}
                <div className="w-9 h-9 bg-slate-200 rounded-full flex items-center justify-center text-slate-600 text-sm font-medium flex-shrink-0">
                  {(conv.contactName || '?')[0].toUpperCase()}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-800 text-sm font-medium truncate">{conv.contactName}</span>
                    <span className={`px-1 py-0.5 rounded text-[10px] font-medium ${
                      conv.channel === 'whatsapp' ? 'bg-green-50 text-green-700' : 'bg-blue-50 text-blue-700'
                    }`}>
                      {conv.channel === 'whatsapp' ? 'WA' : 'Email'}
                    </span>
                  </div>
                  <p className="text-slate-400 text-xs truncate">{conv.lastMessagePreview}</p>
                </div>

                {/* Status + Time */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  <StatusBadge status={conv.status} />
                  <span className="text-slate-200 text-[10px]">
                    {conv.lastMessageAt ? new Date(conv.lastMessageAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : ''}
                  </span>
                </div>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function StatCard({ icon, label, value, color, bgColor, subtitle }: {
  icon: React.ReactNode; label: string; value: number; color: string; bgColor: string; subtitle?: string
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5">
      <div className={`w-10 h-10 ${bgColor} rounded-xl flex items-center justify-center ${color} mb-3`}>
        {icon}
      </div>
      <div className="text-2xl font-bold text-slate-800">{value}</div>
      <div className="text-slate-400 text-sm">{label}</div>
      {subtitle && <div className="text-slate-300 text-xs mt-0.5">{subtitle}</div>}
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; color: string }> = {
    active: { label: 'IA', color: 'bg-[#13DEFC]/20 text-cyan-600' },
    human_handoff: { label: 'Humano', color: 'bg-yellow-500/20 text-yellow-400' },
    resolved: { label: 'Resolvido', color: 'bg-green-500/20 text-green-400' },
    expired: { label: 'Expirado', color: 'bg-slate-500/20 text-slate-400' },
  }
  const c = config[status] || config.expired
  return <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${c.color}`}>{c.label}</span>
}
