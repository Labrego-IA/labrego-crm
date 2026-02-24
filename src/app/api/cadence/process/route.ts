import { NextRequest, NextResponse } from 'next/server'
import { getAdminDb } from '@/lib/firebaseAdmin'
import { getAutomationConfig, getTodayActionCount } from '@/lib/automationConfig'
import { executeCadenceStep, logCadenceExecution } from '@/lib/cadenceExecutors'
import type { CadenceStep, CadenceExecutionLog } from '@/types/cadence'

const BATCH_SIZE = 20
const BATCH_DELAY_MS = 5000

/**
 * POST /api/cadence/process
 * Called by cron every 15 minutes.
 * Processes eligible cadence steps for all organizations.
 */
export async function POST(request: NextRequest) {
  // Optional auth
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const auth = request.headers.get('authorization')
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const db = getAdminDb()
  const now = new Date()
  const results = { processed: 0, success: 0, failed: 0, skipped: 0 }

  try {
    // Get all orgs with automation enabled
    const orgsSnap = await db.collectionGroup('automationConfig')
      .where('enabled', '==', true)
      .get()

    for (const configDoc of orgsSnap.docs) {
      const orgId = configDoc.ref.parent.parent?.id
      if (!orgId) continue

      const config = await getAutomationConfig(orgId)

      // Check work hours
      const hours = now.getHours()
      const minutes = now.getMinutes()
      const currentTime = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
      if (currentTime < config.workHoursStart || currentTime > config.workHoursEnd) {
        continue
      }

      // Check daily limit
      const todayCount = await getTodayActionCount(orgId)
      if (todayCount >= config.maxActionsPerDay) {
        continue
      }

      const remaining = config.maxActionsPerDay - todayCount
      await processOrg(db, orgId, config.pausedStageIds, remaining, results)
    }

    return NextResponse.json({
      message: 'Cadence processing complete',
      ...results,
      timestamp: now.toISOString(),
    })
  } catch (error) {
    console.error('Cadence process error:', error)
    return NextResponse.json(
      { error: 'Failed to process cadences', details: error instanceof Error ? error.message : '' },
      { status: 500 }
    )
  }
}

async function processOrg(
  db: FirebaseFirestore.Firestore,
  orgId: string,
  pausedStageIds: string[],
  maxActions: number,
  results: { processed: number; success: number; failed: number; skipped: number }
) {
  const now = new Date()
  let actionsLeft = maxActions

  // Get all active cadence steps for this org
  const stepsSnap = await db.collection('cadenceSteps')
    .where('orgId', '==', orgId)
    .where('isActive', '==', true)
    .get()

  if (stepsSnap.empty) return

  const steps = stepsSnap.docs.map(d => ({ id: d.id, ...d.data() } as CadenceStep))
  const stepMap = new Map<string, CadenceStep>()
  for (const s of steps) stepMap.set(s.id, s)

  // Get stages info
  const stagesSnap = await db.collection('funnelStages')
    .where('orgId', '==', orgId)
    .get()
  const stageMap = new Map<string, { id: string; name: string; funnelId: string }>()
  stagesSnap.docs.forEach(d => stageMap.set(d.id, { id: d.id, name: d.data().name, funnelId: d.data().funnelId || '' }))

  // Find eligible contacts
  const clientsSnap = await db.collection('organizations').doc(orgId).collection('clients')
    .where('currentCadenceStepId', '!=', '')
    .get()

  type ContactDoc = Record<string, unknown> & { id: string }
  const eligible: { contact: ContactDoc; step: CadenceStep; stage: { id: string; name: string } }[] = []

  for (const doc of clientsSnap.docs) {
    const contact: ContactDoc = { id: doc.id, ...doc.data() }
    const stepId = contact.currentCadenceStepId as string
    if (!stepId) continue

    // Check if responded — skip if cadence is paused
    if (contact.lastCadenceStepResponded) continue

    const step = stepMap.get(stepId)
    if (!step || !step.isActive) continue

    // Check if stage is paused
    if (pausedStageIds.includes(step.stageId)) continue

    // Check timing: lastCadenceActionAt + daysAfterPrevious <= now
    const lastAction = contact.lastCadenceActionAt as string
    if (lastAction) {
      const nextEligible = new Date(lastAction)
      nextEligible.setDate(nextEligible.getDate() + step.daysAfterPrevious)
      if (nextEligible > now) continue
    }
    // If no lastCadenceActionAt, the contact just entered the cadence — first step should execute if days=0

    const stage = stageMap.get(step.stageId)
    if (!stage) continue

    eligible.push({ contact, step, stage })
  }

  // Process in batches
  for (let i = 0; i < eligible.length && actionsLeft > 0; i += BATCH_SIZE) {
    const batch = eligible.slice(i, i + BATCH_SIZE)

    for (const { contact, step, stage } of batch) {
      if (actionsLeft <= 0) break
      results.processed++
      actionsLeft--

      const result = await executeCadenceStep(
        step,
        contact as Record<string, unknown> & { id: string },
        orgId
      )

      // Log execution
      await logCadenceExecution(db, orgId, contact.id, {
        stepId: step.id,
        stepName: step.name,
        channel: step.contactMethod,
        stageId: stage.id,
        stageName: stage.name,
        success: result.success,
        error: result.error,
        templatePreview: (step.messageTemplate || step.emailSubject || step.name).slice(0, 100),
      })

      // Create execution log entry
      const logEntry: Omit<CadenceExecutionLog, 'id'> = {
        orgId,
        clientId: contact.id,
        clientName: (contact.name as string) || '',
        stepId: step.id,
        stepName: step.name,
        stageId: stage.id,
        stageName: stage.name,
        channel: step.contactMethod,
        status: result.success ? 'success' : 'failed',
        error: result.error,
        executedAt: now.toISOString(),
        retryCount: 0,
      }
      await db.collection('organizations').doc(orgId).collection('cadenceExecutionLog').add(logEntry)

      if (result.success) {
        results.success++
        // Advance to next step
        await advanceToNextStep(db, orgId, contact, step, steps, stageMap)
      } else {
        results.failed++
        // Handle retry
        await handleFailedStep(db, orgId, contact, step, logEntry, steps, stageMap)
      }
    }

    // Delay between batches
    if (i + BATCH_SIZE < eligible.length) {
      await new Promise(resolve => setTimeout(resolve, BATCH_DELAY_MS))
    }
  }
}

