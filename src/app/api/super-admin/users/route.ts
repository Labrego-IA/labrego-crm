import { NextRequest, NextResponse } from 'next/server'
import { isSuperAdmin } from '@/lib/superAdmin'
import { getAdminDb, getAdminAuth } from '@/lib/firebaseAdmin'

async function requireSuperAdmin(req: NextRequest): Promise<string | NextResponse> {
  const email = req.headers.get('x-user-email')?.toLowerCase()
  if (!email) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }
  if (!(await isSuperAdmin(email))) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }
  return email
}

export async function GET(req: NextRequest) {
  const result = await requireSuperAdmin(req)
  if (result instanceof NextResponse) return result

  try {
    const auth = getAdminAuth()
    const db = getAdminDb()

    // List all Firebase Auth users (paginated, max 1000 per call)
    const allUsers: any[] = []
    let nextPageToken: string | undefined
    do {
      const listResult = await auth.listUsers(1000, nextPageToken)
      allUsers.push(...listResult.users)
      nextPageToken = listResult.pageToken
    } while (nextPageToken)

    // Get all organizations to map members to plans
    const orgsSnap = await db.collection('organizations').get()
    const orgMap = new Map<string, { name: string; plan: string; createdAt: string; updatedAt: string }>()
    orgsSnap.docs.forEach((doc) => {
      const data = doc.data()
      orgMap.set(doc.id, { name: data.name, plan: data.plan, createdAt: data.createdAt || '', updatedAt: data.updatedAt || data.createdAt || '' })
    })

    // Get all members across all organizations to map userId -> org
    const userOrgMap = new Map<string, { orgId: string; memberId: string; orgName: string; plan: string; role: string; orgCreatedAt: string; orgUpdatedAt: string }>()
    for (const [orgId, orgData] of orgMap) {
      const membersSnap = await db.collection('organizations').doc(orgId).collection('members').get()
      membersSnap.docs.forEach((doc) => {
        const member = doc.data()
        if (member.userId) {
          userOrgMap.set(member.userId, {
            orgId,
            memberId: doc.id,
            orgName: orgData.name,
            plan: member.plan || orgData.plan,
            role: member.role || 'user',
            orgCreatedAt: orgData.createdAt,
            orgUpdatedAt: orgData.updatedAt,
          })
        }
      })
    }

    const users = allUsers.map((user) => {
      const orgInfo = userOrgMap.get(user.uid)
      return {
        uid: user.uid,
        email: user.email || '',
        displayName: user.displayName || '',
        disabled: user.disabled,
        createdAt: user.metadata.creationTime,
        lastSignIn: user.metadata.lastSignInTime,
        plan: orgInfo?.plan || null,
        orgName: orgInfo?.orgName || null,
        orgId: orgInfo?.orgId || null,
        memberId: orgInfo?.memberId || null,
        role: orgInfo?.role || null,
        orgCreatedAt: orgInfo?.orgCreatedAt || null,
        orgUpdatedAt: orgInfo?.orgUpdatedAt || null,
      }
    })

    return NextResponse.json({ users })
  } catch (error: any) {
    console.error('[super-admin/users] GET error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  const result = await requireSuperAdmin(req)
  if (result instanceof NextResponse) return result

  try {
    const body = await req.json()
    const { uid, action } = body
    if (!uid || !action) {
      return NextResponse.json({ error: 'missing uid or action' }, { status: 400 })
    }

    const auth = getAdminAuth()

    switch (action) {
      case 'disable':
        await auth.updateUser(uid, { disabled: true })
        break
      case 'enable':
        await auth.updateUser(uid, { disabled: false })
        break
      case 'delete':
        await auth.deleteUser(uid)
        break
      case 'update': {
        const db = getAdminDb()
        // Update user disabled status if provided
        if (body.disabled !== undefined) {
          const disabled = body.disabled === true || body.disabled === 'true'
          await auth.updateUser(uid, { disabled })
        }
        // Update organization name if orgId is provided
        if (body.orgId && body.orgName !== undefined) {
          await db.collection('organizations').doc(body.orgId).update({ name: body.orgName })
        }
        // Update plan on the member document (per-user)
        if (body.orgId && body.memberId && body.plan !== undefined) {
          await db.collection('organizations').doc(body.orgId).collection('members').doc(body.memberId).update({ plan: body.plan })
        }
        break
      }
      default:
        return NextResponse.json({ error: 'invalid action' }, { status: 400 })
    }

    return NextResponse.json({ ok: true })
  } catch (error: any) {
    console.error('[super-admin/users] PUT error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
