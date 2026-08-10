import { z } from 'zod';

/** POST /v1/fleet/auth/login — step 1: credentials (spec §16.4). */
export const fleetLoginRequestSchema = z.object({
  email: z.email(),
  password: z.string().min(8),
});
export type FleetLoginRequest = z.infer<typeof fleetLoginRequestSchema>;

/** Step 2: OTP verification completing the login. */
export const fleetOtpVerifyRequestSchema = z.object({
  challengeId: z.uuid(),
  otp: z.string().regex(/^\d{6}$/),
});
export type FleetOtpVerifyRequest = z.infer<typeof fleetOtpVerifyRequestSchema>;

export const fleetSessionSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  fleet: z.object({
    id: z.string(),
    businessName: z.string(),
  }),
});
export type FleetSession = z.infer<typeof fleetSessionSchema>;
