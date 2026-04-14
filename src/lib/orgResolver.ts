import { findMemberOrgByEmail } from './orgMembers'
import type { Organization } from '@/types/organization'
import type { OrgMember } from '@/types/organization'
import { getOrganization } from './organization'

export interface OrgContext {
  orgId: string
  org: Organization
  member: OrgMember
}

export async function resolveOrgByEmail(email: string): Promise<OrgContext | null> {
  const result = await findMemberOrgByEmail(email)
  if (!result) return null

  const org = await getOrganization(result.orgId)
  if (!org) return null
  if (org.status !== 'active') return null

  return {
    orgId: result.orgId,
    org,
    member: result.member,
  }
}

// Extract orgId from API request (header or token)
export function getOrgIdFromHeaders(headers: Headers): string | null {
  return headers.get('x-org-id')
}

/**
 * requireOrgId — Resolve orgId de forma segura, SEM fallback para DEFAULT_ORG_ID.
 *
 * Ordem de resolução:
 *   1. x-user-email header → resolveOrgByEmail
 *   2. x-org-id header → getOrgIdFromHeaders
 *
 * Retorna null se não conseguir resolver — a rota deve retornar 401/400.
 */
export async function requireOrgId(headers: Headers): Promise<{ orgId: string; email?: string } | null> {
  const email = headers.get('x-user-email')?.toLowerCase()
  if (email) {
    const ctx = await resolveOrgByEmail(email)
    if (ctx) return { orgId: ctx.orgId, email }
  }
  const fromHeader = getOrgIdFromHeaders(headers)
  if (fromHeader) return { orgId: fromHeader, email: email || undefined }
  return null
}
