import { z } from 'zod';
import { sessionTokensSchema } from '../common/auth';
import { kycStatusSchema } from '../common/enums';

/**
 * Driver-realm auth (§9.2, §15.2). Same phone-OTP flow as the customer app; the
 * difference is what the session carries.
 */

export const driverIdentitySchema = z.object({
  id: z.uuid(),
  mobile: z.string(),
  name: z.string().nullable(),
  /**
   * §3.1 — the driver app's root switch reads this to decide between the KYC
   * flow, the "awaiting approval" screen and the online toggle. A fresh signup
   * is always `incomplete`; `pending` means submitted and awaiting a human.
   *
   * Also present as a claim on the access token, refreshed on every rotation,
   * so an approval takes effect without re-login.
   */
  kycStatus: kycStatusSchema,
  /** Null for independent drivers — most are, at launch. */
  fleetId: z.uuid().nullable(),
  isNew: z.boolean(),
});
export type DriverIdentity = z.infer<typeof driverIdentitySchema>;

export const driverSessionSchema = sessionTokensSchema.extend({
  driver: driverIdentitySchema,
});
export type DriverSession = z.infer<typeof driverSessionSchema>;
