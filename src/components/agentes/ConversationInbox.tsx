'use client'

import { useState } from 'react'
import type { Conversation, ConversationStatus } from '@/types/agentConfig'
import { ChatBubbleLeftRightIcon, FunnelIcon } from '@heroicons/react/24/outline'

interface ConversationInboxProps {
  conversations: Conversation[]
  selectedId: string | null
  onSelect: (id: string) => void
  loading?: boolean
}

const STATUS_LABELS: Record<ConversationStatus, { label: string; color: string }> = {
  active: { label: 'IA', color: 'bg-[#13DEFC]/20 text-[#13DEFC]' },
  human_handoff: { label: 'Humano', color: 'bg-yellow-500/20 text-yellow-400' },
  resolved: { label: 'Resolvido', color: 'bg-green-500/20 text-green-400' },
  expired: { label: 'Expirado', color: 'bg-slate-500/20 text-slate-400' },
}

export default function ConversationInbox({
  conversations,
  selectedId,
  onSelect,
  loading,
}: ConversationInboxProps) {
  const [filter, setFilter] = useState<'all' | 'active' | 'human_handoff' | 'resolved'>('all')

  const filtered = filter === 'all'
    ? conversations
    : conversations.filter(c => c.status === filter)

  const formatTime = (dateStr: string) => {
    if (!dateStr) return ''
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffHrs = diffMs / (1000 * 60 * 60)

    if (diffHrs < 24) {
      return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    }
    if (diffHrs < 48) return 'Ontem'
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
  }

  return (
    <div className="flex flex-col h-full border-r border-slate-700">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-700">
        <h2 className="text-white font-semibold flex items-center gap-2">
          <ChatBubbleLeftRightIcon className="w-5 h-5 text-[#13DEFC]" />
          Conversas
        </h2>
      </div>

      {/* Filters */}
      <div className="px-3 py-2 border-b border-slate-700/50 flex gap-1 overflow-x-auto">
        {([
          { key: 'all', label: 'Todas' },
          { key: 'active', label: 'IA' },
          { key: 'human_handoff', label: 'Humano' },
          { key: 'resolved', label: 'Resolvidas' },
        ] as const).map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-3 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
              filter === f.key
                ? 'bg-[#13DEFC]/10 text-[#13DEFC]'
                : 'text-white/40 hover:text-white/60 hover:bg-slate-700/50'
            }`}
          >
            {f.label}
            {f.key !== 'all' && (
              <span className="ml-1 text-white/20">
                {conversations.filter(c => c.status === f.key).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin w-6 h-6 border-2 border-[#13DEFC] border-t-transparent rounded-full" />
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-white/30">
            <FunnelIcon className="w-8 h-8 mb-2" />
            <p className="text-sm">Nenhuma conversa encontrada</p>
          </div>
        )}

        {filtered.map(conv => {
          const isSelected = selectedId === conv.id
          const statusConfig = STATUS_LABELS[conv.status]

          return (
            <button
              key={conv.id}
              onClick={() => onSelect(conv.id)}
              className={`w-full px-4 py-3 text-left border-b border-slate-700/30 transition-all hover:bg-slate-700/30 ${
                isSelected ? 'bg-slate-700/50' : ''
              }`}
            >
              <div className="flex items-start gap-3">
                {/* Avatar */}
                <div className="w-10 h-10 bg-slate-700 rounded-full flex items-center justify-center text-white/60 font-medium text-sm flex-shrink-0">
                  {(conv.contactName || '?')[0].toUpperCase()}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-white font-medium text-sm truncate">
                      {conv.contactName}
                    </span>
                    <span className="text-white/30 text-[10px] flex-shrink-0">
                      {formatTime(conv.lastMessageAt)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2 mt-0.5">
                    <p className="text-white/40 text-xs truncate">
                      {conv.lastMessagePreview || 'Sem mensagens'}
                    </p>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {conv.unreadCount > 0 && (
                        <span className="w-5 h-5 bg-[#13DEFC] text-slate-900 text-[10px] font-bold rounded-full flex items-center justify-center">
                          {conv.unreadCount > 9 ? '9+' : conv.unreadCount}
                        </span>
                      )}
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${statusConfig.color}`}>
                        {statusConfig.label}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
