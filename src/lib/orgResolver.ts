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
