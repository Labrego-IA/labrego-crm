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
        <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-5">
          <svg
            className="w-8 h-8 text-amber-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
            />
          </svg>
        </div>

        {/* Title */}
        <h3 className="text-lg font-bold text-slate-800 mb-3">
          Plano Free
        </h3>

        {/* Description */}
        <p className="text-sm text-slate-600 mb-6 leading-relaxed">
          Você está no plano Free e não pode inserir, alterar ou excluir dados.
          Assine um plano para desbloquear todas as funcionalidades.
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
              router.push('/perfil')
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
