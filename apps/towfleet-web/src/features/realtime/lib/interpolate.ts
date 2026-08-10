import type { FleetPosition } from '../types';

/**
 * §11.4: "the marker animates from previous → new point over ~1s with easing;
 * heading rotates to match bearing", and §11.10: "marker never teleports across
 * the screen for updates <= 10s apart".
 *
 * Pings land once a second in one batch, so without this every marker jumps.
 */

export interface AnimatedFrame {
  lat: number;
  lng: number;
  heading: number;
}

interface Track {
  fromLat: number;
  fromLng: number;
  fromHeading: number;
  toLat: number;
  toLng: number;
  toHeading: number;
  startedAt: number;
}

/** Matches the 1s flush cadence: the tween finishes just as the next batch lands. */
const TWEEN_MS = 1_000;

/** Beyond this the jump is real (a resync, a GPS fix) — snap rather than glide. */
const TELEPORT_DEG = 0.25;

const easeOutCubic = (t: number): number => 1 - (1 - t) ** 3;

/** Shortest way round the compass: 350° → 10° is +20°, not −340°. */
function shortestArc(from: number, to: number): number {
  return ((((to - from + 180) % 360) + 360) % 360) - 180;
}

export class PositionAnimator {
  private tracks = new Map<string, Track>();

  /** Retargets each tween at the newest position; call on every data change. */
  update(positions: FleetPosition[], nowMs: number): void {
    const seen = new Set<string>();

    for (const position of positions) {
      if (position.lat === null || position.lng === null) continue;
      seen.add(position.truckId);

      const heading = position.heading ?? 0;
      const existing = this.tracks.get(position.truckId);

      if (!existing) {
        this.tracks.set(position.truckId, {
          fromLat: position.lat,
          fromLng: position.lng,
          fromHeading: heading,
          toLat: position.lat,
          toLng: position.lng,
          toHeading: heading,
          startedAt: nowMs - TWEEN_MS,
        });
        continue;
      }

      if (existing.toLat === position.lat && existing.toLng === position.lng) continue;

      const jumped =
        Math.abs(position.lat - existing.toLat) > TELEPORT_DEG ||
        Math.abs(position.lng - existing.toLng) > TELEPORT_DEG;

      // Start the new tween wherever the marker actually IS, not at the previous
      // target — otherwise a batch arriving mid-tween snaps it backwards first.
      const current = jumped
        ? { lat: position.lat, lng: position.lng, heading }
        : this.frameFor(existing, nowMs);

      this.tracks.set(position.truckId, {
        fromLat: current.lat,
        fromLng: current.lng,
        fromHeading: current.heading,
        toLat: position.lat,
        toLng: position.lng,
        toHeading: heading,
        startedAt: nowMs,
      });
    }

    // Drop trucks that left the snapshot so the map cannot animate a ghost.
    for (const truckId of this.tracks.keys()) {
      if (!seen.has(truckId)) this.tracks.delete(truckId);
    }
  }

  frames(nowMs: number): Map<string, AnimatedFrame> {
    const out = new Map<string, AnimatedFrame>();
    for (const [truckId, track] of this.tracks) out.set(truckId, this.frameFor(track, nowMs));
    return out;
  }

  /** True while any marker is still moving — lets the caller idle the rAF loop. */
  isAnimating(nowMs: number): boolean {
    for (const track of this.tracks.values()) {
      if (nowMs - track.startedAt < TWEEN_MS) return true;
    }
    return false;
  }

  private frameFor(track: Track, nowMs: number): AnimatedFrame {
    const progress = Math.min(1, Math.max(0, (nowMs - track.startedAt) / TWEEN_MS));
    const eased = easeOutCubic(progress);
    return {
      lat: track.fromLat + (track.toLat - track.fromLat) * eased,
      lng: track.fromLng + (track.toLng - track.fromLng) * eased,
      heading: track.fromHeading + shortestArc(track.fromHeading, track.toHeading) * eased,
    };
  }
}
