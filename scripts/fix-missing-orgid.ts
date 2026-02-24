import * as admin from 'firebase-admin'
import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') })

const { FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY } = process.env

admin.initializeApp({
  credential: admin.credential.cert({
    projectId: FIREBASE_PROJECT_ID!,
    clientEmail: FIREBASE_CLIENT_EMAIL!,
    privateKey: FIREBASE_PRIVATE_KEY!.replace(/\\n/g, '\n'),
  }),
})

const db = admin.firestore()
const ORG_ID = '5ll2vGQSaAC0lzuwRkmm'

async function main() {
  // Fix clients without orgId
  const clientsSnap = await db.collection('clients').where('orgId', '==', '').get()
  const clientsSnap2 = await db.collection('clients').get()

  let fixed = 0
  const batch = db.batch()

  for (const doc of clientsSnap2.docs) {
    const data = doc.data()
    if (!data.orgId) {
      batch.update(doc.ref, { orgId: ORG_ID })
      fixed++
      console.log(`  Fixed: ${doc.id} (${data.name})`)
    }
  }

  if (fixed > 0) {
    await batch.commit()
    console.log(`\nFixed ${fixed} clients with missing orgId`)
  } else {
    console.log('No clients with missing orgId found')
  }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1) })
