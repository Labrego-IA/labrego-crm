import { NextRequest, NextResponse } from 'next/server'
import { getAdminDb } from '@/lib/firebaseAdmin'
import { verifyExtensionAuth } from '@/lib/extensionAuth'
import { resolveOrgByEmail } from '@/lib/orgResolver'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function clean(value: unknown) {
  if (typeof value !== 'string') return ''
  return value.trim()
}

// Criar contato
export async function POST(req: NextRequest) {
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
    const body = await req.json()

    const name = clean(body.name)
    const phone = clean(body.phone)
    const company = clean(body.company)
    const email = clean(body.email).toLowerCase()
    const industry = clean(body.industry)
    const description = clean(body.description)
    const document = clean(body.document)
    const birthday = clean(body.birthday)
    const funnelId = clean(body.funnelId)
    const columnId = clean(body.columnId)
    const contactType = clean(body.contactType) || 'Lead'

    if (!name) {
      return NextResponse.json({ success: false, error: 'Nome é obrigatório' }, { status: 400 })
    }

    const db = getAdminDb()

    // Verificar se já existe contato com esse telefone na mesma org
    if (phone) {
      const existingQuery = await db
        .collection('clients')
        .where('orgId', '==', orgId)
        .where('phone', '==', phone)
        .limit(1)
        .get()

      if (!existingQuery.empty) {
        const existingDoc = existingQuery.docs[0]
        return NextResponse.json({
          success: false,
          error: 'Já existe um contato com esse telefone',
          existingContact: {
            id: existingDoc.id,
            ...existingDoc.data(),
          },
        }, { status: 409 })
      }
    }

    const nowIso = new Date().toISOString()
    const docRef = db.collection('clients').doc()

    const data: Record<string, any> = {
      name,
      phone: phone || '',
      leadSource: 'WhatsApp',
      status: contactType,
      orgId,
      createdAt: nowIso,
      updatedAt: nowIso,
    }

    if (company) data.company = company
    if (email) data.email = email
    if (industry) data.industry = industry
    if (description) data.description = description
    if (document) data.document = document
    if (birthday) data.birthday = birthday
    if (funnelId) data.funnelId = funnelId
    if (columnId) {
      data.funnelStage = columnId
      data.funnelStageUpdatedAt = nowIso
    }

    await docRef.set(data)

    return NextResponse.json({
      success: true,
      contact: {
        id: docRef.id,
        ...data,
      },
    }, { status: 201 })
  } catch (err) {
    console.error('[Extension Contacts] Create error:', err)
    return NextResponse.json({ success: false, error: 'Erro ao criar contato' }, { status: 500 })
  }
}

// Listar contatos
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

  try {
    const db = getAdminDb()
    const searchParams = req.nextUrl.searchParams
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100)
    const search = searchParams.get('search')?.toLowerCase()

    const snapshot = await db.collection('clients')
      .where('orgId', '==', orgId)
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .get()

    let contacts = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }))

    // Apply viewScope filter: non-admin users with 'own' scope see only their contacts
    if (viewScope === 'own' && member?.role !== 'admin') {
      contacts = contacts.filter((c: any) => c.assignedTo === member.id)
    }

    // Filtrar por busca se necessário
    if (search) {
      contacts = contacts.filter((c: any) =>
        c.name?.toLowerCase().includes(search) ||
        c.phone?.includes(search) ||
        c.company?.toLowerCase().includes(search)
      )
    }

    return NextResponse.json({
      success: true,
      contacts,
    })
  } catch (err) {
    console.error('[Extension Contacts] List error:', err)
    return NextResponse.json({ success: false, error: 'Erro ao listar contatos' }, { status: 500 })
  }
}
