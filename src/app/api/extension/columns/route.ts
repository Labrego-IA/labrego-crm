import { NextRequest, NextResponse } from 'next/server'
import { getAdminDb } from '@/lib/firebaseAdmin'
import { verifyExtensionAuth } from '@/lib/extensionAuth'
import { resolveOrgByEmail } from '@/lib/orgResolver'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Listar colunas (stages) de um funil
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
    // Por enquanto, ignoramos o funnelId pois temos apenas um funil
    // const funnelId = req.nextUrl.searchParams.get('funnelId')
    const db = getAdminDb()

    const stagesSnapshot = await db
      .collection('funnelStages')
      .where('orgId', '==', orgId)
      .orderBy('order', 'asc')
      .get()

    const columns = stagesSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }))

    return NextResponse.json({
      success: true,
      columns,
    })
  } catch (err) {
    console.error('[Extension Columns] List error:', err)
    return NextResponse.json({ success: false, error: 'Erro ao listar colunas' }, { status: 500 })
  }
}
