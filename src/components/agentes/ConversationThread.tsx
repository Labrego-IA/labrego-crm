'use client'

import { useEffect, useRef, useState } from 'react'
import MessageBubble from './MessageBubble'
import HumanHandoffBanner from './HumanHandoffBanner'
import type { Conversation, ConversationMessage } from '@/types/agentConfig'
import { PaperAirplaneIcon, CheckCircleIcon, ArrowPathIcon } from '@heroicons/react/24/solid'

interface ConversationThreadProps {
  conversation: Conversation
  messages: ConversationMessage[]
  orgId: string
  onSendMessage: (message: string) => Promise<void>
  onHandoff: () => Promise<void>
  onResolve: () => Promise<void>
  onResumeAI: () => Promise<void>
}

export default function ConversationThread({
  conversation,
  messages,
  orgId,
  onSendMessage,
  onHandoff,
  onResolve,
  onResumeAI,
}: ConversationThreadProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [newMessage, setNewMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)

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
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700 bg-slate-800/50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-slate-700 rounded-full flex items-center justify-center text-white/60 font-medium">
            {(conversation.contactName || '?')[0].toUpperCase()}
          </div>
          <div>
            <h3 className="text-white font-medium text-sm">{conversation.contactName}</h3>
            <p className="text-white/40 text-xs">
              {conversation.contactPhone || conversation.contactEmail}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {conversation.status === 'active' && (
            <button
              onClick={() => handleAction(onHandoff)}
              disabled={actionLoading}
              className="px-3 py-1.5 bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-400 text-xs font-medium rounded-lg transition-colors disabled:opacity-50"
            >
              Assumir conversa
            </button>
          )}
          {conversation.status !== 'resolved' && (
            <button
              onClick={() => handleAction(onResolve)}
              disabled={actionLoading}
              className="flex items-center gap-1 px-3 py-1.5 bg-green-500/10 hover:bg-green-500/20 text-green-400 text-xs font-medium rounded-lg transition-colors disabled:opacity-50"
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
        <div className="flex items-center justify-between px-4 py-3 bg-green-500/10 border-b border-green-500/20">
          <div className="flex items-center gap-2">
            <CheckCircleIcon className="w-4 h-4 text-green-400" />
            <span className="text-green-400 text-sm font-medium">Conversa resolvida</span>
          </div>
          <button
            onClick={() => handleAction(onResumeAI)}
            disabled={actionLoading}
            className="flex items-center gap-1 px-3 py-1.5 bg-slate-700/50 hover:bg-slate-700 text-white/60 text-xs font-medium rounded-lg transition-colors disabled:opacity-50"
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
            <p className="text-white/30 text-sm">Nenhuma mensagem ainda.</p>
          </div>
        )}
        {messages.map(msg => (
          <MessageBubble key={msg.id} message={msg} />
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input (apenas se nao resolvida) */}
      {conversation.status !== 'resolved' && (
        <div className="px-4 py-3 border-t border-slate-700 bg-slate-800/50">
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
              className="flex-1 px-4 py-2.5 bg-slate-900/50 border border-slate-600 rounded-xl text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-[#13DEFC]/50 resize-none"
            />
            <button
              onClick={handleSend}
              disabled={!newMessage.trim() || sending}
              className="p-2.5 bg-[#13DEFC] hover:bg-[#13DEFC]/90 text-slate-900 rounded-xl transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <PaperAirplaneIcon className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
