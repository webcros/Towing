import { z } from 'zod';
import { serviceTypeSchema } from '../common/enums';
import { unsignedPaiseSchema } from '../common/money';
import {
  COMMISSION_PCT_CAP,
  COMMISSION_PCT_FLOOR,
  commissionPctSchema,
} from '../common/pricing';
import { vehicleClassSchema } from '../fleet/trucks';

/**
 * §16.5 `GET/PUT /v1/admin/pricing` and `GET/PUT /v1/admin/commission`, RBAC-gated
 * to `super_admin | finance`, audited on every change.
 *
 * These routes exist in Phase 14 because the §3.3 guardrail needs a way to be
 * exercised. Phase 14 builds the floor/cap check, the `commission_config` CHECK
 * and `commission_config_history`; without a route, none of the three could ever
 * be tripped, and "validated server-side" would be an untested claim. The thin
 * admin FORMS over these endpoints are Phase 20 · B3.
 *
 * EVERY UPDATE FIELD IS `.optional()` WITH NO `.default()`. Phase 13 shipped and
 * then fixed a bug where `.partial()` preserved field defaults, so a one-key PUT
 * arrived as every key and silently reset the rest — the same defect was found
 * dormant in `fleetSettingsUpdateSchema`. On a pricing table that would rewrite
 * the whole fare matrix from a single-field edit.
 */

export const pricingRuleKindSchema = z.enum(['slab', 'long_distance', 'roadside']);
export type PricingRuleKind = z.infer<typeof pricingRuleKindSchema>;

/** One row of `pricing_rules` — a §7.1/§7.2 slab, a §7.3 range, or a flat roadside fare. */
export const adminPricingRuleSchema = z.object({
  id: z.uuid(),
  ruleKind: pricingRuleKindSchema,
  /** Roadside rows only — which flat-rated service this is. */
  serviceType: serviceTypeSchema.nullable(),
  /** Slab and long-distance rows only. */
  vehicleClass: vehicleClassSchema.nullable(),
  /** Upper bound of the distance band, km. Null on roadside rows. */
  maxKm: z.number().nullable(),
  /** The slab price, the flat fare, or — for `long_distance` — the range FLOOR. */
  pricePaise: unsignedPaiseSchema,
  /** §7.3 range CEILING. Non-null on `long_distance` rows only. */
  priceMaxPaise: unsignedPaiseSchema.nullable(),
  isActive: z.boolean(),
});
export type AdminPricingRule = z.infer<typeof adminPricingRuleSchema>;

/** §7.4 additional charges — the singleton `charge_config` row. */
export const adminChargeConfigSchema = z.object({
  /** §7.4 night towing, percent of base. */
  nightPct: z.number().min(0).max(100),
  /** Night window, IST hours. Wraps midnight when start > end (22 → 6 does). */
  nightStartHour: z.number().int().min(0).max(23),
  nightEndHour: z.number().int().min(0).max(23),
  /** §7.4 gives ₹500–₹1,000; ₹500 is the seeded launch value. */
  highwayChargePaise: unsignedPaiseSchema,
  accidentChargePaise: unsignedPaiseSchema,
  waitingFreeMinutes: z.number().int().min(0).max(120),
  waitingPerMinutePaise: unsignedPaiseSchema,
  /** §7.4 surge is +10–25 %; `standard` is always 0 and is not editable. */
  surgePctHigh: z.number().min(0).max(100),
  surgePctPeak: z.number().min(0).max(100),
  /**
   * Multiplier applied to great-circle distance when the Distance Matrix is
   * unavailable (§19.2). Straight-line under-states a road tow, and quoting the
   * under-stated number is a business loss on every degraded booking.
   */
  haversineRoadFactor: z.number().min(1).max(3),
});
export type AdminChargeConfig = z.infer<typeof adminChargeConfigSchema>;

/** `GET /v1/admin/pricing`. */
export const adminPricingConfigSchema = z.object({
  charges: adminChargeConfigSchema,
  rules: z.array(adminPricingRuleSchema),
});
export type AdminPricingConfig = z.infer<typeof adminPricingConfigSchema>;

