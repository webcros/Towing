# AWS Handover Pack — Towing Platform

**Purpose:** everything an AWS engineer needs to take the Towing platform (TowFleet fleet-owner console + shared NestJS backend) from "runs locally against Docker" to a deployed AWS environment — Phase 9 of [`docs/TowFleet-Implementation-Plan.md`](../docs/TowFleet-Implementation-Plan.md). You are assumed to have never seen this codebase.

**Recommended reading order: 01 → 06.** Each document is self-contained but they build on each other — 01 gives context, 02 the target shape, 03–05 the subsystems, 06 the day-1/day-2 procedures.

## File inventory

| File | What it is |
|---|---|
| [`01-project-overview.md`](01-project-overview.md) | The product, the monorepo, what exists today (Phases 1–4 done), what you are deploying, the AWS account unknowns, and the **Owners & contacts** table that ratifies every decision in this pack |
| [`02-target-architecture.md`](02-target-architecture.md) | Spec §15 mapped to concrete AWS services; ECS service inventory; data-store usage; a line-by-line assessment of the `infrastructure/deploy-all.sh` CDK generator (what it covers, its 15-item gap list) |
| [`03-database.md`](03-database.md) | RDS PostgreSQL 16 + PostGIS provisioning; how the 5 drizzle migrations work and how to run them on AWS; schema domain map; the invariants the database itself enforces; seed behavior |
| [`04-runtime-environment.md`](04-runtime-environment.md) | Every process that must run, every env var each one reads (with build-time vs runtime binding), packaging state (Dockerfiles are placeholders), logging, graceful shutdown, statefulness caveats |
| [`05-security-networking.md`](05-security-networking.md) | Auth realms, BFF session model, tenancy enforcement, secrets inventory, rate limiting (and its `trust proxy` trap), network topology, IAM & deployment identity, vendor credential status |
| [`06-operations-runbook.md`](06-operations-runbook.md) | Bring-up order, command reference, post-deploy verification checklist, CI/CD state, rollback, observability/alarms, Backup & DR, operator access to the data tier, FAQ |
| `migrations/` | Point-in-time **copy** of the drizzle migration set (`0000`–`0004` + `meta/` journal) for review without opening the app tree |
| `db/schema-snapshot.sql` | Schema-only `pg_dump` (03 Aug 2026) of the fully-migrated dev database — orientation aid, **never** an apply script |

## ⚠️ Canonical vs snapshot

**`apps/backend/drizzle/` is the CANONICAL migration source** — it is what `pnpm db:migrate` applies. `Aws/migrations/` and `Aws/db/schema-snapshot.sql` are **dated copies** taken 03 Aug 2026 and will drift as new migrations land. Never deploy from this folder. Refresh procedure: [03 §9 "Refreshing these artifacts"](03-database.md).

## Top decisions awaiting the business

The blocking inputs only the project owner can supply — each links to the document that owns it. All are ratified by the owners in [01 "Owners & contacts"](01-project-overview.md) (currently all TBD).

| Decision | Owning doc |
|---|---|
| AWS account ID(s), access mechanism, state of the GitHub CI secrets, greenfield-vs-brownfield inventory | [01 §8](01-project-overview.md) |
| Cost envelope — target monthly spend per environment; cost vs availability on conflicts | [02 §7 decision 13](02-target-architecture.md) |
| Demand numbers — fleets/trucks/drivers at launch and 6 months, console sessions, bookings/day, GPS ping rate | [02 §7 "Demand assumptions"](02-target-architecture.md) |
| Environments & promotion — how many environments, single vs multi-account, promotion trigger | [02 §7 decision 14](02-target-architecture.md) / [06 §1](06-operations-runbook.md) |
| RPO/RTO, backup retention, cross-region copies, Redis loss window | [06 §10 Backup & DR](06-operations-runbook.md) |
| IAM & deploy rights — permission boundaries, per-env deploy rights, branch protection on `main` | [05 §11](05-security-networking.md) |
| Vendor credentials — MSG91 (DLT registration is a weeks-long lead item and gates production login), Razorpay Route/KYC | [05 §4.2 vendor table](05-security-networking.md) |

_Last updated: 03 Aug 2026_
