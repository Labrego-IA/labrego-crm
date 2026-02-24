import { NextRequest, NextResponse } from 'next/server'
import { getAdminAuth } from '@/lib/firebaseAdmin'
import {
  getEmailProviderConfig,
  saveEmailProviderConfig,
  type EmailProviderConfig,
  type EmailProviderId,
} from '@/lib/email/emailProvider'

const VALID_PROVIDERS: EmailProviderId[] = ['gmail', 'resend', 'sendgrid']

async function verifyAuth(req: NextRequest): Promise<{ uid: string } | null> {
  const authHeader = req.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) return null
  try {
    const token = authHeader.slice(7)
    const decoded = await getAdminAuth().verifyIdToken(token)
    return { uid: decoded.uid }
  } catch {
    return null
  }
}

/**
 * GET /api/admin/email-provider?orgId=xxx
 * Returns the email provider configuration for an organization.
 */
export async function GET(req: NextRequest) {
  const user = await verifyAuth(req)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const orgId = req.nextUrl.searchParams.get('orgId')
  if (!orgId) {
    return NextResponse.json({ error: 'orgId is required' }, { status: 400 })
  }

  try {
    const config = await getEmailProviderConfig(orgId)
    // Strip credentials from response (only show if configured)
    return NextResponse.json({
      primaryProvider: config.primaryProvider,
      fallbackProvider: config.fallbackProvider,
      fromName: config.fromName,
      fromEmail: config.fromEmail,
      gmailUser: config.gmailUser || '',
      hasGmailCredentials: !!(config.gmailUser && config.gmailAppPassword),
      hasResendKey: !!config.resendApiKey,
      hasSendgridKey: !!config.sendgridApiKey,
    })
  } catch (error) {
    console.error('Error fetching email provider config:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/admin/email-provider
 * Updates the email provider configuration.
 */
export async function POST(req: NextRequest) {
  const user = await verifyAuth(req)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await req.json()
    const { orgId, primaryProvider, fallbackProvider, fromName, fromEmail, resendApiKey, sendgridApiKey } = body

    if (!orgId) {
      return NextResponse.json({ error: 'orgId is required' }, { status: 400 })
    }

    if (primaryProvider && !VALID_PROVIDERS.includes(primaryProvider)) {
      return NextResponse.json({ error: 'Invalid primary provider' }, { status: 400 })
    }

    if (fallbackProvider && !VALID_PROVIDERS.includes(fallbackProvider)) {
      return NextResponse.json({ error: 'Invalid fallback provider' }, { status: 400 })
    }

    const updates: Partial<EmailProviderConfig> = {}
    if (primaryProvider !== undefined) updates.primaryProvider = primaryProvider
    if (fallbackProvider !== undefined) updates.fallbackProvider = fallbackProvider
    if (fromName !== undefined) updates.fromName = fromName
    if (fromEmail !== undefined) updates.fromEmail = fromEmail
    if (body.gmailUser !== undefined) updates.gmailUser = body.gmailUser
    if (body.gmailAppPassword !== undefined) updates.gmailAppPassword = body.gmailAppPassword
    if (resendApiKey !== undefined) updates.resendApiKey = resendApiKey
    if (sendgridApiKey !== undefined) updates.sendgridApiKey = sendgridApiKey

    await saveEmailProviderConfig(orgId, updates)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error saving email provider config:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
