import { index, integer, jsonb, pgTable, text, uuid } from 'drizzle-orm/pg-core';
import { primaryId, timestamps } from './columns';
import { importStatusEnum } from './enums';
import { fleets } from './fleets';

/** One row per `{ row, field, code, message }` in the downloadable error report. */
export interface ImportRowError {
  /** 1-based row number in the uploaded file, header excluded — what the user sees in Excel. */
  row: number;
  field: string;
  code: string;
  message: string;
}

/**
 * A bulk truck CSV import (§9.3.4).
 *
 * Persisted even for the synchronous path, because the error report has to
 * survive the response: the operator uploads 400 rows, 12 fail, and they need
 * to download `row,field,code,message` and fix the file. Holding that only in
 * the HTTP response would lose it on a refresh.
 */
export const truckImports = pgTable(
  'truck_imports',
  {
    id: primaryId(),
    fleetId: uuid('fleet_id')
      .notNull()
      .references(() => fleets.id, { onDelete: 'cascade' }),
    filename: text('filename'),
    status: importStatusEnum('status').notNull().default('pending'),
    totalRows: integer('total_rows').notNull().default(0),
    importedRows: integer('imported_rows').notNull().default(0),
    failedRows: integer('failed_rows').notNull().default(0),
    /** The error report. Capped when written — a 10k-row disaster must not become a 10k-entry blob. */
    errors: jsonb('errors').$type<ImportRowError[]>().notNull().default([]),
    /**
     * Raw CSV for the queued path only. The worker runs in another process and
     * cannot read the request's multipart buffer; nulled once the job finishes
     * so a fleet's whole upload history is not sitting in the row store.
     */
    payload: text('payload'),
    failureReason: text('failure_reason'),
    ...timestamps,
  },
  (t) => [index('idx_truck_imports_fleet').on(t.fleetId, t.createdAt.desc())],
);
