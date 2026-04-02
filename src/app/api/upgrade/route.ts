import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { getAdminDb } from '@/lib/firebaseAdmin'
import { getStripePriceId, isPaidPlan } from '@/lib/stripePrices'
import { PLAN_LIMITS, PLAN_DISPLAY } from '@/types/plan'
import type { PlanId } from '@/types/plan'

function isValidPlan(plan: string): plan is PlanId {
  return plan in PLAN_LIMITS
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { orgId, newPlanId, userEmail } = body

    if (!orgId || !newPlanId || !userEmail) {
      return NextResponse.json(
        { error: 'Campos obrigatorios: orgId, newPlanId, userEmail' },
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
    const orgRef = db.collection('organizations').doc(orgId)
    const orgSnap = await orgRef.get()

    if (!orgSnap.exists) {
      return NextResponse.json({ error: 'Organizacao nao encontrada' }, { status: 404 })
    }

    const orgData = orgSnap.data()
    const stripeSubscriptionId = orgData?.stripeSubscriptionId
    const currentPlan = orgData?.plan as PlanId

    if (!stripeSubscriptionId) {
      return NextResponse.json(
        { error: 'Organizacao nao possui assinatura ativa' },
        { status: 400 }
      )
    }

    if (currentPlan === newPlanId) {
      return NextResponse.json(
        { error: 'Voce ja esta neste plano' },
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

    // Atualizar a subscription no Stripe com proration
    const updatedSubscription = await stripe.subscriptions.update(
      stripeSubscriptionId,
      {
        items: [
          {
            id: currentItem.id,
            price: newPriceId,
          },
        ],
        proration_behavior: 'create_prorations',
        metadata: {
          orgId,
          planId: newPlanId,
          previousPlanId: currentPlan,
          upgradedBy: userEmail,
          upgradedAt: new Date().toISOString(),
        },
        payment_behavior: 'pending_if_incomplete',
      }
    )

    // Atualizar org no Firestore imediatamente
    const newLimits = PLAN_LIMITS[newPlanId]
    const now = new Date().toISOString()

    await orgRef.update({
      plan: newPlanId,
      limits: {
        maxUsers: newLimits.maxUsers,
        maxFunnels: newLimits.maxFunnels,
        maxContacts: newLimits.maxContacts,
      },
      previousPlan: currentPlan,
      planUpgradedAt: now,
      updatedAt: now,
    })

    // Atualizar plano em todos os membros
    const allMembersSnap = await orgRef.collection('members').get()
    const batch = db.batch()

    allMembersSnap.docs.forEach((memberDoc: any) => {
      batch.update(memberDoc.ref, { plan: newPlanId })
    })

    // Ajustar creditos proporcionalmente
    const currentLimits = PLAN_LIMITS[currentPlan]
    const creditsRef = orgRef.collection('credits').doc('balance')
    const creditsSnap = await creditsRef.get()

    if (creditsSnap.exists) {
      const creditsData = creditsSnap.data()!

      // Calcular creditos adicionais proporcionais aos dias restantes
      const periodEnd = currentItem.current_period_end
      const periodStart = currentItem.current_period_start
      const nowTs = Math.floor(Date.now() / 1000)
      const totalDays = Math.ceil((periodEnd - periodStart) / 86400)
      const remainingDays = Math.max(0, Math.ceil((periodEnd - nowTs) / 86400))
      const ratio = totalDays > 0 ? remainingDays / totalDays : 0

      // Diferenca de limites mensais proporcional aos dias restantes
      const additionalMinutes = Math.round(
        (newLimits.monthlyMinutes - currentLimits.monthlyMinutes) * ratio
      )
      const additionalActions = Math.round(
        (newLimits.monthlyActions - currentLimits.monthlyActions) * ratio
      )

      if (additionalMinutes > 0 || additionalActions > 0) {
        const newBalance = (creditsData.balance || 0) + Math.max(0, additionalMinutes)
        const newActionBalance = (creditsData.actionBalance || 0) + Math.max(0, additionalActions)

        batch.update(creditsRef, {
          balance: newBalance,
          totalPurchased: (creditsData.totalPurchased || 0) + Math.max(0, additionalMinutes),
          actionBalance: newActionBalance,
          actionTotalPurchased: (creditsData.actionTotalPurchased || 0) + Math.max(0, additionalActions),
          lastRechargeAt: now,
        })

        // Registrar transacao de creditos (minutos)
        if (additionalMinutes > 0) {
          const minuteTxRef = orgRef.collection('creditTransactions').doc()
          batch.set(minuteTxRef, {
            orgId,
            type: 'adjustment',
            creditType: 'minutes',
            amount: additionalMinutes,
            balance: newBalance,
            description: `Upgrade de plano: ${PLAN_DISPLAY[currentPlan]?.displayName} → ${PLAN_DISPLAY[newPlanId]?.displayName} (${remainingDays} dias restantes)`,
            adminEmail: userEmail,
            createdAt: now,
          })
        }

        // Registrar transacao de creditos (acoes)
        if (additionalActions > 0) {
          const actionTxRef = orgRef.collection('creditTransactions').doc()
          batch.set(actionTxRef, {
            orgId,
            type: 'adjustment',
            creditType: 'actions',
            amount: additionalActions,
            balance: newActionBalance,
            description: `Upgrade de plano: ${PLAN_DISPLAY[currentPlan]?.displayName} → ${PLAN_DISPLAY[newPlanId]?.displayName} (${remainingDays} dias restantes)`,
            adminEmail: userEmail,
            createdAt: now,
          })
        }
      }
    }

    // Notificar todos os membros
    const displayName = PLAN_DISPLAY[newPlanId]?.displayName || newPlanId
    const previousDisplayName = PLAN_DISPLAY[currentPlan]?.displayName || currentPlan

    allMembersSnap.docs.forEach((memberDoc: any) => {
      const memberData = memberDoc.data()
      if (!memberData.userId) return
      const notifRef = db.collection('notifications').doc()
      batch.set(notifRef, {
        orgId,
        userId: memberData.userId,
        type: 'plan_upgraded',
        title: 'Plano atualizado!',
        message: `Seu plano foi atualizado de ${previousDisplayName} para ${displayName}. Os novos recursos ja estao disponiveis!`,
        read: false,
        createdAt: now,
      })
    })

    await batch.commit()

    return NextResponse.json({
      success: true,
      subscription: {
        id: updatedSubscription.id,
        status: updatedSubscription.status,
      },
      previousPlan: currentPlan,
      newPlan: newPlanId,
    })
  } catch (error: any) {
    console.error('[api/upgrade] POST error:', error)
    return NextResponse.json(
      { error: error.message || 'Erro ao processar upgrade' },
      { status: 500 }
    )
  }
}
