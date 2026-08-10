import type { Shadow } from '../types';

/**
 * Elevation (spec §10.5): subtle shadows in light mode; dark mode leans on
 * surface tints, so shadows are near-invisible there.
 *
 * INVARIANT — `elevation` and `opacity` must never share a style node, and no
 * ancestor of an elevated view may animate `opacity`.
 *
 * On Android `elevation` is drawn by the system outside the view's own alpha:
 * `SkPaintFilterCanvas::onDrawShadowRec` delegates without applying the alpha
 * filter. Put alpha on the same node and Skia flags the caster as transparent,
 * stops culling the shadow beneath it, and the shadow shows through the faded
 * surface. Put an animated alpha on an ancestor and the shadow refuses to fade
 * with its owner, leaving a hard rim mid-transition.
 *
 * Dim an elevated surface with colour tokens instead, or trade the shadow away
 * while it is faded. To animate one, animate `transform`, never `opacity`.
 */
export const lightShadows = {
  card: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
  },
  fab: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
  },
  raised: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 6,
  },
} satisfies Record<string, Shadow>;

export const darkShadows = {
  card: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 2,
  },
  fab: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 4,
  },
  raised: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 6,
  },
} satisfies Record<string, Shadow>;
