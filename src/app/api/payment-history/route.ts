import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { getAdminDb } from '@/lib/firebaseAdmin'
import { PLAN_DISPLAY } from '@/types/plan'
import type { PlanId } from '@/types/plan'

export interface PaymentHistoryItem {
  id: string
  type: 'payment' | 'renewal' | 'cancellation'
  planId: string
  planName: string
  amount: number // in BRL cents
  currency: string
  status: string
  date: string // ISO string
  periodStart: string | null
  periodEnd: string | null
  invoiceUrl: string | null
  cancelledAt: string | null
}

export async function GET(req: NextRequest) {
  try {
    const orgId = req.nextUrl.searchParams.get('orgId')

    if (!orgId) {
      return NextResponse.json(
        { error: 'Parametro obrigatorio: orgId' },
        { status: 400 }
      )
    }

    const db = getAdminDb()
    const orgRef = db.collection('organizations').doc(orgId)
    const orgSnap = await orgRef.get()

    if (!orgSnap.exists) {
      return NextResponse.json(
        { error: 'Organizacao nao encontrada' },
        { status: 404 }
      )
    }

    const orgData = orgSnap.data()!
    const stripeCustomerId = orgData.stripeCustomerId as string | undefined

    if (!stripeCustomerId) {
      return NextResponse.json({ items: [] })
    }

    // Fetch invoices from Stripe
    const invoices = await stripe.invoices.list({
      customer: stripeCustomerId,
      limit: 100,
      expand: ['data.subscription'],
    })

    const items: PaymentHistoryItem[] = []

    for (const invoice of invoices.data) {
      const subscription = invoice.subscription as any
      const planId = subscription?.metadata?.planId || orgData.plan || 'free'
      const planDisplay = PLAN_DISPLAY[planId as PlanId]
      const planName = planDisplay?.displayName || planId

      let type: PaymentHistoryItem['type'] = 'payment'

      // Determine if this is a renewal (not the first invoice for this subscription)
      if (invoice.billing_reason === 'subscription_cycle') {
        type = 'renewal'
      } else if (invoice.billing_reason === 'subscription_create') {
        type = 'payment'
      }

      items.push({
        id: invoice.id,
        type,
        planId,
        planName,
        amount: invoice.amount_paid,
        currency: invoice.currency,
        status: invoice.status || 'unknown',
        date: new Date((invoice.created || 0) * 1000).toISOString(),
        periodStart: invoice.period_start
          ? new Date(invoice.period_start * 1000).toISOString()
          : null,
        periodEnd: invoice.period_end
          ? new Date(invoice.period_end * 1000).toISOString()
          : null,
        invoiceUrl: invoice.hosted_invoice_url || null,
        cancelledAt: null,
      })
    }

    // Fetch cancelled subscriptions
    const subscriptions = await stripe.subscriptions.list({
      customer: stripeCustomerId,
      status: 'canceled',
      limit: 100,
    })

    for (const sub of subscriptions.data) {
      const planId = sub.metadata?.planId || orgData.plan || 'free'
      const planDisplay = PLAN_DISPLAY[planId as PlanId]
      const planName = planDisplay?.displayName || planId

      items.push({
        id: `cancel_${sub.id}`,
        type: 'cancellation',
        planId,
        planName,
        amount: 0,
        currency: 'brl',
        status: 'canceled',
        date: sub.canceled_at
          ? new Date(sub.canceled_at * 1000).toISOString()
          : new Date(sub.created * 1000).toISOString(),
        periodStart: new Date(sub.created * 1000).toISOString(),
        periodEnd: sub.canceled_at
          ? new Date(sub.canceled_at * 1000).toISOString()
          : null,
        invoiceUrl: null,
        cancelledAt: sub.canceled_at
          ? new Date(sub.canceled_at * 1000).toISOString()
          : null,
      })
    }

    // Sort by date descending (most recent first)
    items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

    return NextResponse.json({ items })
  } catch (error: any) {
    console.error('[api/payment-history] GET error:', error)
    return NextResponse.json(
      { error: error.message || 'Erro ao buscar historico de pagamentos' },
      { status: 500 }
    )
  }
}
