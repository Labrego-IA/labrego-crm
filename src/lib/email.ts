import 'server-only'
import nodemailer from 'nodemailer'
import React from 'react'
import admin from 'firebase-admin'
import { render } from '@react-email/render'

import { getAdminDb } from './firebaseAdmin'

type SendEmailParams = {
  to: string | string[]
  subject: string
  react: React.ReactElement
}

function sanitizeGmailUser(value: string | undefined): string | undefined {
  const trimmed = value?.trim()
  return trimmed && trimmed.length > 0 ? trimmed : undefined
}

function sanitizeGmailPass(value: string | undefined): string | undefined {
  const trimmed = value?.trim()
  if (!trimmed) return undefined
  const withoutSpaces = trimmed.replace(/\s+/g, '')
  return withoutSpaces.length > 0 ? withoutSpaces : undefined
}

export function getGmailCredentials() {
  const user = sanitizeGmailUser(process.env.GMAIL_USER)
  const pass = sanitizeGmailPass(process.env.GMAIL_PASS)
  return { user, pass }
}

export function hasGmailCredentials(): boolean {
  const { user, pass } = getGmailCredentials()
  return Boolean(user && pass)
}

function getHostingerCredentials() {
  return {
    host: process.env.HOSTINGER_SMTP_HOST?.trim() || 'smtp.hostinger.com',
    port: parseInt(process.env.HOSTINGER_SMTP_PORT || '465', 10),
    user: process.env.HOSTINGER_SMTP_USER?.trim(),
    pass: process.env.HOSTINGER_SMTP_PASS?.trim(),
    fromName: process.env.HOSTINGER_SMTP_FROM_NAME?.trim() || 'Voxium CRM',
  }
}

export function hasHostingerCredentials(): boolean {
  const { user, pass } = getHostingerCredentials()
  return Boolean(user && pass)
}

function createTransporter() {
  if (hasHostingerCredentials()) {
    const { host, port, user, pass, fromName } = getHostingerCredentials()
    return {
      transporter: nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: { user, pass },
      }),
      from: `${fromName} <${user}>`,
    }
  }
  const { user, pass } = getGmailCredentials()
  if (!user || !pass) throw new Error('Nenhuma credencial SMTP configurada.')
  return {
    transporter: nodemailer.createTransport({
      service: 'gmail',
      auth: { user, pass },
    }),
    from: `Voxium <${user}>`,
  }
}

function normalizeRecipients(to: string | string[]): string[] {
  const list = Array.isArray(to) ? to : [to]
  return list
    .map(item => item.trim())
    .filter((item, index, arr) => item.length > 0 && arr.indexOf(item) === index)
}

async function logEmailEvent(
  status: 'sent' | 'error' | 'skipped',
  payload: {
    recipients: string[]
    subject: string
    errorMessage?: string
  },
) {
  try {
    const db = getAdminDb()
    await db.collection('emailLogs').add({
      recipients: payload.recipients,
      subject: payload.subject,
      status,
      errorMessage: payload.errorMessage || null,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    })
  } catch (err) {
    console.error('[email] Failed to persist log entry', err)
  }
}

export async function sendEmail({ to, subject, react }: SendEmailParams) {
  const recipients = normalizeRecipients(to)
  if (recipients.length === 0)
    throw new Error('sendEmail called without any valid recipients')

  let transport: { transporter: nodemailer.Transporter; from: string }
  try {
    transport = createTransporter()
  } catch {
    console.warn(
      '[email] No SMTP credentials configured. Email delivery skipped.'
    )
    await logEmailEvent('skipped', {
      recipients,
      subject,
      errorMessage: 'missing-credentials',
    })
    return
  }

  const html = await render(react)

  try {
    await transport.transporter.sendMail({
      from: transport.from,
      to: 'undisclosed-recipients:;',
      bcc: recipients.join(', '),
      subject,
      html,
    })
    await logEmailEvent('sent', { recipients, subject })
  } catch (error) {
    const nodemailerError = error as { code?: string; response?: unknown }
    const responseText =
      typeof nodemailerError?.response === 'string'
        ? nodemailerError.response
        : undefined

    if (nodemailerError?.code === 'EAUTH') {
      const baseMessage =
        'Gmail rejected the credentials. Verify the GMAIL_USER and GMAIL_PASS environment variables.'

      if (responseText?.includes('534-5.7.9')) {
        const appPasswordMessage =
          'Gmail rejected the credentials because the account requires an application-specific password. Enable 2-Step Verification for the account and set the generated App Password in the GMAIL_PASS environment variable.'
        console.error(`[email] ${appPasswordMessage}`, error)
        throw new Error(appPasswordMessage)
      }

      console.error(`[email] ${baseMessage}`, error)
      throw new Error(baseMessage)
    }

    await logEmailEvent('error', {
      recipients,
      subject,
      errorMessage: nodemailerError?.code || responseText || 'unknown-error',
    })
    throw error
  }
}
