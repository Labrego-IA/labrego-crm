import { NextRequest, NextResponse } from 'next/server'
import { getAdminDb, getAdminAuth } from '@/lib/firebaseAdmin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const token = searchParams.get('token')

    if (!token) {
      return NextResponse.json({ error: 'Token não fornecido.' }, { status: 400 })
    }

    const db = getAdminDb()
    const tokenDoc = await db.collection('passwordChangeTokens').doc(token).get()

    if (!tokenDoc.exists) {
      return NextResponse.json({ error: 'Link inválido ou já utilizado.' }, { status: 400 })
    }

    const data = tokenDoc.data()!

    if (data.used) {
      return NextResponse.json({ error: 'Este link já foi utilizado.' }, { status: 400 })
    }

    const expiresAt = new Date(data.expiresAt)
    if (new Date() > expiresAt) {
      return NextResponse.json({ error: 'Link expirado. Solicite uma nova troca de senha.' }, { status: 400 })
    }

    // Update password via Firebase Admin
    const adminAuth = getAdminAuth()
    await adminAuth.updateUser(data.uid, { password: data.newPassword })

    // Mark token as used and delete sensitive data
    await db.collection('passwordChangeTokens').doc(token).update({
      used: true,
      newPassword: null,
      usedAt: new Date().toISOString(),
    })

    return NextResponse.json({ success: true, message: 'Senha alterada com sucesso.' })
  } catch (error) {
    console.error('[profile] confirm-password-change error:', error)
    return NextResponse.json({ error: 'Erro interno. Tente novamente.' }, { status: 500 })
  }
}
