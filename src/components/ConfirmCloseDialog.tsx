'use client'

import { createPortal } from 'react-dom'
import { useEffect, useState } from 'react'
import { ExclamationTriangleIcon } from '@radix-ui/react-icons'

interface ConfirmCloseDialogProps {
  isOpen: boolean
  onConfirm: () => void
  onCancel: () => void
  title?: string
  message?: string
  confirmText?: string
  cancelText?: string
}

export default function ConfirmCloseDialog({
  isOpen,
  onConfirm,
  onCancel,
  title = 'Dados não salvos',
  message = 'Você tem alterações não salvas. Tem certeza que deseja fechar e perder os dados?',
  confirmText = 'Sim, fechar',
  cancelText = 'Continuar editando'
}: ConfirmCloseDialogProps) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!isOpen || !mounted) return null

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center"
      onClick={onCancel}
    >
      <div className="absolute inset-0 bg-slate-900/70 backdrop-blur-sm" />
      <div
        className="relative bg-slate-800 border border-slate-700 rounded-2xl p-6 w-full max-w-sm mx-4 shadow-2xl animate-in fade-in zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex flex-col items-center text-center">
          <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mb-4">
            <ExclamationTriangleIcon className="w-6 h-6 text-red-400" />
          </div>
          <h3 className="text-lg font-semibold text-white mb-2">
            {title}
          </h3>
          <p className="text-sm text-white/60 mb-6">
            {message}
          </p>
          <div className="flex gap-3 w-full">
            <button
              onClick={onCancel}
              className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium text-white/70 bg-slate-700 hover:bg-slate-600 transition-colors duration-200"
            >
              {cancelText}
            </button>
            <button
              onClick={onConfirm}
              className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium text-white bg-red-500 hover:bg-red-600 transition-colors duration-200"
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
