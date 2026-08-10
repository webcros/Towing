-- PostGIS must exist before any geography(...) column is created, so this runs
-- as migration 0000. The postgis/postgis image ships the extension files; this
-- only registers them in the target database (and is a no-op on RDS once the
-- extension is allow-listed).
CREATE EXTENSION IF NOT EXISTS postgis;
