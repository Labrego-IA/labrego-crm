import { NextRequest, NextResponse } from 'next/server'
import { getAdminDb, getAdminAuth } from '@/lib/firebaseAdmin'

export const runtime = 'nodejs'

/**
 * POST /api/admin/members/search-by-email
 * Searches for an existing user by email across Firebase Auth.
 * Returns user info if found, or indicates that the user doesn't exist yet.
 */
export async function POST(req: NextRequest) {
  const callerEmail = req.headers.get('x-user-email')?.toLowerCase()
  if (!callerEmail) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }

  try {
    const { orgId, email } = await req.json()

    if (!orgId || !email) {
      return NextResponse.json({ error: 'missing required fields' }, { status: 400 })
    }

    const normalizedEmail = email.toLowerCase().trim()

    // Verify caller is admin of this org
    const db = getAdminDb()
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
      return NextResponse.json({ error: 'only admins can search members' }, { status: 403 })
    }

    // Check if email already exists in org
    const existingSnap = await db
      .collection('organizations').doc(orgId)
      .collection('members')
      .where('email', '==', normalizedEmail)
      .limit(1)
      .get()

    if (!existingSnap.empty) {
      return NextResponse.json({ error: 'email already exists in organization' }, { status: 409 })
    }

    // Search in Firebase Auth
    const auth = getAdminAuth()
    try {
      const userRecord = await auth.getUserByEmail(normalizedEmail)
      return NextResponse.json({
        found: true,
        user: {
          uid: userRecord.uid,
          email: userRecord.email,
          displayName: userRecord.displayName || userRecord.email?.split('@')[0] || '',
          photoUrl: userRecord.photoURL || null,
        },
      })
    } catch {
      // User not found in Firebase Auth
      return NextResponse.json({
        found: false,
        user: null,
      })
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    console.error('[search-by-email] Error:', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
