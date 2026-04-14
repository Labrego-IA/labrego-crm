import { NextRequest, NextResponse } from 'next/server'
import { getAdminDb } from '@/lib/firebaseAdmin'
import { CallScript } from '@/types/callRouting'
import { requireOrgId } from '@/lib/orgResolver'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET - Listar roteiros
export async function GET(req: NextRequest) {
  try {
    const orgCtx = await requireOrgId(req.headers)
    if (!orgCtx) {
      return NextResponse.json({ error: 'orgId is required' }, { status: 401 })
    }
    const orgId = orgCtx.orgId

    const db = getAdminDb()
    const searchParams = req.nextUrl.searchParams
    const activeOnly = searchParams.get('activeOnly') === 'true'

    let query = db.collection('callScripts').where('orgId', '==', orgId).orderBy('updatedAt', 'desc')

    if (activeOnly) {
      query = db.collection('callScripts').where('orgId', '==', orgId).where('isActive', '==', true)
    }

    const snapshot = await query.get()
    const scripts = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as CallScript[]

    return NextResponse.json({
      success: true,
      count: scripts.length,
      scripts,
    })
  } catch (error) {
    console.error('[CALL-ROUTING SCRIPTS] GET error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// POST - Criar novo roteiro
export async function POST(req: NextRequest) {
  try {
    const orgCtx = await requireOrgId(req.headers)
    if (!orgCtx) {
      return NextResponse.json({ error: 'orgId is required' }, { status: 401 })
    }
    const orgId = orgCtx.orgId

    const body = await req.json()

    if (!body.name || !body.phases || body.phases.length === 0) {
      return NextResponse.json(
        { error: 'Campos obrigatórios: name, phases (array não vazio)' },
        { status: 400 }
      )
    }

    const db = getAdminDb()

    // Se este roteiro for ativo, desativar os outros da mesma org
    if (body.isActive) {
      const activeScripts = await db
        .collection('callScripts')
        .where('orgId', '==', orgId)
        .where('isActive', '==', true)
        .get()

      const batch = db.batch()
      activeScripts.docs.forEach(doc => {
        batch.update(doc.ref, { isActive: false })
      })
      await batch.commit()
    }

    const now = new Date().toISOString()
    const docRef = await db.collection('callScripts').add({
      ...body,
      orgId,
      isActive: body.isActive ?? false,
      createdAt: now,
      updatedAt: now,
    })

    return NextResponse.json({
      success: true,
      id: docRef.id,
      message: 'Roteiro criado com sucesso',
    })
  } catch (error) {
    console.error('[CALL-ROUTING SCRIPTS] POST error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// PUT - Atualizar roteiro
export async function PUT(req: NextRequest) {
  try {
    const orgCtx = await requireOrgId(req.headers)
    if (!orgCtx) {
      return NextResponse.json({ error: 'orgId is required' }, { status: 401 })
    }
    const orgId = orgCtx.orgId

    const body = await req.json()

    if (!body.id) {
      return NextResponse.json({ error: 'ID do roteiro é obrigatório' }, { status: 400 })
    }

    const db = getAdminDb()
    const docRef = db.collection('callScripts').doc(body.id)

    const doc = await docRef.get()
    if (!doc.exists) {
      return NextResponse.json({ error: 'Roteiro não encontrado' }, { status: 404 })
    }

    // Validate script belongs to this org
    const docData = doc.data()
    if (docData?.orgId && docData.orgId !== orgId) {
      return NextResponse.json({ error: 'Roteiro não pertence a esta organização' }, { status: 403 })
    }

    // Se este roteiro for ativo, desativar os outros da mesma org
    if (body.isActive) {
      const activeScripts = await db
        .collection('callScripts')
        .where('orgId', '==', orgId)
        .where('isActive', '==', true)
        .get()

      const batch = db.batch()
      activeScripts.docs.forEach(d => {
        if (d.id !== body.id) {
          batch.update(d.ref, { isActive: false })
        }
      })
      await batch.commit()
    }

    const { id: _id, ...updateData } = body
    await docRef.update({
      ...updateData,
      updatedAt: new Date().toISOString(),
    })

    return NextResponse.json({
      success: true,
      message: 'Roteiro atualizado com sucesso',
    })
  } catch (error) {
    console.error('[CALL-ROUTING SCRIPTS] PUT error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// DELETE - Excluir roteiro
export async function DELETE(req: NextRequest) {
  try {
    const orgCtx = await requireOrgId(req.headers)
    if (!orgCtx) {
      return NextResponse.json({ error: 'orgId is required' }, { status: 401 })
    }
    const orgId = orgCtx.orgId

    const searchParams = req.nextUrl.searchParams
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'ID do roteiro é obrigatório' }, { status: 400 })
    }

    const db = getAdminDb()
    const docRef = db.collection('callScripts').doc(id)

    const doc = await docRef.get()
    if (!doc.exists) {
      return NextResponse.json({ error: 'Roteiro não encontrado' }, { status: 404 })
    }

    // Validate script belongs to this org
    const docData = doc.data()
    if (docData?.orgId && docData.orgId !== orgId) {
      return NextResponse.json({ error: 'Roteiro não pertence a esta organização' }, { status: 403 })
    }

    await docRef.delete()

    return NextResponse.json({
      success: true,
      message: 'Roteiro excluído com sucesso',
    })
  } catch (error) {
    console.error('[CALL-ROUTING SCRIPTS] DELETE error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
