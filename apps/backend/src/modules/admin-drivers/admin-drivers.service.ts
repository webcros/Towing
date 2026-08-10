import { Inject, Injectable } from '@nestjs/common';
import type {
  AdminCapabilitiesResponse,
  AdminCapabilitiesUpdate,
  AdminDocumentReview,
  AdminDocumentReviewResult,
  AdminKycDecision,
  AdminKycResult,
  AdminPendingDriversResponse,
} from '@towing/api-contracts';
import { and, asc, eq } from 'drizzle-orm';
import { ApiException } from '../../common/errors/api-exception';
import { keyFromFileUrl } from '../../common/storage/file-url';
import { STORAGE, type StoragePort } from '../../common/storage/storage.port';
import { DB, type Database } from '../../db/db.module';
import { driverDocuments, drivers } from '../../db/schema';
import type { KycStatus } from '../auth/auth.types';
import { TokenService, type SessionContext } from '../auth/token.service';
import { AdminAuditService } from '../admin-auth/admin-audit.service';

/** Where each driver-level decision lands. */
const NEXT_STATUS: Record<AdminKycDecision['decision'], KycStatus> = {
  approve: 'approved',
  reject: 'rejected',
  // Back to `incomplete`, not `pending`: the driver needs to act (resubmit a
  // document) before this can be `pending` again — leaving it `pending` would
  // put a request-info'd driver right back in the queue with nothing changed.
  request_info: 'incomplete',
  suspend: 'suspended',
  // Back to `pending` rather than `approved`: reinstating an account is not the
  // same judgement as approving its documents, and a human should make the
  // second one explicitly.
  reactivate: 'pending',
};

/** Thumbnail links in the queue are short-lived — re-fetch the queue rather than caching them. */
const THUMBNAIL_TTL_SECONDS = 5 * 60;

/**
 * The §3.1 KYC queue and per-document review (Phase 11) — built on Phase 10's
 * single `decide()` action, which now lives here instead of `admin-auth`
 * (that module stays authentication-only).
 */
