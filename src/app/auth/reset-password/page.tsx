'use client'

import { useState, useEffect, Suspense } from 'react'
import { confirmPasswordReset, verifyPasswordResetCode } from 'firebase/auth'
import { auth } from '@/lib/firebaseClient'
import { toast } from 'sonner'
import Link from 'next/link'
import { useSearchParams, useRouter } from 'next/navigation'

function ResetPasswordForm() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const oobCode = searchParams.get('oobCode')

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [verifying, setVerifying] = useState(true)
  const [email, setEmail] = useState('')
  const [invalidCode, setInvalidCode] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  useEffect(() => {
    async function verifyCode() {
      if (!oobCode) {
        setInvalidCode(true)
        setVerifying(false)
        return
      }

      try {
        const userEmail = await verifyPasswordResetCode(auth, oobCode)
        setEmail(userEmail)
      } catch {
        setInvalidCode(true)
      } finally {
        setVerifying(false)
      }
    }

    verifyCode()
  }, [oobCode])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (password.length < 6) {
      toast.error('A senha deve ter pelo menos 6 caracteres.')
      return
    }

    if (password !== confirmPassword) {
      toast.error('As senhas não coincidem.')
      return
    }

    if (!oobCode) return

    setLoading(true)

    try {
      await confirmPasswordReset(auth, oobCode, password)
      toast.success('Senha alterada com sucesso! Redirecionando para o login...')
      setTimeout(() => {
        router.push('/login')
      }, 2000)
    } catch (err: any) {
      const code = err?.code || ''
      if (code === 'auth/expired-action-code') {
        toast.error('Este link expirou. Solicite um novo link de recuperação.')
      } else if (code === 'auth/invalid-action-code') {
        toast.error('Este link é inválido ou já foi utilizado.')
      } else if (code === 'auth/weak-password') {
        toast.error('A senha é muito fraca. Use pelo menos 6 caracteres.')
      } else {
        toast.error('Erro ao redefinir senha. Tente novamente.')
      }
    } finally {
      setLoading(false)
    }
  }

  if (verifying) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex flex-col items-center gap-4">
          <svg className="animate-spin h-8 w-8 text-[#13DEFC]" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <p className="text-sm text-slate-400">Verificando link...</p>
        </div>
      </div>
    )
  }

  if (invalidCode) {
    return (
      <div className="space-y-5">
        <div className="flex justify-center">
          <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="15" y1="9" x2="9" y2="15" />
              <line x1="9" y1="9" x2="15" y2="15" />
            </svg>
          </div>
        </div>

        <div className="text-center space-y-2">
          <h3 className="text-lg font-semibold text-white">Link invalido ou expirado</h3>
          <p className="text-sm text-slate-400">
            Este link de recuperacao nao e valido ou ja foi utilizado. Solicite um novo link.
          </p>
        </div>

        <Link
          href="/reset-password"
          className="block w-full text-center bg-gradient-to-r from-[#13DEFC] to-[#09B00F] hover:from-[#11c8e3] hover:to-[#089e0d] text-slate-950 font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-[#13DEFC]/10 hover:shadow-[#13DEFC]/20"
        >
          Solicitar novo link
        </Link>

        <Link
          href="/login"
          className="block w-full text-center text-sm text-slate-400 hover:text-white font-medium py-2 transition-colors"
        >
          Voltar ao login
        </Link>
      </div>
    )
  }

  return (
    <>
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-white">
          Redefinir senha
        </h2>
        <p className="text-sm text-slate-400 mt-1">
          {email && (
            <>Digite a nova senha para <span className="text-white font-medium">{email}</span></>
          )}
          {!email && 'Digite sua nova senha abaixo'}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label htmlFor="new-password" className="block text-sm font-medium text-slate-300 mb-2">
            Nova senha
          </label>
          <div className="relative">
            <input
              id="new-password"
              type={showPassword ? 'text' : 'password'}
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-white/[0.06] px-4 py-3 pr-12 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#13DEFC]/40 focus:border-[#13DEFC]/40 transition-all"
              placeholder="Minimo 6 caracteres"
              autoFocus
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
              tabIndex={-1}
            >
              {showPassword ? (
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                  <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                  <line x1="1" y1="1" x2="23" y2="23" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              )}
            </button>
          </div>
        </div>

        <div>
          <label htmlFor="confirm-password" className="block text-sm font-medium text-slate-300 mb-2">
            Confirmar nova senha
          </label>
          <div className="relative">
            <input
              id="confirm-password"
              type={showConfirmPassword ? 'text' : 'password'}
              required
              minLength={6}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-white/[0.06] px-4 py-3 pr-12 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#13DEFC]/40 focus:border-[#13DEFC]/40 transition-all"
              placeholder="Repita a nova senha"
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
              tabIndex={-1}
            >
              {showConfirmPassword ? (
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                  <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                  <line x1="1" y1="1" x2="23" y2="23" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {password && confirmPassword && password !== confirmPassword && (
          <p className="text-xs text-red-400">As senhas nao coincidem.</p>
        )}

        <button
          type="submit"
          disabled={loading || !password || !confirmPassword}
          className="w-full bg-gradient-to-r from-[#13DEFC] to-[#09B00F] hover:from-[#11c8e3] hover:to-[#089e0d] disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-[#13DEFC]/10 hover:shadow-[#13DEFC]/20"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Redefinindo...
            </span>
          ) : (
            'Confirmar nova senha'
          )}
        </button>

        <Link
          href="/login"
          className="block w-full text-center text-sm text-slate-400 hover:text-white font-medium py-2 transition-colors"
        >
          Voltar ao login
        </Link>
      </form>
    </>
  )
}

