import { getAdminDb } from './firebaseAdmin'
import type { OrgMember, MemberPermissions } from '@/types/organization'
import { ROLE_PRESETS, type RolePreset } from '@/types/permissions'

function getMembersRef(orgId: string) {
  const db = getAdminDb()
  return db.collection('organizations').doc(orgId).collection('members')
}

export async function getMembers(orgId: string): Promise<OrgMember[]> {
  const snap = await getMembersRef(orgId).orderBy('joinedAt', 'desc').get()
  return snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as OrgMember))
}

export async function getMemberByEmail(orgId: string, email: string): Promise<OrgMember | null> {
  const snap = await getMembersRef(orgId).where('email', '==', email.toLowerCase()).limit(1).get()
  if (snap.empty) return null
  const doc = snap.docs[0]
  return { id: doc.id, ...doc.data() } as OrgMember
}

export async function findMemberOrgByEmail(email: string): Promise<{ orgId: string; member: OrgMember } | null> {
  const db = getAdminDb()
  const orgsSnap = await db.collection('organizations').where('status', '==', 'active').get()

  for (const orgDoc of orgsSnap.docs) {
    const memberSnap = await orgDoc.ref.collection('members')
      .where('email', '==', email.toLowerCase())
      .where('status', 'in', ['active', 'invited'])
      .limit(1)
      .get()

    if (!memberSnap.empty) {
      const memberDoc = memberSnap.docs[0]
      return {
        orgId: orgDoc.id,
        member: { id: memberDoc.id, ...memberDoc.data() } as OrgMember,
      }
    }
  }

  return null
}

export async function addMember(orgId: string, data: {
  email: string
  role: RolePreset
  displayName: string
  photoUrl?: string
  invitedBy?: string
  userId?: string
}): Promise<OrgMember> {
  const ref = getMembersRef(orgId)

  // Check if already exists
  const existing = await getMemberByEmail(orgId, data.email)
  if (existing) throw new Error('Member already exists in this organization')

  const permissions = ROLE_PRESETS[data.role]
  const now = new Date().toISOString()

  const memberData = {
    userId: data.userId || '',
    email: data.email.toLowerCase(),
    role: data.role,
    displayName: data.displayName,
    photoUrl: data.photoUrl || '',
    permissions,
    status: 'active' as const,
    joinedAt: now,
    invitedBy: data.invitedBy || '',
  }

  const docRef = ref.doc()
  await docRef.set(memberData)

  return { id: docRef.id, ...memberData }
}

export async function updateMember(orgId: string, memberId: string, data: Partial<Pick<OrgMember, 'role' | 'permissions' | 'status' | 'displayName' | 'photoUrl'>>) {
  const ref = getMembersRef(orgId).doc(memberId)
  await ref.update(data)
}

export async function removeMember(orgId: string, memberId: string) {
  await getMembersRef(orgId).doc(memberId).delete()
}

export async function updateMemberPermissions(orgId: string, memberId: string, permissions: MemberPermissions) {
  await getMembersRef(orgId).doc(memberId).update({ permissions })
}
