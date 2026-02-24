import { NextRequest, NextResponse } from 'next/server'
import { getAdminDb } from '@/lib/firebaseAdmin'
import { verifyExtensionAuth } from '@/lib/extensionAuth'
import { resolveOrgByEmail } from '@/lib/orgResolver'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Listar funis
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
    const db = getAdminDb()

    // O sistema atual usa funnelStages como um único funil
    // Vamos criar um funil "padrão" com as stages existentes
    const stagesSnapshot = await db
      .collection('funnelStages')
      .where('orgId', '==', orgId)
      .orderBy('order', 'asc')
      .get()

    const stages = stagesSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }))

    // Retornar como um único funil padrão
    const funnels = [
      {
        id: 'default',
        name: 'Funil de Vendas',
        stages,
      },
    ]

    return NextResponse.json({
      success: true,
      funnels,
    })
  } catch (err) {
    console.error('[Extension Funnels] List error:', err)
    return NextResponse.json({ success: false, error: 'Erro ao listar funis' }, { status: 500 })
  }
}
