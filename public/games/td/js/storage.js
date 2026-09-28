const KEY = "td.save";
const BEST = "td.best.";
const KIT = "td.kit";
const PRESETS = "td.presets";

export function saveRun(snapshot) {
  try { localStorage.setItem(KEY, JSON.stringify(snapshot)); } catch (e) { /* not remembered, still playable */ }
}
export function loadRun() {
  try {
    const raw = localStorage.getItem(KEY);
    const snap = raw ? JSON.parse(raw) : null;
    return snap && typeof snap === "object" && Array.isArray(snap.towers) ? snap : null;
  } catch (e) { return null; }
}
export function clearRun() {
  try { localStorage.removeItem(KEY); } catch (e) { /* fine */ }
}
export function saveLoadout(kinds) {
  try { localStorage.setItem(KIT, JSON.stringify(kinds)); } catch (e) { /* not remembered, still playable */ }
}
export function loadLoadout() {
  try {
    const raw = localStorage.getItem(KIT);
    const kit = raw ? JSON.parse(raw) : null;
    return Array.isArray(kit) && kit.every((k) => typeof k === "string") ? kit : null;
  } catch (e) { return null; }
}
export function savePresets(list) {
  try { localStorage.setItem(PRESETS, JSON.stringify(list)); } catch (e) { /* not remembered, still playable */ }
}
export function loadPresets() {
  try {
    const raw = localStorage.getItem(PRESETS);
    const list = raw ? JSON.parse(raw) : null;
    return Array.isArray(list) ? list.filter((p) => p && typeof p.name === "string" && Array.isArray(p.kinds)) : [];
  } catch (e) { return []; }
}
/**
 * Drop every best kept against a balance that is no longer the one being
 * played. A wave count only means something while the waves mean the same
 * thing, so a rebalance takes the boards with it rather than leaving a number
 * nobody can reach or beat any more.
 */
export function dropOldBests(balance) {
  try {
    const tail = "." + balance;
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith(BEST) && !key.endsWith(tail)) localStorage.removeItem(key);
    }
  } catch (e) { /* fine */ }
}
export function readBest(mapId) {
  try { return Number(localStorage.getItem(BEST + mapId)) || 0; } catch (e) { return 0; }
}
export function writeBest(mapId, waves) {
  try { if (waves > readBest(mapId)) localStorage.setItem(BEST + mapId, String(waves)); } catch (e) { /* fine */ }
}
