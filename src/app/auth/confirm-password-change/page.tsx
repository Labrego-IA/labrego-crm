'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'

type Status = 'loading' | 'success' | 'error'

function ConfirmPasswordChangeContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const token = searchParams.get('token')

  const [status, setStatus] = useState<Status>('loading')
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!token) {
      setStatus('error')
      setMessage('Link inválido. Verifique o link no seu email.')
      return
    }

    async function confirmChange() {
      try {
        const res = await fetch(`/api/profile/confirm-password-change?token=${token}`)
        const data = await res.json()

        if (res.ok && data.success) {
          setStatus('success')
          setMessage('Senha alterada com sucesso!')
          setTimeout(() => router.push('/perfil'), 3000)
        } else {
          setStatus('error')
          setMessage(data.error || 'Erro ao confirmar a troca de senha.')
        }
      } catch {
        setStatus('error')
        setMessage('Erro de conexão. Tente novamente.')
      }
    }

    confirmChange()
  }, [token, router])

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-8 max-w-md w-full text-center">
        {status === 'loading' && (
          <>
            <div className="w-16 h-16 rounded-full bg-primary-100 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-primary-600 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">Confirmando troca de senha...</h2>
            <p className="text-sm text-slate-500">Aguarde um momento.</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">Senha alterada com sucesso!</h2>
            <p className="text-sm text-slate-500 mb-4">{message}</p>
            <p className="text-sm text-slate-400">Você será redirecionado para o perfil em instantes...</p>
            <Link
              href="/perfil"
              className="inline-flex items-center gap-2 mt-4 px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-primary-600 hover:bg-primary-700 transition-colors"
            >
              Ir para o Perfil
            </Link>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">Não foi possível confirmar</h2>
            <p className="text-sm text-slate-500 mb-4">{message}</p>
            <Link
              href="/perfil"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-primary-600 bg-primary-50 border border-primary-200 hover:bg-primary-100 transition-colors"
            >
              Voltar ao Perfil
            </Link>
          </>
        )}
      </div>
    </div>
  )
}

export default function ConfirmPasswordChangePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-50 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
        </div>
      }
    >
      <ConfirmPasswordChangeContent />
    </Suspense>
  )
}
