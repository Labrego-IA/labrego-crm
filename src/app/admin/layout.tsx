import { ReactNode } from 'react'

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="p-4 sm:p-6">
      {children}
    </div>
  )
}
