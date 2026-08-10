import { sql } from 'drizzle-orm';
import { customType } from 'drizzle-orm/pg-core';

export interface LatLng {
  lat: number;
  lng: number;
}

/**
 * Postgres returns `geography` values as EWKB hex. This decodes the Point case
 * so repositories can read `truck.currentLocation.lat` directly instead of
 * wrapping every select in `ST_X`/`ST_Y`.
 */
function parseEwkbPoint(hex: string): LatLng {
  const buf = Buffer.from(hex, 'hex');
  const littleEndian = buf.readUInt8(0) === 1;

  const readU32 = (o: number) => (littleEndian ? buf.readUInt32LE(o) : buf.readUInt32BE(o));
  const readF64 = (o: number) => (littleEndian ? buf.readDoubleLE(o) : buf.readDoubleBE(o));

  const typeWord = readU32(1);
  const geometryType = typeWord & 0xff;
  if (geometryType !== 1) {
    throw new Error(`Expected an EWKB Point (type 1), got type ${geometryType}`);
  }

  // Bit 0x20000000 marks an embedded SRID, which shifts the coordinates by 4 bytes.
  const hasSrid = (typeWord & 0x20000000) !== 0;
  const coordsAt = hasSrid ? 9 : 5;

  // EWKB is X,Y — i.e. longitude first.
  return { lng: readF64(coordsAt), lat: readF64(coordsAt + 8) };
}

/**
 * `geography(Point,4326)` mapped to `{ lat, lng }` in both directions.
 *
 * Gotcha: `drizzle-kit generate` emits custom type names double-quoted
 * (`"geography(Point,4326)"`), which Postgres reads as an identifier and
 * rejects with `type ... does not exist`. After regenerating a migration that
 * touches a geography column, strip those quotes in the generated SQL.
 */
export const geographyPoint = customType<{
  data: LatLng;
  driverData: string;
}>({
  dataType() {
    return 'geography(Point,4326)';
  },
  toDriver(value: LatLng): string {
    return `SRID=4326;POINT(${value.lng} ${value.lat})`;
  },
  fromDriver(value: string): LatLng {
    return parseEwkbPoint(value);
  },
});

/**
 * `geography(Polygon,4326)`. Zone polygons are only ever written by admin
 * tooling and read back as GeoJSON, so the round-trip stays textual rather than
 * paying for a full EWKB ring decoder.
 */
export const geographyPolygon = customType<{
  data: string;
  driverData: string;
}>({
  dataType() {
    return 'geography(Polygon,4326)';
  },
});

/** Builds a bindable point for use inside raw `sql` fragments. */
export function pointSql({ lat, lng }: LatLng) {
  return sql`ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography`;
}

/** Great-circle metres between a geography column and a point. */
export function distanceMetersSql(column: unknown, point: LatLng) {
  return sql`ST_Distance(${column}, ${pointSql(point)})`;
}
