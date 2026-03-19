'use client'

import { ReactNode } from 'react'
import { useCrmUser } from '@/contexts/CrmUserContext'

export default function AdminLayout({ children }: { children: ReactNode }) {
  const { member } = useCrmUser()

  // Aguarda carregar os dados do membro
  if (!member) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-[#13DEFC]" />
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6">
      {children}
    </div>
  )
}
