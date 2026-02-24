import { NextRequest, NextResponse } from 'next/server'
import { getAdminDb } from '@/lib/firebaseAdmin'
import { FieldValue } from 'firebase-admin/firestore'
import type { AutomationTrigger, AutomationLog, TriggerCondition } from '@/types/automation'

/**
 * Evaluate automation triggers for a given event.
 * Called after key events: stage change, lead creation, deal value set, ICP match.
 * POST body: { orgId, eventType, contactId, contactName, context }
 */
export async function POST(req: NextRequest) {
  try {
    // Authentication: require CRON_SECRET or internal API key
    const cronSecret = process.env.CRON_SECRET
    if (!cronSecret) {
      return NextResponse.json({ error: 'Server not configured' }, { status: 503 })
    }
    const auth = req.headers.get('authorization')
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { orgId, eventType, contactId, contactName, context } = body

    if (!orgId || !eventType || !contactId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Recursion protection: check if this evaluation was triggered by an automation
    const maxDepth = 3
    const currentDepth = (context?._automationDepth as number) || 0
    if (currentDepth >= maxDepth) {
      return NextResponse.json({ triggered: 0, skipped: 'max_recursion_depth' })
    }

    // Fetch active triggers for this org and event type
    const triggersSnap = await getAdminDb()
      .collection('automationTriggers')
      .where('orgId', '==', orgId)
      .where('eventType', '==', eventType)
      .where('isActive', '==', true)
      .get()

    if (triggersSnap.empty) {
      return NextResponse.json({ triggered: 0 })
    }

    const results: { triggerId: string; actions: number }[] = []

    for (const doc of triggersSnap.docs) {
      const trigger = { id: doc.id, ...doc.data() } as AutomationTrigger

      // Check conditions
      if (!evaluateConditions(trigger.conditions, context || {})) continue

      // Check stage-specific conditions
      if (eventType === 'stage_changed') {
        if (trigger.fromStageId && trigger.fromStageId !== context?.fromStageId) continue
        if (trigger.toStageId && trigger.toStageId !== context?.toStageId) continue
      }

      // Execute actions
      const actionsResults = []
      for (const action of trigger.actions) {
        try {
          await executeAction(action, orgId, contactId, contactName, context)
          actionsResults.push({ type: action.type, success: true, detail: `${action.type} executed` })
        } catch (error) {
          actionsResults.push({ type: action.type, success: false, detail: String(error) })
        }
      }

      // Log execution
      const log: Omit<AutomationLog, 'id'> = {
        orgId,
        triggerId: trigger.id,
        triggerName: trigger.name,
        eventType,
        contactId,
        contactName: contactName || '',
        actionsExecuted: actionsResults,
        executedAt: new Date().toISOString(),
      }
      await getAdminDb().collection('automationLogs').add(log)

      // Update trigger execution count (atomic increment to avoid race conditions)
      await getAdminDb()
        .collection('automationTriggers')
        .doc(trigger.id)
        .update({
          executionCount: FieldValue.increment(1),
          lastExecutedAt: new Date().toISOString(),
        })

      results.push({ triggerId: trigger.id, actions: actionsResults.length })
    }

    return NextResponse.json({ triggered: results.length, results })
  } catch (error) {
    console.error('Automation evaluation error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

function evaluateConditions(conditions: TriggerCondition[], context: Record<string, unknown>): boolean {
  if (!conditions || conditions.length === 0) return true

  return conditions.every((cond) => {
    const val = String(context[cond.field] ?? '')
    switch (cond.operator) {
      case 'equals':
        return val === cond.value
      case 'not_equals':
        return val !== cond.value
      case 'greater_than':
        return parseFloat(val) > parseFloat(cond.value)
      case 'less_than':
        return parseFloat(val) < parseFloat(cond.value)
      case 'contains':
        return val.toLowerCase().includes(cond.value.toLowerCase())
      default:
        return true
    }
  })
}

async function executeAction(
  action: AutomationTrigger['actions'][0],
  orgId: string,
  contactId: string,
  contactName: string,
  context: Record<string, unknown>,
) {
  const adminDb = getAdminDb()

  switch (action.type) {
    case 'send_notification': {
      // Add notification to org notifications collection
      await adminDb.collection('notifications').add({
        orgId,
        type: 'automation',
        title: 'Automação executada',
        message: action.notificationMessage || `Trigger executado para ${contactName}`,
        contactId,
        read: false,
        createdAt: new Date().toISOString(),
      })
      break
    }
    case 'move_to_stage': {
      if (!action.targetStageId) break
      const updates: Record<string, unknown> = {
        funnelStageId: action.targetStageId,
        funnelStageUpdatedAt: new Date().toISOString(),
      }
      if (action.targetFunnelId) {
        updates.funnelId = action.targetFunnelId
      }
      await adminDb.collection('clients').doc(contactId).update(updates)
      break
    }
    case 'assign_to_user': {
      if (!action.targetUserId) break
      await adminDb.collection('clients').doc(contactId).update({
        assignedTo: action.targetUserId,
        assignedToName: action.targetUserName || '',
      })
      break
    }
    case 'send_email': {
      // Queue email for sending (creates a pending campaign recipient or uses direct send)
      await adminDb.collection('emailQueue').add({
        orgId,
        contactId,
        contactName,
        contactEmail: context.email || '',
        templateId: action.emailTemplateId || null,
        subject: action.emailSubject || 'Automação',
        status: 'pending',
        triggeredBy: 'automation',
        createdAt: new Date().toISOString(),
      })
      break
    }
    case 'add_tag': {
      if (!action.tagName) break
      // Get current tags and add new one
      const clientSnap = await adminDb.collection('clients').doc(contactId).get()
      const currentTags: string[] = clientSnap.data()?.tags || []
      if (!currentTags.includes(action.tagName)) {
        await adminDb.collection('clients').doc(contactId).update({
          tags: [...currentTags, action.tagName],
        })
      }
      break
    }
  }
}
