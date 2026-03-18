/**
 * Trial helpers — calcula dias restantes do trial de um membro.
 * Usa trialEndsAt (ISO string) salvo no OrgMember.
 */

export function getTrialDaysLeft(trialEndsAt: string | null | undefined): number {
  if (!trialEndsAt) return -1
  const end = new Date(trialEndsAt).getTime()
  if (isNaN(end)) return -1
  const now = Date.now()
  const diff = end - now
  if (diff <= 0) return 0
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

export function isTrialActive(trialEndsAt: string | null | undefined): boolean {
  if (!trialEndsAt) return false
  const end = new Date(trialEndsAt).getTime()
  if (isNaN(end)) return false
  return end > Date.now()
}

export function getTrialLabel(trialEndsAt: string | null | undefined): string | null {
  const days = getTrialDaysLeft(trialEndsAt)
  if (days < 0) return null // sem trial
  if (days === 0) return 'Trial expirado'
  if (days === 1) return 'Trial · Menos de 1 dia'
  return `Trial · ${days} dias restantes`
}
