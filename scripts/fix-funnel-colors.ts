/**
 * Fix funnel stage colors: convert hex colors to numeric indices
 *
 * The funil page expects numeric color indices (0-9) matching stageColorOptions array,
 * but the seed script originally created stages with hex color strings.
 */
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

// Map stage names to color indices (matching stageColorOptions in funil/page.tsx)
// 0=Azul, 1=Ciano, 2=Verde, 3=Amarelo, 4=Laranja, 5=Roxo, 6=Rosa, 7=Vermelho, 8=Cinza, 9=Teal
const NAME_TO_COLOR: Record<string, string> = {
  'Novo': '0',              // Azul
  'Qualificado': '1',       // Ciano
  'Proposta Enviada': '5',  // Roxo
  'Negociacao': '3',        // Amarelo
  'Fechado - Ganho': '2',   // Verde
  'Fechado - Perdido': '7', // Vermelho
}

async function main() {
  const snap = await db.collection('funnelStages').get()
  console.log(`Found ${snap.size} funnel stages`)

  let fixed = 0
  const batch = db.batch()

  for (const doc of snap.docs) {
    const data = doc.data()
    const color = data.color || ''

    // If color starts with # or is not a valid numeric index, fix it
    if (color.startsWith('#') || isNaN(parseInt(color))) {
      const newColor = NAME_TO_COLOR[data.name] || String(data.order || 0)
      batch.update(doc.ref, { color: newColor })
      console.log(`  Fix: "${data.name}" color "${color}" → "${newColor}"`)
      fixed++
    } else {
      console.log(`  OK:  "${data.name}" color "${color}"`)
    }
  }

  if (fixed > 0) {
    await batch.commit()
    console.log(`\nFixed ${fixed} funnel stages`)
  } else {
    console.log('\nAll funnel stages already have correct color format')
  }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1) })
