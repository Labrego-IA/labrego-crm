'use client'

import { useState } from 'react'
import { PlusIcon, TrashIcon, ChevronUpIcon, ChevronDownIcon } from '@heroicons/react/24/outline'
import type { FAQItem } from '@/types/agentConfig'

interface FAQManagerProps {
  items: FAQItem[]
  onChange: (items: FAQItem[]) => void
}

export default function FAQManager({ items, onChange }: FAQManagerProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const addItem = () => {
    const newItem: FAQItem = {
      id: `faq-${Date.now()}`,
      question: '',
      answer: '',
      order: items.length,
    }
    onChange([...items, newItem])
    setExpandedId(newItem.id)
  }

  const updateItem = (id: string, field: 'question' | 'answer' | 'category', value: string) => {
    onChange(items.map(item =>
      item.id === id ? { ...item, [field]: value } : item
    ))
  }

  const removeItem = (id: string) => {
    onChange(items.filter(item => item.id !== id))
    if (expandedId === id) setExpandedId(null)
  }

  const moveItem = (index: number, direction: 'up' | 'down') => {
    const newItems = [...items]
    const targetIndex = direction === 'up' ? index - 1 : index + 1
    if (targetIndex < 0 || targetIndex >= newItems.length) return
    ;[newItems[index], newItems[targetIndex]] = [newItems[targetIndex], newItems[index]]
    newItems.forEach((item, i) => { item.order = i })
    onChange(newItems)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white">Perguntas Frequentes (FAQ)</h3>
          <p className="text-white/50 text-sm">Cadastre perguntas e respostas para o agente usar como referencia.</p>
        </div>
        <button
          onClick={addItem}
          className="flex items-center gap-2 px-4 py-2 bg-[#13DEFC]/10 hover:bg-[#13DEFC]/20 text-[#13DEFC] font-medium rounded-xl transition-colors text-sm"
        >
          <PlusIcon className="w-4 h-4" />
          Adicionar
        </button>
      </div>

      {items.length === 0 && (
        <div className="text-center py-8 bg-slate-800/30 rounded-xl border border-dashed border-slate-700">
          <p className="text-white/40">Nenhuma pergunta cadastrada ainda.</p>
          <p className="text-white/30 text-sm mt-1">Clique em &quot;Adicionar&quot; para comecar.</p>
        </div>
      )}

      <div className="space-y-2">
        {items.map((item, index) => (
          <div key={item.id} className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden">
            {/* Header */}
            <div
              className="flex items-center gap-3 p-4 cursor-pointer hover:bg-slate-700/30 transition-colors"
              onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
            >
              <span className="text-white/40 text-sm font-mono w-6">#{index + 1}</span>
              <span className="flex-1 text-white/80 text-sm truncate">
                {item.question || 'Nova pergunta...'}
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={(e) => { e.stopPropagation(); moveItem(index, 'up') }}
                  disabled={index === 0}
                  className="p-1 text-white/30 hover:text-white/60 disabled:opacity-30"
                >
                  <ChevronUpIcon className="w-4 h-4" />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); moveItem(index, 'down') }}
                  disabled={index === items.length - 1}
                  className="p-1 text-white/30 hover:text-white/60 disabled:opacity-30"
                >
                  <ChevronDownIcon className="w-4 h-4" />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); removeItem(item.id) }}
                  className="p-1 text-red-400/50 hover:text-red-400"
                >
                  <TrashIcon className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Content */}
            {expandedId === item.id && (
              <div className="px-4 pb-4 space-y-3 border-t border-slate-700/50 pt-3">
                <div>
                  <label className="block text-white/50 text-xs font-medium mb-1">Pergunta</label>
                  <input
                    type="text"
                    value={item.question}
                    onChange={(e) => updateItem(item.id, 'question', e.target.value)}
                    placeholder="Ex: Qual o prazo de entrega?"
                    className="w-full px-3 py-2 bg-slate-900/50 border border-slate-600 rounded-lg text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-[#13DEFC]/50"
                  />
                </div>
                <div>
                  <label className="block text-white/50 text-xs font-medium mb-1">Resposta</label>
                  <textarea
                    value={item.answer}
                    onChange={(e) => updateItem(item.id, 'answer', e.target.value)}
                    placeholder="Ex: Nosso prazo de entrega e de 3 a 5 dias uteis..."
                    rows={3}
                    className="w-full px-3 py-2 bg-slate-900/50 border border-slate-600 rounded-lg text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-[#13DEFC]/50 resize-none"
                  />
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {items.length > 0 && (
        <p className="text-white/30 text-xs text-center">
          {items.length} pergunta{items.length > 1 ? 's' : ''} cadastrada{items.length > 1 ? 's' : ''}
        </p>
      )}
    </div>
  )
}
