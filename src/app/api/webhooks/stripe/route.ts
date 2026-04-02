import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { getAdminDb } from '@/lib/firebaseAdmin'
import { PLAN_LIMITS, PLAN_DISPLAY } from '@/types/plan'
import type { PlanId } from '@/types/plan'
import type Stripe from 'stripe'

function isValidPlan(plan: string): plan is PlanId {
  return plan in PLAN_LIMITS
}

async function handleCheckoutComplete(session: Stripe.Checkout.Session) {
  const orgId = session.metadata?.orgId
  const planId = session.metadata?.planId
  const userEmail = session.metadata?.userEmail

  if (!orgId || !planId || !userEmail) {
    console.error('[stripe-webhook] Missing metadata in session:', session.id)
    return
  }

  if (!isValidPlan(planId)) {
    console.error('[stripe-webhook] Invalid plan in metadata:', planId)
    return
  }

  const db = getAdminDb()
  const orgRef = db.collection('organizations').doc(orgId)
  const orgSnap = await orgRef.get()

  if (!orgSnap.exists) {
    console.error('[stripe-webhook] Organization not found:', orgId)
    return
  }

  const newLimits = PLAN_LIMITS[planId]
  const now = new Date().toISOString()

  await orgRef.update({
    plan: planId,
    limits: {
      maxUsers: newLimits.maxUsers,
      maxFunnels: newLimits.maxFunnels,
      maxContacts: newLimits.maxContacts,
    },
    stripeCustomerId: session.customer as string,
    stripeSubscriptionId: session.subscription as string,
    planSubscribedAt: now,
    updatedAt: now,
  })

  const allMembersSnap = await orgRef.collection('members').get()
  const batch = db.batch()

  allMembersSnap.docs.forEach((memberDoc: any) => {
    batch.update(memberDoc.ref, { plan: planId })
  })

  const displayName = PLAN_DISPLAY[planId]?.displayName || planId
  allMembersSnap.docs.forEach((memberDoc: any) => {
    const memberData = memberDoc.data()
    if (!memberData.userId) return
    const notifRef = db.collection('notifications').doc()
    batch.set(notifRef, {
      orgId,
      userId: memberData.userId,
      type: 'plan_subscribed',
      title: 'Assinatura confirmada!',
      message: `Pagamento confirmado! Seu plano ${displayName} esta ativo. Aproveite todos os recursos disponiveis!`,
      read: false,
      createdAt: now,
    })
  })

  await batch.commit()
  console.log(`[stripe-webhook] Plan ${planId} activated for org ${orgId}`)
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  const orgId = subscription.metadata?.orgId
  const planId = subscription.metadata?.planId

  if (!orgId) return

  const db = getAdminDb()
  const orgRef = db.collection('organizations').doc(orgId)
  const now = new Date().toISOString()

  if (subscription.status === 'active') {
    const updateData: Record<string, unknown> = {
      stripeSubscriptionStatus: 'active',
      updatedAt: now,
    }

    // Se o planId na metadata mudou, atualizar o plano (upgrade via Stripe)
    if (planId && isValidPlan(planId)) {
      const orgSnap = await orgRef.get()
      const currentPlan = orgSnap.data()?.plan

      if (currentPlan !== planId) {
        const newLimits = PLAN_LIMITS[planId]
        updateData.plan = planId
        updateData.limits = {
          maxUsers: newLimits.maxUsers,
          maxFunnels: newLimits.maxFunnels,
          maxContacts: newLimits.maxContacts,
        }
        updateData.planUpgradedAt = now

        // Atualizar plano nos membros
        const allMembersSnap = await orgRef.collection('members').get()
        const batch = db.batch()
        allMembersSnap.docs.forEach((memberDoc: any) => {
          batch.update(memberDoc.ref, { plan: planId })
        })
        await batch.commit()

        console.log(`[stripe-webhook] Plan upgraded to ${planId} for org ${orgId}`)
      }
    }

    await orgRef.update(updateData)
  } else if (subscription.status === 'canceled' || subscription.status === 'unpaid') {
    await orgRef.update({
      stripeSubscriptionStatus: subscription.status,
      updatedAt: now,
    })
  }
}

async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  const subscriptionId = (invoice as any).subscription as string | null

  if (!subscriptionId) return

  const subscription = await stripe.subscriptions.retrieve(subscriptionId)
  const orgId = subscription.metadata?.orgId

  if (!orgId) return

  const db = getAdminDb()
  const orgRef = db.collection('organizations').doc(orgId)

  await orgRef.update({
    stripeSubscriptionStatus: 'past_due',
    updatedAt: new Date().toISOString(),
  })

  const allMembersSnap = await orgRef.collection('members').get()
  const batch = db.batch()
  const now = new Date().toISOString()

  allMembersSnap.docs.forEach((memberDoc: any) => {
    const memberData = memberDoc.data()
    if (!memberData.userId) return
    const notifRef = db.collection('notifications').doc()
    batch.set(notifRef, {
      orgId,
      userId: memberData.userId,
      type: 'payment_failed',
      title: 'Falha no pagamento',
      message: 'Nao conseguimos processar o pagamento da sua assinatura. Atualize seu metodo de pagamento para evitar a suspensao do servico.',
      read: false,
      createdAt: now,
    })
  })

  await batch.commit()
}

export async function POST(req: NextRequest) {
  const body = await req.text()
  const signature = req.headers.get('stripe-signature')

  if (!signature) {
    return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 })
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (!webhookSecret) {
    console.error('[stripe-webhook] STRIPE_WEBHOOK_SECRET not configured')
    return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 })
  }

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
  } catch (err: any) {
    console.error('[stripe-webhook] Signature verification failed:', err.message)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutComplete(event.data.object as Stripe.Checkout.Session)
        break

      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription)
        break

      case 'customer.subscription.deleted':
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription)
        break

      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice)
        break

      default:
        console.log(`[stripe-webhook] Unhandled event type: ${event.type}`)
    }
  } catch (error: any) {
    console.error(`[stripe-webhook] Error handling ${event.type}:`, error)
    return NextResponse.json({ error: 'Webhook handler error' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
