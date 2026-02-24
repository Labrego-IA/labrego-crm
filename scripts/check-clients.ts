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

async function main() {
  const snap = await db.collection('clients').limit(10).get()
  console.log('Total clients found:', snap.size)
  snap.docs.forEach(d => {
    const data = d.data()
    console.log(`  - ${d.id} | orgId: ${data.orgId || 'MISSING'} | name: ${data.name}`)
  })
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1) })
