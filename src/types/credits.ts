export interface CreditBalance {
  balance: number // minutes available
  totalPurchased: number
  totalConsumed: number
  lastRechargeAt?: string
  lastConsumedAt?: string
}

export interface CreditTransaction {
  id: string
  orgId: string
  type: 'purchase' | 'consumption' | 'adjustment' | 'bonus'
  amount: number // positive for addition, negative for consumption
  balance: number // balance after transaction
  description: string
  callId?: string // for consumption type
  adminEmail?: string // who performed the action
  createdAt: string
}
