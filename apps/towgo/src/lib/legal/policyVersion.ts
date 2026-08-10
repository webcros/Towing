/**
 * Bump this whenever the privacy policy or terms of service copy changes
 * materially — a bump alone does not force re-consent (Phase 12 captures
 * consent once per device, see `consent.captured.v1` in `storage`); a later
 * phase can compare this against the version recorded in `POST /me/consent`
 * to decide whether to re-prompt.
 */
export const POLICY_VERSION = '2026-08-10';
