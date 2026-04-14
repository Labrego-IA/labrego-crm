'use client'

import Image from 'next/image'
import { Loader2 } from 'lucide-react'

interface LoadingProps {
  full?: boolean
  message?: string
}

export default function Loading({ full = true, message = 'Carregando...' }: LoadingProps) {
  const containerClass = full
    ? 'fixed inset-0 z-50 flex flex-col items-center justify-center bg-white dark:bg-dark'
    : 'flex flex-col items-center justify-center p-4 bg-white dark:bg-dark'

  return (
    <div className={containerClass}>
      <Image src="/logo-voxium.png" alt="Voxium" width={160} height={53} className="object-contain mb-6 select-none" />
      <div className="flex items-center gap-3">
        <Loader2 className="h-5 w-5 animate-spin text-primary-600" />
        <span className="text-sm text-slate-600 dark:text-slate-400 font-medium">{message}</span>
      </div>
    </div>
  )
}
