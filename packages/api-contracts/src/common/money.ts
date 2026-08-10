import { z } from 'zod';

/**
 * Money crosses the API as integer paise (precision-safe in JSON); the
 * database stores NUMERIC(12,2) rupee strings. These two converters are the
 * only sanctioned bridge — both work in string/integer space so no float ever
 * touches a money value.
 */

/** Integer paise. Signed — ledger amounts carry their sign. */
export const paiseSchema = z.number().int();

/** Non-negative paise for fares/balances where a sign would be a bug. */
export const unsignedPaiseSchema = z.number().int().min(0);

/** `"149.90"` → `14990`. Accepts optional sign and 0–2 decimal places. */
export function rupeeStringToPaise(value: string): number {
  const match = /^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(value.trim());
  if (!match) {
    throw new Error(`Not a NUMERIC(12,2) rupee string: "${value}"`);
  }
  const [, sign, whole, fraction = ''] = match;
  const paise = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  return sign === '-' ? -paise : paise;
}

/** `14990` → `"149.90"` (round-trips with rupeeStringToPaise). */
export function paiseToRupeeString(paise: number): string {
  if (!Number.isSafeInteger(paise)) {
    throw new Error(`Not an integer paise amount: ${paise}`);
  }
  const sign = paise < 0 ? '-' : '';
  const abs = Math.abs(paise);
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
}
