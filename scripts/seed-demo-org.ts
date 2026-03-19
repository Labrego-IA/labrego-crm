/**
 * Seed Script: Create a demo organization with members
 *
 * Creates:
 *   - An organization document in `organizations` collection
 *   - Admin member in `organizations/{orgId}/members` subcollection
 *   - Default funnel stages in `funnelStages` collection
 *   - Default call routing config in `callRoutingConfig` collection
 *
 * Usage:
 *   npx ts-node --skip-project scripts/seed-demo-org.ts <admin-email> [org-name] [plan]
 *
 * Example:
 *   npx ts-node --skip-project scripts/seed-demo-org.ts admin@empresa.com "Minha Empresa" pro
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

const ADMIN_EMAIL = process.argv[2]
const ORG_NAME = process.argv[3] || 'Empresa Demo'
const PLAN = (process.argv[4] || 'pro') as 'basic' | 'standard' | 'pro'

if (!ADMIN_EMAIL) {
  console.error('Usage: npx ts-node --skip-project scripts/seed-demo-org.ts <admin-email> [org-name] [plan]')
  console.error('Example: npx ts-node --skip-project scripts/seed-demo-org.ts admin@empresa.com "Minha Empresa" pro')
  process.exit(1)
}

const PLAN_LIMITS: Record<string, { maxUsers: number; maxFunnels: number; maxContacts: number }> = {
  basic: { maxUsers: 3, maxFunnels: 1, maxContacts: 500 },
  standard: { maxUsers: 10, maxFunnels: 3, maxContacts: 2000 },
  pro: { maxUsers: 50, maxFunnels: 10, maxContacts: 10000 },
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

const DEFAULT_FUNNEL_STAGES = [
  { name: 'Novo', order: 0, color: '0' },
  { name: 'Qualificado', order: 1, color: '1' },
  { name: 'Proposta Enviada', order: 2, color: '5' },
  { name: 'Negociacao', order: 3, color: '3' },
  { name: 'Fechado - Ganho', order: 4, color: '2' },
  { name: 'Fechado - Perdido', order: 5, color: '7' },
]

async function main() {
  console.log('===========================================')
  console.log('  Seed Demo Organization Script')
  console.log('===========================================')
  console.log(`  Admin email: ${ADMIN_EMAIL}`)
  console.log(`  Org name: ${ORG_NAME}`)
  console.log(`  Plan: ${PLAN}`)
  console.log('===========================================\n')

  const now = new Date().toISOString()
  const slug = slugify(ORG_NAME)
  const limits = PLAN_LIMITS[PLAN] || PLAN_LIMITS.pro

  // 1. Create organization
  const orgRef = db.collection('organizations').doc()
  const orgId = orgRef.id

  const orgData = {
    id: orgId,
    name: ORG_NAME,
    slug,
    plan: PLAN,
    settings: {
      timezone: 'America/Sao_Paulo',
      currency: 'BRL',
    },
    limits,
    status: 'active',
    createdAt: now,
    updatedAt: now,
  }

  await orgRef.set(orgData)
  console.log(`  + Organization created: ${ORG_NAME} (${orgId})`)

  // 2. Create admin member
  const memberRef = orgRef.collection('members').doc()
  const memberData = {
    id: memberRef.id,
    userId: ADMIN_EMAIL, // Will be updated when user first logs in
    email: ADMIN_EMAIL.toLowerCase(),
    role: 'admin',
    displayName: ADMIN_EMAIL.split('@')[0],
    permissions: {
      pages: [
        '/contatos', '/funil', '/funil/produtividade', '/conversao',
        '/cadencia', '/ligacoes', '/admin/usuarios', '/admin/creditos', '/plano',
      ],
      actions: {
        canCreateContacts: true,
        canEditContacts: true,
        canDeleteContacts: true,
        canCreateProposals: true,
        canExportData: true,
        canManageFunnels: true,
        canManageUsers: true,
        canTriggerCalls: true,
        canViewReports: true,
        canManageSettings: true,
      },
      viewScope: 'all',
    },
    status: 'active',
    joinedAt: now,
  }

  await memberRef.set(memberData)
  console.log(`  + Admin member created: ${ADMIN_EMAIL}`)

  // 3. Create default funnel stages
  const batch = db.batch()

  for (const stage of DEFAULT_FUNNEL_STAGES) {
    const stageRef = db.collection('funnelStages').doc()
    batch.set(stageRef, {
      ...stage,
      orgId,
      funnelId: 'default',
      createdAt: now,
    })
  }

  await batch.commit()
  console.log(`  + ${DEFAULT_FUNNEL_STAGES.length} default funnel stages created`)

  // 4. Create default call routing config
  await db.collection('callRoutingConfig').doc(orgId).set({
    orgId,
    schedule: {
      startHour: 9,
      endHour: 18,
      slotDuration: 30,
      workDays: [1, 2, 3, 4, 5],
    },
    callConfig: {
      maxRetries: 3,
      retryIntervalMinutes: 30,
    },
    createdAt: now,
    updatedAt: now,
  })
  console.log('  + Default call routing config created')

  // 5. Create credits record
  await db.collection('organizations').doc(orgId).collection('credits').doc('current').set({
    balance: PLAN === 'pro' ? 300 : PLAN === 'standard' ? 60 : 0,
    monthlyAllowance: PLAN === 'pro' ? 300 : PLAN === 'standard' ? 60 : 0,
    usedThisMonth: 0,
    lastResetAt: now,
    updatedAt: now,
  })
  console.log('  + Credits record created')

  // Summary
  console.log('\n===========================================')
  console.log('  SETUP COMPLETE')
  console.log('===========================================')
  console.log(`  Organization ID: ${orgId}`)
  console.log(`  Slug: ${slug}`)
  console.log(`  Plan: ${PLAN}`)
  console.log(`  Admin: ${ADMIN_EMAIL}`)
  console.log('')
  console.log('  Next steps:')
  console.log(`  1. Set DEFAULT_ORG_ID=${orgId} in .env.local`)
  console.log(`  2. Run migration if you have existing data:`)
  console.log(`     npx ts-node --skip-project scripts/migrate-to-multitenant.ts ${orgId}`)
  console.log('  3. Start the app: npm run dev')
  console.log('===========================================')

  process.exit(0)
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
