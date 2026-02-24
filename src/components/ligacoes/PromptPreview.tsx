'use client'

import { useMemo, useState, useEffect } from 'react'
import { XMarkIcon, DocumentTextIcon } from '@heroicons/react/24/outline'
import type { AgentWizardAnswers } from '@/types/callRouting'
import { assemblePromptFromWizard } from '@/lib/promptAssembler'

/* ================================= Types ================================= */

interface PromptPreviewProps {
  answers: AgentWizardAnswers
  open: boolean
  onClose: () => void
}

/* ================================= Component ================================= */

export default function PromptPreview({ answers, open, onClose }: PromptPreviewProps) {
  // Debounce prompt assembly by 500ms
  const [debouncedAnswers, setDebouncedAnswers] = useState(answers)

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedAnswers(answers), 500)
    return () => clearTimeout(timer)
  }, [answers])

  const promptText = useMemo(() => assemblePromptFromWizard(debouncedAnswers), [debouncedAnswers])
  const charCount = promptText.length
  const estimatedTokens = Math.ceil(charCount / 4)

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />

      {/* Drawer */}
      <div className="relative w-full max-w-md bg-white shadow-2xl flex flex-col animate-in slide-in-from-right">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <DocumentTextIcon className="w-5 h-5 text-primary" />
            <h3 className="font-bold text-slate-800">Prompt Gerado</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <XMarkIcon className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {charCount > 0 ? (
            <PromptRenderer text={promptText} />
          ) : (
            <div className="text-center py-12 text-slate-400">
              <DocumentTextIcon className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p className="text-sm">Preencha as fases do wizard para ver o prompt gerado.</p>
            </div>
          )}
        </div>

        {/* Footer — character/token count */}
        <div className="p-4 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <span>{charCount.toLocaleString()} caracteres</span>
          <span>~{estimatedTokens.toLocaleString()} tokens (estimativa)</span>
        </div>
      </div>
    </div>
  )
}

/* ================================= Prompt Renderer ================================= */

function PromptRenderer({ text }: { text: string }) {
  const lines = text.split('\n')

  return (
    <div className="space-y-0.5">
      {lines.map((line, i) => {
        // H2 headers (## IDENTIDADE)
        if (line.startsWith('## ')) {
          return (
            <h3
              key={i}
              className="text-sm font-bold text-slate-800 mt-5 mb-1.5 pb-1 border-b border-slate-100 first:mt-0"
            >
              {line.replace('## ', '')}
            </h3>
          )
        }

        // H3 headers (### Abertura)
        if (line.startsWith('### ')) {
          return (
            <h4 key={i} className="text-xs font-semibold text-slate-700 mt-3 mb-1">
              {line.replace('### ', '')}
            </h4>
          )
        }

        // Numbered list items (1. ESCUTA ATIVA: ...)
        if (/^\d+\.\s/.test(line)) {
          return (
            <p key={i} className="text-xs text-slate-600 pl-3 py-0.5">
              <BoldRenderer text={line} />
            </p>
          )
        }

        // Bullet list items (- "pergunta")
        if (line.startsWith('- ')) {
          return (
            <div key={i} className="flex gap-1.5 pl-3 py-0.5">
              <span className="text-slate-400 text-xs mt-0.5">&#8226;</span>
              <span className="text-xs text-slate-600">
                <BoldRenderer text={line.replace(/^- /, '')} />
              </span>
            </div>
          )
        }

        // Empty line
        if (line.trim() === '') {
          return <div key={i} className="h-1.5" />
        }

        // Regular text with bold rendering
        return (
          <p key={i} className="text-xs text-slate-600 py-0.5">
            <BoldRenderer text={line} />
          </p>
        )
      })}
    </div>
  )
}

/* ================================= Bold Renderer ================================= */

function BoldRenderer({ text }: { text: string }) {
  // Split on **bold** patterns
  const parts = text.split(/(\*\*[^*]+\*\*)/g)

  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return (
            <strong key={i} className="text-slate-700 font-semibold">
              {part.slice(2, -2)}
            </strong>
          )
        }
        return <span key={i}>{part}</span>
      })}
    </>
  )
}
