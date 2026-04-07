'use client'

import type { ConversationMessage } from '@/types/agentConfig'

interface MessageBubbleProps {
  message: ConversationMessage
}

export default function MessageBubble({ message }: MessageBubbleProps) {
  const isContact = message.role === 'contact'
  const isSystem = message.role === 'system'
  const isAgent = message.role === 'agent'

  // Mensagem de sistema (centralizada)
  if (isSystem) {
    return (
      <div className="flex justify-center my-3">
        <span className="px-3 py-1.5 bg-slate-100 text-slate-400 text-xs rounded-full">
          {message.content}
        </span>
      </div>
    )
  }

  const time = message.sentAt
    ? new Date(message.sentAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    : ''

  return (
    <div className={`flex ${isContact ? 'justify-start' : 'justify-end'} mb-2`}>
      <div
        className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${
          isContact
            ? 'bg-slate-200/60 text-slate-800 rounded-bl-md'
            : isAgent
              ? 'bg-cyan-50 text-slate-800 border border-cyan-200 rounded-br-md'
              : 'bg-green-50 text-slate-800 border border-green-200 rounded-br-md'
        }`}
      >
        {/* Role label */}
        {!isContact && (
          <div className={`text-[10px] font-medium mb-1 ${
            isAgent ? 'text-cyan-500' : 'text-green-400/60'
          }`}>
            {isAgent ? 'Agente IA' : 'Atendente'}
          </div>
        )}

        {/* Media indicator */}
        {message.contentType === 'audio' && (
          <div className="flex items-center gap-2 mb-1">
            <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
            <span className="text-slate-500 text-xs">Audio</span>
          </div>
        )}

        {message.contentType === 'image' && message.mediaUrl && (
          <div className="mb-2">
            <div className="flex items-center gap-2 text-slate-500 text-xs">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span>Imagem</span>
            </div>
          </div>
        )}

        {message.contentType === 'document' && (
          <div className="flex items-center gap-2 mb-1">
            <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span className="text-slate-500 text-xs">Documento</span>
          </div>
        )}

        {/* Text content */}
        <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 mt-1">
          {time && <span className="text-[10px] text-slate-300">{time}</span>}
          {message.tokensUsed > 0 && (
            <span className="text-[10px] text-slate-200">{message.tokensUsed} tokens</span>
          )}
        </div>
      </div>
    </div>
  )
}
