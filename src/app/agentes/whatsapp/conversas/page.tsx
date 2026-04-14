'use client'

import { useState, useEffect, useCallback } from 'react'
import { useCrmUser } from '@/contexts/CrmUserContext'
import ConversationInbox from '@/components/agentes/ConversationInbox'
import ConversationThread from '@/components/agentes/ConversationThread'
import type { Conversation, ConversationMessage } from '@/types/agentConfig'

export default function WhatsAppConversasPage() {
  const { orgId } = useCrmUser()
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ConversationMessage[]>([])
  const [selectedConv, setSelectedConv] = useState<Conversation | null>(null)
  const [listLoading, setListLoading] = useState(true)
  const [threadLoading, setThreadLoading] = useState(false)

  // Carregar lista de conversas
  const loadConversations = useCallback(async () => {
    if (!orgId) return
    try {
      const res = await fetch(`/api/agent/conversations?orgId=${orgId}&channel=whatsapp`)
      const data = await res.json()
      setConversations(data.conversations || [])
    } catch (err) {
      console.error('Erro ao carregar conversas:', err)
    } finally {
      setListLoading(false)
    }
  }, [orgId])

  useEffect(() => {
    loadConversations()
    // Polling a cada 10s para novas conversas
    const interval = setInterval(loadConversations, 10000)
    return () => clearInterval(interval)
  }, [loadConversations])

  // Carregar conversa selecionada
  const loadThread = useCallback(async (convId: string) => {
    if (!orgId) return
    setThreadLoading(true)
    try {
      const res = await fetch(`/api/agent/conversations/${convId}?orgId=${orgId}`)
      const data = await res.json()
      setSelectedConv(data.conversation)
      setMessages(data.messages || [])
    } catch (err) {
      console.error('Erro ao carregar conversa:', err)
    } finally {
      setThreadLoading(false)
    }
  }, [orgId])

  // Polling mensagens da conversa selecionada
  useEffect(() => {
    if (!selectedId) return
    loadThread(selectedId)
    const interval = setInterval(() => loadThread(selectedId), 5000)
    return () => clearInterval(interval)
  }, [selectedId, loadThread])

  const handleSelect = (id: string) => {
    setSelectedId(id)
  }

  // Enviar mensagem manual
  const handleSendMessage = async (message: string) => {
    if (!orgId || !selectedId) return
    await fetch('/api/agent/whatsapp/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orgId, conversationId: selectedId, message }),
    })
    // Recarregar thread
    await loadThread(selectedId)
    await loadConversations()
  }

  // Handoff para humano
  const handleHandoff = async () => {
    if (!orgId || !selectedId) return
    await fetch(`/api/agent/conversations/${selectedId}/handoff`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orgId, reason: 'Transferido manualmente pelo atendente' }),
    })
    await loadThread(selectedId)
    await loadConversations()
  }

  // Resolver conversa
  const handleResolve = async () => {
    if (!orgId || !selectedId) return
    await fetch(`/api/agent/conversations/${selectedId}/resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orgId }),
    })
    await loadThread(selectedId)
    await loadConversations()
  }

  // Reativar IA
  const handleResumeAI = async () => {
    if (!orgId || !selectedId) return
    await fetch(`/api/agent/conversations/${selectedId}/resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orgId, action: 'resume_ai' }),
    })
    await loadThread(selectedId)
    await loadConversations()
  }

  // Toggle IA on/off por conversa
  const handleToggleAI = async () => {
    if (!orgId || !selectedId || !selectedConv) return
    const newEnabled = !selectedConv.aiEnabled
    await fetch(`/api/agent/conversations/${selectedId}/toggle-ai`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orgId, aiEnabled: newEnabled }),
    })
    await loadThread(selectedId)
    await loadConversations()
  }

  // Adicionar tag ao contato
  const handleAddTag = async (tag: string) => {
    if (!orgId || !selectedId) return
    await fetch(`/api/agent/conversations/${selectedId}/tags`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orgId, tag }),
    })
    await loadThread(selectedId)
    await loadConversations()
  }

  return (
    <div className="h-[calc(100vh-64px)] flex">
      {/* Sidebar — Lista de conversas */}
      <div className="w-80 flex-shrink-0">
        <ConversationInbox
          conversations={conversations}
          selectedId={selectedId}
          onSelect={handleSelect}
          loading={listLoading}
        />
      </div>

      {/* Main — Thread */}
      <div className="flex-1 bg-slate-50 dark:bg-white/5">
        {!selectedId ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-300">
            <svg className="w-16 h-16 mb-4 text-slate-100" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <p className="text-lg font-medium">Selecione uma conversa</p>
            <p className="text-sm mt-1">Escolha uma conversa na lista ao lado para visualizar.</p>
          </div>
        ) : threadLoading && !selectedConv ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin w-8 h-8 border-2 border-cyan-600 border-t-transparent rounded-full" />
          </div>
        ) : selectedConv ? (
          <ConversationThread
            conversation={selectedConv}
            messages={messages}
            orgId={orgId || ''}
            onSendMessage={handleSendMessage}
            onHandoff={handleHandoff}
            onResolve={handleResolve}
            onResumeAI={handleResumeAI}
            onToggleAI={handleToggleAI}
            onAddTag={handleAddTag}
          />
        ) : null}
      </div>
    </div>
  )
}
