import { Logger } from '@nestjs/common';
import type { Response } from 'express';

/**
 * The one CSV writer. Hoisted out of `jobs.service.ts` in Phase 7, when
 * earnings statements and reports became the second and third exports.
 *
 * **One escape implementation is a security property, not a style preference.**
 * Formula injection (a cell starting `=`, `+`, `-` or `@` that Excel executes on
 * open) must not have two definitions that can drift apart — the second copy is
 * always the one that gets it wrong.
 */

const logger = new Logger('Csv');

/** Quote when needed; neutralize spreadsheet formula injection. */
export function csvEscape(value: string): string {
  let cell = value;
  if (/^[=+\-@]/.test(cell)) cell = `'${cell}`;
  if (/[",\n\r]/.test(cell)) cell = `"${cell.replaceAll('"', '""')}"`;
  return cell;
}

export function csvLine(cells: readonly string[]): string {
  return cells.map(csvEscape).join(',');
}

/**
 * Produces the next batch of rows, or an empty array when finished. Called
 * repeatedly; the implementation owns its own cursor.
 */
export type CsvBatchProducer = () => Promise<readonly (readonly string[])[]>;

/**
 * Stream a CSV download without ever buffering it.
 *
 * NOTE (`@Res` caveat, unchanged from the original in `jobs.service.ts`): an
 * error after the first write cannot become an error envelope — the response is
 * already committed. The stream is destroyed instead, so the client sees a
 * truncated download, which is the honest failure mode.
 */
export async function streamCsv(
  res: Response,
  options: { filename: string; header: readonly string[] },
  produceBatch: CsvBatchProducer,
): Promise<void> {
  try {
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${options.filename}"`);
    res.write(`${options.header.join(',')}\n`);

    for (;;) {
      const rows = await produceBatch();
      if (rows.length === 0) break;
      res.write(`${rows.map(csvLine).join('\n')}\n`);
    }

    res.end();
  } catch (err) {
    if (!res.headersSent) throw err;
    logger.error(
      `CSV export failed mid-stream (${options.filename}): ${err instanceof Error ? err.message : String(err)}`,
    );
    res.destroy();
  }
}
