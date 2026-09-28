// localStorage: the shift in progress, the best shift on each desk, the
// sound levels, and whether the guide has been read. Every read is defended,
// because a page that cannot remember anything should still be playable.

const RUN = "algebraloop.u21.run";
const BEST = "algebraloop.u21.best.";
const SOUND = "algebraloop.u21.sound";
const SEEN = "algebraloop.u21.seen";

export function saveRun(snapshot) {
  try { localStorage.setItem(RUN, JSON.stringify(snapshot)); } catch { /* not remembered, still playable */ }
}

export function loadRun() {
  try {
    const raw = localStorage.getItem(RUN);
    const kept = raw ? JSON.parse(raw) : null;
    if (!kept || typeof kept !== "object" || kept.version !== 17) return null;
    if (!Number.isFinite(kept.time) || !Array.isArray(kept.trains) || !Array.isArray(kept.routes)) return null;
    return kept;
  } catch { return null; }
}

export function clearRun() {
  try { localStorage.removeItem(RUN); } catch { /* fine */ }
}

/** Whether a shift has anything to show for it: a train on time, or a point. One ended before a train got through has neither. */
const scored = (s) => s.ppm > 0 || s.points > 0;

/**
 * The best shift on a desk: on-time percentage and points, and the
 * conditions and clock-in it was set at, or null. One with nothing to show
 * for it, kept before that was asked of a best, reads as none.
 */
export function readBest(zone) {
  try {
    const raw = localStorage.getItem(BEST + zone);
    const kept = raw ? JSON.parse(raw) : null;
    if (!kept || !Number.isFinite(kept.ppm) || !Number.isFinite(kept.points) || !scored(kept)) return null;
    return kept;
  } catch { return null; }
}

/**
 * Keep a finished shift if it beats what is held for its desk, whatever the
 * conditions: more on time, then more points. A shift with nothing to show
 * for it is never kept, so a desk only ended early still reads as not
 * worked, rather than as 0% on time.
 */
export function keepBest(zone, summary, { level, start }) {
  if (!scored(summary)) return false;
  const had = readBest(zone);
  if (had && (had.ppm > summary.ppm || (had.ppm === summary.ppm && had.points >= summary.points))) return false;
  try { localStorage.setItem(BEST + zone, JSON.stringify({ ppm: summary.ppm, points: summary.points, level, start })); } catch { /* fine */ }
  return true;
}

export function readSound() {
  try {
    const kept = JSON.parse(localStorage.getItem(SOUND) ?? "null");
    if (!kept || typeof kept !== "object") return null;
    return kept;
  } catch { return null; }
}

export function saveSound(levels) {
  try { localStorage.setItem(SOUND, JSON.stringify(levels)); } catch { /* fine */ }
}

export function guideSeen() {
  try { return localStorage.getItem(SEEN) === "1"; } catch { return false; }
}

export function markGuideSeen() {
  try { localStorage.setItem(SEEN, "1"); } catch { /* fine */ }
}
