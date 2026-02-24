'use client'

import Image from 'next/image'
import { Loader2 } from 'lucide-react'

interface LoadingProps {
  full?: boolean
  message?: string
}

export default function Loading({ full = true, message = 'Carregando...' }: LoadingProps) {
  const containerClass = full
    ? 'fixed inset-0 z-50 flex flex-col items-center justify-center bg-white'
    : 'flex flex-col items-center justify-center p-4 bg-white'

  return (
    <div className={containerClass}>
      <Image
        src="/Logo Principal.png"
        alt="Logo"
        width={160}
        height={160}
        priority
        className="select-none mb-6"
      />
      <div className="flex items-center gap-3">
        <Loader2 className="h-5 w-5 animate-spin text-primary-600" />
        <span className="text-sm text-slate-600 font-medium">{message}</span>
      </div>
    </div>
  )
}
