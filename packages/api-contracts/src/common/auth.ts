import { z } from 'zod';
import { publicAuthRoleSchema } from './enums';

/**
 * Shapes shared by every realm's auth endpoints.
 *
 * The raw refresh value is a server-issued opaque secret, so no client ever
 * constructs one — which is why only the response side of it is described here.
 */

/**
 * Indian mobile numbers in E.164. Deliberately strict: the number is a unique
 * key on both `users` and `drivers`, so "+919876543210" and "9876543210" must
 * not be able to become two accounts for one person.
 */
export const mobileSchema = z
  .string()
  .trim()
  .regex(/^\+91[6-9]\d{9}$/, 'Enter a 10-digit Indian mobile number');

export const otpCodeSchema = z.string().regex(/^\d{6}$/);

/** POST /v1/auth/otp/send — step 1 for the customer and driver apps (§15.2). */
export const otpSendRequestSchema = z.object({
  mobile: mobileSchema,
  role: publicAuthRoleSchema,
});
export type OtpSendRequest = z.infer<typeof otpSendRequestSchema>;

export const otpSendResponseSchema = z.object({
  challengeId: z.uuid(),
  expiresAt: z.iso.datetime(),
  /** Seconds until "Resend code" should become tappable — the server's own cooldown. */
  resendAfterSeconds: z.number().int().nonnegative(),
});
export type OtpSendResponse = z.infer<typeof otpSendResponseSchema>;

/** POST /v1/auth/otp/verify — step 2, challenge + code becomes a session. */
export const otpVerifyRequestSchema = z.object({
  challengeId: z.uuid(),
  otp: otpCodeSchema,
});
export type OtpVerifyRequest = z.infer<typeof otpVerifyRequestSchema>;

/**
 * POST /v1/auth/social — Google now, Apple from Phase 13.
 *
 * `idToken` is the provider's signed JWT, verified server-side against the
 * provider's JWKS. The client never sends a provider access token: an ID token
 * is the only thing whose audience the server can pin to its own client ids.
 */
export const socialLoginRequestSchema = z.object({
  provider: z.enum(['google', 'apple']),
  idToken: z.string().min(1),
  role: publicAuthRoleSchema,
});
export type SocialLoginRequest = z.infer<typeof socialLoginRequestSchema>;

export const sessionTokensSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
});
export type SessionTokens = z.infer<typeof sessionTokensSchema>;
