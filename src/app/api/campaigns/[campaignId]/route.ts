import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { updateCampaign, deleteCampaign, getCampaign } from '@/lib/campaigns'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ campaignId: string }> },
) {
  try {
    const { campaignId } = await params
    const body = await req.json()
    const { orgId, ...data } = body as { orgId: string; [key: string]: unknown }

    if (!campaignId || !orgId) {
      return NextResponse.json({ error: 'campaignId and orgId are required' }, { status: 400 })
    }

    const campaign = await getCampaign(orgId, campaignId)
    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    if (campaign.orgId !== orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // Only allow editing draft or scheduled campaigns
    if (!['draft', 'scheduled'].includes(campaign.status)) {
      return NextResponse.json(
        { error: 'Só é possível editar campanhas com status rascunho ou agendada' },
        { status: 400 },
      )
    }

    await updateCampaign(orgId, campaignId, data)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Campaign PATCH] Error:', error)
    const errMsg = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: errMsg }, { status: 500 })
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ campaignId: string }> },
) {
  try {
    const { campaignId } = await params
    const { searchParams } = new URL(req.url)
    const orgId = searchParams.get('orgId')

    if (!campaignId || !orgId) {
      return NextResponse.json({ error: 'campaignId and orgId are required' }, { status: 400 })
    }

    const campaign = await getCampaign(orgId, campaignId)
    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    if (campaign.orgId !== orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // Don't allow deleting campaigns that are currently sending
    if (campaign.status === 'sending') {
      return NextResponse.json(
        { error: 'Não é possível excluir uma campanha que está sendo enviada' },
        { status: 400 },
      )
    }

    await deleteCampaign(orgId, campaignId)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Campaign DELETE] Error:', error)
    const errMsg = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: errMsg }, { status: 500 })
  }
}
