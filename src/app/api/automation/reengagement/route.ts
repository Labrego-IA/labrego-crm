import { NextRequest, NextResponse } from 'next/server'
import { getAdminDb } from '@/lib/firebaseAdmin'
import type { ReengagementConfig, ReengagementEnrollment } from '@/types/cadence'

/**
 * POST /api/automation/reengagement
 * Called by cron to check for leads that should be enrolled in reengagement.
 * Also processes active reengagement enrollments (advances steps).
 */
export async function POST(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    return NextResponse.json({ error: 'Server not configured' }, { status: 503 })
  }
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const adminDb = getAdminDb()
  const now = new Date()
  const results = { enrolled: 0, advanced: 0, completed: 0, responded: 0, maxCycles: 0 }

  try {
    // Get all active reengagement configs
    const configsSnap = await adminDb.collection('reengagementConfigs')
      .where('enabled', '==', true)
      .get()

    for (const configDoc of configsSnap.docs) {
      const config = { id: configDoc.id, ...configDoc.data() } as ReengagementConfig

      // 1. Enroll new leads (inactive + lost)
      await enrollInactiveLeads(adminDb, config, now, results)
      if (config.includeLost) {
        await enrollLostLeads(adminDb, config, now, results)
      }

      // 2. Process active enrollments (advance steps)
      await processActiveEnrollments(adminDb, config, now, results)
    }

    return NextResponse.json({
      message: 'Reengagement processing complete',
      ...results,
      timestamp: now.toISOString(),
    })
  } catch (error) {
    console.error('Reengagement process error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

async function enrollInactiveLeads(
  db: FirebaseFirestore.Firestore,
  config: ReengagementConfig,
  now: Date,
  results: { enrolled: number; maxCycles: number },
) {
  const cutoffDate = new Date(now)
  cutoffDate.setDate(cutoffDate.getDate() - config.inactiveDays)
  const cutoffStr = cutoffDate.toISOString()

  // Get clients who haven't had activity since cutoff
  const clientsSnap = await db.collection('clients')
    .where('orgId', '==', config.orgId)
    .where('lastFollowUpAt', '<=', cutoffStr)
    .get()

  for (const clientDoc of clientsSnap.docs) {
    const client = clientDoc.data()
    const contactId = clientDoc.id

    // Check if already enrolled
    const existingSnap = await db.collection('reengagementEnrollments')
      .where('orgId', '==', config.orgId)
      .where('contactId', '==', contactId)
      .where('status', '==', 'active')
      .limit(1)
      .get()

    if (!existingSnap.empty) continue

    // Check cycle limit
    const allEnrollments = await db.collection('reengagementEnrollments')
      .where('orgId', '==', config.orgId)
      .where('contactId', '==', contactId)
      .get()

    const completedCycles = allEnrollments.docs.filter(
      d => d.data().status === 'completed' || d.data().status === 'max_cycles'
    ).length

    if (completedCycles >= config.maxCycles) {
      results.maxCycles++
      continue
    }

    // Enroll
    const enrollment: Omit<ReengagementEnrollment, 'id'> = {
      orgId: config.orgId,
      contactId,
      contactName: (client.name as string) || '',
      configId: config.id,
      currentStepIndex: 0,
      cycle: completedCycles + 1,
      status: 'active',
      enrolledAt: now.toISOString(),
      reason: 'inactive',
    }
    await db.collection('reengagementEnrollments').add(enrollment)
    results.enrolled++
  }
}

async function enrollLostLeads(
  db: FirebaseFirestore.Firestore,
  config: ReengagementConfig,
  now: Date,
  results: { enrolled: number; maxCycles: number },
) {
  // Get stages with negative conversion type
  const stagesSnap = await db.collection('funnelStages')
    .where('orgId', '==', config.orgId)
    .where('conversionType', '==', 'negative')
    .get()

  const lostStageIds = stagesSnap.docs.map(d => d.id)
  if (lostStageIds.length === 0) return

  // Get clients in lost stages that haven't been enrolled recently
  for (const stageId of lostStageIds) {
    const clientsSnap = await db.collection('clients')
      .where('orgId', '==', config.orgId)
      .where('funnelStageId', '==', stageId)
      .get()

    for (const clientDoc of clientsSnap.docs) {
      const client = clientDoc.data()
      const contactId = clientDoc.id

      // Check if already enrolled
      const existingSnap = await db.collection('reengagementEnrollments')
        .where('orgId', '==', config.orgId)
        .where('contactId', '==', contactId)
        .where('status', '==', 'active')
        .limit(1)
        .get()

      if (!existingSnap.empty) continue

      // Check cycle limit
      const allEnrollments = await db.collection('reengagementEnrollments')
        .where('orgId', '==', config.orgId)
        .where('contactId', '==', contactId)
        .get()

      const completedCycles = allEnrollments.docs.filter(
        d => d.data().status === 'completed' || d.data().status === 'max_cycles'
      ).length

      if (completedCycles >= config.maxCycles) {
        results.maxCycles++
        continue
      }

      const enrollment: Omit<ReengagementEnrollment, 'id'> = {
        orgId: config.orgId,
        contactId,
        contactName: (client.name as string) || '',
        configId: config.id,
        currentStepIndex: 0,
        cycle: completedCycles + 1,
        status: 'active',
        enrolledAt: now.toISOString(),
        reason: 'lost',
      }
      await db.collection('reengagementEnrollments').add(enrollment)
      results.enrolled++
    }
  }
}

async function processActiveEnrollments(
  db: FirebaseFirestore.Firestore,
  config: ReengagementConfig,
  now: Date,
  results: { advanced: number; completed: number; responded: number },
) {
  const enrollmentsSnap = await db.collection('reengagementEnrollments')
    .where('orgId', '==', config.orgId)
    .where('configId', '==', config.id)
    .where('status', '==', 'active')
    .get()

  for (const enrollDoc of enrollmentsSnap.docs) {
    const enrollment = { id: enrollDoc.id, ...enrollDoc.data() } as ReengagementEnrollment

    // Check if lead responded (has recent activity)
    const clientDoc = await db.collection('clients').doc(enrollment.contactId).get()
    if (!clientDoc.exists) continue

    const client = clientDoc.data()!
    const lastFollowUp = client.lastFollowUpAt as string
    if (lastFollowUp && lastFollowUp > enrollment.enrolledAt) {
      // Lead responded — exit reengagement
      await enrollDoc.ref.update({
        status: 'responded',
        respondedAt: now.toISOString(),
      })
      results.responded++
      continue
    }

    // Check if current step is due
    const step = config.steps[enrollment.currentStepIndex]
    if (!step || !step.isActive) {
      // Advance to next active step or complete
      const nextIndex = findNextActiveStep(config.steps, enrollment.currentStepIndex + 1)
      if (nextIndex === -1) {
        await enrollDoc.ref.update({ status: 'completed' })
        results.completed++
      } else {
        await enrollDoc.ref.update({ currentStepIndex: nextIndex })
      }
      continue
    }

    const referenceDate = enrollment.lastStepAt || enrollment.enrolledAt
    const dueDate = new Date(referenceDate)
    dueDate.setDate(dueDate.getDate() + step.daysAfterPrevious)

    if (now < dueDate) continue // Not yet due

    // Execute step — log it
    await db.collection('reengagementLogs').add({
      orgId: config.orgId,
      enrollmentId: enrollment.id,
      contactId: enrollment.contactId,
      contactName: enrollment.contactName,
      stepName: step.name,
      channel: step.contactMethod,
      cycle: enrollment.cycle,
      executedAt: now.toISOString(),
    })

    // Advance to next step
    const nextIndex = findNextActiveStep(config.steps, enrollment.currentStepIndex + 1)
    if (nextIndex === -1) {
      await enrollDoc.ref.update({
        status: 'completed',
        lastStepAt: now.toISOString(),
      })
      results.completed++
    } else {
      await enrollDoc.ref.update({
        currentStepIndex: nextIndex,
        lastStepAt: now.toISOString(),
      })
      results.advanced++
    }
  }
}

function findNextActiveStep(steps: ReengagementConfig['steps'], fromIndex: number): number {
  for (let i = fromIndex; i < steps.length; i++) {
    if (steps[i].isActive) return i
  }
  return -1
}

// GET removed — mutations must use POST only
