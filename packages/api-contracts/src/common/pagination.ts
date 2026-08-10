import { z } from 'zod';

/** Classic page/limit query for small tables (trucks, drivers). */
export const pageQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  sort: z.string().optional(),
});
export type PageQuery = z.infer<typeof pageQuerySchema>;

export function pageEnvelopeSchema<T extends z.ZodType>(item: T) {
  return z.object({
    items: z.array(item),
    page: z.number().int(),
    limit: z.number().int(),
    total: z.number().int(),
  });
}

/**
 * Cursor (keyset) pagination for unbounded feeds (jobs, ledger). The cursor
 * is an opaque base64 of `(created_at, id)` — offset pagination degrades on
 * big tables; keyset stays O(page) forever.
 */
export const cursorQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
export type CursorQuery = z.infer<typeof cursorQuerySchema>;

export function cursorEnvelopeSchema<T extends z.ZodType>(item: T) {
  return z.object({
    items: z.array(item),
    nextCursor: z.string().nullable(),
  });
}
