'use client'

import { useState, useEffect, useCallback } from 'react'
import { useCrmUser } from '@/contexts/CrmUserContext'
import ConversationInbox from '@/components/agentes/ConversationInbox'
import ConversationThread from '@/components/agentes/ConversationThread'
import type { Conversation, ConversationMessage } from '@/types/agentConfig'

export default function EmailConversasPage() {
  const { orgId } = useCrmUser()
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ConversationMessage[]>([])
  const [selectedConv, setSelectedConv] = useState<Conversation | null>(null)
  const [listLoading, setListLoading] = useState(true)
  const [threadLoading, setThreadLoading] = useState(false)

  const loadConversations = useCallback(async () => {
    if (!orgId) return
    try {
      const res = await fetch(`/api/agent/conversations?orgId=${orgId}&channel=email`)
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
    const interval = setInterval(loadConversations, 10000)
    return () => clearInterval(interval)
  }, [loadConversations])

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

  useEffect(() => {
    if (!selectedId) return
    loadThread(selectedId)
    const interval = setInterval(() => loadThread(selectedId), 5000)
    return () => clearInterval(interval)
  }, [selectedId, loadThread])

  // Para email, o envio manual usa a API de email (nao WhatsApp)
  const handleSendMessage = async (message: string) => {
    if (!orgId || !selectedId || !selectedConv) return
    // Usar endpoint generico de envio — por enquanto reutiliza o send do whatsapp
    // Em producao, criar /api/agent/email/send dedicado
    await fetch('/api/agent/whatsapp/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orgId, conversationId: selectedId, message }),
    })
    await loadThread(selectedId)
    await loadConversations()
  }

  const handleHandoff = async () => {
    if (!orgId || !selectedId) return
    await fetch(`/api/agent/conversations/${selectedId}/handoff`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orgId, reason: 'Transferido manualmente' }),
    })
    await loadThread(selectedId)
    await loadConversations()
  }

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

  return (
    <div className="h-[calc(100vh-64px)] flex">
      <div className="w-80 flex-shrink-0">
        <ConversationInbox
          conversations={conversations}
          selectedId={selectedId}
          onSelect={setSelectedId}
          loading={listLoading}
        />
      </div>
      <div className="flex-1 bg-slate-50">
        {!selectedId ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-300">
            <svg className="w-16 h-16 mb-4 text-slate-100" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            <p className="text-lg font-medium">Selecione uma conversa</p>
            <p className="text-sm mt-1">Escolha uma conversa de email na lista ao lado.</p>
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
          />
        ) : null}
      </div>
    </div>
  )
}
