'use client'

import { UserIcon, SparklesIcon } from '@heroicons/react/24/outline'

interface HumanHandoffBannerProps {
  onResumeAI: () => void
  loading?: boolean
}

export default function HumanHandoffBanner({ onResumeAI, loading }: HumanHandoffBannerProps) {
  return (
    <div className="flex items-center justify-between px-4 py-3 bg-yellow-500/10 border-b border-yellow-500/20">
      <div className="flex items-center gap-2">
        <UserIcon className="w-4 h-4 text-yellow-400" />
        <span className="text-yellow-400 text-sm font-medium">
          Atendimento humano ativo
        </span>
        <span className="text-white/40 text-xs">
          — O agente IA esta pausado nesta conversa
        </span>
      </div>
      <button
        onClick={onResumeAI}
        disabled={loading}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-[#13DEFC]/10 hover:bg-[#13DEFC]/20 text-[#13DEFC] text-xs font-medium rounded-lg transition-colors disabled:opacity-50"
      >
        <SparklesIcon className="w-3.5 h-3.5" />
        Reativar IA
      </button>
    </div>
  )
}
