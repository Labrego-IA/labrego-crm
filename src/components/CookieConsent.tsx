'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

export default function CookieConsent() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const consent = localStorage.getItem('cookie_consent')
    if (!consent) setVisible(true)
  }, [])

  const accept = (type: 'all' | 'essential') => {
    localStorage.setItem('cookie_consent', type)
    document.cookie = `cookie_consent=${type}; path=/; max-age=${365 * 24 * 60 * 60}; SameSite=Lax`
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[100] p-4">
      <div className="max-w-4xl mx-auto bg-white border border-slate-200 rounded-2xl shadow-xl p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <div className="flex-1">
          <p className="text-sm text-slate-700 font-medium">Este site utiliza cookies</p>
          <p className="text-xs text-slate-500 mt-1">
            Usamos cookies para melhorar sua experiencia. Ao continuar, voce concorda com nossa{' '}
            <Link href="/privacidade" className="text-cyan-600 hover:underline">Politica de Privacidade</Link>.
          </p>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <button
            onClick={() => accept('essential')}
            className="px-4 py-2 text-sm font-medium text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
          >
            Apenas essenciais
          </button>
          <button
            onClick={() => accept('all')}
            className="px-4 py-2 text-sm font-medium text-white bg-cyan-600 rounded-lg hover:bg-cyan-700 transition-colors"
          >
            Aceitar todos
          </button>
        </div>
      </div>
    </div>
  )
}
