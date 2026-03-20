'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from '@/lib/firebaseClient'

function InvitePageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token')
  const [status, setStatus] = useState<'loading' | 'invalid' | 'redirecting'>('loading')
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    if (!token) {
      setStatus('invalid')
      setErrorMsg('Link de convite invalido. Token nao encontrado.')
      return
    }

    // Validate the token first
    fetch('/api/admin/members/resolve-invite-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json()
          setStatus('invalid')
          setErrorMsg(data.message || 'Convite nao encontrado ou ja foi utilizado.')
          return
        }

        // Token is valid — store it in localStorage and check auth
        localStorage.setItem('pendingInviteToken', token)

        // Check if user is already logged in
        const unsub = onAuthStateChanged(auth, (user) => {
          unsub()
          if (user) {
            // User logged in — redirect to app (layout will pick up the token)
            setStatus('redirecting')
            router.replace('/contatos')
          } else {
            // Not logged in — redirect to login
            setStatus('redirecting')
            router.replace('/login?invite=1')
          }
        })
      })
      .catch(() => {
        setStatus('invalid')
        setErrorMsg('Erro ao verificar convite. Tente novamente.')
      })
  }, [token, router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-8 max-w-md w-full text-center">
        {status === 'loading' && (
          <>
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary-100">
              <div className="h-7 w-7 animate-spin rounded-full border-4 border-primary-200 border-t-primary-600" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900 mb-1">Verificando convite...</h2>
            <p className="text-sm text-gray-500">Aguarde enquanto validamos seu convite de parceria.</p>
          </>
        )}

        {status === 'redirecting' && (
          <>
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100">
              <svg className="h-7 w-7 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-gray-900 mb-1">Convite valido!</h2>
            <p className="text-sm text-gray-500">Redirecionando para o aplicativo...</p>
          </>
        )}

        {status === 'invalid' && (
          <>
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-100">
              <svg className="h-7 w-7 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-gray-900 mb-1">Convite invalido</h2>
            <p className="text-sm text-gray-500 mb-6">{errorMsg}</p>
            <a
              href="/login"
              className="inline-flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white bg-primary-600 hover:bg-primary-700 shadow-sm transition active:scale-[0.99]"
            >
              Ir para o login
            </a>
          </>
        )}
      </div>
    </div>
  )
}

export default function InvitePage() {
  return (
    <Suspense>
      <InvitePageContent />
    </Suspense>
  )
}