/** `PUT /v1/admin/pricing`. Charges are patched key-by-key; rules are edited by id. */
export const adminPricingUpdateSchema = z
  .object({
    charges: z
      .object({
        nightPct: z.number().min(0).max(100).optional(),
        nightStartHour: z.number().int().min(0).max(23).optional(),
        nightEndHour: z.number().int().min(0).max(23).optional(),
        highwayChargePaise: unsignedPaiseSchema.optional(),
        accidentChargePaise: unsignedPaiseSchema.optional(),
        waitingFreeMinutes: z.number().int().min(0).max(120).optional(),
        waitingPerMinutePaise: unsignedPaiseSchema.optional(),
        surgePctHigh: z.number().min(0).max(100).optional(),
        surgePctPeak: z.number().min(0).max(100).optional(),
        haversineRoadFactor: z.number().min(1).max(3).optional(),
      })
      .optional(),
    rules: z
      .array(
        z.object({
          id: z.uuid(),
          pricePaise: unsignedPaiseSchema.optional(),
          priceMaxPaise: unsignedPaiseSchema.nullable().optional(),
          isActive: z.boolean().optional(),
        }),
      )
      .optional(),
    reason: z.string().min(3).max(500).optional(),
  })
  .refine((body) => body.charges !== undefined || (body.rules?.length ?? 0) > 0, {
    message: 'Nothing to update',
  });
export type AdminPricingUpdate = z.infer<typeof adminPricingUpdateSchema>;

/** One band's live percentage, plus who last moved it. */
export const adminCommissionBandSchema = z.object({
  band: z.enum(['A', 'B', 'C']),
  pct: z.number(),
  updatedAt: z.iso.datetime(),
  updatedBy: z.uuid().nullable(),
});
export type AdminCommissionBand = z.infer<typeof adminCommissionBandSchema>;

/** `GET /v1/admin/commission`. The guardrail is served alongside so a form can render it. */
export const adminCommissionConfigSchema = z.object({
  bands: z.array(adminCommissionBandSchema),
  floorPct: z.literal(COMMISSION_PCT_FLOOR),
  capPct: z.literal(COMMISSION_PCT_CAP),
});
export type AdminCommissionConfig = z.infer<typeof adminCommissionConfigSchema>;

/**
 * `PUT /v1/admin/commission`.
 *
 * THIS SCHEMA DELIBERATELY DOES NOT ENFORCE THE 5–10 GUARDRAIL, and that is the
 * subtle part. §3.3 requires that out-of-band attempts are "rejected AND
 * audited" — but a `ZodValidationPipe` rejection never reaches the service, so
 * pinning `commissionPctSchema` here would produce a 422 with NO audit row and
 * quietly satisfy only half the sentence. Somebody probing how far the fare
 * engine bends is precisely what the audit log exists to record.
 *
 * What stays at the pipe is a SANITY bound: finite, non-negative, at most 100,
 * two decimal places. That rejects garbage and typos cheaply without swallowing
 * the deliberate 11 % attempt that the service must see, audit and refuse. The
 * guardrail proper lives in `AdminConfigService.updateCommission`, backed by
 * `ck_commission_config_guardrail` in the database.
 *
 * `commissionPctSchema` remains exported for callers that want the strict check
 * WITHOUT the audit semantics — the Phase 20 form validating a field as the
 * operator types, for instance.
 */
export const adminCommissionUpdateSchema = z.object({
  bands: z
    .array(
      z.object({
        band: z.enum(['A', 'B', 'C']),
        pct: z.number().min(0).max(100).multipleOf(0.01),
      }),
    )
    .min(1)
    .max(3),
  reason: z.string().min(3).max(500).optional(),
});
export type AdminCommissionUpdate = z.infer<typeof adminCommissionUpdateSchema>;

/** A `commission_config_history` row — `GET /v1/admin/commission/history`. */
export const commissionHistoryEntrySchema = z.object({
  id: z.uuid(),
  band: z.enum(['A', 'B', 'C']),
  oldPct: z.number().nullable(),
  newPct: z.number(),
  changedBy: z.uuid(),
  reason: z.string().nullable(),
  createdAt: z.iso.datetime(),
});
export type CommissionHistoryEntry = z.infer<typeof commissionHistoryEntrySchema>;
