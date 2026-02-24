import { NextRequest, NextResponse } from 'next/server'
import { getAdminDb } from '@/lib/firebaseAdmin'
import { verifyExtensionAuth } from '@/lib/extensionAuth'
import { sendServerNotification } from '@/lib/serverNotifications'
import { resolveOrgByEmail } from '@/lib/orgResolver'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function clean(value: unknown) {
  if (typeof value !== 'string') return ''
  return value.trim()
}

// Criar lead rápido (apenas nome e telefone)
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
    const notes = clean(body.notes)

    if (!name) {
      return NextResponse.json({ success: false, error: 'Nome é obrigatório' }, { status: 400 })
    }

    const db = getAdminDb()
    const nowIso = new Date().toISOString()
    const docRef = db.collection('clients').doc()

    const data: Record<string, any> = {
      name,
      phone: phone || '',
      leadSource: 'WhatsApp',
      status: 'Lead',
      orgId,
      createdAt: nowIso,
      updatedAt: nowIso,
    }

    if (notes) data.description = notes

    await docRef.set(data)

    // Enviar notificação
    try {
      await sendServerNotification('Novo Lead WhatsApp', `Lead criado: ${name}`, {
        url: '/contatos',
        role: 'admin',
        data: { clientId: docRef.id },
      })
    } catch (err) {
      console.error('[Extension Leads] Notification error:', err)
    }

    return NextResponse.json({
      success: true,
      lead: {
        id: docRef.id,
        ...data,
      },
    }, { status: 201 })
  } catch (err) {
    console.error('[Extension Leads] Create error:', err)
    return NextResponse.json({ success: false, error: 'Erro ao criar lead' }, { status: 500 })
  }
}
