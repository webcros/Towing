import { z } from 'zod';
import { sessionTokensSchema } from '../common/auth';

/**
 * Customer-realm auth (§9.1, §15.2). Phone OTP or social sign-in; no password
 * exists anywhere in this realm.
 *
 * Names are `customer`-prefixed because the package barrel is flat.
 */

export const customerIdentitySchema = z.object({
  id: z.uuid(),
  mobile: z.string(),
  name: z.string().nullable(),
  /**
   * True when this login created the account. The app uses it to route into the
   * profile step instead of straight to the map — the server knows, and making
   * the client guess from a null name would be wrong the moment a returning
   * customer has still not set one.
   */
  isNew: z.boolean(),
});
export type CustomerIdentity = z.infer<typeof customerIdentitySchema>;

export const customerSessionSchema = sessionTokensSchema.extend({
  customer: customerIdentitySchema,
});
export type CustomerSession = z.infer<typeof customerSessionSchema>;