@Injectable()
export class AdminDriversService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly audit: AdminAuditService,
    private readonly tokens: TokenService,
    @Inject(STORAGE) private readonly storage: StoragePort,
  ) {}

  async decide(
    adminId: string,
    driverId: string,
    body: AdminKycDecision,
    context: SessionContext = {},
  ): Promise<AdminKycResult> {
    const [before] = await this.db
      .select({
        id: drivers.id,
        kycStatus: drivers.kycStatus,
        rejectionReason: drivers.rejectionReason,
        approvedBy: drivers.approvedBy,
      })
      .from(drivers)
      .where(eq(drivers.id, driverId))
      .limit(1);

    if (!before) throw ApiException.notFound('Driver not found');

    const status = NEXT_STATUS[body.decision];
    const approving = body.decision === 'approve';
    const now = new Date();

    const [after] = await this.db
      .update(drivers)
      .set({
        kycStatus: status,
        // `approved_by` now references `admin_users` (migration 0007). Cleared
        // on any non-approval so a rejected/reinstated driver does not keep a
        // stale approver.
        approvedBy: approving ? adminId : null,
        approvedAt: approving ? now : null,
        rejectionReason: ['reject', 'request_info'].includes(body.decision)
          ? (body.reason ?? null)
          : null,
        updatedAt: now,
      })
      .where(eq(drivers.id, driverId))
      .returning({
        id: drivers.id,
        kycStatus: drivers.kycStatus,
        rejectionReason: drivers.rejectionReason,
        approvedBy: drivers.approvedBy,
      });

    /**
     * Losing authority must be IMMEDIATE, not eventual (§9.4.3).
     *
     * Without this, a suspended or rejected driver keeps a valid access token
     * for the rest of its 900-second life and could accept a job in that window.
     * `DriverRealmPolicy` covers the same ground at the next refresh; this
     * closes the gap before it.
     */
    const revokesAuthority = status === 'suspended' || status === 'rejected';
    const sessionsRevoked = revokesAuthority
      ? await this.tokens.revokeSubject(driverId, 'driver', `kyc_${body.decision}`)
      : 0;

    // Written after the mutation and awaited, not fire-and-forget: an audit row
    // that can silently go missing is worse than none, because it is trusted.
    await this.audit.record({
      adminId,
      action: `driver.kyc.${body.decision}`,
      subjectType: 'driver',
      subjectId: driverId,
      before,
      after: after ?? null,
      reason: body.reason ?? null,
      ip: context.ip ?? null,
      userAgent: context.userAgent ?? null,
    });

    return {
      driverId,
      kycStatus: after!.kycStatus,
      rejectionReason: after!.rejectionReason,
      sessionsRevoked,
    };
  }

  /**
   * Strictly `kyc_status = 'pending'` — "submitted and awaiting a human", per
   * migration 0007's default change. An `incomplete` driver (nothing submitted
   * yet) must never appear here, however long ago they signed up.
   */
  async pending(): Promise<AdminPendingDriversResponse> {
    const rows = await this.db
      .select({
        id: drivers.id,
        name: drivers.name,
        mobile: drivers.mobile,
        vehicleClass: drivers.vehicleClass,
        longDistanceEnabled: drivers.longDistanceEnabled,
        kycSubmittedAt: drivers.kycSubmittedAt,
      })
      .from(drivers)
      .where(eq(drivers.kycStatus, 'pending'))
      // Oldest submission first — a queue should clear front-to-back.
      .orderBy(asc(drivers.kycSubmittedAt));

    const items = await Promise.all(
      rows.map(async (row) => {
        const docs = await this.db
          .select({
            id: driverDocuments.id,
            docType: driverDocuments.docType,
            status: driverDocuments.status,
            rejectionReason: driverDocuments.rejectionReason,
            fileUrl: driverDocuments.fileUrl,
          })
          .from(driverDocuments)
          .where(eq(driverDocuments.driverId, row.id));

        const documents = await Promise.all(
          docs.map(async (doc) => {
            const thumbnail = await this.storage.presignGet(
              keyFromFileUrl(doc.fileUrl),
              THUMBNAIL_TTL_SECONDS,
            );
            return {
              id: doc.id,
              docType: doc.docType,
              status: doc.status,
              rejectionReason: doc.rejectionReason,
              thumbnailUrl: thumbnail.url,
            };
          }),
        );

        return {
          id: row.id,
          name: row.name,
          mobile: row.mobile,
          vehicleClass: row.vehicleClass,
          longDistanceEnabled: row.longDistanceEnabled,
          kycSubmittedAt: row.kycSubmittedAt?.toISOString() ?? null,
          documents,
        };
      }),
    );

    return { items };
  }

  /**
   * Per-document review — new in Phase 11. `driverId` is checked against the
   * document's own `driver_id`, not just used to build the query: without it,
   * a valid `docId` for a DIFFERENT driver, addressed through this driver's
   * URL, would silently review the wrong person's document.
   */
  async reviewDocument(
    adminId: string,
    driverId: string,
    documentId: string,
    body: AdminDocumentReview,
    context: SessionContext = {},
  ): Promise<AdminDocumentReviewResult> {
    const [before] = await this.db
      .select({
        id: driverDocuments.id,
        driverId: driverDocuments.driverId,
        docType: driverDocuments.docType,
        status: driverDocuments.status,
        rejectionReason: driverDocuments.rejectionReason,
      })
      .from(driverDocuments)
      .where(and(eq(driverDocuments.id, documentId), eq(driverDocuments.driverId, driverId)))
      .limit(1);

    if (!before) throw ApiException.notFound('Document not found');

    const status = body.decision === 'approve' ? ('approved' as const) : ('rejected' as const);
    const now = new Date();

    const [after] = await this.db
      .update(driverDocuments)
      .set({
        status,
        rejectionReason: body.decision === 'reject' ? (body.reason ?? null) : null,
        verifiedBy: adminId,
        verifiedAt: now,
        updatedAt: now,
      })
      .where(eq(driverDocuments.id, documentId))
      .returning({
        id: driverDocuments.id,
        docType: driverDocuments.docType,
        status: driverDocuments.status,
        rejectionReason: driverDocuments.rejectionReason,
      });

    await this.audit.record({
      adminId,
      action: `driver.document.${body.decision}`,
      subjectType: 'driver_document',
      subjectId: documentId,
      before,
      after,
      reason: body.reason ?? null,
      ip: context.ip ?? null,
      userAgent: context.userAgent ?? null,
    });

    return {
      documentId: after!.id,
      docType: after!.docType,
      status: after!.status,
      rejectionReason: after!.rejectionReason,
    };
  }

  /** §3.2 — admin can revoke (or grant) the Band C long-haul opt-in and reclassify vehicle class. */
  async updateCapabilities(
    adminId: string,
    driverId: string,
    body: AdminCapabilitiesUpdate,
    context: SessionContext = {},
  ): Promise<AdminCapabilitiesResponse> {
    const [before] = await this.db
      .select({ vehicleClass: drivers.vehicleClass, longDistanceEnabled: drivers.longDistanceEnabled })
      .from(drivers)
      .where(eq(drivers.id, driverId))
      .limit(1);
    if (!before) throw ApiException.notFound('Driver not found');

    const [after] = await this.db
      .update(drivers)
      .set({
        ...(body.vehicleClass !== undefined ? { vehicleClass: body.vehicleClass } : {}),
        ...(body.longDistanceEnabled !== undefined
          ? { longDistanceEnabled: body.longDistanceEnabled }
          : {}),
        updatedAt: new Date(),
      })
      .where(eq(drivers.id, driverId))
      .returning({ vehicleClass: drivers.vehicleClass, longDistanceEnabled: drivers.longDistanceEnabled });

    await this.audit.record({
      adminId,
      action: 'driver.capabilities.update',
      subjectType: 'driver',
      subjectId: driverId,
      before,
      after,
      ip: context.ip ?? null,
      userAgent: context.userAgent ?? null,
    });

    return after!;
  }
}
