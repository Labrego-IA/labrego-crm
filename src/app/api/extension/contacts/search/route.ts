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
  const { orgId, member } = orgContext
  const viewScope = member?.permissions?.viewScope ?? 'own'
  const isOwn = viewScope === 'own' && member?.role !== 'admin'

  try {
    const phone = req.nextUrl.searchParams.get('phone')

    if (!phone) {
      return NextResponse.json({ success: false, error: 'Telefone é obrigatório' }, { status: 400 })
    }

    const normalizedPhone = normalizePhone(phone)
    const db = getAdminDb()

    // Build allowed member IDs set for partner group access
    let allowedIds: Set<string> | null = null
    if (isOwn) {
      allowedIds = new Set<string>()
      if (member.id) allowedIds.add(member.id)
      try {
        const membersSnap = await db.collection('organizations').doc(orgId).collection('members')
          .where('status', '==', 'active').get()
        if (member.invitedBy) {
          membersSnap.docs.forEach((d) => {
            const data = d.data()
            if (data.invitedBy === member.invitedBy) allowedIds!.add(d.id)
            if (data.email === member.invitedBy) allowedIds!.add(d.id)
          })
        } else if (member.email) {
          membersSnap.docs.forEach((d) => {
            const data = d.data()
            if (data.invitedBy === member.email.toLowerCase()) allowedIds!.add(d.id)
          })
        }
      } catch {
        // Fallback: keep only own data
      }
    }

    // Helper: check if contact belongs to user's partner group when viewScope is 'own'
    const canAccess = (data: Record<string, unknown>) =>
      !allowedIds || !data.assignedTo || allowedIds.has(data.assignedTo as string)

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
        return normalizePhone(data.phone || '') === normalizedPhone && canAccess(data)
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
      if (canAccess(doc.data())) {
        return NextResponse.json({
          success: true,
          found: true,
          contact: {
            id: doc.id,
            ...doc.data(),
          },
        })
      }
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
