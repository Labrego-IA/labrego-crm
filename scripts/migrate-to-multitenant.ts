/**
 * Migration Script: Add orgId to existing Firestore documents
 *
 * This script adds the `orgId` field to all root-level documents that
 * are now required for multi-tenant SaaS operation.
 *
 * Usage:
 *   npx ts-node --skip-project scripts/migrate-to-multitenant.ts <orgId>
 *
 * Example:
 *   npx ts-node --skip-project scripts/migrate-to-multitenant.ts abc123orgId
 *
 * Collections migrated:
 *   - clients
 *   - funnelStages
 *   - macroStages
 *   - cadenceSteps
 *   - costCenters
 *   - projects
 *   - proposals
 *   - callScripts
 *   - callQueues
 *   - callQueueItems
 *   - callRoutingConfig
 *   - fcmTokens
 *
 * Note: Subcollections (followups, logs, documents, briefings, etc.)
 * are NOT migrated because they are scoped by their parent document.
 */

import * as admin from 'firebase-admin'
import * as dotenv from 'dotenv'
import * as path from 'path'

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') })

const ORG_ID = process.argv[2]

if (!ORG_ID) {
  console.error('Usage: npx ts-node --skip-project scripts/migrate-to-multitenant.ts <orgId>')
  console.error('Example: npx ts-node --skip-project scripts/migrate-to-multitenant.ts abc123')
  process.exit(1)
}

const DRY_RUN = process.argv.includes('--dry-run')

// Initialize Firebase Admin
const { FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY, FIREBASE_STORAGE_BUCKET, NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET } = process.env

if (!FIREBASE_PROJECT_ID || !FIREBASE_CLIENT_EMAIL || !FIREBASE_PRIVATE_KEY) {
  console.error('Missing Firebase Admin credentials. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY in .env.local')
  process.exit(1)
}

admin.initializeApp({
  credential: admin.credential.cert({
    projectId: FIREBASE_PROJECT_ID,
    clientEmail: FIREBASE_CLIENT_EMAIL,
    privateKey: FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  }),
  storageBucket: FIREBASE_STORAGE_BUCKET || NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
})

const db = admin.firestore()

// Collections that need orgId
const COLLECTIONS = [
  'clients',
  'funnelStages',
  'macroStages',
  'cadenceSteps',
  'costCenters',
  'projects',
  'proposals',
  'callScripts',
  'callQueues',
  'callQueueItems',
  'fcmTokens',
]

async function migrateCollection(collectionName: string): Promise<{ total: number; migrated: number; skipped: number }> {
  console.log(`\n--- Migrating collection: ${collectionName} ---`)

  const snapshot = await db.collection(collectionName).get()
  let migrated = 0
  let skipped = 0

  // Process in batches of 500 (Firestore batch limit)
  const BATCH_SIZE = 500
  let batch = db.batch()
  let batchCount = 0

  for (const doc of snapshot.docs) {
    const data = doc.data()

    if (data.orgId) {
      skipped++
      continue
    }

    if (DRY_RUN) {
      console.log(`  [DRY-RUN] Would set orgId=${ORG_ID} on ${collectionName}/${doc.id}`)
      migrated++
      continue
    }

    batch.update(doc.ref, { orgId: ORG_ID })
    batchCount++
    migrated++

    if (batchCount >= BATCH_SIZE) {
      await batch.commit()
      console.log(`  Committed batch of ${batchCount} updates`)
      batch = db.batch()
      batchCount = 0
    }
  }

  if (batchCount > 0) {
    await batch.commit()
    console.log(`  Committed final batch of ${batchCount} updates`)
  }

  console.log(`  Total: ${snapshot.size} | Migrated: ${migrated} | Skipped (already has orgId): ${skipped}`)

  return { total: snapshot.size, migrated, skipped }
}

async function migrateCallRoutingConfig(): Promise<void> {
  console.log(`\n--- Migrating callRoutingConfig ---`)

  // The old system uses a single doc 'settings'
  // The new system uses orgId as the doc ID
  const settingsDoc = await db.collection('callRoutingConfig').doc('settings').get()

  if (!settingsDoc.exists) {
    console.log('  No callRoutingConfig/settings doc found. Skipping.')
    return
  }

  const data = settingsDoc.data()!

  // Check if already migrated
  const orgDoc = await db.collection('callRoutingConfig').doc(ORG_ID).get()
  if (orgDoc.exists) {
    console.log(`  callRoutingConfig/${ORG_ID} already exists. Skipping.`)
    return
  }

  if (DRY_RUN) {
    console.log(`  [DRY-RUN] Would copy callRoutingConfig/settings -> callRoutingConfig/${ORG_ID}`)
    return
  }

  // Copy settings to org-specific doc
  await db.collection('callRoutingConfig').doc(ORG_ID).set({
    ...data,
    orgId: ORG_ID,
  })

  console.log(`  Copied callRoutingConfig/settings -> callRoutingConfig/${ORG_ID}`)
}

async function main() {
  console.log('===========================================')
  console.log('  Multi-Tenant Migration Script')
  console.log('===========================================')
  console.log(`  Target orgId: ${ORG_ID}`)
  console.log(`  Dry run: ${DRY_RUN}`)
  console.log(`  Collections: ${COLLECTIONS.length + 1}`)
  console.log('===========================================')

  const results: Record<string, { total: number; migrated: number; skipped: number }> = {}

  for (const collection of COLLECTIONS) {
    try {
      results[collection] = await migrateCollection(collection)
    } catch (err) {
      console.error(`  ERROR migrating ${collection}:`, err)
      results[collection] = { total: -1, migrated: 0, skipped: 0 }
    }
  }

  // Special: callRoutingConfig
  try {
    await migrateCallRoutingConfig()
  } catch (err) {
    console.error('  ERROR migrating callRoutingConfig:', err)
  }

  // Summary
  console.log('\n===========================================')
  console.log('  MIGRATION SUMMARY')
  console.log('===========================================')

  let totalMigrated = 0
  let totalDocs = 0

  for (const [collection, result] of Object.entries(results)) {
    const status = result.total === -1 ? 'ERROR' : `${result.migrated}/${result.total}`
    console.log(`  ${collection}: ${status} migrated`)
    if (result.total > 0) {
      totalDocs += result.total
      totalMigrated += result.migrated
    }
  }

  console.log('-------------------------------------------')
  console.log(`  Total: ${totalMigrated}/${totalDocs} documents migrated`)

  if (DRY_RUN) {
    console.log('\n  This was a DRY RUN. No data was modified.')
    console.log('  Remove --dry-run to apply changes.')
  }

  console.log('\n===========================================')
  process.exit(0)
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
