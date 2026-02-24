import { getAdminDb } from './firebaseAdmin'
import { FieldValue } from 'firebase-admin/firestore'
import type { CreditBalance, CreditTransaction } from '@/types/credits'

function getCreditsRef(orgId: string) {
  const db = getAdminDb()
  return db.collection('organizations').doc(orgId).collection('credits').doc('balance')
}

function getTransactionsRef(orgId: string) {
  const db = getAdminDb()
  return db.collection('organizations').doc(orgId).collection('creditTransactions')
}

export async function getCreditBalance(orgId: string): Promise<CreditBalance> {
  const doc = await getCreditsRef(orgId).get()
  if (!doc.exists) {
    return { balance: 0, totalPurchased: 0, totalConsumed: 0 }
  }
  return doc.data() as CreditBalance
}

export async function hasCredits(orgId: string, requiredMinutes: number = 1): Promise<boolean> {
  const credits = await getCreditBalance(orgId)
  return credits.balance >= requiredMinutes
}

export async function addCredits(orgId: string, amount: number, type: 'purchase' | 'bonus' | 'adjustment', description: string, adminEmail?: string): Promise<CreditTransaction> {
  const now = new Date().toISOString()

  // Atomic increment
  await getCreditsRef(orgId).update({
    balance: FieldValue.increment(amount),
    totalPurchased: FieldValue.increment(amount),
    lastRechargeAt: now,
  })

  // Get new balance
  const newBalance = await getCreditBalance(orgId)

  // Record transaction
  const txData = {
    orgId,
    type,
    amount,
    balance: newBalance.balance,
    description,
    adminEmail: adminEmail || '',
    createdAt: now,
  }

  const txRef = getTransactionsRef(orgId).doc()
  await txRef.set(txData)

  return { id: txRef.id, ...txData }
}

export async function deductCredits(orgId: string, minutes: number, callId?: string, description?: string): Promise<CreditTransaction> {
  const now = new Date().toISOString()
  const deduction = Math.ceil(minutes) // round up

  // Atomic decrement
  await getCreditsRef(orgId).update({
    balance: FieldValue.increment(-deduction),
    totalConsumed: FieldValue.increment(deduction),
    lastConsumedAt: now,
  })

  // Get new balance
  const newBalance = await getCreditBalance(orgId)

  // Record transaction
  const txData = {
    orgId,
    type: 'consumption' as const,
    amount: -deduction,
    balance: newBalance.balance,
    description: description || `Ligacao: ${deduction} minuto(s)`,
    callId: callId || '',
    createdAt: now,
  }

  const txRef = getTransactionsRef(orgId).doc()
  await txRef.set(txData)

  return { id: txRef.id, ...txData }
}

export async function getTransactions(orgId: string, limit: number = 50): Promise<CreditTransaction[]> {
  const snap = await getTransactionsRef(orgId).orderBy('createdAt', 'desc').limit(limit).get()
  return snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as CreditTransaction))
}
