/**
 * Seed Script: Create plan documents in Firestore
 *
 * Creates the three SaaS plan documents (basic, standard, pro)
 * in the `plans` collection.
 *
 * Usage:
 *   npx ts-node --skip-project scripts/seed-plans.ts
 *
 * This is idempotent — running it again will overwrite existing plan docs.
 */

import * as admin from 'firebase-admin'
import * as dotenv from 'dotenv'
import * as path from 'path'

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') })

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

interface PlanDoc {
  id: string
  displayName: string
  price: number
  features: string[]
  limits: {
    maxUsers: number
    maxFunnels: number
    maxContacts: number
    monthlyCredits: number
  }
  order: number
  createdAt: string
}

const plans: PlanDoc[] = [
  {
    id: 'basic',
    displayName: 'Basic',
    price: 97,
    features: ['funnel', 'contacts', 'proposals'],
    limits: {
      maxUsers: 3,
      maxFunnels: 1,
      maxContacts: 500,
      monthlyCredits: 0,
    },
    order: 1,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'standard',
    displayName: 'Standard',
    price: 197,
    features: ['funnel', 'contacts', 'proposals', 'cadence', 'productivity', 'whatsapp_plugin'],
    limits: {
      maxUsers: 10,
      maxFunnels: 3,
      maxContacts: 2000,
      monthlyCredits: 60,
    },
    order: 2,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'pro',
    displayName: 'Pro',
    price: 497,
    features: [
      'funnel', 'contacts', 'proposals', 'cadence', 'productivity',
      'whatsapp_plugin', 'email_automation', 'crm_automation',
      'voice_agent', 'whatsapp_agent', 'ai_reports',
    ],
    limits: {
      maxUsers: 50,
      maxFunnels: 10,
      maxContacts: 10000,
      monthlyCredits: 300,
    },
    order: 3,
    createdAt: new Date().toISOString(),
  },
]

async function main() {
  console.log('===========================================')
  console.log('  Seed Plans Script')
  console.log('===========================================')

  const batch = db.batch()

  for (const plan of plans) {
    const ref = db.collection('plans').doc(plan.id)
    batch.set(ref, plan)
    console.log(`  + ${plan.displayName} (R$${plan.price}/mes) — ${plan.features.length} features, ${plan.limits.maxUsers} users`)
  }

  await batch.commit()

  console.log('\n  3 plans created/updated in Firestore')
  console.log('===========================================')
  process.exit(0)
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
