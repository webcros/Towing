import { Inject, Injectable } from '@nestjs/common';
import { and, count, desc, eq, inArray, isNull, lt, or } from 'drizzle-orm';
import {
  SUBJECT_NOTIFICATION_PREF_DEFAULTS,
  type CursorQuery,
  type NotificationsListResponse,
  type NotificationsReadResponse,
  type SubjectNotificationPrefs,
  type SubjectNotificationPrefsUpdate,
} from '@towing/api-contracts';
import { DB, type Database } from '../../db/db.module';
import { drivers } from '../../db/schema/drivers';
import { notifications } from '../../db/schema/notifications';
import { users } from '../../db/schema/users';
import { decodeCursor, encodeCursor } from '../jobs/jobs.cursor';

export type CentreSubjectType = 'user' | 'driver';

/**
 * The in-app notification centre — the bell in `AppHeader` and `DriverHeader`,
 * both of which did nothing before Phase 13.
 *
 * It reads `notifications` rows only. It never consults
 * `notification_deliveries`, and that is deliberate (invariant 74): a message
 * whose recipient had no push token, whose channel is on the log adapter, or
 * whose device was revoked must still appear here. Deriving the bell from
 * delivery receipts would make the entire spine invisible until real vendor
 * credentials exist.
 */
@Injectable()
export class NotificationCentreService {
  constructor(@Inject(DB) private readonly db: Database) {}

  async list(
    subjectType: CentreSubjectType,
    subjectId: string,
    query: CursorQuery,
  ): Promise<NotificationsListResponse> {
    const scope = and(
      eq(notifications.subjectType, subjectType),
      eq(notifications.subjectId, subjectId),
    );

    // Keyset, not offset: the feed grows forever and offset degrades on it.
    // `(created_at DESC, id DESC)` matches `idx_notifications_subject`, so the
    // page is an index range scan rather than a sort.
    const after = query.cursor ? decodeCursor(query.cursor) : null;
    const where = after
      ? and(
          scope,
          or(
            lt(notifications.createdAt, after.createdAt),
            and(eq(notifications.createdAt, after.createdAt), lt(notifications.id, after.id)),
          ),
        )
      : scope;

    // One extra row is the "is there a next page" probe — cheaper and more
    // honest than a COUNT over an unbounded feed.
    const rows = await this.db
      .select()
      .from(notifications)
      .where(where)
      .orderBy(desc(notifications.createdAt), desc(notifications.id))
      .limit(query.limit + 1);

    const page = rows.slice(0, query.limit);
    const last = page.at(-1);

    return {
      items: page.map((row) => ({
        id: row.id,
        event: row.event,
        category: row.category,
        title: row.title,
        body: row.body,
        data: row.data,
        readAt: row.readAt?.toISOString() ?? null,
        createdAt: row.createdAt.toISOString(),
      })),
      nextCursor:
        rows.length > query.limit && last
          ? encodeCursor({ createdAt: last.createdAt, id: last.id })
          : null,
    };
  }

  async unreadCount(subjectType: CentreSubjectType, subjectId: string): Promise<number> {
    const [row] = await this.db
      .select({ value: count() })
      .from(notifications)
      .where(
        and(
          eq(notifications.subjectType, subjectType),
          eq(notifications.subjectId, subjectId),
          isNull(notifications.readAt),
        ),
      );
    return row?.value ?? 0;
  }

  /**
   * `ids` absent means "mark everything read" — one route rather than a
   * separate `/read-all`, since the difference is a WHERE clause.
   *
   * The subject scope is in the WHERE regardless of the ids supplied, so
   * passing somebody else's notification id marks nothing rather than
   * anything: the ids are a filter, never an authorisation.
   */
  async markRead(
    subjectType: CentreSubjectType,
    subjectId: string,
    ids?: string[],
  ): Promise<NotificationsReadResponse> {
    const scope = and(
      eq(notifications.subjectType, subjectType),
      eq(notifications.subjectId, subjectId),
      isNull(notifications.readAt),
    );

    const marked = await this.db
      .update(notifications)
      .set({ readAt: new Date(), updatedAt: new Date() })
      .where(ids && ids.length > 0 ? and(scope, inArray(notifications.id, ids)) : scope)
      .returning({ id: notifications.id });

    return {
      markedRead: marked.length,
      unread: await this.unreadCount(subjectType, subjectId),
    };
  }

  /**
   * Defaults merged on read — a subject who has never opened the screen gets
   * the product default, and a key added in a later phase defaults correctly
   * for every existing row without a backfill. Same idiom
   * `settings.service.ts` uses for `fleets.notification_prefs`.
   */
  async getPrefs(
    subjectType: CentreSubjectType,
    subjectId: string,
  ): Promise<SubjectNotificationPrefs> {
    const stored = await this.readStoredPrefs(subjectType, subjectId);
    return { ...SUBJECT_NOTIFICATION_PREF_DEFAULTS, ...stored };
  }

  async updatePrefs(
    subjectType: CentreSubjectType,
    subjectId: string,
    patch: SubjectNotificationPrefsUpdate,
  ): Promise<SubjectNotificationPrefs> {
    const stored = await this.readStoredPrefs(subjectType, subjectId);
    // Merged rather than replaced: a PUT from an older client that does not
    // know about a newer key must not blank it.
    const next = { ...stored, ...patch };

    if (subjectType === 'driver') {
      await this.db
        .update(drivers)
        .set({ notificationPrefs: next, updatedAt: new Date() })
        .where(eq(drivers.id, subjectId));
    } else {
      await this.db
        .update(users)
        .set({ notificationPrefs: next, updatedAt: new Date() })
        .where(eq(users.id, subjectId));
    }

    return { ...SUBJECT_NOTIFICATION_PREF_DEFAULTS, ...next };
  }

  private async readStoredPrefs(
    subjectType: CentreSubjectType,
    subjectId: string,
  ): Promise<Partial<SubjectNotificationPrefs>> {
    if (subjectType === 'driver') {
      const [row] = await this.db
        .select({ prefs: drivers.notificationPrefs })
        .from(drivers)
        .where(eq(drivers.id, subjectId))
        .limit(1);
      return row?.prefs ?? {};
    }

    const [row] = await this.db
      .select({ prefs: users.notificationPrefs })
      .from(users)
      .where(eq(users.id, subjectId))
      .limit(1);
    return row?.prefs ?? {};
  }
}

