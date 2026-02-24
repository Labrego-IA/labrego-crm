import { NextRequest, NextResponse } from 'next/server'
import { getAdminDb } from '@/lib/firebaseAdmin'
import { verifyExtensionAuth } from '@/lib/extensionAuth'
import { resolveOrgByEmail } from '@/lib/orgResolver'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Normalizar número de telefone para comparação
function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '')
}

// Buscar contato por telefone
export async function GET(req: NextRequest) {
  const user = await verifyExtensionAuth(req)
  if (!user) {
    return NextResponse.json({ success: false, error: 'Não autorizado' }, { status: 401 })
  }

  const orgContext = await resolveOrgByEmail(user.email || '')
  if (!orgContext) {
    return NextResponse.json({ success: false, error: 'Organização não encontrada' }, { status: 403 })
  }
  const { orgId } = orgContext

  try {
    const phone = req.nextUrl.searchParams.get('phone')

    if (!phone) {
      return NextResponse.json({ success: false, error: 'Telefone é obrigatório' }, { status: 400 })
    }

    const normalizedPhone = normalizePhone(phone)
    const db = getAdminDb()

    // Buscar por telefone exato primeiro (filtrado por orgId)
    let snapshot = await db
      .collection('clients')
      .where('orgId', '==', orgId)
      .where('phone', '==', phone)
      .limit(1)
      .get()

    // Se não encontrou, tentar com telefone normalizado
    if (snapshot.empty && normalizedPhone !== phone) {
      snapshot = await db
        .collection('clients')
        .where('orgId', '==', orgId)
        .where('phone', '==', normalizedPhone)
        .limit(1)
        .get()
    }

    // Se ainda não encontrou, buscar todos da org e filtrar
    if (snapshot.empty) {
      const allContacts = await db.collection('clients').where('orgId', '==', orgId).get()
      const found = allContacts.docs.find((doc) => {
        const data = doc.data()
        return normalizePhone(data.phone || '') === normalizedPhone
      })

      if (found) {
        return NextResponse.json({
          success: true,
          found: true,
          contact: {
            id: found.id,
            ...found.data(),
          },
        })
      }
    } else {
      const doc = snapshot.docs[0]
      return NextResponse.json({
        success: true,
        found: true,
        contact: {
          id: doc.id,
          ...doc.data(),
        },
      })
    }

    return NextResponse.json({
      success: true,
      found: false,
      contact: null,
    })
  } catch (err) {
    console.error('[Extension Search] Error:', err)
    return NextResponse.json({ success: false, error: 'Erro ao buscar contato' }, { status: 500 })
  }
}
