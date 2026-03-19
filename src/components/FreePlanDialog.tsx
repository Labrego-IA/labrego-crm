'use client'

import { useRouter } from 'next/navigation'

interface FreePlanDialogProps {
  isOpen: boolean
  onClose: () => void
}

export default function FreePlanDialog({ isOpen, onClose }: FreePlanDialogProps) {
  const router = useRouter()

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md m-4 p-8 text-center animate-in zoom-in-95 fade-in duration-200">
        {/* Warning icon */}
        <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-5">
          <svg
            className="w-8 h-8 text-red-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
            />
          </svg>
        </div>

        {/* Title */}
        <h3 className="text-lg font-bold text-slate-800 mb-3">
          Periodo de teste expirado
        </h3>

        {/* Description */}
        <p className="text-sm text-slate-600 mb-6 leading-relaxed">
          Seu periodo gratuito de 7 dias chegou ao fim.
          Assine um plano para continuar usando todas as funcionalidades.
        </p>

        {/* Buttons */}
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={onClose}
            className="px-5 py-2.5 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
          >
            Fechar
          </button>
          <button
            onClick={() => {
              onClose()
              router.push('/plano')
            }}
            className="px-5 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-primary-600 to-purple-600 hover:from-primary-700 hover:to-purple-700 rounded-xl transition-all shadow-lg shadow-primary-200"
          >
            Ver planos
          </button>
        </div>
      </div>
    </div>
  )
}
