import { NextRequest } from 'next/server'
import { getAdminAuth } from '@/lib/firebaseAdmin'

/**
 * Verifica autenticação para rotas da Chrome Extension.
 * Aceita apenas Firebase ID Tokens verificados pelo Admin SDK.
 * NÃO faz fallback para decodificação JWT sem assinatura.
 */
export async function verifyExtensionAuth(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return null
  }

  const token = authHeader.slice(7)
  if (!token) return null

  try {
    const auth = getAdminAuth()
    const decodedToken = await auth.verifyIdToken(token)
    return decodedToken
  } catch {
    return null
  }
}
