import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { getStripePriceId, isPaidPlan } from '@/lib/stripePrices'
import { PLAN_DISPLAY, PLAN_LIMITS } from '@/types/plan'
import type { PlanId } from '@/types/plan'

function isValidPlan(plan: string): plan is PlanId {
  return plan in PLAN_LIMITS
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { planId, orgId, userEmail, userName, userPhone } = body

    if (!planId || !orgId || !userEmail) {
      return NextResponse.json(
        { error: 'Campos obrigatorios: planId, orgId, userEmail' },
        { status: 400 }
      )
    }

    if (!isValidPlan(planId)) {
      return NextResponse.json({ error: 'Plano invalido' }, { status: 400 })
    }

    if (!isPaidPlan(planId)) {
      return NextResponse.json({ error: 'Plano gratuito nao requer pagamento' }, { status: 400 })
    }

    const priceId = getStripePriceId(planId)
    if (!priceId) {
      return NextResponse.json(
        { error: 'Price ID nao configurado para este plano. Configure NEXT_PUBLIC_STRIPE_PRICE_* no .env' },
        { status: 500 }
      )
    }

    const display = PLAN_DISPLAY[planId]
    const origin = req.headers.get('origin') || ''

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card', 'boleto'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      customer_email: userEmail,
      metadata: {
        orgId,
        planId,
        userEmail,
        userName: userName || '',
        userPhone: userPhone || '',
      },
      subscription_data: {
        metadata: {
          orgId,
          planId,
        },
      },
      billing_address_collection: 'required',
      phone_number_collection: {
        enabled: true,
      },
      custom_fields: [
        {
          key: 'cpf_cnpj',
          label: { type: 'custom', custom: 'CPF ou CNPJ' },
          type: 'text',
        },
        {
          key: 'company_name',
          label: { type: 'custom', custom: 'Nome da empresa' },
          type: 'text',
          optional: true,
        },
      ],
      locale: 'pt-BR',
      success_url: `${origin}/checkout/sucesso?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/checkout/cancelado?plan=${planId}`,
      allow_promotion_codes: true,
    })

    return NextResponse.json({
      url: session.url,
      sessionId: session.id,
    })
  } catch (error: any) {
    console.error('[api/checkout] POST error:', error)
    return NextResponse.json(
      { error: error.message || 'Erro ao criar sessao de checkout' },
      { status: 500 }
    )
  }
}
