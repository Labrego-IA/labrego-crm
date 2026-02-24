import { NextRequest, NextResponse } from 'next/server'
import { getAdminDb } from '@/lib/firebaseAdmin'
import { verifyExtensionAuth } from '@/lib/extensionAuth'
import { resolveOrgByEmail } from '@/lib/orgResolver'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Listar oportunidades (clientes em funis)
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
    const searchParams = req.nextUrl.searchParams
    // Por enquanto, ignoramos o funnelId pois temos apenas um funil
    // const funnelId = searchParams.get('funnelId')
    const search = searchParams.get('search')?.toLowerCase()
    const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 200)

    const db = getAdminDb()

    // Buscar clientes que têm funnelStage definido (estão no funil)
    const snapshot = await db
      .collection('clients')
      .where('orgId', '==', orgId)
      .orderBy('updatedAt', 'desc')
      .limit(limit)
      .get()

    let opportunities = snapshot.docs
      .map((doc) => {
        const data = doc.data()
        return {
          id: doc.id,
          name: data.name,
          phone: data.phone,
          company: data.company,
          email: data.email,
          funnelStage: data.funnelStage,
          funnelStageUpdatedAt: data.funnelStageUpdatedAt,
          lastFollowUpAt: data.lastFollowUpAt,
          leadSource: data.leadSource,
          createdAt: data.createdAt,
          updatedAt: data.updatedAt,
        }
      })
      // Filtrar apenas os que têm funnelStage
      .filter((o) => o.funnelStage)

    // Filtrar por busca se necessário
    if (search) {
      opportunities = opportunities.filter(
        (o) =>
          o.name?.toLowerCase().includes(search) ||
          o.phone?.includes(search) ||
          o.company?.toLowerCase().includes(search)
      )
    }

    return NextResponse.json({
      success: true,
      opportunities,
    })
  } catch (err) {
    console.error('[Extension Opportunities] List error:', err)
    return NextResponse.json(
      { success: false, error: 'Erro ao listar oportunidades' },
      { status: 500 }
    )
  }
}
