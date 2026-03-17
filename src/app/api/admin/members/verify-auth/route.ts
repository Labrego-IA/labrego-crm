import { NextRequest, NextResponse } from 'next/server'
import { getAdminDb, getAdminAuth } from '@/lib/firebaseAdmin'

export const runtime = 'nodejs'

/**
 * POST /api/admin/members/verify-auth
 * Receives an array of userIds and returns which ones still exist in Firebase Auth.
 */
export async function POST(req: NextRequest) {
  const callerEmail = req.headers.get('x-user-email')?.toLowerCase()
  if (!callerEmail) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }

  try {
    const { orgId, userIds } = await req.json()

    if (!orgId || !Array.isArray(userIds) || userIds.length === 0) {
      return NextResponse.json({ error: 'missing required fields' }, { status: 400 })
    }

    const db = getAdminDb()

    // Verify caller is admin of this org
    const callerSnap = await db
      .collection('organizations').doc(orgId)
      .collection('members')
      .where('email', '==', callerEmail)
      .limit(1)
      .get()

    if (callerSnap.empty) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 })
    }

    const callerMember = callerSnap.docs[0].data()
    if (callerMember.role !== 'admin') {
      return NextResponse.json({ error: 'only admins can verify members' }, { status: 403 })
    }

    // Check which userIds still exist in Firebase Auth
    const auth = getAdminAuth()
    const validUserIds: string[] = []

    // Firebase Admin getUsers supports up to 100 identifiers per call
    const chunks: string[][] = []
    for (let i = 0; i < userIds.length; i += 100) {
      chunks.push(userIds.slice(i, i + 100))
    }

    for (const chunk of chunks) {
      const identifiers = chunk.map((uid: string) => ({ uid }))
      const result = await auth.getUsers(identifiers)
      for (const user of result.users) {
        validUserIds.push(user.uid)
      }
    }

    return NextResponse.json({ validUserIds })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    console.error('[verify-auth] Error:', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
