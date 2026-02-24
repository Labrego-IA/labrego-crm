import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { getAdminDb } from '@/lib/firebaseAdmin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

/**
 * POST /api/admin/migrate-funnel-ids
 * Migrates existing funnelStages without funnelId and clients without funnelId.
 * Protected by CRON_SECRET.
 */
export async function POST(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const auth = req.headers.get('authorization')
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const db = getAdminDb()
  const results = {
    stagesMigrated: 0,
    clientsMigrated: 0,
    orgsProcessed: 0,
    errors: [] as string[],
  }

  try {
    // Get all organizations
    const orgsSnap = await db.collection('organizations').get()

    for (const orgDoc of orgsSnap.docs) {
      const orgId = orgDoc.id
      results.orgsProcessed++

      try {
        // Find default funnel for this org
        const funnelsSnap = await db
          .collection('organizations')
          .doc(orgId)
          .collection('funnels')
          .where('isDefault', '==', true)
          .limit(1)
          .get()

        let defaultFunnelId = ''
        if (!funnelsSnap.empty) {
          defaultFunnelId = funnelsSnap.docs[0].id
        } else {
          // If no default funnel, try to get first funnel
          const anyFunnelSnap = await db
            .collection('organizations')
            .doc(orgId)
            .collection('funnels')
            .limit(1)
            .get()
          if (!anyFunnelSnap.empty) {
            defaultFunnelId = anyFunnelSnap.docs[0].id
          }
        }

        if (!defaultFunnelId) {
          continue // No funnels for this org, skip
        }

        // Step 1: Migrate stages without funnelId
        const stagesSnap = await db
          .collection('funnelStages')
          .where('orgId', '==', orgId)
          .get()

        const stageToFunnelMap = new Map<string, string>()

        for (const stageDoc of stagesSnap.docs) {
          const stageData = stageDoc.data()
          if (stageData.funnelId) {
            stageToFunnelMap.set(stageDoc.id, stageData.funnelId)
          } else {
            // Assign to default funnel
            await stageDoc.ref.update({ funnelId: defaultFunnelId })
            stageToFunnelMap.set(stageDoc.id, defaultFunnelId)
            results.stagesMigrated++
          }
        }

        // Step 2: Migrate clients without funnelId
        const clientsSnap = await db
          .collection('clients')
          .where('orgId', '==', orgId)
          .get()

        for (const clientDoc of clientsSnap.docs) {
          const clientData = clientDoc.data()

          // Skip if client already has funnelId
          if (clientData.funnelId) continue

          if (clientData.funnelStage) {
            // Derive funnelId from the stage
            const stageFunnelId = stageToFunnelMap.get(clientData.funnelStage)
            if (stageFunnelId) {
              await clientDoc.ref.update({ funnelId: stageFunnelId })
              results.clientsMigrated++
            }
          } else {
            // Client has no stage — set empty funnelId
            await clientDoc.ref.update({ funnelId: '' })
            results.clientsMigrated++
          }
        }
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : 'Unknown error'
        results.errors.push(`Org ${orgId}: ${errMsg}`)
      }
    }

    return NextResponse.json({
      success: true,
      ...results,
    })
  } catch (error) {
    console.error('[Migration] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
