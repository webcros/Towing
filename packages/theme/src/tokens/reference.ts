/**
 * The design reference width, in dp. Every fixed size in the token files and
 * in both apps is expressed at this width.
 *
 * This constant exists because its absence caused a real defect. The Figma
 * source (`SIvJR8JHqznJP6LycgZ7qG`) mixes three authoring conventions, and
 * screens were transcribed pixel-for-pixel without knowing which one applied:
 *
 *   A — native 390: customer Bookings / Services / Account (393), driver Home /
 *       Earnings / Profile. Raw values are correct as-is.
 *   B — a 430 design squashed into a 390 frame: customer Home / Book, driver
 *       New Job, and every nav + status bar in the file. Every number is an
 *       exact multiple of 0.9069767 (390/430), so raw values read ~9% small.
 *       Multiply by 1.1026 to recover intent.
 *   C — native 430: driver Jobs. Multiply by 0.907 to reach 390.
 *
 * When adding a screen, resolve it against its group before copying numbers.
 */
export const REFERENCE_WIDTH = 390;

/** Smallest shippable text size. Below this, override upward and comment why. */
export const MIN_FONT_SIZE = 10;

/** Minimum interactive target (spec §10.11). */
export const MIN_TAP_TARGET = 44;
