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

    if (!subscriptionId) {
      return NextResponse.json(
        { error: 'Nenhuma assinatura ativa encontrada para esta organizacao' },
        { status: 400 }
      )
    }

    // Cancel at end of billing period (graceful cancellation)
    const subscription = await stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: true,
    })

    const cancelAt = subscription.cancel_at
      ? new Date(subscription.cancel_at * 1000).toISOString()
      : null

    await orgRef.update({
      stripeSubscriptionStatus: 'canceling',
      stripeCancelAt: cancelAt,
      updatedAt: new Date().toISOString(),
    })

    // Notify all members
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
        type: 'plan_canceled',
        title: 'Cancelamento de plano solicitado',
        message: cancelAt
          ? `O cancelamento foi solicitado. Seu plano permanece ativo ate ${new Date(cancelAt).toLocaleDateString('pt-BR')}.`
          : 'O cancelamento do plano foi solicitado.',
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
