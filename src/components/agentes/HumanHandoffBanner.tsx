'use client'

import { UserIcon, SparklesIcon } from '@heroicons/react/24/outline'

interface HumanHandoffBannerProps {
  onResumeAI: () => void
  loading?: boolean
}

export default function HumanHandoffBanner({ onResumeAI, loading }: HumanHandoffBannerProps) {
  return (
    <div className="flex items-center justify-between px-4 py-3 bg-yellow-50 border-b border-yellow-200">
      <div className="flex items-center gap-2">
        <UserIcon className="w-4 h-4 text-yellow-400" />
        <span className="text-yellow-400 text-sm font-medium">
          Atendimento humano ativo
        </span>
        <span className="text-slate-400 text-xs">
          — O agente IA esta pausado nesta conversa
        </span>
      </div>
      <button
        onClick={onResumeAI}
        disabled={loading}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-50 hover:bg-[#13DEFC]/20 text-cyan-600 text-xs font-medium rounded-lg transition-colors disabled:opacity-50"
      >
        <SparklesIcon className="w-3.5 h-3.5" />
        Reativar IA
      </button>
    </div>
  )
}
