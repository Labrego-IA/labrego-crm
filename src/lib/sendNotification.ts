export async function sendNotification(
  title: string,
  body: string,
  options: { url?: string; action?: string; email?: string; role?: string } = {},
) {
  try {
    await fetch('/api/send-notification', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, body, ...options }),
    })
  } catch (err) {
    console.error('Failed to send notification', err)
  }
}

export async function notifyNewLead(
  name: string,
  data: Record<string, any> = { name },
) {
  await sendNotification('Novo lead', `Tem um novo lead: ${name}`, {
    url: '/crm',
    role: 'admin',
  })
  try {
    await fetch('/api/n8n/lead-created', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
  } catch (err) {
    console.error('[N8N] lead webhook error', err)
  }
}
