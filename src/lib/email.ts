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
  const { user, pass } = getGmailCredentials()
  const recipients = normalizeRecipients(to)
  if (recipients.length === 0)
    throw new Error('sendEmail called without any valid recipients')

  if (!user || !pass) {
    console.warn(
      '[email] Missing GMAIL_USER or GMAIL_PASS environment variables. Email delivery skipped.'
    )
    await logEmailEvent('skipped', {
      recipients,
      subject,
      errorMessage: 'missing-credentials',
    })
    return
  }

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user, pass },
  })

  const html = await render(react)

  try {
    await transporter.sendMail({
      from: `Labrego IA <${user}>`,
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
