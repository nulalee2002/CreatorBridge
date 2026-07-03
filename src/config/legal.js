/**
 * Single source of truth for platform policy versions and role scoping.
 *
 * POLICY_VERSIONS: bump a document's version (we use its last-updated date) when
 * its content changes — every user is then re-prompted to accept on next login.
 * The acceptance gate also re-confirms monthly (REACCEPT_DAYS) regardless.
 */
export const POLICY_VERSIONS = {
  terms_of_service: '2026-07-03',
  dispute_policy: '2026-07-03',
  creator_agreement: '2026-07-03',
};

export const POLICY_LINKS = {
  terms_of_service: { href: '/terms-of-service', label: 'Terms of Service' },
  dispute_policy: { href: '/dispute-policy', label: 'Dispute Policy' },
  creator_agreement: { href: '/creator-agreement', label: 'Creator Agreement' },
};

/** Days after which a signed-in member is asked to re-confirm the policies. */
export const REACCEPT_DAYS = 30;

/**
 * Which policies a role must accept. Clients see the general terms plus the
 * dispute/refund policy; creators additionally accept the Creator Agreement.
 */
export function requiredPoliciesForRole(role) {
  return role === 'creator'
    ? ['terms_of_service', 'dispute_policy', 'creator_agreement']
    : ['terms_of_service', 'dispute_policy'];
}
