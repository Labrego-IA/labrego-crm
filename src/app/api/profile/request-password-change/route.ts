import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import React from 'react'
import admin from 'firebase-admin'

import { getAdminAuth, getAdminDb } from '@/lib/firebaseAdmin'
import { encrypt } from '@/lib/crypto'
import { sendEmail } from '@/lib/email'
import PasswordChangeEmail from '@/emails/PasswordChangeEmail'

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }

    const idToken = authHeader.split('Bearer ')[1]
    const decoded = await getAdminAuth().verifyIdToken(idToken)
    const { uid, email } = decoded

    if (!email) {
      return NextResponse.json({ error: 'email-not-found' }, { status: 400 })
    }

    const body = await req.json()
    const { currentPassword, newPassword } = body as {
      currentPassword: string
      newPassword: string
    }

    if (!currentPassword || !newPassword) {
      return NextResponse.json({ error: 'missing-fields' }, { status: 400 })
    }

    if (newPassword.length < 6) {
      return NextResponse.json({ error: 'senha-muito-curta' }, { status: 400 })
    }

    // Verify current password via Firebase Auth REST API
    const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'config-error' }, { status: 500 })
    }

    const verifyRes = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password: currentPassword,
          returnSecureToken: false,
        }),
      }
    )

    if (!verifyRes.ok) {
      const verifyData = await verifyRes.json()
      const errorMessage = verifyData?.error?.message || ''
      if (
        errorMessage.includes('INVALID_PASSWORD') ||
        errorMessage.includes('INVALID_LOGIN_CREDENTIALS')
      ) {
        return NextResponse.json({ error: 'senha-atual-incorreta' }, { status: 401 })
      }
      return NextResponse.json({ error: 'auth-error' }, { status: 401 })
    }

    const token = crypto.randomUUID()
    const now = Date.now()
    const expiresAt = now + 30 * 60 * 1000

    const db = getAdminDb()
    await db.collection('password_change_tokens').doc(token).set({
      token,
      userId: uid,
      userEmail: email,
      encryptedNewPassword: encrypt(newPassword),
      createdAt: admin.firestore.Timestamp.fromMillis(now),
      expiresAt: admin.firestore.Timestamp.fromMillis(expiresAt),
      used: false,
    })

    await sendEmail({
      to: email,
      subject: 'Confirme a troca de senha — Voxium CRM',
      react: React.createElement(PasswordChangeEmail, { token }),
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[profile/request-password-change] Error:', error)
    return NextResponse.json({ error: 'internal-error' }, { status: 500 })
  }
}
