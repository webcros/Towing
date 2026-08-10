ALTER TABLE "drivers" ADD COLUMN "assigned_truck_id" uuid;--> statement-breakpoint
ALTER TABLE "drivers" ADD CONSTRAINT "drivers_assigned_truck_id_fleet_trucks_id_fk" FOREIGN KEY ("assigned_truck_id") REFERENCES "public"."fleet_trucks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
-- One driver per truck at a time; the partial predicate keeps unassigned rows
-- (NULL) out of the uniqueness check. This index is also what makes the
-- assign-truck race safe: the loser of two concurrent assigns gets 23505.
CREATE UNIQUE INDEX "uq_drivers_assigned_truck" ON "drivers" ("assigned_truck_id") WHERE "assigned_truck_id" IS NOT NULL;--> statement-breakpoint
-- Plates are unique within a fleet (bulk CSV import in Phase 6 relies on it).
CREATE UNIQUE INDEX "uq_fleet_trucks_fleet_plate" ON "fleet_trucks" ("fleet_id", "plate");