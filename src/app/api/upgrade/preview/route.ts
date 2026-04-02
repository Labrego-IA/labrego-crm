import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { getAdminDb } from '@/lib/firebaseAdmin'
import { getStripePriceId, isPaidPlan } from '@/lib/stripePrices'
import { PLAN_LIMITS, PLAN_DISPLAY } from '@/types/plan'
import type { PlanId } from '@/types/plan'
import type Stripe from 'stripe'

function isValidPlan(plan: string): plan is PlanId {
  return plan in PLAN_LIMITS
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { orgId, newPlanId } = body

    if (!orgId || !newPlanId) {
      return NextResponse.json(
        { error: 'Campos obrigatorios: orgId, newPlanId' },
        { status: 400 }
      )
    }

    if (!isValidPlan(newPlanId)) {
      return NextResponse.json({ error: 'Plano invalido' }, { status: 400 })
    }

    if (!isPaidPlan(newPlanId)) {
      return NextResponse.json({ error: 'Plano gratuito nao requer pagamento' }, { status: 400 })
    }

    const newPriceId = getStripePriceId(newPlanId)
    if (!newPriceId) {
      return NextResponse.json(
        { error: 'Price ID nao configurado para este plano' },
        { status: 500 }
      )
    }

    // Buscar org no Firestore
    const db = getAdminDb()
    const orgSnap = await db.collection('organizations').doc(orgId).get()

    if (!orgSnap.exists) {
      return NextResponse.json({ error: 'Organizacao nao encontrada' }, { status: 404 })
    }

    const orgData = orgSnap.data()
    const stripeSubscriptionId = orgData?.stripeSubscriptionId

    if (!stripeSubscriptionId) {
      return NextResponse.json(
        { error: 'Organizacao nao possui assinatura ativa' },
        { status: 400 }
      )
    }

    // Buscar subscription atual no Stripe
    const subscription = await stripe.subscriptions.retrieve(stripeSubscriptionId)

    if (subscription.status !== 'active') {
      return NextResponse.json(
        { error: 'Assinatura nao esta ativa' },
        { status: 400 }
      )
    }

    const currentItem = subscription.items.data[0]
    if (!currentItem) {
      return NextResponse.json(
        { error: 'Nenhum item encontrado na assinatura' },
        { status: 400 }
      )
    }

    // Usar Stripe para calcular o preview da proration
    const proration = await stripe.invoices.createPreview({
      customer: subscription.customer as string,
      subscription: stripeSubscriptionId,
      subscription_items: [
        {
          id: currentItem.id,
          price: newPriceId,
        },
      ],
      subscription_proration_behavior: 'create_prorations',
    })

    // Calcular valores
    const currentPlanId = orgData?.plan as PlanId
    const currentDisplay = PLAN_DISPLAY[currentPlanId]
    const newDisplay = PLAN_DISPLAY[newPlanId]

    // Extrair linhas de proration do invoice preview
    const prorationLines = proration.lines.data.filter(
      (line: Stripe.InvoiceLineItem) => line.proration
    )

    // Valor total da proration (credito do plano atual + debito do novo plano)
    const prorationAmount = prorationLines.reduce(
      (sum: number, line: Stripe.InvoiceLineItem) => sum + line.amount,
      0
    )

    // Calcular dias restantes
    const now = Math.floor(Date.now() / 1000)
    const periodEnd = subscription.items.data[0]?.current_period_end ?? now
    const periodStart = subscription.items.data[0]?.current_period_start ?? now
    const totalDays = Math.ceil((periodEnd - periodStart) / 86400)
    const remainingDays = Math.max(0, Math.ceil((periodEnd - now) / 86400))

    return NextResponse.json({
      currentPlan: {
        id: currentPlanId,
        name: currentDisplay?.displayName || currentPlanId,
        price: currentDisplay?.price || 0,
      },
      newPlan: {
        id: newPlanId,
        name: newDisplay?.displayName || newPlanId,
        price: newDisplay?.price || 0,
      },
      proration: {
        // Valor em centavos convertido para reais
        amountDue: Math.max(0, proration.amount_due / 100),
        // Credito do plano atual (valor negativo = credito)
        credit: Math.abs(
          prorationLines
            .filter((l: Stripe.InvoiceLineItem) => l.amount < 0)
            .reduce((sum: number, l: Stripe.InvoiceLineItem) => sum + l.amount, 0)
        ) / 100,
        // Debito do novo plano
        debit: prorationLines
          .filter((l: Stripe.InvoiceLineItem) => l.amount > 0)
          .reduce((sum: number, l: Stripe.InvoiceLineItem) => sum + l.amount, 0) / 100,
        totalDays,
        remainingDays,
      },
      // Subtotal do invoice preview
      subtotal: proration.subtotal / 100,
      total: proration.total / 100,
    })
  } catch (error: any) {
    console.error('[api/upgrade/preview] POST error:', error)
    return NextResponse.json(
      { error: error.message || 'Erro ao calcular preview do upgrade' },
      { status: 500 }
    )
  }
}
