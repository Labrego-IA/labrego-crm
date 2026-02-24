import { getAdminDb } from './firebaseAdmin'

const SUPER_ADMIN_COLLECTION = 'superAdmins'

export async function isSuperAdmin(email: string): Promise<boolean> {
  const db = getAdminDb()
  const doc = await db.collection(SUPER_ADMIN_COLLECTION).doc(email.toLowerCase()).get()
  return doc.exists
}

export async function addSuperAdmin(email: string) {
  const db = getAdminDb()
  await db.collection(SUPER_ADMIN_COLLECTION).doc(email.toLowerCase()).set({
    role: 'super_admin',
    createdAt: new Date().toISOString(),
  })
}

export async function removeSuperAdmin(email: string) {
  const db = getAdminDb()
  await db.collection(SUPER_ADMIN_COLLECTION).doc(email.toLowerCase()).delete()
}

export async function listSuperAdmins(): Promise<string[]> {
  const db = getAdminDb()
  const snap = await db.collection(SUPER_ADMIN_COLLECTION).get()
  return snap.docs.map(doc => doc.id)
}
