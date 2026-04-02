import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { getAdminDb } from '@/lib/firebaseAdmin'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { orgId, userEmail } = body

    if (!orgId || !userEmail) {
      return NextResponse.json(
        { error: 'Campos obrigatorios: orgId, userEmail' },
        { status: 400 }
      )
    }

    const db = getAdminDb()
    const orgRef = db.collection('organizations').doc(orgId)
    const orgSnap = await orgRef.get()

    if (!orgSnap.exists) {
      return NextResponse.json({ error: 'Organizacao nao encontrada' }, { status: 404 })
    }

    const orgData = orgSnap.data()
    const subscriptionId = orgData?.stripeSubscriptionId
    const planSubscribedAt = orgData?.planSubscribedAt

    let cancelAt: string | null = null

    if (subscriptionId) {
      // Has Stripe subscription - cancel at period end
      try {
        const subscription = await stripe.subscriptions.update(subscriptionId, {
          cancel_at_period_end: true,
        })

        cancelAt = subscription.cancel_at
          ? new Date(subscription.cancel_at * 1000).toISOString()
          : null
      } catch (stripeErr: any) {
        console.error('[api/cancel-subscription] Stripe error:', stripeErr.message)
        // If Stripe fails (e.g. subscription already canceled), continue with local cancellation
      }
    }

    // If no cancelAt from Stripe, calculate based on 30 days from planSubscribedAt
    if (!cancelAt && planSubscribedAt) {
      const subscribedDate = new Date(planSubscribedAt)
      subscribedDate.setDate(subscribedDate.getDate() + 30)
      cancelAt = subscribedDate.toISOString()
    }

    // Fallback: 30 days from now
    if (!cancelAt) {
      const fallback = new Date()
      fallback.setDate(fallback.getDate() + 30)
      cancelAt = fallback.toISOString()
    }

    const now = new Date().toISOString()

    await orgRef.update({
      stripeSubscriptionStatus: 'canceling',
      stripeCancelAt: cancelAt,
      updatedAt: now,
    })

    // Notify all members
    const allMembersSnap = await orgRef.collection('members').get()
    const batch = db.batch()

    allMembersSnap.docs.forEach((memberDoc: any) => {
      const memberData = memberDoc.data()
      if (!memberData.userId) return
      const notifRef = db.collection('notifications').doc()
      batch.set(notifRef, {
        orgId,
        userId: memberData.userId,
        type: 'plan_canceled',
        title: 'Cancelamento de plano solicitado',
        message: `O cancelamento foi solicitado. Seu plano permanece ativo ate ${new Date(cancelAt!).toLocaleDateString('pt-BR')}.`,
        read: false,
        createdAt: now,
      })
    })

    await batch.commit()

    return NextResponse.json({
      success: true,
      cancelAt,
    })
  } catch (error: any) {
    console.error('[api/cancel-subscription] POST error:', error)
    return NextResponse.json(
      { error: error.message || 'Erro ao cancelar assinatura' },
      { status: 500 }
    )
  }
}
