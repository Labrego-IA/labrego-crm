import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import admin from 'firebase-admin'

import { getAdminAuth, getAdminDb } from '@/lib/firebaseAdmin'

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }

    const idToken = authHeader.split('Bearer ')[1]
    const decoded = await getAdminAuth().verifyIdToken(idToken)
    const { uid } = decoded

    const body = await req.json()
    const { displayName, phone } = body as { displayName: string; phone?: string }

    if (!displayName?.trim()) {
      return NextResponse.json({ error: 'displayName é obrigatório' }, { status: 400 })
    }

    await getAdminAuth().updateUser(uid, { displayName: displayName.trim() })

    const db = getAdminDb()
    const membersSnap = await db
      .collection('org_members')
      .where('userId', '==', uid)
      .limit(1)
      .get()

    if (!membersSnap.empty) {
      const memberDoc = membersSnap.docs[0]
      await memberDoc.ref.update({
        displayName: displayName.trim(),
        phone: phone?.trim() || null,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[profile/update] Error:', error)
    return NextResponse.json({ error: 'internal-error' }, { status: 500 })
  }
}