async function advanceToNextStep(
  db: FirebaseFirestore.Firestore,
  orgId: string,
  contact: { id: string } & Record<string, unknown>,
  currentStep: CadenceStep,
  allSteps: CadenceStep[],
  stageMap: Map<string, { id: string; name: string; funnelId: string }>
) {
  // Find next step in the same stage with higher order
  const stageSteps = allSteps
    .filter(s => s.stageId === currentStep.stageId && s.isActive)
    .sort((a, b) => a.order - b.order)

  const currentIndex = stageSteps.findIndex(s => s.id === currentStep.id)
  const nextStep = stageSteps[currentIndex + 1]

  const clientRef = db.collection('organizations').doc(orgId).collection('clients').doc(contact.id)

  if (nextStep) {
    // Advance to next step
    await clientRef.update({
      currentCadenceStepId: nextStep.id,
      lastCadenceActionAt: new Date().toISOString(),
    })
  } else {
    // Cadence exhausted — check stage config
    const stageRef = db.collection('funnelStages').doc(currentStep.stageId)
    const stageDoc = await stageRef.get()
    const stageData = stageDoc.data()

    const exhaustedAction = stageData?.cadenceExhaustedAction || 'keep'

    if (exhaustedAction === 'move' && stageData?.cadenceExhaustedTargetStageId) {
      // Move contact to target stage
      const targetStage = stageMap.get(stageData.cadenceExhaustedTargetStageId)
      await clientRef.update({
        funnelStage: stageData.cadenceExhaustedTargetStageId,
        funnelId: targetStage?.funnelId || '',
        funnelStageUpdatedAt: new Date().toISOString(),
        currentCadenceStepId: '',
        lastCadenceActionAt: new Date().toISOString(),
      })

      // Log the move
      await db.collection('organizations').doc(orgId).collection('clients').doc(contact.id).collection('logs').add({
        action: 'cadence_exhausted_move',
        message: `Cadência esgotada — movido para ${targetStage?.name || 'outra etapa'}`,
        type: 'cadence',
        author: 'Sistema (Cadência automática)',
        createdAt: new Date().toISOString(),
      })
    } else if (exhaustedAction === 'notify') {
      const assignedTo = contact.assignedTo as string
      if (assignedTo) {
        await db.collection('organizations').doc(orgId).collection('notifications').add({
          userId: assignedTo,
          type: 'cadence_exhausted',
          title: 'Cadência esgotada',
          message: `Cadência de ${(contact.name as string) || 'contato'} esgotou sem resposta`,
          contactId: contact.id,
          read: false,
          createdAt: new Date().toISOString(),
        })
      }
      await clientRef.update({
        currentCadenceStepId: '',
        lastCadenceActionAt: new Date().toISOString(),
      })
    } else {
      // Keep — just clear the cadence step
      await clientRef.update({
        currentCadenceStepId: '',
        lastCadenceActionAt: new Date().toISOString(),
      })
    }
  }
}

async function handleFailedStep(
  db: FirebaseFirestore.Firestore,
  orgId: string,
  contact: { id: string } & Record<string, unknown>,
  step: CadenceStep,
  logEntry: Omit<CadenceExecutionLog, 'id'>,
  allSteps: CadenceStep[],
  stageMap: Map<string, { id: string; name: string; funnelId: string }>
) {
  const retryCount = (step.retryCount || 0) + 1

  if (retryCount <= 2) {
    // Schedule retry — mark as retry_pending
    await db.collection('cadenceSteps').doc(step.id).update({
      retryCount,
      lastRetryAt: new Date().toISOString(),
    })
  } else {
    // Max retries exceeded — log and advance to next step
    await db.collection('organizations').doc(orgId).collection('clients').doc(contact.id).collection('logs').add({
      action: 'cadence_auto_error',
      message: `Cadência falhou após ${retryCount} tentativas: ${step.name} — avançando para próximo step`,
      type: 'cadence',
      author: 'Sistema (Cadência automática)',
      createdAt: new Date().toISOString(),
    })

    // Reset retry count on the step
    await db.collection('cadenceSteps').doc(step.id).update({
      retryCount: 0,
      lastRetryAt: '',
    })

    // Advance contact to next step (or finish cadence)
    await advanceToNextStep(db, orgId, contact, step, allSteps, stageMap)
  }
}

// Also support GET for Vercel Cron
export async function GET(request: NextRequest) {
  return POST(request)
}
