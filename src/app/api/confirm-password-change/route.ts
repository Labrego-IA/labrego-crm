import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import admin from 'firebase-admin'

import { getAdminAuth, getAdminDb } from '@/lib/firebaseAdmin'
import { decrypt } from '@/lib/crypto'

export async function GET(req: NextRequest) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.voxium.com.br'

  try {
    const token = req.nextUrl.searchParams.get('token')
    if (!token) {
      return NextResponse.redirect(`${baseUrl}/perfil?error=token-invalido`)
    }

    const db = getAdminDb()
    const docRef = db.collection('password_change_tokens').doc(token)
    const docSnap = await docRef.get()

    if (!docSnap.exists) {
      return NextResponse.redirect(`${baseUrl}/perfil?error=token-invalido`)
    }

    const data = docSnap.data()!

    if (data.used) {
      return NextResponse.redirect(`${baseUrl}/perfil?error=token-ja-usado`)
    }

    const expiresAt = (data.expiresAt as admin.firestore.Timestamp).toMillis()
    if (Date.now() > expiresAt) {
      return NextResponse.redirect(`${baseUrl}/perfil?error=token-expirado`)
    }

    const newPassword = decrypt(data.encryptedNewPassword as string)
    await getAdminAuth().updateUser(data.userId as string, { password: newPassword })

    await docRef.update({
      used: true,
      usedAt: admin.firestore.FieldValue.serverTimestamp(),
    })

    return NextResponse.redirect(`${baseUrl}/perfil?success=senha-alterada`)
  } catch (error) {
    console.error('[confirm-password-change] Error:', error)
    return NextResponse.redirect(`${baseUrl}/perfil?error=erro-interno`)
  }
}
