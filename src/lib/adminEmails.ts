const fallbackAdminEmails = Object.freeze(
  Array.from(
    new Set(
      (process.env.NEXT_PUBLIC_ADMIN_EMAILS || '')
        .split(',')
        .map(email => email.trim().toLowerCase())
        .filter(Boolean)
    ),
  ),
)

export const NEXT_PUBLIC_ADMIN_EMAILS = fallbackAdminEmails as readonly string[]
export const FALLBACK_ADMIN_EMAILS = fallbackAdminEmails
