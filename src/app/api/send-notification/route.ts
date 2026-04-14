import { NextResponse } from 'next/server'
import { sendServerNotification } from '@/lib/serverNotifications'
import { requireOrgId } from '@/lib/orgResolver'

export async function POST(req: Request) {
  try {
    const json = await req.json()
    const { title, body, url, action, email, role, data, orgId } = json
    if (!title || !body) {
      return NextResponse.json({ error: 'title and body required' }, { status: 400 })
    }
    const options: Parameters<typeof sendServerNotification>[2] = {}
    if (email) options.email = email
    if (role) options.role = role
    if (url) options.url = url
    if (action) options.action = action
    if (data && typeof data === 'object') {
      const normalizedData: Record<string, string> = {}
      for (const [key, value] of Object.entries(data)) {
        if (typeof value === 'string') {
          normalizedData[key] = value
        }
      }
      if (Object.keys(normalizedData).length > 0) {
        options.data = normalizedData
      }

    }

    // Multi-tenant: resolve orgId from body first, then headers (no env fallback)
    let resolvedOrgId = orgId || ''
    if (!resolvedOrgId) {
      const headerCtx = await requireOrgId(req.headers)
      if (headerCtx) resolvedOrgId = headerCtx.orgId
    }
    if (resolvedOrgId) {
      if (!options.data) options.data = {}
      options.data.orgId = resolvedOrgId
    }

    const sent = await sendServerNotification(title, body, options)
    return NextResponse.json({ success: true, sent })
  } catch (err: any) {
    console.error('[FCM] send error', err)
    return NextResponse.json(
      { error: err.message || 'Internal Server Error' },
      { status: 500 },
    )
  }
}
