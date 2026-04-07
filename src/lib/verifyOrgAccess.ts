/**
 * verifyOrgAccess — Helper de seguranca para verificar que o usuario pertence a org
 *
 * Uso em API routes:
 *   const access = await verifyOrgAccess(request, orgId)
 *   if (!access.authorized) return NextResponse.json({ error: access.error }, { status: 403 })
 */

import { getAdminAuth, getAdminDb } from './firebaseAdmin'

interface AccessResult {
  authorized: boolean
  userId?: string
  email?: string
  error?: string
}

/**
 * Verifica se o request tem um token Firebase valido e se o usuario
 * pertence a org especificada.
 *
 * Aceita auth via:
 * 1. Header Authorization: Bearer <firebase-id-token>
 * 2. Header x-user-email (fallback para compatibilidade)
 */
export async function verifyOrgAccess(
  request: Request,
  orgId: string
): Promise<AccessResult> {
  if (!orgId) {
    return { authorized: false, error: 'orgId nao fornecido' }
  }

  try {
    const authHeader = request.headers.get('authorization')
    let email: string | undefined
    let userId: string | undefined

    // Tentar verificar via Firebase ID token
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7)
      try {
        const auth = getAdminAuth()
        const decoded = await auth.verifyIdToken(token)
        email = decoded.email
        userId = decoded.uid
      } catch {
        // Token invalido — tentar fallback
      }
    }

    // Fallback: header x-user-email (usado pelo frontend)
    if (!email) {
      email = request.headers.get('x-user-email') || undefined
    }

    if (!email) {
      return { authorized: false, error: 'Nao autenticado' }
    }

    // Verificar se o usuario e membro da org
    const db = getAdminDb()
    const membersSnap = await db
      .collection('organizations')
      .doc(orgId)
      .collection('members')
      .where('email', '==', email.toLowerCase())
      .where('status', '==', 'active')
      .limit(1)
      .get()

    if (membersSnap.empty) {
      // Verificar se e super admin
      const adminEmails = (process.env.NEXT_PUBLIC_ADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase())
      if (!adminEmails.includes(email.toLowerCase())) {
        return { authorized: false, error: 'Acesso negado a esta organizacao' }
      }
    }

    return { authorized: true, userId, email }
  } catch (error) {
    console.error('[verifyOrgAccess] Erro:', error)
    return { authorized: false, error: 'Erro de autenticacao' }
  }
}
