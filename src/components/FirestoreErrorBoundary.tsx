'use client'

import { Component, type ReactNode } from 'react'
import Link from 'next/link'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  errorMessage: string
}

/**
 * Error boundary que captura erros de Firestore (permission denied, etc.)
 * e exibe uma interface amigável em vez de crashar a página.
 */
export default class FirestoreErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, errorMessage: '' }
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      errorMessage: error.message || 'Erro desconhecido',
    }
  }

  componentDidCatch(error: Error) {
    console.warn('[FirestoreErrorBoundary] Caught error:', error.message)
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div className="flex items-center justify-center min-h-[60vh] px-6 py-16">
          <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-10 max-w-lg text-center">
            <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">
              Conteudo indisponivel
            </h3>
            <p className="text-sm text-slate-600 mb-6">
              Para acessar esta funcionalidade, faca o upgrade do seu plano.
            </p>
            <Link
              href="/admin/plano"
              className="inline-flex items-center px-5 py-2.5 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors"
            >
              Ver planos disponiveis
            </Link>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
