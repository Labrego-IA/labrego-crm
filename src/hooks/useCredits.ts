'use client'

import { useState, useEffect } from 'react'
import { db } from '@/lib/firebaseClient'
import { doc, onSnapshot } from 'firebase/firestore'
import type { PlanId } from '@/types/plan'

interface CreditSummary {
  actionBalance: number
  minuteBalance: number
  loading: boolean
}

/**
 * Hook real-time para saldo de créditos da organização.
 * Usa onSnapshot no Firestore para atualizar automaticamente.
 * Para plano free, retorna 0 sem consultar o Firestore.
 */
export function useCredits(orgId: string | undefined, orgPlan?: PlanId | null): CreditSummary {
  const [actionBalance, setActionBalance] = useState(0)
  const [minuteBalance, setMinuteBalance] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Plano free (ou sem plano) não tem créditos — retorna 0 sem consultar Firestore
    if (!orgId || !orgPlan || orgPlan === 'free') {
      setActionBalance(0)
      setMinuteBalance(0)
      setLoading(false)
      return
    }

    const balanceRef = doc(db, 'organizations', orgId, 'credits', 'balance')
    const unsubscribe = onSnapshot(
      balanceRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data()
          setActionBalance(data.actionBalance ?? 0)
          setMinuteBalance(data.balance ?? 0)
        } else {
          setActionBalance(0)
          setMinuteBalance(0)
        }
        setLoading(false)
      },
      (error) => {
        console.warn('[useCredits] Permission error (expected for some plans):', error.message)
        setActionBalance(0)
        setMinuteBalance(0)
        setLoading(false)
      }
    )

    return () => unsubscribe()
  }, [orgId, orgPlan])

  return { actionBalance, minuteBalance, loading }
}
