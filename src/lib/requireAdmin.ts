import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { getAdminDb } from '@/lib/firebaseAdmin'
import { FALLBACK_ADMIN_EMAILS } from './adminEmails'

export { FALLBACK_ADMIN_EMAILS } from './adminEmails'

export interface RoleConfig {
  allowedScreens?: string[]
  actionPermissions?: Record<string, { viewScope?: 'own' | 'all'; edit?: boolean; delete?: boolean }>
}

/**
 * Fetches the role of a user based on the provided e-mail.
 * Falls back to 'user' when no role document is found.
 */
export async function getUserRole(email: string): Promise<string> {
  const db = getAdminDb()
  const snap = await db.collection('userRoles').doc(email).get()
  if (snap.exists) {
    const data = snap.data() as any
    if (data?.frozen) return 'frozen'
    const role = data?.role
    if (!role && FALLBACK_ADMIN_EMAILS.includes(email)) return 'admin'
    return role || 'user'
  }
  if (FALLBACK_ADMIN_EMAILS.includes(email)) return 'admin'
  return 'user'
}

/**
 * Fetches the roleConfig for a given role name.
 */
export async function getRoleConfig(roleName: string): Promise<RoleConfig | null> {
  if (!roleName || roleName === 'frozen') return null
  const db = getAdminDb()
  const snap = await db.collection('roleConfigs').doc(roleName).get()
  if (!snap.exists) return null
  return snap.data() as RoleConfig
}

/**
 * Checks if a user can view all items for a specific screen path.
 * Returns true if user is admin OR has viewScope: 'all' for the screen.
 */
export async function canViewAllForScreen(email: string, screenPath: string): Promise<boolean> {
  const role = await getUserRole(email)
  if (role === 'admin') return true
  if (role === 'frozen') return false

  const roleConfig = await getRoleConfig(role)
  if (!roleConfig?.actionPermissions) return false

  // Check exact path match
  const permissions = roleConfig.actionPermissions[screenPath]
  if (permissions?.viewScope === 'all') return true

  // Check parent path match (e.g., /projetos/suporte for /projetos/suporte/*)
  for (const [path, perms] of Object.entries(roleConfig.actionPermissions)) {
    if (screenPath.startsWith(path) && perms?.viewScope === 'all') {
      return true
    }
  }

  return false
}

/**
 * Checks if a user can edit items for a specific screen path.
 * Returns true if user is admin OR has edit: true for the screen.
 */
export async function canEditForScreen(email: string, screenPath: string): Promise<boolean> {
  const role = await getUserRole(email)
  if (role === 'admin') return true
  if (role === 'frozen') return false

  const roleConfig = await getRoleConfig(role)
  if (!roleConfig?.actionPermissions) return false

  // Check exact path match
  const permissions = roleConfig.actionPermissions[screenPath]
  if (permissions?.edit === true) return true

  // Check parent path match (e.g., /projetos/suporte for /projetos/suporte/*)
  for (const [path, perms] of Object.entries(roleConfig.actionPermissions)) {
    if (screenPath.startsWith(path) && perms?.edit === true) {
      return true
    }
  }

  return false
}

/**
 * Ensures that the incoming API request belongs to an admin user.
 * It expects the frontend to send the authenticated e-mail in the
 * `x-user-email` header. When the user is not authenticated or does not
 * have the required role, a JSON response with the appropriate status code
 * is returned.
 */
export async function requireAdminApi(
  req: NextRequest
): Promise<string | NextResponse> {
  const email = req.headers.get('x-user-email')?.toLowerCase()
  if (!email) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }
  const role = await getUserRole(email)
  if (role === 'frozen') {
    return NextResponse.json({ error: 'account_frozen' }, { status: 403 })
  }
  if (role !== 'admin') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }
  return email
}

/**
 * Server utility to guard pages under the `(admin)` route group. It reads the
 * `x-user-email` header (populated by the client) and redirects the request to
 * `/login` when missing or to the client area (`/`) when the user lacks the
 * required role.
 */
export async function requireAdminPage(): Promise<void> {
  const headersList = await headers()
  const email = headersList.get('x-user-email')?.toLowerCase()
  if (!email) {
    redirect('/login')
  }
  const role = await getUserRole(email)
  if (role === 'frozen') {
    redirect('/sem-acesso')
  }
  if (role !== 'admin') {
    redirect('/sem-acesso')
  }
}
