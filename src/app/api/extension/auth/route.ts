import { NextRequest, NextResponse } from 'next/server'
import { getAdminAuth, getAdminDb } from '@/lib/firebaseAdmin'
import { resolveOrgByEmail } from '@/lib/orgResolver'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const FIREBASE_API_KEY = process.env.NEXT_PUBLIC_FIREBASE_API_KEY

type LoginPayload = {
  email: string
  password: string
}

function clean(value: unknown) {
  if (typeof value !== 'string') return ''
  return value.trim()
}

export async function POST(req: NextRequest) {
  try {
    let body: LoginPayload
    try {
      body = (await req.json()) as LoginPayload
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 })
    }

    const email = clean(body.email).toLowerCase()
    const password = clean(body.password)

    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: 'Email e senha são obrigatórios' },
        { status: 400 }
      )
    }

    if (!FIREBASE_API_KEY) {
      console.error('[Extension Auth] Firebase API key not configured')
      return NextResponse.json(
        { success: false, error: 'Configuração do servidor incompleta' },
        { status: 500 }
      )
    }

    // Usar Firebase Auth REST API para verificar email/senha
    const authResponse = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          returnSecureToken: true,
        }),
      }
    )

    const authData = await authResponse.json()

    if (!authResponse.ok || authData.error) {
      const errorMessage = authData.error?.message || 'Falha na autenticação'

      // Mapear erros comuns do Firebase para mensagens amigáveis
      const errorMap: Record<string, string> = {
        'EMAIL_NOT_FOUND': 'Usuário não encontrado',
        'INVALID_PASSWORD': 'Senha incorreta',
        'USER_DISABLED': 'Usuário desativado',
        'INVALID_EMAIL': 'Email inválido',
        'INVALID_LOGIN_CREDENTIALS': 'Email ou senha incorretos',
      }

      return NextResponse.json(
        { success: false, error: errorMap[errorMessage] || errorMessage },
        { status: 401 }
      )
    }

    // Autenticação bem-sucedida - buscar dados adicionais
    const db = getAdminDb()

    // Buscar role do usuário
    let role = 'user'
    try {
      const roleDoc = await db.collection('userRoles').doc(email).get()
      if (roleDoc.exists) {
        role = roleDoc.data()?.role || 'user'
      }
    } catch (err) {
      console.error('[Extension Auth] Error fetching user role:', err)
    }

    // Resolver organização do usuário
    let orgInfo: { orgId: string; orgName: string; orgPlan: string } | null = null
    try {
      const orgContext = await resolveOrgByEmail(email)
      if (orgContext) {
        orgInfo = {
          orgId: orgContext.orgId,
          orgName: orgContext.org.name,
          orgPlan: orgContext.org.plan,
        }
      }
    } catch (err) {
      console.error('[Extension Auth] Error resolving org:', err)
    }

    // Retornar dados do usuário com o idToken do Firebase
    return NextResponse.json({
      success: true,
      token: authData.idToken,
      refreshToken: authData.refreshToken,
      user: {
        uid: authData.localId,
        email: authData.email,
        displayName: authData.displayName || email.split('@')[0],
        name: authData.displayName || email.split('@')[0],
        role,
      },
      org: orgInfo,
    })
  } catch (err) {
    console.error('[Extension Auth] Error:', err)
    return NextResponse.json(
      { success: false, error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

// Verificar token
export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { success: false, error: 'Token não fornecido' },
        { status: 401 }
      )
    }

    const token = authHeader.slice(7)
    const auth = getAdminAuth()

    try {
      const decodedToken = await auth.verifyIdToken(token)
      return NextResponse.json({
        success: true,
        user: {
          uid: decodedToken.uid,
          email: decodedToken.email,
        },
      })
    } catch {
      return NextResponse.json(
        { success: false, error: 'Token inválido' },
        { status: 401 }
      )
    }
  } catch (err) {
    console.error('[Extension Auth] Verify error:', err)
    return NextResponse.json(
      { success: false, error: 'Erro ao verificar token' },
      { status: 500 }
    )
  }
}
