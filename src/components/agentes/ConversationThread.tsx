'use client'

import { useEffect, useRef, useState } from 'react'
import MessageBubble from './MessageBubble'
import HumanHandoffBanner from './HumanHandoffBanner'
import type { Conversation, ConversationMessage } from '@/types/agentConfig'
import { PaperAirplaneIcon, CheckCircleIcon, ArrowPathIcon } from '@heroicons/react/24/solid'
import { PlusIcon, TagIcon } from '@heroicons/react/24/outline'

interface ConversationThreadProps {
  conversation: Conversation
  messages: ConversationMessage[]
  orgId: string
  onSendMessage: (message: string) => Promise<void>
  onHandoff: () => Promise<void>
  onResolve: () => Promise<void>
  onResumeAI: () => Promise<void>
  onToggleAI: () => Promise<void>
  onAddTag: (tag: string) => Promise<void>
}

export default function ConversationThread({
  conversation,
  messages,
  orgId,
  onSendMessage,
  onHandoff,
  onResolve,
  onResumeAI,
  onToggleAI,
  onAddTag,
}: ConversationThreadProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [newMessage, setNewMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [showTagInput, setShowTagInput] = useState(false)
  const [tagValue, setTagValue] = useState('')

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = async () => {
    if (!newMessage.trim() || sending) return
    setSending(true)
    try {
      await onSendMessage(newMessage.trim())
      setNewMessage('')
    } finally {
      setSending(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleAction = async (action: () => Promise<void>) => {
    setActionLoading(true)
    try { await action() } finally { setActionLoading(false) }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-white/10 bg-white dark:bg-surface-dark">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-slate-200 rounded-full flex items-center justify-center text-slate-600 dark:text-slate-400 font-medium">
            {(conversation.contactName || '?')[0].toUpperCase()}
          </div>
          <div>
            <h3 className="text-slate-800 dark:text-white font-medium text-sm">{conversation.contactName}</h3>
            <p className="text-slate-400 text-xs">
              {conversation.contactPhone || conversation.contactEmail}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* AI Toggle */}
          <button
            onClick={() => handleAction(onToggleAI)}
            disabled={actionLoading}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors disabled:opacity-50 ${
              conversation.aiEnabled
                ? 'bg-cyan-50 text-cyan-600 hover:bg-cyan-100'
                : 'bg-slate-100 dark:bg-white/10 text-slate-400 hover:bg-slate-200'
            }`}
          >
            IA {conversation.aiEnabled ? 'On' : 'Off'}
          </button>

          {/* Add Tag */}
          {showTagInput ? (
            <div className="flex items-center gap-1">
              <TagIcon className="w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                value={tagValue}
                onChange={e => setTagValue(e.target.value)}
                onKeyDown={async e => {
                  if (e.key === 'Enter' && tagValue.trim()) {
                    await onAddTag(tagValue.trim())
                    setTagValue('')
                    setShowTagInput(false)
                  }
                  if (e.key === 'Escape') {
                    setTagValue('')
                    setShowTagInput(false)
                  }
                }}
                placeholder="Nome da tag..."
                autoFocus
                className="w-28 px-2 py-1 bg-white dark:bg-surface-dark border border-slate-200 dark:border-white/10 rounded-lg text-xs text-slate-800 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-cyan-500"
              />
            </div>
          ) : (
            <button
              onClick={() => setShowTagInput(true)}
              className="flex items-center gap-1 px-2 py-1.5 bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:bg-white/10 text-slate-500 text-xs font-medium rounded-lg transition-colors"
            >
              <PlusIcon className="w-3.5 h-3.5" />
              Tag
            </button>
          )}

          {conversation.status === 'active' && (
            <button
              onClick={() => handleAction(onHandoff)}
              disabled={actionLoading}
              className="px-3 py-1.5 bg-yellow-50 hover:bg-yellow-500/20 text-yellow-400 text-xs font-medium rounded-lg transition-colors disabled:opacity-50"
            >
              Assumir conversa
            </button>
          )}
          {conversation.status !== 'resolved' && (
            <button
              onClick={() => handleAction(onResolve)}
              disabled={actionLoading}
              className="flex items-center gap-1 px-3 py-1.5 bg-green-50 hover:bg-green-500/20 text-green-400 text-xs font-medium rounded-lg transition-colors disabled:opacity-50"
            >
              <CheckCircleIcon className="w-3.5 h-3.5" />
              Resolver
            </button>
          )}
        </div>
      </div>

      {/* Handoff Banner */}
      {conversation.status === 'human_handoff' && (
        <HumanHandoffBanner onResumeAI={() => handleAction(onResumeAI)} loading={actionLoading} />
      )}

      {/* Resolved Banner */}
      {conversation.status === 'resolved' && (
        <div className="flex items-center justify-between px-4 py-3 bg-green-50 border-b border-green-200">
          <div className="flex items-center gap-2">
            <CheckCircleIcon className="w-4 h-4 text-green-400" />
            <span className="text-green-400 text-sm font-medium">Conversa resolvida</span>
          </div>
          <button
            onClick={() => handleAction(onResumeAI)}
            disabled={actionLoading}
            className="flex items-center gap-1 px-3 py-1.5 bg-slate-100 dark:bg-white/10 hover:bg-slate-200 text-slate-600 dark:text-slate-400 text-xs font-medium rounded-lg transition-colors disabled:opacity-50"
          >
            <ArrowPathIcon className="w-3.5 h-3.5" />
            Reabrir
          </button>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
        {messages.length === 0 && (
          <div className="flex items-center justify-center h-full">
            <p className="text-slate-300 text-sm">Nenhuma mensagem ainda.</p>
          </div>
        )}
        {messages.map(msg => (
          <MessageBubble key={msg.id} message={msg} />
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input (apenas se nao resolvida) */}
      {conversation.status !== 'resolved' && (
        <div className="px-4 py-3 border-t border-slate-200 dark:border-white/10 bg-white dark:bg-surface-dark">
          <div className="flex items-end gap-2">
            <textarea
              value={newMessage}
              onChange={e => setNewMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                conversation.status === 'human_handoff'
                  ? 'Digite sua resposta...'
                  : 'Enviar mensagem manual (o agente IA esta respondendo)...'
              }
              rows={1}
              className="flex-1 px-4 py-2.5 bg-white dark:bg-surface-dark border border-slate-300 rounded-xl text-slate-800 dark:text-white text-sm placeholder:text-slate-400 focus:outline-none focus:border-cyan-500 resize-none"
            />
            <button
              onClick={handleSend}
              disabled={!newMessage.trim() || sending}
              className="p-2.5 bg-secondary hover:bg-secondary/90 text-slate-900 dark:text-white rounded-xl transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              aria-label="Enviar mensagem"
            >
              <PaperAirplaneIcon className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
