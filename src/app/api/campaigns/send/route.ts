import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { getAdminDb } from '@/lib/firebaseAdmin'
import { replaceVariables } from '@/types/campaign'
import { getEmailProviderConfig, createProvider } from '@/lib/email/emailProvider'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300 // 5 min max for batch sending

const BATCH_SIZE = 20
const BATCH_INTERVAL_MS = 2000

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { campaignId, orgId } = body as { campaignId: string; orgId: string }

    if (!campaignId || !orgId) {
      return NextResponse.json({ error: 'campaignId and orgId are required' }, { status: 400 })
    }

    const db = getAdminDb()

    // Get campaign
    const campaignRef = db.collection('organizations').doc(orgId).collection('campaigns').doc(campaignId)
    const campaignSnap = await campaignRef.get()
    if (!campaignSnap.exists) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    const campaign = campaignSnap.data()!

    // Verify orgId matches
    if (campaign.orgId !== orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // Update status to sending
    await campaignRef.update({ status: 'sending', updatedAt: new Date().toISOString() })

    // Get pending recipients
    const recipientsRef = campaignRef.collection('recipients')
    const recipientsSnap = await recipientsRef.where('status', '==', 'pending').get()
    const recipients = recipientsSnap.docs.map((d) => ({ id: d.id, ...d.data() }))

    if (recipients.length === 0) {
      await campaignRef.update({ status: 'completed', updatedAt: new Date().toISOString() })
      return NextResponse.json({ success: true, sent: 0, failed: 0 })
    }

    // Load org email provider config from Firestore
    const emailConfig = await getEmailProviderConfig(orgId)
    const provider = createProvider(emailConfig.primaryProvider, emailConfig)
    const from = emailConfig.fromEmail
      ? `${emailConfig.fromName || 'Voxium'} <${emailConfig.fromEmail}>`
      : undefined

    let sentCount = 0
    let failedCount = 0

    // Process in batches
    for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
      const batch = recipients.slice(i, i + BATCH_SIZE)

      await Promise.all(
        batch.map(async (recipient) => {
          const contact = recipient as Record<string, unknown>
          const personalizedSubject = replaceVariables(campaign.subject, contact)
          const personalizedBody = replaceVariables(campaign.body, contact)
          const email = contact.email as string

          if (!email) {
            await recipientsRef.doc(recipient.id).update({
              status: 'failed',
              error: 'Email do destinatário não informado',
            })
            failedCount++
            return
          }

          const result = await provider.send(email, personalizedSubject, personalizedBody, from)

          if (result.success) {
            // Mark recipient as sent
            await recipientsRef.doc(recipient.id).update({
              status: 'sent',
              sentAt: new Date().toISOString(),
            })

            // Log in contact's activity
            if (contact.clientId) {
              await logCampaignActivity(db, orgId, contact.clientId as string, {
                campaignId,
                campaignName: campaign.name,
                subject: personalizedSubject,
                status: 'sent',
              })
            }

            sentCount++
          } else {
            const errMsg = result.error || 'Erro desconhecido'

            // Mark recipient as failed
            await recipientsRef.doc(recipient.id).update({
              status: 'failed',
              error: errMsg,
            })

            // Log failure in contact's activity
            if (contact.clientId) {
              await logCampaignActivity(db, orgId, contact.clientId as string, {
                campaignId,
                campaignName: campaign.name,
                subject: personalizedSubject,
                status: 'failed',
                error: errMsg,
              })
            }

            failedCount++
          }
        }),
      )

      // Update campaign counters after each batch
      await campaignRef.update({
        sentCount,
        failedCount,
        lastSentAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })

      // Wait between batches (except the last one)
      if (i + BATCH_SIZE < recipients.length) {
        await new Promise((resolve) => setTimeout(resolve, BATCH_INTERVAL_MS))
      }
    }

    // Final status update
    const finalStatus = failedCount === 0 ? 'completed' : 'partial_failure'
    await campaignRef.update({
      status: finalStatus,
      sentCount,
      failedCount,
      lastSentAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })

    return NextResponse.json({ success: true, sent: sentCount, failed: failedCount })
  } catch (error) {
    console.error('[Campaign Send] Error:', error)
    const errMsg = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: errMsg }, { status: 500 })
  }
}

/* ==================== Activity Logging ==================== */

async function logCampaignActivity(
  db: FirebaseFirestore.Firestore,
  orgId: string,
  clientId: string,
  data: {
    campaignId: string
    campaignName: string
    subject: string
    status: 'sent' | 'failed'
    error?: string
  },
): Promise<void> {
  try {
    await db.collection('organizations').doc(orgId).collection('clients').doc(clientId).collection('logs').add({
      action: 'campaign_email_sent',
      message:
        data.status === 'sent'
          ? `Email enviado — Campanha: ${data.campaignName}`
          : `Email falhou — Campanha: ${data.campaignName}`,
      type: 'campaign',
      author: 'Sistema (Campanha automática)',
      authorId: 'system',
      metadata: {
        campaignId: data.campaignId,
        campaignName: data.campaignName,
        subject: data.subject,
        status: data.status,
        error: data.error || null,
      },
      createdAt: new Date().toISOString(),
    })
  } catch (error) {
    console.error(`[Campaign] Failed to log activity for client ${clientId}:`, error)
  }
}
