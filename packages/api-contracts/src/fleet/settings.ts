import { z } from 'zod';

/**
 * `GET/PUT /v1/fleet/settings` and the Route linked-account onboarding
 * (§9.3.1, §9.3.8).
 *
 * §9.3.1's wizard is "business profile (name, GSTIN optional, address), bank
 * details for payouts (Route), notification preferences", resumable, with the
 * account "usable only after business profile completes". Phase 7 scopes that
 * gate to the money paths: requesting a payout and linking a bank account.
 */

/**
 * Keys match the console's existing `NOTIFICATION_PREFS` exactly, so the Phase 2
 * toggles keep their labels and their meaning when they finally persist.
 *
 * Stored as jsonb rather than columns: the list is product-driven and grows
 * (Phase 13 adds per-channel prefs), it is never a query predicate, and adding
 * a preference must not be a migration. Unknown keys are dropped on write and
 * missing keys default on read, so an old client can never blank a new pref.
 */
export const notificationPrefsSchema = z.object({
  compliance: z.boolean().default(true),
  payouts: z.boolean().default(true),
  jobs: z.boolean().default(false),
  weekly: z.boolean().default(true),
});
export type NotificationPrefs = z.infer<typeof notificationPrefsSchema>;

export const NOTIFICATION_PREF_DEFAULTS: NotificationPrefs = {
  compliance: true,
  payouts: true,
  jobs: false,
  weekly: true,
};

/**
 * 2 state digits · 5 PAN letters · 4 PAN digits · PAN check letter · entity
 * code · literal Z · checksum. Verified against both seeded fixtures
 * (`29ABCDE1234F1Z5`, `33FGHIJ5678K2Z9`) — a stricter pattern would make `PUT`
 * round-trips fail on the demo data.
 */
export const GSTIN_REGEX = /^\d{2}[A-Z]{5}\d{4}[A-Z][A-Z\d]Z[A-Z\d]$/;

export const IFSC_REGEX = /^[A-Z]{4}0[A-Z0-9]{6}$/;

export const payoutAccountStatusSchema = z.enum([
  'unlinked',
  'pending',
  'active',
  'rejected',
  'suspended',
]);
export type PayoutAccountStatus = z.infer<typeof payoutAccountStatusSchema>;

/**
 * The redacted view. `accountNumberLast4` is the ONLY account-number field that
 * crosses the wire in either direction — the full number goes to the provider
 * at onboarding and is never persisted, so there is nothing else to return.
 */
export const payoutAccountSchema = z.object({
  status: payoutAccountStatusSchema,
  beneficiaryName: z.string().nullable(),
  accountNumberLast4: z.string().nullable(),
  ifsc: z.string().nullable(),
  bankName: z.string().nullable(),
  failureReason: z.string().nullable(),
  linkedAt: z.iso.datetime().nullable(),
});
export type PayoutAccountDto = z.infer<typeof payoutAccountSchema>;

export const onboardingStepSchema = z.enum(['profile', 'payout_account', 'notifications', 'done']);
export type OnboardingStep = z.infer<typeof onboardingStepSchema>;

export const fleetSettingsSchema = z.object({
  businessName: z.string(),
  gstin: z.string().nullable(),
  address: z.string().nullable(),
  notificationPrefs: notificationPrefsSchema,
  payoutAccount: payoutAccountSchema,
  onboarding: z.object({
    /**
     * A monotonic high-water mark, never "the step currently shown" — editing
     * an address from /settings a year later must not throw the owner back
     * into the wizard.
     */
    step: onboardingStepSchema,
    profileComplete: z.boolean(),
    payoutAccountLinked: z.boolean(),
    completedAt: z.iso.datetime().nullable(),
  }),
});
export type FleetSettingsDto = z.infer<typeof fleetSettingsSchema>;

/**
 * `PUT` with a partial body — the same idiom `PUT /v1/fleet/trucks/:id` already
 * uses. That is deliberate: the BFF proxy exports GET/POST/PUT/DELETE and no
 * PATCH, and adding one for a single route would be a new seam for no gain.
 *
 * `onboardingStep` is NOT settable here. A client that could write it could
 * walk itself past the §9.3.1 gate; the step advances only through
 * `POST /settings/onboarding/advance`, which validates each transition.
 */
export const fleetSettingsUpdateSchema = z
  .object({
    businessName: z.string().trim().min(2).max(120),
    gstin: z
      .string()
      .trim()
      .toUpperCase()
      .regex(GSTIN_REGEX, 'Enter a valid 15-character GSTIN')
      .nullable(),
    address: z.string().trim().min(10).max(300).nullable(),
    notificationPrefs: notificationPrefsSchema.partial(),
  })
  .partial()
  .refine((o) => Object.keys(o).length > 0, {
    message: 'Provide at least one field to update',
  });
export type FleetSettingsUpdate = z.infer<typeof fleetSettingsUpdateSchema>;

/** `POST /v1/fleet/settings/payout-account` — the only place a full account number appears. */
export const payoutAccountLinkSchema = z.object({
  beneficiaryName: z.string().trim().min(2).max(120),
  accountNumber: z.string().trim().regex(/^\d{6,20}$/, 'Enter a valid bank account number'),
  ifsc: z
    .string()
    .trim()
    .toUpperCase()
    .regex(IFSC_REGEX, 'Enter a valid IFSC, e.g. HDFC0000123'),
});
export type PayoutAccountLinkRequest = z.infer<typeof payoutAccountLinkSchema>;

/**
 * `POST /v1/fleet/settings/onboarding/advance` — a narrow, unspoofable state
 * machine. `from` makes the call idempotent under a double-tap: advancing from
 * a step the server has already left is a no-op, not a skip.
 */
export const onboardingAdvanceSchema = z.object({
  from: onboardingStepSchema,
});
export type OnboardingAdvanceRequest = z.infer<typeof onboardingAdvanceSchema>;
