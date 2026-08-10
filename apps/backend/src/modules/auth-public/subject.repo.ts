import { Inject, Injectable } from '@nestjs/common';
import type { PublicAuthRole } from '@towing/api-contracts';
import { and, eq } from 'drizzle-orm';
import { DB, type Database } from '../../db/db.module';
import { drivers, socialIdentities, users } from '../../db/schema';
import type { Realm } from '../auth/auth.types';

export interface PublicSubject {
  id: string;
  mobile: string;
  name: string | null;
  /** True when this call created the row — drives the app's post-login routing. */
  isNew: boolean;
  /** Drivers only. */
  kycStatus?: (typeof drivers.$inferSelect)['kycStatus'];
  fleetId?: string | null;
}

export const REALM_FOR_ROLE = { customer: 'customer', driver: 'driver' } as const satisfies Record<
  PublicAuthRole,
  Realm
>;

/**
 * First-login provisioning for the two phone-OTP realms.
 *
 * `users.mobile` and `drivers.mobile` are both UNIQUE, so "find or create" is a
 * plain upsert with `onConflictDoNothing` followed by a read — which is what
 * makes two simultaneous first logins from the same number resolve to one row
 * rather than one of them 500ing on a duplicate key.
 *
 * PROVISIONING ON AN UNKNOWN NUMBER IS DELIBERATE. Returning 404 for a number
 * with no account would turn this endpoint into an oracle for "does this person
 * use Towing", answerable by anyone with a phone book.
 */
@Injectable()
export class SubjectRepo {
  constructor(@Inject(DB) private readonly db: Database) {}

  async findOrCreateByMobile(role: PublicAuthRole, mobile: string): Promise<PublicSubject> {
    return role === 'customer' ? this.customerByMobile(mobile) : this.driverByMobile(mobile);
  }

  async findById(role: PublicAuthRole, id: string): Promise<PublicSubject | null> {
    if (role === 'customer') {
      const [row] = await this.db
        .select({ id: users.id, mobile: users.mobile, name: users.name })
        .from(users)
        .where(eq(users.id, id))
        .limit(1);
      return row ? { ...row, isNew: false } : null;
    }

    const [row] = await this.db
      .select({
        id: drivers.id,
        mobile: drivers.mobile,
        name: drivers.name,
        kycStatus: drivers.kycStatus,
        fleetId: drivers.fleetId,
      })
      .from(drivers)
      .where(eq(drivers.id, id))
      .limit(1);

    return row ? { ...row, isNew: false } : null;
  }

  private async customerByMobile(mobile: string): Promise<PublicSubject> {
    const inserted = await this.db
      .insert(users)
      .values({ mobile })
      .onConflictDoNothing({ target: users.mobile })
      .returning({ id: users.id, mobile: users.mobile, name: users.name });

    if (inserted[0]) return { ...inserted[0], isNew: true };

    const [existing] = await this.db
      .select({ id: users.id, mobile: users.mobile, name: users.name })
      .from(users)
      .where(eq(users.mobile, mobile))
      .limit(1);

    // Unreachable: the insert conflicted, so the row exists.
    if (!existing) throw new Error(`users row for ${mobile} vanished between insert and select`);
    return { ...existing, isNew: false };
  }

  private async driverByMobile(mobile: string): Promise<PublicSubject> {
    const inserted = await this.db
      .insert(drivers)
      // `kycStatus` explicitly, even though migration 0007 makes it the column
      // default: `pending` must mean "submitted and awaiting a human", and a
      // self-signup that has uploaded nothing must never enter Phase 11's queue.
      // Stating it here means a future default change cannot silently move it.
      .values({ mobile, kycStatus: 'incomplete' })
      .onConflictDoNothing({ target: drivers.mobile })
      .returning({
        id: drivers.id,
        mobile: drivers.mobile,
        name: drivers.name,
        kycStatus: drivers.kycStatus,
        fleetId: drivers.fleetId,
      });

    if (inserted[0]) return { ...inserted[0], isNew: true };

    const [existing] = await this.db
      .select({
        id: drivers.id,
        mobile: drivers.mobile,
        name: drivers.name,
        kycStatus: drivers.kycStatus,
        fleetId: drivers.fleetId,
      })
      .from(drivers)
      .where(eq(drivers.mobile, mobile))
      .limit(1);

    if (!existing) throw new Error(`drivers row for ${mobile} vanished between insert and select`);
    return { ...existing, isNew: false };
  }

  /**
   * The account bound to a provider identity, creating the binding on first use.
   *
   * Social sign-in has no mobile number to key on, so a first-time social user
   * gets a row with a synthetic placeholder mobile they replace during profile
   * setup. Keyed on `(provider, provider_subject)` — never on email, which
   * changes hands.
   */
  async findOrCreateBySocial(
    role: PublicAuthRole,
    provider: 'google' | 'apple',
    providerSubject: string,
    profile: { email: string | null; emailVerified: boolean; name: string | null },
  ): Promise<PublicSubject> {
    const subjectType = role === 'customer' ? 'user' : 'driver';

    const [binding] = await this.db
      .select({ subjectId: socialIdentities.subjectId })
      .from(socialIdentities)
      .where(
        and(
          eq(socialIdentities.provider, provider),
          eq(socialIdentities.providerSubject, providerSubject),
          // The same Google account signing into both apps is two accounts, so
          // the binding is per subject type as well as per provider.
          eq(socialIdentities.subjectType, subjectType),
        ),
      )
      .limit(1);

    if (binding) {
      const existing = await this.findById(role, binding.subjectId);
      if (existing) {
        await this.db
          .update(socialIdentities)
          .set({ lastLoginAt: new Date(), email: profile.email, updatedAt: new Date() })
          .where(
            and(
              eq(socialIdentities.provider, provider),
              eq(socialIdentities.providerSubject, providerSubject),
              eq(socialIdentities.subjectType, subjectType),
            ),
          );
        return existing;
      }
      // Binding outlived its subject — fall through and re-provision.
    }

    const subject = await this.createForSocial(role, providerSubject, profile.name);

    await this.db
      .insert(socialIdentities)
      .values({
        provider,
        providerSubject,
        subjectType,
        subjectId: subject.id,
        email: profile.email,
        emailVerified: profile.emailVerified,
        lastLoginAt: new Date(),
      })
      .onConflictDoNothing({
        target: [
          socialIdentities.provider,
          socialIdentities.providerSubject,
          // `subject_type` is part of the key: the same Google account is a
          // different account in the customer app and the driver app.
          socialIdentities.subjectType,
        ],
      });

    return subject;
  }

  private async createForSocial(
    role: PublicAuthRole,
    providerSubject: string,
    name: string | null,
  ): Promise<PublicSubject> {
    // `mobile` is NOT NULL and UNIQUE on both tables, and a social signup has
    // none. A namespaced placeholder derived from the provider subject keeps the
    // uniqueness meaningful and is obviously not a phone number to anyone
    // reading the table. Phase 12's profile step replaces it.
    const placeholder = `social:${providerSubject}`.slice(0, 64);

    if (role === 'customer') {
      const [row] = await this.db
        .insert(users)
        .values({ mobile: placeholder, name })
        .returning({ id: users.id, mobile: users.mobile, name: users.name });
      return { ...row!, isNew: true };
    }

    const [row] = await this.db
      .insert(drivers)
      .values({ mobile: placeholder, name, kycStatus: 'incomplete' })
      .returning({
        id: drivers.id,
        mobile: drivers.mobile,
        name: drivers.name,
        kycStatus: drivers.kycStatus,
        fleetId: drivers.fleetId,
      });
    return { ...row!, isNew: true };
  }
}
