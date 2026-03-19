import { NextRequest, NextResponse } from 'next/server'
import { getAdminDb } from '@/lib/firebaseAdmin'
import { PLAN_LIMITS } from '@/types/plan'
import type { PlanId } from '@/types/plan'

function isValidPlan(plan: string): plan is PlanId {
  return plan in PLAN_LIMITS
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { orgId, newPlan, userEmail } = body

    if (!orgId || !newPlan || !userEmail) {
      return NextResponse.json(
        { error: 'Campos obrigatorios: orgId, newPlan, userEmail' },
        { status: 400 }
      )
    }

    if (!isValidPlan(newPlan)) {
      return NextResponse.json(
        { error: 'Plano invalido' },
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
    const currentPlan = orgData.plan

    if (currentPlan === newPlan) {
      return NextResponse.json(
        { error: 'O plano selecionado ja e o plano atual' },
        { status: 400 }
      )
    }

    // Verify user is a member with admin role
    const membersSnap = await orgRef
      .collection('members')
      .where('email', '==', userEmail)
      .limit(1)
      .get()

    if (membersSnap.empty) {
      return NextResponse.json(
        { error: 'Usuario nao encontrado na organizacao' },
        { status: 403 }
      )
    }

    const memberDoc = membersSnap.docs[0]
    const memberData = memberDoc.data()

    if (memberData.role !== 'admin') {
      return NextResponse.json(
        { error: 'Apenas administradores podem alterar o plano' },
        { status: 403 }
      )
    }

    const newLimits = PLAN_LIMITS[newPlan]
    const now = new Date().toISOString()

    // Update organization: plan, limits, planSubscribedAt, updatedAt
    await orgRef.update({
      plan: newPlan,
      limits: {
        maxUsers: newLimits.maxUsers,
        maxFunnels: newLimits.maxFunnels,
        maxContacts: newLimits.maxContacts,
      },
      planSubscribedAt: now,
      updatedAt: now,
    })

    // Update all members' plan field to match the org plan
    const allMembersSnap = await orgRef.collection('members').get()
    const batch = db.batch()
    allMembersSnap.docs.forEach((memberDoc: any) => {
      batch.update(memberDoc.ref, { plan: newPlan })
    })
    await batch.commit()

    return NextResponse.json({
      ok: true,
      plan: newPlan,
      limits: {
        maxUsers: newLimits.maxUsers,
        maxFunnels: newLimits.maxFunnels,
        maxContacts: newLimits.maxContacts,
      },
    })
  } catch (error: any) {
    console.error('[admin/change-plan] POST error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
