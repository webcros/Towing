import { Inject, Injectable } from '@nestjs/common';
import type {
  AccountDeletionResponse,
  AccountExportResponse,
  ConsentRecordRequest,
} from '@towing/api-contracts';
import { and, eq } from 'drizzle-orm';
import { ApiException } from '../../common/errors/api-exception';
import { isUniqueViolation } from '../../common/errors/pg-errors';
import { DB, type Database } from '../../db/db.module';
import {
  addresses,
  consentRecords,
  deletionRequests,
  drivers,
  emergencyContacts,
  savedVehicles,
  users,
} from '../../db/schema';

export type PrivacySubjectType = 'user' | 'driver';

/**
 * §20.4 DPDP, dual-realm (Phase 12) — `DELETE /v1/me`, `GET /v1/me/export`,
 * `POST /v1/me/consent`. A customer and a driver call the exact same routes;
 * what differs is which tables `subjectType` reads from.
 */
@Injectable()
export class AccountPrivacyService {
  constructor(@Inject(DB) private readonly db: Database) {}

  async requestDeletion(
    subjectType: PrivacySubjectType,
    subjectId: string,
    reason?: string,
  ): Promise<AccountDeletionResponse> {
    try {
      const [row] = await this.db
        .insert(deletionRequests)
        .values({ subjectType, subjectId, reason })
        .returning({ id: deletionRequests.id, requestedAt: deletionRequests.requestedAt });

      return { requestId: row!.id, status: 'requested', requestedAt: row!.requestedAt.toISOString() };
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      // `uq_deletion_requests_one_open_per_subject` — a second request while
      // one is still open is a no-op from the subject's point of view, not a
      // new fact worth a second row for Phase 20's erasure worker to race on.
      throw ApiException.conflict('An account deletion request is already open');
    }
  }

  async recordConsent(
    subjectType: PrivacySubjectType,
    subjectId: string,
    body: ConsentRecordRequest,
  ): Promise<void> {
    await this.db.insert(consentRecords).values({
      subjectType,
      subjectId,
      policyType: body.policyType,
      policyVersion: body.policyVersion,
    });
  }

  async exportData(
    subjectType: PrivacySubjectType,
    subjectId: string,
  ): Promise<AccountExportResponse> {
    const consents = await this.db
      .select({
        policyType: consentRecords.policyType,
        policyVersion: consentRecords.policyVersion,
        consentedAt: consentRecords.consentedAt,
      })
      .from(consentRecords)
      .where(and(eq(consentRecords.subjectType, subjectType), eq(consentRecords.subjectId, subjectId)));

    const consentRows = consents.map((c) => ({
      policyType: c.policyType,
      policyVersion: c.policyVersion,
      consentedAt: c.consentedAt.toISOString(),
    })) as AccountExportResponse['consents'];

    if (subjectType === 'driver') {
      // Nothing else exists to export for a driver yet beyond KYC documents,
      // which stay out of the export bundle for now — DPDP §20.4's own
      // scoping question, noted in ToBeDoneEhsan.md rather than assumed.
      const [driver] = await this.db
        .select({
          id: drivers.id,
          mobile: drivers.mobile,
          name: drivers.name,
          email: drivers.email,
          kycStatus: drivers.kycStatus,
        })
        .from(drivers)
        .where(eq(drivers.id, subjectId))
        .limit(1);

      return { profile: driver ?? null, consents: consentRows };
    }

    const [profile, vehicles, addressRows, contacts] = await Promise.all([
      this.db
        .select({
          id: users.id,
          mobile: users.mobile,
          name: users.name,
          email: users.email,
        })
        .from(users)
        .where(eq(users.id, subjectId))
        .limit(1),
      this.db
        .select({ id: savedVehicles.id, type: savedVehicles.type, plate: savedVehicles.plate })
        .from(savedVehicles)
        .where(eq(savedVehicles.userId, subjectId)),
      this.db
        .select({ id: addresses.id, fullAddress: addresses.fullAddress })
        .from(addresses)
        .where(eq(addresses.userId, subjectId)),
      this.db
        .select({ id: emergencyContacts.id, name: emergencyContacts.name, phone: emergencyContacts.phone })
        .from(emergencyContacts)
        .where(eq(emergencyContacts.userId, subjectId)),
    ]);

    return {
      profile: profile[0] ?? null,
      vehicles,
      addresses: addressRows,
      emergencyContacts: contacts,
      consents: consentRows,
    };
  }
}
