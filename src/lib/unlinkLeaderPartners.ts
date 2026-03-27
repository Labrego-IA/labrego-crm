import { ensurePartnerHasOwnOrg } from '@/lib/partnerOrg'

/**
 * Unlinks all partners invited by a specific leader (inviter) within an organization.
 * For each partner:
 * 1. Ensures they have their own free-plan org to fall back to
 * 2. Deletes their member document from the leader's org
 *
 * This should be called when a partner leader:
 * - Deletes their own account (self-deletion)
 * - Is removed by an admin or super-admin
 * - Has their account excluded
 *
 * @returns The number of partners that were unlinked
 */
export async function unlinkLeaderPartners(
  db: FirebaseFirestore.Firestore,
  leaderEmail: string,
  orgId: string,
): Promise<number> {
  const normalizedEmail = leaderEmail.toLowerCase()

  // Find all partners invited by this leader in this org
  const partnersSnap = await db
    .collection('organizations').doc(orgId)
    .collection('members')
    .where('invitedBy', '==', normalizedEmail)
    .get()

  if (partnersSnap.empty) return 0

  let unlinkedCount = 0

  for (const partnerDoc of partnersSnap.docs) {
    const partnerData = partnerDoc.data()

    // Ensure partner has their own free org before removing them
    if (partnerData.userId) {
      try {
        await ensurePartnerHasOwnOrg(
          db,
          partnerData.email,
          partnerData.userId,
          partnerData.displayName,
        )
      } catch (err) {
        console.error(`[unlinkLeaderPartners] Error ensuring own org for ${partnerData.email}:`, err)
        // Continue — still remove the partner from the leader's org
      }
    }

    // Delete the partner's member document from the leader's org
    try {
      await partnerDoc.ref.delete()
      unlinkedCount++
    } catch (err) {
      console.error(`[unlinkLeaderPartners] Error deleting partner ${partnerData.email}:`, err)
    }
  }

  console.log(`[unlinkLeaderPartners] Unlinked ${unlinkedCount} partners of ${normalizedEmail} from org ${orgId}`)
  return unlinkedCount
}