export default function AuthResetPasswordPage() {
  return (
    <div className="min-h-screen flex bg-slate-950 relative overflow-hidden">
      {/* Background decorative elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `linear-gradient(rgba(19,222,252,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(19,222,252,0.3) 1px, transparent 1px)`,
            backgroundSize: '60px 60px',
          }}
        />
        {/* Glow orbs */}
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-[#13DEFC]/10 rounded-full blur-[120px]" />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-[#09B00F]/10 rounded-full blur-[120px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#13DEFC]/5 rounded-full blur-[160px]" />
      </div>

      {/* Left side — Hero/Branding (hidden on mobile) */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-center items-center relative px-16">
        <div className="max-w-md space-y-8">
          {/* Logo */}
          <div>
            <h1 className="text-6xl font-black bg-gradient-to-r from-[#13DEFC] to-[#09B00F] bg-clip-text text-transparent tracking-tight">
              Voxium
            </h1>
            <div className="h-1 w-20 bg-gradient-to-r from-[#13DEFC] to-[#09B00F] rounded-full mt-4" />
          </div>

          {/* Tagline */}
          <div className="space-y-4">
            <h2 className="text-2xl font-semibold text-white/90 leading-relaxed">
              Acelere suas vendas com inteligencia artificial
            </h2>
            <p className="text-base text-slate-400 leading-relaxed">
              CRM inteligente com agentes de voz IA, automacao de cadencias e gestao completa do seu funil de vendas.
            </p>
          </div>

          {/* Feature highlights */}
          <div className="space-y-4 pt-4">
            {[
              { icon: '\u{1F3AF}', text: 'Funis de vendas inteligentes' },
              { icon: '\u{1F916}', text: 'Agentes de voz com IA' },
              { icon: '\u26A1', text: 'Automacao de cadencias' },
              { icon: '\u{1F4CA}', text: 'Analytics em tempo real' },
            ].map((feature) => (
              <div key={feature.text} className="flex items-center gap-3">
                <span className="text-lg">{feature.icon}</span>
                <span className="text-sm text-slate-300">{feature.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right side — Reset password form */}
      <div className="flex-1 flex items-center justify-center px-6 py-12 relative">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="lg:hidden text-center mb-10">
            <h1 className="text-4xl font-black bg-gradient-to-r from-[#13DEFC] to-[#09B00F] bg-clip-text text-transparent tracking-tight">
              Voxium
            </h1>
            <p className="text-sm text-slate-400 mt-2">Acelere suas vendas com IA</p>
          </div>

          {/* Glass card */}
          <div className="backdrop-blur-xl bg-white/[0.04] border border-white/[0.08] rounded-3xl p-8 shadow-[0_0_60px_rgba(19,222,252,0.06)]">
            <Suspense fallback={
              <div className="flex items-center justify-center py-20">
                <svg className="animate-spin h-8 w-8 text-[#13DEFC]" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              </div>
            }>
              <ResetPasswordForm />
            </Suspense>
          </div>

          {/* Footer */}
          <p className="text-center text-xs text-slate-600 mt-8">
            &copy; {new Date().getFullYear()} Voxium. Todos os direitos reservados.
          </p>
        </div>
      </div>
    </div>
  )
}
