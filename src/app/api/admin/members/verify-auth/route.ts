import { NextRequest, NextResponse } from 'next/server'
import { getAdminDb, getAdminAuth } from '@/lib/firebaseAdmin'

export const runtime = 'nodejs'

export interface AuthUser {
  uid: string
  email: string
  displayName: string | undefined
  photoURL: string | undefined
  provider: string
  createdAt: string | undefined
  lastSignIn: string | undefined
  disabled: boolean
}

/**
 * GET /api/admin/members/verify-auth?orgId=xxx
 * Lists all Firebase Auth users. Only accessible by org admins.
 */
export async function GET(req: NextRequest) {
  const callerEmail = req.headers.get('x-user-email')?.toLowerCase()
  if (!callerEmail) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }

  const orgId = req.nextUrl.searchParams.get('orgId')
  if (!orgId) {
    return NextResponse.json({ error: 'missing orgId' }, { status: 400 })
  }

  try {
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
    const isCallerAdmin = callerMember.role === 'admin'
    const isCallerOwner = !callerMember.invitedBy
    const isCallerSystemAdmin = callerMember.systemRole === 'admin'
    const canManageUsers = callerMember.permissions?.actions?.canManageUsers === true

    if (!isCallerAdmin && !isCallerOwner && !isCallerSystemAdmin && !canManageUsers) {
      return NextResponse.json({ error: 'only admins can list auth users' }, { status: 403 })
    }

    // List all Firebase Auth users
    const auth = getAdminAuth()
    const authUsers: AuthUser[] = []
    let nextPageToken: string | undefined

    do {
      const listResult = await auth.listUsers(1000, nextPageToken)
      for (const user of listResult.users) {
        const provider = user.providerData?.[0]?.providerId || 'email'
        authUsers.push({
          uid: user.uid,
          email: user.email || '',
          displayName: user.displayName,
          photoURL: user.photoURL,
          provider,
          createdAt: user.metadata.creationTime,
          lastSignIn: user.metadata.lastSignInTime,
          disabled: user.disabled,
        })
      }
      nextPageToken = listResult.pageToken
    } while (nextPageToken)

    return NextResponse.json({ users: authUsers })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    console.error('[verify-auth] Error:', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
