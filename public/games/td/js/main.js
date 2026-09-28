import { MAPS, PROPS, routesOf, routeCells, propsFor } from "./layouts.js";
import { TOWERS, SELL_REFUND, spentOn, upgradePrice, MAX_TIER, LOADOUT, DEFAULT_LOADOUT, PRESETS, PIERCE_RESIST_POWER, mostOf, statsFor, canUpgrade } from "./resources.js";
import { BALANCE, CHANGES } from "./changes.js";
import { SANDBOX_NOTE, CAMPAIGN_WAVES, DIFFICULTIES, ENEMIES, KILL_REWARD, MUTATIONS, composeWave, mutationChance, mutationFrom, specFor } from "./schedule.js";
import { Simulation, TARGETS } from "./model.js";
import { Scene, muzzleHeight } from "./view.js";
import { notesFor, finaleLine } from "./notes.js";
import { saveRun, loadRun, clearRun, readBest, writeBest, dropOldBests, saveLoadout, loadLoadout, savePresets, loadPresets } from "./storage.js";
import { initAudio, play, setLoops, isMuted, setMuted, getVolume, setVolume } from "./sound.js";

const $ = (id) => document.getElementById(id);
const canvas = $("canvas");
const scene = new Scene(canvas);
const veil = $("veil"), veilTitle = $("veilTitle"), veilText = $("veilText"), veilBtn = $("veilBtn"), veilAlt = $("veilAlt"), veilThrough = $("veilThrough");
const out = { gold: $("gold"), lives: $("lives"), wave: $("wave"), status: $("status") };
/** Whether the run can pay `cost`: always, in the sandbox. */
const afford = (cost) => simulation.level.free || simulation.gold >= cost;
/** The purse, as words: unlimited in the sandbox. */
const purse = () => (simulation.level.free ? "unlimited gold" : simulation.gold + " gold");
let difficulty = "easy";
// The sandbox is a switch laid over the difficulty, not a difficulty of its own.
let sandbox = false;
try {
  const kept = localStorage.getItem("td.difficulty");
  if (DIFFICULTIES[kept]) difficulty = kept;
  else if (kept === "sandbox") { difficulty = "normal"; sandbox = true; } // from when it was one
  if (localStorage.getItem("td.sandbox") === "1") sandbox = true;
} catch {}
/**
 * The key a best score is stored under: per route, per difficulty, per balance.
 * A wave count is only worth keeping while it means the same thing, so a
 * rebalance raises BALANCE and the boards kept against the old one are dropped
 * rather than left standing as a number nobody can reach or beat any more.
 * What changed is at the top of the changes list, where a player can read it.
 */
const bestKey = (map, level) => map.id + "." + level + "." + BALANCE;
dropOldBests(BALANCE);
/**
 * Whether a route's whole campaign has been held at a difficulty. The sandbox
 * is what that earns: it opens on the route and the difficulty it was won at
 * and nowhere else, so a run cannot be looked up before it has been played.
 * Bests are kept per route per difficulty already, so beating one says so.
 */
const beaten = (map, level) => readBest(bestKey(map, level)) >= CAMPAIGN_WAVES;
/** Whether the sandbox is open at all at a difficulty: any route carried at it. */
const sandboxOpen = (level) => MAPS.some((m) => beaten(m, level));
// A sandbox remembered from a difficulty that has since been given up on, or
// from before it was earned at all, is not honoured.
if (sandbox && !sandboxOpen(difficulty)) sandbox = false;
const shop = $("shop"), pop = $("pop"), epop = $("epop"), detail = $("detail"), askPanel = $("ask");
// The towers this run was brought with, in the order the number keys reach
// them. Anything remembered is filtered against the roster, in case a tower
// has come or gone since it was saved.
let loadout = (loadLoadout() || DEFAULT_LOADOUT).filter((kind) => TOWERS[kind]).slice(0, LOADOUT);
if (!loadout.length) loadout = DEFAULT_LOADOUT.slice();
/** How many towers this difficulty lets a run bring. */
const slots = () => Math.min(DIFFICULTIES[difficulty].slots || LOADOUT, Object.keys(TOWERS).length);
/**
 * What a step up costs against its listed price: the running run's, or the
 * difficulty settled on, so the codex quotes the prices the next run will pay.
 */
const upkeep = () => (simulation ? simulation.upkeep : DIFFICULTIES[difficulty].upkeep || 1);
/** The towers on this run: every one of them in the sandbox, the kit chosen otherwise. */
const kit = () => ((simulation ? simulation.level.free : sandbox) ? Object.keys(TOWERS) : loadout);
// Everything that only matters once a run is under way.
const hudParts = [...document.querySelectorAll(".hud.top, .hud.side, .hud.bottom, .hud.corner, .hud.sandbox")];
const startBtn = $("start"), speedBtn = $("speed"), autoBtn = $("auto"), pauseBtn = $("pause"), soundBtn = $("sound");
// ---- Wave notes ------------------------------------------------------
// A banner that drops in from the top: warnings about the wave to come, and
// on a quiet one, something to read. Clicking it sends it away early.
const notes = $("notes");
let notesTimer = 0;
function announce(title, lines, warn) {
  $("notesTitle").textContent = title;
  const text = $("notesText");
  text.textContent = "";
  for (const line of lines) { const p = document.createElement("p"); p.textContent = line; text.appendChild(p); }
  notes.classList.toggle("warn", !!warn);
  notes.classList.add("on");
  clearTimeout(notesTimer);
  // Long enough to read: a few seconds, and more for every line.
  notesTimer = setTimeout(() => notes.classList.remove("on"), 3500 + lines.join(" ").length * 45);
}
function dismissNotes() { clearTimeout(notesTimer); notes.classList.remove("on"); }
notes.addEventListener("click", dismissNotes);
/** Before a wave: what the one about to start brings, as far as the settings let it say. */
function notesAhead() {
  if (!simulation || simulation.phase !== "build" || notesMode === "off") return;
  const said = notesFor(simulation.cleared + 1, simulation.difficulty);
  if (!said) return;
  if (notesMode === "all") { announce(said.title, said.lines, said.warn); return; }
  // Warnings only: the lines that are real warnings, and nothing if none are.
  const lines = said.lines.filter((_, k) => said.major[k]);
  if (lines.length) announce(said.title, lines, true);
}

// ---- Settings -------------------------------------------------------
// Music and sound effect levels live with the audio; which wave notes show
// is kept here. All of it is remembered in this browser.
const NOTES_KEY = "td.notes";
let notesMode = "all";
try { const m = localStorage.getItem(NOTES_KEY) || localStorage.getItem("td.herald"); if (m === "all" || m === "warnings" || m === "off") notesMode = m; } catch {}
const settingsPanel = $("settings"), settingsBtn = $("settingsBtn");
function showSettings(open) {
  settingsPanel.hidden = !open;
  settingsBtn.setAttribute("aria-expanded", String(open));
}
function markSettings() {
  const v = getVolume();
  $("musicLevel").value = String(Math.round(v.music * 100));
  $("sfxLevel").value = String(Math.round(v.sfx * 100));
  // The fill stops at the thumb's middle, which travels the track less its own width.
  const fill = (level) => "calc(6px + (100% - 12px) * " + level + ")";
  $("musicLevel").style.setProperty("--fill", fill(v.music));
  $("sfxLevel").style.setProperty("--fill", fill(v.sfx));
  $("musicOut").textContent = Math.round(v.music * 100) + "%";
  $("sfxOut").textContent = Math.round(v.sfx * 100) + "%";
  for (const b of $("notesMode").querySelectorAll("button")) b.setAttribute("aria-checked", String(b.dataset.mode === notesMode));
}
settingsBtn.addEventListener("click", (e) => { e.stopPropagation(); showSettings(settingsPanel.hidden); markSettings(); settingsBtn.blur(); });
$("musicLevel").addEventListener("input", (e) => { setVolume({ music: Number(e.target.value) / 100 }); markSettings(); });
$("sfxLevel").addEventListener("input", (e) => { setVolume({ sfx: Number(e.target.value) / 100 }); markSettings(); });
// Let go of the effects slider and hear where it landed.
$("sfxLevel").addEventListener("change", () => play("click"));
$("notesMode").addEventListener("click", (e) => {
  const b = e.target.closest("button[data-mode]");
  if (!b) return;
  notesMode = b.dataset.mode;
  try { localStorage.setItem(NOTES_KEY, notesMode); } catch {}
  if (notesMode === "off" || (notesMode === "warnings" && !notes.classList.contains("warn"))) dismissNotes();
  play("click");
  markSettings();
});
// The panel keeps its own keys, so arrowing a slider does not turn the view,
// and a click anywhere outside it puts it away.
settingsPanel.addEventListener("keydown", (e) => e.stopPropagation());
settingsPanel.addEventListener("pointerdown", (e) => e.stopPropagation());
document.addEventListener("pointerdown", (e) => { if (!settingsPanel.hidden && !settingsPanel.contains(e.target) && !settingsBtn.contains(e.target)) showSettings(false); });
markSettings();

const sandboxBar = $("sandbox"), jumpWave = $("jumpWave"), jumpGo = $("jumpGo"), sendKinds = $("sendKinds"), sendMuts = $("sendMuts"), sendGo = $("sendGo");
// What the sandbox sends: a kind of cube and a mutation, each picked from a
// grid of models. Built the first time the panel shows, since the pictures
// take a moment and most runs never need them.
let sendKind = "basic", sendMut = "", sandboxBuilt = false;
function buildSandbox() {
  const grid = (box, entries, picked, pick) => {
    box.innerHTML = "";
    for (const [key, name, src] of entries) {
      const b = document.createElement("button");
      b.type = "button";
      b.dataset.key = key;
      b.setAttribute("aria-pressed", String(key === picked()));
      b.innerHTML = '<img alt="" src="' + src + '">' + name;
      b.addEventListener("click", () => { pick(key); play("click"); for (const o of box.children) o.setAttribute("aria-pressed", String(o.dataset.key === key)); });
      box.appendChild(b);
    }
  };
  grid(sendKinds, Object.entries(ENEMIES).map(([key, spec]) => [key, spec.name, scene.thumbnail(key, 120, true)]), () => sendKind, (k) => { sendKind = k; });
  grid(sendMuts, [["", "Plain", scene.thumbnail("basic", 120, true)], ...Object.entries(MUTATIONS).map(([key, m]) => [key, m.name, scene.thumbnail("basic", 120, true, key)])], () => sendMut, (k) => { sendMut = k; });
  scene.dropThumbnails();
  sandboxBuilt = true;
}
jumpGo.addEventListener("click", () => {
  if (!simulation || !simulation.jumpTo(Number(jumpWave.value))) { play("denied"); return; }
  play("click"); autosave(); update(); notesAhead();
});
sendGo.addEventListener("click", () => {
  if (!simulation || !simulation.send(sendKind, sendMut || null)) { play("denied"); return; }
  play("click"); update();
});
// The bar's own keys stay its own: typing a wave number must not place towers.
sandboxBar.addEventListener("keydown", (e) => e.stopPropagation());
// Browsers only allow sound after a gesture; the first press anywhere starts it.
for (const type of ["pointerdown", "keydown"]) document.addEventListener(type, () => initAudio(), { passive: true });
soundBtn.setAttribute("aria-pressed", String(!isMuted()));
soundBtn.addEventListener("click", () => { setMuted(!isMuted()); soundBtn.setAttribute("aria-pressed", String(!isMuted())); soundBtn.blur(); });

let simulation = null;
let mapIndex = 0;
// The route the last run was on, or -1 if nothing has been played yet. The
// chooser comes back with it already picked, since one route after another on
// the same board is the usual way of it.
let lastPlayed = -1;
let view = { hover: null, placing: null, selected: null, watching: null, flashes: [], arcs: [] };
let speed = 1, paused = false, last = 0;
// The speed a player last left it at comes back with them.
try { const kept = Number(localStorage.getItem("td.speed")); if ([1, 2, 5].includes(kept)) speed = kept; } catch {}
speedBtn.textContent = speed + "×";
// Auto-start: the next wave begins on its own a moment after a clear. On
// unless the player has switched it off, which is remembered.
/**
 * How long a wave counts itself in for on auto, in seconds. A whole number, so
 * every figure the button shows gets a second of its own and a tick to match.
 */
const AUTO_COUNT = 3;
let auto = true, autoTimer = 0;
try { auto = localStorage.getItem("td.auto") !== "0"; } catch {}

window.addEventListener("resize", () => { scene.fit(); if (veilMode === "choose") placeChooser(); if (veilMode === "kit") placeKitBoard(); });

// ---- Setup ---------------------------------------------------------
function newRun(index) {
  mapIndex = lastPlayed = index;
  const alreadyShowing = previewing === index && simulation && simulation.map === MAPS[index] && !simulation.towers.length;
  // No route is being previewed once a run is under way, which is not the
  // same as the chooser showing an empty board: -1 is that, and using it here
  // meant a board left standing after a loss never sank when the chooser
  // came back, since preview(-1) saw nothing to change.
  previewing = null;
  if (!alreadyShowing) {
    simulation = new Simulation(MAPS[index], difficulty, sandbox);
    view = { hover: null, placing: null, selected: null, watching: null, flashes: [], arcs: [] };
    scene.draw(simulation, view);
    scene.dropIn();
  }
  clearRun();
  begin();
}
/** Carry on with a run restored from its save, over the board as it was left. */
function resumeRun(restored) {
  simulation = restored;
  mapIndex = lastPlayed = Math.max(0, MAPS.indexOf(restored.map));
  view = { hover: null, placing: null, selected: null, watching: null, flashes: [], arcs: [] };
  scene.draw(simulation, view);
  scene.dropIn();
  begin();
}
function begin() {
  veil.classList.remove("on", "intro", "kitstep");
  // Whichever step put the veil up, it is down now and so is its panel.
  kitStage.hidden = true;
  scene.showcaseSet(null);
  scene.panTo(0, 1);
  peeking = false;
  veil.classList.remove("peeking");
  veilAlt.hidden = true;
  scene.lock(false);
  for (const el of hudParts) el.hidden = false;
  // The shop shows what this run brought, which the sandbox decides differently.
  buildShop();
  towersBuilt = false;
  paused = false;
  autoTimer = 0;
  status("");
  update();
  notesAhead();
}

/** What the status line says when a kind is at its limit. */
function capNote(kind) {
  return mostOf(kind) + " " + TOWERS[kind].name.toLowerCase() + (mostOf(kind) === 1 ? "" : "s") + " is the most a run can stand.";
}
/** And when the level allows nothing more standing at all. */
function standNote() {
  return simulation.level.stand + " towers is the most this run can stand at once.";
}
/** Whether a kind may be brought on this difficulty at all: Ruin sells no mint. */
const allowed = (kind) => !(kind === "mint" && DIFFICULTIES[difficulty].mints === 0);

// ---- HUD -----------------------------------------------------------
function status(text) { out.status.textContent = text; }

function update() {
  if (!simulation) return;
  out.gold.textContent = simulation.level.free ? "\u221e" : String(simulation.gold);
  // The sandbox panel shows with the rest of the HUD, never over the menus.
  sandboxBar.hidden = !simulation.level.free || (veil.classList.contains("on") && veilMode !== "paused");
  if (!sandboxBar.hidden && !sandboxBuilt) buildSandbox();
  jumpGo.disabled = simulation.phase !== "build";
  while (out.lives.children.length < simulation.maxLives) out.lives.appendChild(document.createElement("i"));
  while (out.lives.children.length > simulation.maxLives) out.lives.lastElementChild.remove();
  const lives = Math.max(0, Math.min(simulation.maxLives, simulation.lives));
  Array.prototype.forEach.call(out.lives.children, (seg, i) => seg.classList.toggle("lost", i >= lives));
  out.lives.setAttribute("aria-label", simulation.lives + " lives");
  // The wave under way, or the one being built for; the last one, once held.
  const n = simulation.phase === "wave" ? simulation.wave : simulation.phase === "won" ? simulation.cleared : simulation.cleared + 1;
  out.wave.innerHTML = "Wave " + n + ' <span class="of">/ ' + (n > CAMPAIGN_WAVES ? "&infin;" : CAMPAIGN_WAVES) + "</span>";
  startBtn.disabled = simulation.phase !== "build";
  autoBtn.setAttribute("aria-pressed", String(auto));
  pauseBtn.disabled = veil.classList.contains("on") && veilMode !== "paused";
  startBtn.textContent = simulation.phase === "wave"
    ? "Wave " + simulation.wave + " under way"
    // Counting itself in: the button says how long is left rather than asking
    // to be pressed, and pressing it anyway still starts the wave at once.
    : autoTimer > 0
      ? "Wave " + (simulation.wave + 1) + " in " + Math.ceil(autoTimer)
      : "Start wave " + (simulation.wave + 1);
  for (const b of shop.querySelectorAll("button")) {
    const kind = b.dataset.kind;
    b.disabled = !afford(TOWERS[kind].cost) || simulation.atCap(kind) || simulation.atStand();
    b.setAttribute("aria-pressed", String(view.placing === kind));
    // How many are up against how many may be, once there is one.
    const n = simulation.countOf(kind);
    const line = TOWERS[kind].cost + " gold" + (n && !simulation.level.free ? " \u00b7 " + n + " of " + mostOf(kind) : "");
    const small = b.querySelector("small");
    if (small && small.textContent !== line) small.textContent = line;
  }
  renderPop();
  renderWatch();
}

/** Start or stop placing a kind of tower. */
function setPlacing(kind) {
  if (view.placing !== kind && simulation.atStand()) { play("denied"); status(standNote()); return; }
  if (view.placing !== kind && simulation.atCap(kind)) { play("denied"); status(capNote(kind)); return; }
  view.placing = view.placing === kind ? null : kind;
  view.selected = null;
  view.prop = null;
  if (!view.placing && simulation.phase === "build") status("");
  update();
}

// The tower card hangs above the selected tower and moves with the view.
/** The stat lines for a set of tower stats, as label/value pairs. */
function statLines(s) {
  const out = [];
  const num = (v) => Math.round(v * 100) / 100;
  // A beacon lifts the towers round it and never fires.
  if (s.boost) {
    out.push(["Lifts", "towers within " + num(s.boost.range) + " cells"]);
    if (s.boost.damage) out.push(["Damage", "+" + Math.round(s.boost.damage * 100) + "%"]);
    if (s.boost.rate) out.push(["Rate", "+" + Math.round(s.boost.rate * 100) + "%"]);
    if (s.boost.reach) out.push(["Range", "+" + num(s.boost.reach) + " cells"]);
    return out;
  }
  // A rift is measured by how far back it sends, how many, and how seldom.
  if (s.rift) {
    const r = s.rift;
    out.push(["Tears", "every " + num(Math.max(8, r.every)) + "s" + (r.count > 1 ? ", " + r.count + " at once" : "")]);
    out.push(["Open", num(r.open || 2) + "s, takes up to " + (r.most || 4)]);
    out.push(["Sends back", num(r.back) + " cells, bosses 2"]);
    out.push(["Reach", num(s.range) + " cells"]);
    if (r.daze) out.push(["Dazes", num(r.daze) + "s"]);
    if (r.tear) out.push(["Costs", Math.round(r.tear * 100) + "% of health"]);
    if (r.slow) out.push(["Slows", Math.round(r.slow * 100) + "% for 2s"]);
    if (r.swap) out.push(["Swap", "front and back"]);
    if (r.hole) out.push(["Black hole", "every " + (r.hole === 3 ? "third" : r.hole + "th") + " tear"]);
    return out;
  }
  // A suppressor is measured by what it silences.
  if (s.hush) {
    const lv = s.hush.level || 1;
    out.push(["Field", num(s.range) + " cells"]);
    out.push(["Stops", ["mending, shields, raising", "+ blinking, rising", "+ phasing, warding", "+ mutations"][Math.min(3, lv - 1)]]);
    if (s.hush.reveal) out.push(["Unveils", "hidden cubes"]);
    if (s.hush.strip) out.push(["Strips", s.hush.strip + " armour"]);
    if (s.hush.expose) out.push(["Exposed", "+" + Math.round(s.hush.expose * 100) + "% damage"]);
    return out;
  }
  // A boulder is measured by what it rolls into.
  if (s.boulder) {
    const b = s.boulder;
    out.push(["Rolls", "one every " + num(Math.max(1.5, b.every)) + "s" + (b.count > 1 ? ", " + b.count + " at a time" : "")]);
    out.push(["Hits", Math.round(b.damage) + " at full pace"]);
    out.push(["Weight", Math.round(b.weight)]);
    out.push(["Run", num(b.run) + " cells"]);
    if (b.burst) out.push(["Rubble", num(b.burst) + " cells"]);
    if (b.landslide) out.push(["Landslide", "bosses too"]);
    return out;
  }
  // An urn is measured by what it gathers and what it lets go.
  if (s.urn) {
    out.push(["Gathers", "souls within " + num(s.range) + " cells"]);
    out.push(["Wails at", Math.round(s.urn.hold * (s.urn.early ? 2 / 3 : 1)) + " souls"]);
    out.push(["Wail", s.urn.per + " a soul, " + num(s.urn.span) + " cells each way"]);
    if (s.urn.extra) out.push(["Souls", "+" + s.urn.extra + " a cube"]);
    if (s.urn.twice) out.push(["Requiem", "wails twice"]);
    if (s.urn.slow) out.push(["Chill", Math.round(s.urn.slow * 100) + "% for 2s"]);
    if (s.urn.stun) out.push(["Stops", num(s.urn.stun) + "s"]);
    return out;
  }
  // A lodestone is measured by what it can hold.
  if (s.pull) {
    out.push(["Reach", num(s.pull.range) + " cells"]);
    out.push(["Pull", num(s.pull.speed) + " cells/s" + (s.heavyPull ? ", bosses a little" : "")]);
    if (s.pull.crush) out.push(["Crush", s.pull.crush + "/s per neighbour"]);
    if (s.pullBrittle) out.push(["Held", "+" + Math.round(s.pullBrittle * 100) + "% damage taken"]);
    return out;
  }
  // A sapper is measured by what it leaves lying about.
  if (s.mine) {
    out.push(["Mines", s.mine.most + " at once"]);
    out.push(["Blast", s.mine.damage + " over " + num(s.mine.splash) + " cells"]);
    out.push(["Rattles", "towers in the blast"]);
    out.push(["Laid", "one every " + num(Math.max(0.8, s.mine.every)) + "s"]);
    out.push(["Placed", s.mine.smart ? "ahead of cubes" : "spread out"]);
    out.push(["Charges", s.mine.keep ? "keep" : "one wave"]);
    out.push(["Range", num(s.range)]);
    return out;
  }
  // A tar pit works on the ground it covers and aims at nothing.
  if (s.mire) {
    out.push(["Mires", "everything within " + num(s.mire.range) + " cells"]);
    out.push(["Slow", Math.round(s.mire.slow * 100) + "%"]);
    if (s.mire.brittle) out.push(["Brittle", "+" + Math.round(s.mire.brittle * 100) + "% taken"]);
    if (s.mire.damage) out.push(["Damage", s.mire.damage + "/s"]);
    return out;
  }
  // A mint never shoots, so its card is about what it pays.
  if (s.yield) {
    out.push(["Yield", s.yield + " gold a wave"]);
    if (s.bounty) out.push(["Cut", "+" + Math.round(s.bounty * 100) + "% on every kill"]);
    if (s.interest) out.push(["Interest", Math.round(s.interest * 100) + "% a wave, up to " + s.interestCap]);
    if (s.mend) out.push(["Insurance", (s.mend.lives === 1 ? "a life" : s.mend.lives + " lives") + " back every " + s.mend.every + " waves"]);
    return out;
  }
  out.push(["Damage", num(s.damage) + (s.beam || s.cone ? "/s" : "")]);
  if (!s.beam && !s.cone) out.push(["Rate", num(s.rate) + "/s"]);
  out.push(["Range", isFinite(s.range) ? num(s.range) : "whole map"]);
  if (s.beams > 1) out.push(["Beams", s.beams]);
  if (s.through) out.push(["Beam", "cuts along its line"]);
  if (s.minRange) out.push(["Blind spot", num(s.minRange)]);
  if (s.splash) out.push(["Splash", num(s.splash)]);
  if (s.chain) out.push(["Jumps", s.chain + (s.chainKeep >= 1 ? ", no loss" : "")]);
  if (s.poison) out.push(["Poison", s.poison + "/s for " + s.poisonFor + "s, armour ignored"]);
  if (s.spread) out.push(["Spreads", num(s.spread) + " cells when it dies"]);
  if (s.heavy) out.push(["Share", "+" + (s.heavy * 100).toFixed(1) + "% of the target's health"]);
  if (s.lifted && (s.lifted.damage || s.lifted.rate || s.lifted.range)) {
    const parts = [];
    if (s.lifted.damage) parts.push("+" + Math.round(s.lifted.damage * 100) + "% damage");
    if (s.lifted.rate) parts.push("+" + Math.round(s.lifted.rate * 100) + "% rate");
    if (s.lifted.range) parts.push("+" + num(s.lifted.range) + " range");
    out.push(["Beacons", parts.join(", ")]);
  }
  if (s.stun) out.push(["Stun", s.stun + "s"]);
  if (s.knockback) out.push(["Knockback", s.knockback + " cells"]);
  if (s.guns > 1) out.push(["Guns", s.guns + ", aiming apart"]);
  if (s.daze) out.push(["Disorient", Math.round(s.daze.chance * 100) + "% for " + s.daze.for + "s"]);
  if (s.burn) out.push(["Burn", num(s.burn) + "/s for " + (s.burnFor || 2.5) + "s"]);
  if (s.slow) out.push(["Slow", Math.round(s.slow * 100) + "% for " + num(s.slowFor) + "s"]);
  if (s.brittle) out.push(["Brittle", "+" + Math.round(s.brittle * 100) + "% while slowed"]);
  if (s.cone) out.push(["Cone", s.coneCos <= -1 ? "all round" : s.coneCos < 0.7 ? "wide" : "narrow"]);
  if (s.pierce) out.push(["Armour", "ignored"]);
  else if (s.shred) out.push(["Armour", "counts half"]);
  if (s.passes) out.push(["Goes through", s.passes + (s.passes === 1 ? " more cube" : " more cubes")]);
  if (s.power) {
    out.push(["Power", Math.round(s.power) + " absorbed"]);
    out.push(["Resistances", s.power >= PIERCE_RESIST_POWER ? "burnt through" : "hold below " + PIERCE_RESIST_POWER]);
  }
  out.push(["Hidden", s.detect ? "can see" : "cannot see"]);
  return out;
}
const TARGET_NAMES = { first: "First", last: "Last", strong: "Strong", weak: "Weak" };
/** Whether an upgrade step is the one that lets the tower aim at hidden enemies. */
function seesHidden(upgrade) { const sets = {}; upgrade.apply(sets); return !!sets.detect; }
/** Step a tower to the next target mode. */
function cycleTarget(t) {
  t.target = TARGETS[(TARGETS.indexOf(t.target) + 1) % TARGETS.length];
  play("click"); autosave(); update();
}
const pips = (n) => Array.from({ length: MAX_TIER }, (_, k) => "<span" + (k < n ? ' class="on"' : "") + "></span>").join("");

// The tower card hangs above the selected tower and moves with the view.
// ---- The field guide ------------------------------------------------
const bookPanel = $("bookPanel"), bookGrid = $("bookGrid"), towerGrid = $("towerGrid"), mutGrid = $("mutGrid"), bookNote = $("bookNote");
const changePanel = $("changePanel"), changeList = $("changeList"), menuCorner = document.querySelector(".menu-corner");
let bookBuilt = false, bookPaused = false, towersBuilt = false, mutsBuilt = false, changesBuilt = false;
// The enemy and mutation pages are written for a difficulty, so they are torn
// up when it changes rather than quoting the schedule of a run nobody is on.
const forgetBook = () => { bookBuilt = false; mutsBuilt = false; };
function buildBook() {
  // The wave each type first walks in.
  const debut = {};
  for (let n = 1; n <= CAMPAIGN_WAVES && Object.keys(debut).length < Object.keys(ENEMIES).length; n++) for (const s of composeWave(n, difficulty)) if (!(s.type in debut)) debut[s.type] = n;
  const order = Object.keys(ENEMIES).sort((a, b) => (debut[a] || 99) - (debut[b] || 99) || ENEMIES[a].hp - ENEMIES[b].hp);
  bookGrid.innerHTML = "";
  for (const type of order) {
    const e = ENEMIES[type];
    const card = document.createElement("div");
    card.className = "beast";
    const traits = [];
    if (e.armour) traits.push("<span>Armour <i>" + e.armour + "</i></span>");
    if (e.shield) traits.push("<span>Shield <i>" + e.shield + "</i></span>");
    if (e.hidden) traits.push("<span><i>Hidden</i></span>");
    if (e.resist) for (const [kind, mult] of Object.entries(e.resist)) traits.push("<span>" + TOWERS[kind].name + " <i>" + (mult === 0 ? "immune" : Math.round((1 - mult) * 100) + "% off") + "</i></span>");
    if (e.phase) traits.push("<span><i>Phases</i></span>");
    card.innerHTML =
      '<img alt="" src="' + scene.thumbnail(type, 112, true) + '">' +
      "<b>" + e.name + "<small>" + (debut[type] ? "Wave " + debut[type] : "Endless") + "</small></b>" +
      '<div class="nums"><span>Health <i>' + e.hp + "</i></span><span>Speed <i>" + e.speed + "</i></span>" + traits.join("") + "<span>Gold <i>" + e.reward + "</i></span><span>Lives <i>" + (e.leak || 1) + "</i></span></div>" +
      "<p>" + e.blurb + "</p>";
    bookGrid.appendChild(card);
  }
  scene.dropThumbnails();
  bookBuilt = true;
}
/** The towers page: each tower, its numbers, and every step of both paths. */
function buildTowerBook() {
  towerGrid.innerHTML = "";
  const keys = Object.keys(TOWERS);
  // During a run, what it brought comes first, in the order the number keys
  // reach them, and what it left behind follows under a rule of its own. From
  // the menus there is no run yet, so every tower, in the order of the rack.
  const running = !hudParts[0].hidden;
  const brought = running ? kit().filter((kind) => TOWERS[kind]) : [];
  const groups = running
    ? [["On this run", brought], ["Left behind", keys.filter((kind) => !brought.includes(kind))]]
    : [["Every tower", keys]];
  const card = (kind) => {
    const spec = TOWERS[kind];
    const el = document.createElement("div");
    el.className = "beast tower";
    const nums = statLines(spec.base).filter(([l]) => l !== "Hidden").map(([l, v]) => "<span>" + l + " <i>" + v + "</i></span>").join("");
    const path = (pth) => '<section class="path"><b>' + pth.name + "</b>" + pth.upgrades.map((u) => '<div class="' + (seesHidden(u) ? "sees" : "") + '"><span>' + u.name + "</span><b>" + upgradePrice(u, upkeep()) + "</b></div><small>" + u.blurb + "</small>").join("") + "</section>";
    const at = brought.indexOf(kind);
    el.innerHTML =
      '<img alt="" src="' + scene.thumbnail(kind, 112) + '">' +
      "<b>" + spec.name + "<small>" + spec.cost + " gold &middot; up to " + mostOf(kind) + (at >= 0 ? " &middot; key " + ((at + 1) % 10) : "") + "</small></b>" +
      '<div class="nums">' + nums + "</div>" +
      "<p>" + spec.blurb + "</p>" +
      '<section class="paths">' + spec.paths.map(path).join("") + "</section>";
    return el;
  };
  for (const [label, kinds] of groups) {
    if (!kinds.length) continue;
    const shelf = document.createElement("div");
    shelf.className = "shelf";
    shelf.innerHTML = "<span>" + label + " &middot; " + kinds.length + "</span>";
    towerGrid.appendChild(shelf);
    for (const kind of kinds) towerGrid.appendChild(card(kind));
  }
  scene.dropThumbnails();
  towersBuilt = true;
}
/** The mutations page: what each one does to whatever it lands on. */
function buildMutationBook() {
  mutGrid.innerHTML = "";
  // An ordinary runner wears each one, so the colour is what tells them apart.
  for (const [id, m] of Object.entries(MUTATIONS)) {
    const card = document.createElement("div");
    card.className = "beast mutant";
    card.style.setProperty("--mut", m.colour);
    const nums = [];
    const times = (v) => (v >= 1 ? "&times;" + v : Math.round((1 - v) * 100) + "% less");
    if (m.hp) nums.push("<span>Health <i>" + times(m.hp) + "</i></span>");
    if (m.speed) nums.push("<span>Speed <i>" + times(m.speed) + "</i></span>");
    if (m.armour) nums.push("<span>Armour <i>+" + m.armour + "</i></span>");
    if (m.size) nums.push("<span>Size <i>" + times(m.size) + "</i></span>");
    if (m.leak) nums.push("<span>Lives <i>" + times(m.leak) + "</i></span>");
    if (m.reward) nums.push("<span>Gold <i>" + times(m.reward) + "</i></span>");
    for (const [kind, mult] of Object.entries(m.resist || {})) {
      nums.push("<span>" + TOWERS[kind].name + " <i>" + (mult === 0 ? "immune" : mult > 1 ? Math.round((mult - 1) * 100) + "% more" : Math.round((1 - mult) * 100) + "% off") + "</i></span>");
    }
    card.innerHTML =
      '<img alt="" src="' + scene.thumbnail("basic", 112, true, id) + '">' +
      "<b>" + m.name + "<small>" + (m.never ? "The last boss on hard" : "Wave " + mutationFrom(m, difficulty)) + "</small></b>" +
      '<div class="nums">' + nums.join("") + "</div>" +
      "<p>" + m.blurb + (m.maxSize ? " Never lands on the biggest bosses." : "") + "</p>";
    mutGrid.appendChild(card);
  }
  scene.dropThumbnails();
  mutsBuilt = true;
}
/** Everything that has changed about the way a run plays, newest first. */
function buildChangeList() {
  changeList.innerHTML = CHANGES.map((entry) =>
    '<section class="change' + (entry.version === BALANCE ? " now" : "") + '">' +
    "<h3>" + entry.title + "<small>" + (entry.version === BALANCE ? "Current" : "Version " + entry.version) + "</small></h3>" +
    "<ul>" + entry.lines.map((line) => "<li>" + line + "</li>").join("") + "</ul></section>").join("");
  changesBuilt = true;
}
function showBookPage(page) {
  if (page === "towers" && !towersBuilt) buildTowerBook();
  if (page === "mutations" && !mutsBuilt) buildMutationBook();
  bookGrid.hidden = page !== "enemies";
  towerGrid.hidden = page !== "towers";
  mutGrid.hidden = page !== "mutations";
  for (const [tab, name] of [["tabEnemies", "enemies"], ["tabTowers", "towers"], ["tabMutations", "mutations"]]) $(tab).setAttribute("aria-selected", String(page === name));
  bookNote.textContent = page === "towers"
    ? "Every tower, what it costs, what it does, and every step of both upgrade paths."
    : page === "mutations"
      ? "From wave " + DIFFICULTIES[difficulty].mutate.from + " a cube can walk in changed. One in " + Math.round(1 / mutationChance(CAMPAIGN_WAVES, difficulty)) + " does by the last wave, and it can happen to anything."
      : "Every cube that walks the road, what it does, and the wave it first appears.";
}
$("tabEnemies").addEventListener("click", () => showBookPage("enemies"));
$("tabTowers").addEventListener("click", () => showBookPage("towers"));
$("tabMutations").addEventListener("click", () => showBookPage("mutations"));
// Its own panel, from the corner of the menu: the field guide describes the
// road as it is, this says how it got that way.
function openChanges() { if (!changesBuilt) buildChangeList(); changePanel.hidden = false; }
function closeChanges() { changePanel.hidden = true; }
$("changes").addEventListener("click", () => { if (changePanel.hidden) openChanges(); else closeChanges(); play("click"); });
$("changeClose").addEventListener("click", () => { closeChanges(); play("click"); });
function openBook() {
  if (!bookBuilt) buildBook();
  bookPanel.hidden = false;
  // A run in progress waits while you read.
  bookPaused = !!simulation && simulation.phase === "wave" && !paused;
  if (bookPaused) paused = true;
  play("click");
}
function closeBook() {
  bookPanel.hidden = true;
  if (bookPaused) { paused = false; last = performance.now(); }
  bookPaused = false;
}
$("book").addEventListener("click", () => { openBook(); $("book").blur(); });
$("bookClose").addEventListener("click", closeBook);

let popFor = null, popKey = "";
/**
 * The most stat rows a kind of tower can ever show, across every set of
 * upgrades it can hold, a beacon's lift and a prism's absorbed power. Its
 * card keeps that many rows whatever it has bought, so a row appearing with
 * an upgrade does not shift the buttons under the pointer.
 */
const rowsFor = new Map();
function statRowsOf(kind) {
  if (rowsFor.has(kind)) return rowsFor.get(kind);
  let most = 0;
  for (let a = 0; a <= MAX_TIER; a++) for (let b = 0; b <= MAX_TIER; b++) {
    if (a > 2 && b > 2) continue; // the other path is capped once one goes past two
    const s = statsFor(kind, [a, b]);
    if (s.damage) s.lifted = { damage: 0.1 };
    if (s.sacrifice) s.power = 1;
    most = Math.max(most, statLines(s).length);
  }
  rowsFor.set(kind, most);
  return most;
}
function renderPop() {
  const t = view.selected;
  if (!t && view.prop && simulation.props.has(view.prop)) { renderPropPop(); return; }
  if (!t) { view.prop = null; pop.hidden = true; popFor = null; popKey = ""; return; }
  const spec = TOWERS[t.kind], s = simulation.stats(t);
  const nexts = [0, 1].map((p) => ({ cost: simulation.upgradeCost(t, p), up: simulation.upgradeCost(t, p) !== null ? spec.paths[p].upgrades[t.tiers[p]] : null }));
  // Rebuild only when something on the card changes; update() runs every
  // frame during a wave, and replacing the buttons mid-click would eat the click.
  const key = t.id + ":" + t.tiers.join() + ":" + t.target + ":" + Math.ceil(t.stunned || 0) + ":" + nexts.map((n) => n.cost !== null && !afford(n.cost)).join();
  if (popFor === t && key === popKey) {
    const d = $("dealt"); if (d) d.textContent = String(Math.round(simulation.stats(t).yield ? t.earned || 0 : t.dealt || 0));
    const so = $("souls"); if (so) so.textContent = Math.floor(t.souls || 0) + " / " + Math.round(s.urn.hold * (s.urn.early ? 2 / 3 : 1));
    placePop();
    return;
  }
  popKey = key;
  const row = (label, value) => "<div><span>" + label + "</span><b>" + value + "</b></div>";
  const pathHtml = (p) => {
    const path = spec.paths[p], n = nexts[p], tier = t.tiers[p];
    let action;
    if (n.up) action = '<button class="btn" id="up' + p + '" type="button"' + (!afford(n.cost) ? " disabled" : "") + ">" + n.up.name + " &middot; " + n.cost + "</button><small>" + n.up.blurb + "</small>";
    else action = '<small class="done">' + (tier >= MAX_TIER ? "Fully upgraded" : "Locked: the other path went further") + "</small>";
    return '<section class="path"><b>' + path.name + "</b><i>" + pips(tier) + "</i>" + action + "</section>";
  };
  pop.innerHTML =
    // A knocked-out tower says so before anything else: its numbers mean
    // nothing while it is down, and it is the reason it has stopped firing.
    (t.stunned > 0 ? '<p class="down">Tower down <b>&middot; back in ' + Math.ceil(t.stunned) + "s</b></p>" : "") +
    "<h6>" + spec.name + " &middot; " + t.tiers[0] + "-" + t.tiers[1] + "</h6>" +
    statLines(s).map(([l, v]) => row(l, v)).join("") +
    '<div class="pad"><span>&nbsp;</span></div>'.repeat(Math.max(0, statRowsOf(t.kind) - statLines(s).length)) +
    (s.yield
      ? '<div><span>Earned</span><b id="dealt">' + Math.round(t.earned || 0) + "</b></div>"
      : s.damage || s.mire || s.mine || s.pull || s.urn || s.boulder || s.rift
        ? '<div><span>Dealt</span><b id="dealt">' + Math.round(t.dealt || 0) + "</b></div>"
        : "") +
    (s.urn ? '<div><span>Souls</span><b id="souls">' + Math.floor(t.souls || 0) + " / " + Math.round(s.urn.hold * (s.urn.early ? 2 / 3 : 1)) + "</b></div>" : "") +
    (s.damage ? '<div class="target"><span>Target</span><button class="btn btn-secondary" id="target" type="button" title="Which enemy it aims at (T)">' + TARGET_NAMES[t.target] + "</button></div>" : "") +
    '<section class="paths">' + pathHtml(0) + pathHtml(1) + "</section>" +
    '<div class="row"><button class="btn btn-secondary" id="sell" type="button">Sell &middot; ' + Math.floor(spentOn(t, upkeep()) * SELL_REFUND) + "</button></div>";
  for (const p of [0, 1]) { const b = $("up" + p); if (b) b.addEventListener("click", () => { if (simulation.upgrade(t, p)) { play("upgrade"); autosave(); update(); } }); }
  const targetBtn = $("target");
  if (targetBtn) targetBtn.addEventListener("click", () => { cycleTarget(t); });
  $("sell").addEventListener("click", () => { simulation.sell(t); play("sell"); view.selected = null; autosave(); update(); });
  popFor = t;
  pop.hidden = false;
  placePop();
}
/** The card for a prop: what it is, and a button to pay to clear it. */
function renderPropPop() {
  const key = view.prop, prop = simulation.props.get(key);
  const [c, r] = key.split(",").map(Number);
  const can = afford(prop.cost);
  const cardKey = "prop:" + key + ":" + can;
  if (popFor && popFor.prop === key && popKey === cardKey) { placePop(); return; }
  popKey = cardKey;
  const kind = PROPS[prop.kind];
  pop.innerHTML =
    "<h6>" + kind.name + "</h6>" +
    '<p class="about">' + kind.blurb + "</p>" +
    (prop.near ? "<div><span>Beside the road</span><b>costs half again</b></div>" : "") +
    '<div class="row"><button class="btn" id="clearProp" type="button"' + (can ? "" : " disabled") + ">Clear &middot; " + (simulation.level.free ? "free" : prop.cost + " gold") + "</button></div>";
  $("clearProp").addEventListener("click", () => {
    if (!simulation.clearProp(c, r)) { play("denied"); return; }
    play("clear");
    view.prop = null;
    autosave();
    update();
  });
  popFor = { c, r, prop: key };
  pop.hidden = false;
  placePop();
}
function placePop() {
  if (popFor && !pop.hidden) {
    const p = scene.project(popFor.c + 0.5, popFor.r + 0.5, 1.5);
    // Kept wholly on screen: slid in from whichever edge it would have run
    // off, and flipped under the tower when there is no room above it. The
    // pointer then slides along the card's edge so it still marks the tower
    // the card belongs to.
    const w = pop.offsetWidth, h = pop.offsetHeight, pad = 8;
    const below = p.y - h - 12 < pad;
    pop.classList.toggle("below", below);
    const x = Math.max(w / 2 + pad, Math.min(window.innerWidth - w / 2 - pad, p.x));
    const y = below
      ? Math.min(p.y, window.innerHeight - h - 12 - pad)
      : Math.max(p.y, h + 12 + pad);
    pop.style.left = x.toFixed(1) + "px";
    pop.style.top = y.toFixed(1) + "px";
    pop.style.setProperty("--arrow", Math.max(14, Math.min(w - 14, w / 2 + (p.x - x))).toFixed(1) + "px");
  }
  // The cube moves, so its card is placed every frame rather than on change.
  if (watchFor && !epop.hidden) {
    const q = scene.project(watchFor.x, watchFor.y, watchFor.spec.size * 1.7 + 0.45);
    // A cube walks right up to the edge of the view, so its card is kept on
    // screen: held back from the sides, and flipped under the cube when there
    // is no room above it.
    const w = epop.offsetWidth, h = epop.offsetHeight;
    epop.classList.toggle("below", q.y - h - 12 < 6);
    epop.style.left = Math.max(w / 2 + 6, Math.min(window.innerWidth - w / 2 - 6, q.x)).toFixed(1) + "px";
    epop.style.top = q.y.toFixed(1) + "px";
  }
}

// Pictures of the cubes, drawn once each and kept: a wave can hold a lot of
// one kind, and every one of them is the same picture.
const faces = new Map();
function enemyFace(type, mut) {
  const key = type + "|" + mut;
  if (!faces.has(key)) { faces.set(key, scene.thumbnail(type, 96, true, mut)); scene.dropThumbnails(); }
  return faces.get(key);
}

/** What a cube does, in the fewest words that still say it. */
function enemyTraits(spec) {
  const out = [];
  if (spec.hidden) out.push("Unseen by most");
  if (spec.phase) out.push("Phases out");
  if (spec.charge) out.push("Runs faster the more it is hurt");
  if (spec.blink) out.push("Skips ahead");
  if (spec.unchillable) out.push("Cannot be slowed");
  else if (spec.tough) out.push("Half-slowed, never stunned, breaks free when held");
  if (spec.frail) out.push("Takes more from everything");
  if (spec.regen) out.push("Regenerates");
  if (spec.heal) out.push("Heals its neighbours");
  if (spec.aegis) out.push("Shields its neighbours");
  if (spec.guard) out.push("Guards its neighbours");
  if (spec.raise) out.push("Raises more");
  if (spec.split) out.push("Splits when killed");
  if (spec.revive) out.push("Gets back up once");
  if (spec.emp) out.push("Knocks out towers when it dies");
  if (spec.scorch) out.push("Slows the towers it passes");
  return out;
}

/** What is happening to it right now, or nothing at all if it is just walking. */
function enemyNow(e) {
  const out = [];
  if (e.immune) out.push("still coming through");
  if (e.phased) out.push("untouchable");
  if (e.unbound > 0) out.push("broken free, cannot be slowed for " + e.unbound.toFixed(1) + "s");
  if (e.stunLeft > 0) out.push("frozen");
  else if (e.slow > 0) out.push("slowed " + Math.round(e.slow * 100) + "%");
  if (e.burn > 0) out.push("alight");
  if (e.venom > 0) out.push("poisoned, " + Math.round(e.venomDps) + " a second for " + e.venom.toFixed(1) + "s");
  if (e.dazed > 0) out.push("confused, going nowhere");
  if (e.guarded) out.push("under a warden");
  if (e.held > 0) out.push("held by a lodestone");
  return out;
}

let watchFor = null, watchKey = "";
/** The card above a cube that was clicked: what it is and how it is doing. */
function renderWatch() {
  const e = view.watching;
  // It is gone the moment the cube is: killed, leaked, or split into others.
  if (!e || e.dead || !simulation.enemies.includes(e)) {
    if (view.watching) view.watching = null;
    epop.hidden = true; watchFor = null; watchKey = "";
    return;
  }
  const spec = e.spec;
  const row = (label, value, cls) => '<div' + (cls ? ' class="' + cls + '"' : "") + "><span>" + label + "</span><b>" + value + "</b></div>";
  const num = (v) => Math.round(v * 100) / 100;
  const now = enemyNow(e);
  // Only rebuild when the shape of the card changes; the numbers on it are
  // written straight into their own spans every frame.
  const key = e.id + ":" + (e.maxShield > 0) + ":" + now.join();
  if (watchFor === e && key === watchKey) {
    $("ehp").textContent = Math.max(0, Math.round(e.hp)) + " / " + e.maxHp;
    const sh = $("eshield");
    if (sh) sh.textContent = String(Math.round(e.shield));
    return;
  }
  watchKey = key;
  const traits = enemyTraits(spec);
  const resists = Object.entries(spec.resist || {}).map(([kind, mult]) =>
    TOWERS[kind].name + " " + (mult === 0 ? "immune" : mult > 1 ? Math.round((mult - 1) * 100) + "% more" : Math.round((1 - mult) * 100) + "% off"));
  epop.innerHTML =
    '<div class="head"><img alt="" src="' + enemyFace(e.type, e.mut) + '"><h6>' + spec.name + "</h6></div>" +
    '<div><span>Health</span><b id="ehp">' + Math.max(0, Math.round(e.hp)) + " / " + e.maxHp + "</b></div>" +
    (e.maxShield > 0 ? '<div><span>Shield</span><b id="eshield">' + Math.round(e.shield) + "</b></div>" : "") +
    row("Speed", num(spec.speed) + " cells/s") +
    (spec.armour ? row("Armour", spec.armour) : "") +
    row("Gold", Math.max(1, Math.round(spec.reward * simulation.level.reward * KILL_REWARD))) +
    row("Lives", spec.leak || 1) +
    (resists.length ? row("Resists", resists.join(", ")) : "") +
    (traits.length ? row("Traits", traits.join(", ")) : "") +
    row("Right now", now.length ? now.join(", ") : "walking the road", now.length ? "now" : "") +
    "<p>" + ENEMIES[e.type].blurb + (e.mut ? " " + MUTATIONS[e.mut].blurb : "") + "</p>";
  watchFor = e;
  epop.hidden = false;
  placePop();
}

/** The shop holds the towers this run was brought with, and nothing else. */
function buildShop() {
  shop.innerHTML = "";
  kit().forEach((kind, i) => {
    const spec = TOWERS[kind];
    const b = document.createElement("button");
    b.type = "button";
    b.dataset.kind = kind;
    b.addEventListener("pointerenter", () => showDetail(kind, b));
    b.addEventListener("focus", () => showDetail(kind, b));
    b.addEventListener("blur", () => { detail.hidden = true; });
    b.innerHTML = '<img class="model" alt="" src="' + scene.thumbnail(kind) + '"><span>' + spec.name + "<small>" + spec.cost + " gold</small></span><kbd>" + ((i + 1) % 10) + "</kbd>";
    b.addEventListener("click", () => setPlacing(kind));
    shop.appendChild(b);
  });
  scene.dropThumbnails();
}
buildShop();
scene.dropThumbnails();
shop.addEventListener("pointerleave", () => { detail.hidden = true; });

/** Open the description beside the shop, level with the hovered row. */
function showDetail(kind, row) {
  const spec = TOWERS[kind];
  const line = (label, value) => "<div><span>" + label + "</span><b>" + value + "</b></div>";
  const pathHtml = (p) => '<section class="path"><b>' + p.name + "</b>" + p.upgrades.map((u) => '<div class="' + (seesHidden(u) ? "sees" : "") + '"><span>' + u.name + "</span><b>" + upgradePrice(u, upkeep()) + "</b></div>").join("") + "</section>";
  detail.innerHTML =
    "<h6>" + spec.name + " &middot; " + spec.cost + " gold</h6><p>" + spec.blurb + "</p>" +
    statLines(spec.base).map(([l, v]) => line(l, v)).join("") +
    '<section class="paths">' + spec.paths.map(pathHtml).join("") + "</section>";
  const r = row.getBoundingClientRect();
  detail.style.top = (r.top + r.height / 2).toFixed(0) + "px";
  detail.hidden = false;
}
/**
 * Ask before something that cannot be taken back, in the page's own colours.
 * Resolves true only if the reader says go ahead. Escape is deliberately not
 * bound.
 */
let askDone = null, askFrom = null;
function ask(title, text, yes, no) {
  return new Promise((resolve) => {
    closeAsk(false); // never stack two questions
    $("askTitle").textContent = title;
    $("askText").textContent = text;
    $("askYes").textContent = yes;
    $("askNo").textContent = no;
    askFrom = document.activeElement;
    askDone = resolve;
    askPanel.hidden = false;
    // The safe answer has the keyboard, so a stray Enter keeps the run.
    $("askNo").focus();
    play("click");
  });
}
function closeAsk(ok) {
  if (!askDone) return;
  const done = askDone;
  askDone = null;
  askPanel.hidden = true;
  if (askFrom && askFrom.focus) askFrom.focus();
  askFrom = null;
  done(ok);
}
$("askYes").addEventListener("click", () => closeAsk(true));
$("askNo").addEventListener("click", () => closeAsk(false));
// A press outside the box is the same as saying no.
askPanel.addEventListener("pointerdown", (e) => { if (e.target === askPanel) closeAsk(false); });

/** Whether to go ahead and throw this run away for a new one. */
function confirmSwitch() {
  if (simulation.phase === "lost" || simulation.phase === "won") return Promise.resolve(true);
  const n = simulation.phase === "wave" ? simulation.wave : simulation.cleared + 1;
  return ask("Start over?", "Wave " + n + " on " + simulation.map.name.toLowerCase() + ", with " + purse() + " and " + simulation.lives + " lives, will be lost.", "Start over", "Keep playing");
}

// ---- Pointer: placing, selecting, orbiting -------------------------
let drag = null; // { x, from, moved } while the right or middle button turns the view
canvas.addEventListener("pointermove", (e) => {
  if (drag) {
    scene.orbit((e.clientX - drag.x) * 0.006);
    drag.x = e.clientX;
    // Only a real turn counts as a drag. Any move at all used to, so the
    // pixel or two a hand shakes during a click stopped right-click from
    // clearing the selection.
    if (Math.abs(e.clientX - drag.from) > 6) drag.moved = true;
    return;
  }
  view.hover = scene.cellAt(e.clientX, e.clientY);
});
canvas.addEventListener("pointerleave", () => { view.hover = null; });
canvas.addEventListener("pointerdown", (e) => {
  if (!simulation || veil.classList.contains("on")) return;
  if (e.button === 2 || e.button === 1) { drag = { x: e.clientX, from: e.clientX, moved: false }; canvas.setPointerCapture(e.pointerId); return; }
  if (e.button !== 0) return;
  // A cube on the road answers before the ground under it does, so what is
  // walking past can be read without stopping to open the guide.
  if (!view.placing) {
    const id = scene.enemyAt(e.clientX, e.clientY);
    const cube = id === null ? null : simulation.enemies.find((x) => x.id === id);
    if (cube) { view.watching = cube; view.selected = null; update(); return; }
    view.watching = null;
  }
  const cell = scene.cellAt(e.clientX, e.clientY);
  // Selecting goes by the models, which stand above the cells they occupy;
  // placing goes by the cell, since that is what is being built on.
  if (!view.placing) {
    const tid = scene.towerAt(e.clientX, e.clientY);
    view.selected = tid === null
      ? (cell ? simulation.towerAt(cell.c, cell.r) : null)
      : simulation.towers.find((t) => t.id === tid) || null;
    // Nothing built there: a prop on the cell opens its own card.
    view.prop = !view.selected && cell && simulation.props.has(cell.c + "," + cell.r) ? cell.c + "," + cell.r : null;
    update();
    return;
  }
  if (!cell) { update(); return; }
  if (simulation.place(view.placing, cell.c, cell.r)) {
    play("place");
    autosave();
    if (simulation.atStand()) { status(standNote()); view.placing = null; }
    else if (simulation.atCap(view.placing)) { status(capNote(view.placing)); view.placing = null; }
    else if (!afford(TOWERS[view.placing].cost)) view.placing = null;
  } else if (simulation.atCap(view.placing) || simulation.atStand()) {
    play("denied");
    status(simulation.atStand() ? standNote() : capNote(view.placing));
  } else if (!simulation.canBuild(cell.c, cell.r)) {
    play("denied");
    const prop = simulation.propAt(cell.c, cell.r);
    status(simulation.blocked.has(cell.c + "," + cell.r) ? "Not on the road."
      : prop ? (prop.kind === "stones" ? "Stones are" : "A " + PROPS[prop.kind].name.toLowerCase() + " is") + " in the way. Click it without a tower in hand to clear it."
        : "That cell is taken.");
  } else {
    play("denied");
    status("Not enough gold.");
  }
  update();
});
// A right-click anywhere clears the selection, not only one on the board:
// the card itself covers a good part of it, and clicks on the card never
// reached the canvas. Fields keep their own menu.
document.addEventListener("contextmenu", (e) => {
  if (!simulation || veil.classList.contains("on") || !bookPanel.hidden || !changePanel.hidden) return;
  if (e.target.closest("input, select, textarea")) return;
  e.preventDefault();
  if (e.target.closest("canvas")) return; // the canvas answers on pointerup, after a drag
  if (!view.placing && !view.selected && !view.watching && !view.prop) return;
  view.placing = null; view.selected = null; view.watching = null; view.prop = null;
  update();
});
canvas.addEventListener("pointerup", (e) => {
  if (!drag) return;
  const moved = drag.moved;
  drag = null;
  // A right-click without a drag cancels placing or selection.
  if (e.button === 2 && !moved) { view.placing = null; view.selected = null; view.watching = null; view.prop = null; status(""); update(); }
});
canvas.addEventListener("contextmenu", (e) => e.preventDefault());
canvas.addEventListener("wheel", (e) => { e.preventDefault(); scene.zoomBy(e.deltaY < 0 ? 1.1 : 1 / 1.1); }, { passive: false });

startBtn.addEventListener("click", () => { autoTimer = 0; if (simulation.startWave()) { play("wave"); update(); } startBtn.blur(); });
speedBtn.addEventListener("click", () => {
  speed = speed === 1 ? 2 : speed === 2 ? 5 : 1;
  speedBtn.textContent = speed + "×";
  try { localStorage.setItem("td.speed", String(speed)); } catch {}
  speedBtn.blur();
});
autoBtn.addEventListener("click", () => { setAuto(!auto); autoBtn.blur(); });
pauseBtn.addEventListener("click", () => { togglePause(); pauseBtn.blur(); });
function setAuto(on) {
  auto = on;
  try { localStorage.setItem("td.auto", on ? "1" : "0"); } catch {}
  // Turning it off stops a countdown already running. Turning it on does not
  // start one: auto is what happens once a wave has been held, and throwing the
  // switch while a board is still being built should not send the next wave in
  // three seconds when nothing has been asked to start.
  if (!on) autoTimer = 0;
  update();
}
function togglePause() {
  if (!simulation) return;
  if (veil.classList.contains("on")) { if (veilMode === "paused") resume(); return; }
  paused = true;
  showVeil("paused", "Paused", "Wave " + (simulation.phase === "wave" ? simulation.wave : simulation.cleared + 1) + " on " + simulation.map.name.toLowerCase() + ", " + purse() + ", " + simulation.lives + " lives.", "Resume", "New run");
  // The pause menu is where a run is left: written down here, what it says is
  // also what comes back, whatever happens to the page next.
  autosave();
  update();
}
function resume() {
  paused = false;
  veil.classList.remove("on", "intro");
  last = performance.now();
  update();
}

// The arrow keys pan the camera, as [right, up] in view heights per second.
const PAN_KEYS = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] };
const panHeld = new Set();
document.addEventListener("keyup", (e) => { panHeld.delete(e.key); });
// A key let go while the window is elsewhere never sends its keyup.
window.addEventListener("blur", () => panHeld.clear());

// Escape is left alone on purpose.
document.addEventListener("keydown", (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (!askPanel.hidden) return; // the question on top has the keys
  const k = e.key.toLowerCase();
  // The changes panel sits over everything and has only its Close button.
  if (!changePanel.hidden) return;
  if (k === "b") { if (bookPanel.hidden) openBook(); else closeBook(); return; }
  if (!bookPanel.hidden) return; // Keep menu and run shortcuts behind the guide.
  if (e.target.closest?.("#book")) return; // Let Enter/Space activate the wiki button.
  if (e.key === " " || e.key === "Enter") {
    if (veil.classList.contains("on")) { e.preventDefault(); if (!veilBtn.hidden) veilBtn.click(); return; }
    if (simulation && simulation.phase === "build") { e.preventDefault(); if (simulation.startWave()) play("wave"); update(); }
    return;
  }
  if (k === "p") { togglePause(); return; }
  if (k === "f") { speedBtn.click(); return; }
  if (k === "a" && simulation) { setAuto(!auto); return; }
  // On the route card, the arrow keys step through the routes.
  if (veilMode === "choose" && veil.classList.contains("on") && (e.key === "ArrowLeft" || e.key === "ArrowRight")) {
    e.preventDefault();
    showRoute((chosen >= 0 ? chosen : previewing || 0) + (e.key === "ArrowLeft" ? -1 : 1));
    return;
  }
  if (PAN_KEYS[e.key]) {
    // Held rather than stepped: the loop eases the camera along while the key is down.
    e.preventDefault();
    if (simulation && !veil.classList.contains("on")) panHeld.add(e.key);
    return;
  }
  if (e.key === "+" || e.key === "=") { scene.zoomBy(1.15); return; }
  if (e.key === "-" || e.key === "_") { scene.zoomBy(1 / 1.15); return; }
  if (k === "q") { scene.snap(-1); return; }
  if (k === "e") { scene.snap(1); return; }
  if (k === "r") { scene.reset(); return; }
  const slot = e.key === "0" ? 9 : e.key - 1;
  if (/^[0-9]$/.test(e.key) && kit()[slot] && simulation) { setPlacing(kit()[slot]); return; }
  if (k === "u" && view.selected) { if (simulation.upgrade(view.selected, 0)) { play("upgrade"); autosave(); update(); } }
  if (k === "i" && view.selected) { if (simulation.upgrade(view.selected, 1)) { play("upgrade"); autosave(); update(); } }
  if (k === "m") { soundBtn.click(); return; }
  if (k === "t" && view.selected && simulation.stats(view.selected).damage) { cycleTarget(view.selected); return; }
  if (k === "s" && view.selected) { simulation.sell(view.selected); play("sell"); view.selected = null; autosave(); update(); }
});

// ---- Events from the simulation ------------------------------------
function drain() {
  for (const ev of simulation.events) {
    if (ev.type === "hit") {
      view.flashes.push({ x: ev.x, y: ev.y, kind: ev.kind, life: 1 });
      for (const p of ev.struck || []) view.flashes.push({ x: p.x, y: p.y, kind: ev.kind, life: 1 });
      scene.impact(ev);
      play("hit:" + ev.kind);
    }
    else if (ev.type === "shot") { scene.muzzle(ev); play("shot:" + ev.kind); }
    else if (ev.type === "absorb") { scene.absorb(ev); play("absorb"); }
    else if (ev.type === "finale") { if (notesMode !== "off") announce("Wave " + simulation.wave + " \u00b7 The last boss", [finaleLine(ev.name)], true); play("wave"); }
    else if (ev.type === "soul") { scene.soul(ev); play("soul"); }
    else if (ev.type === "wail") { scene.wail(ev); play("wail"); }
    else if (ev.type === "boulder") play("boulder");
    else if (ev.type === "crush") { scene.crush(ev); play(ev.big ? "crush:big" : "crush"); }
    else if (ev.type === "grind") scene.grind(ev);
    else if (ev.type === "rubble") { scene.rubble(ev); play("rubble"); }
    else if (ev.type === "rift") { scene.rift(ev); play("rift"); }
    else if (ev.type === "riftopen") { scene.openTear(ev.x, ev.y, 0.45, false, ev.open, ev.hole); play(ev.hole ? "hole" : "rift"); }
    else if (ev.type === "swallow") { scene.swallow(ev); play("swallow"); }
    else if (ev.type === "consecrate") { scene.consecrate(ev); play("consecrate"); }
    else if (ev.type === "emp") { scene.emp(ev); play("emp"); }
    else if (ev.type === "raise") { scene.raise(ev); play("raise"); }
    else if (ev.type === "earn") { scene.coins(ev); play("coins"); }
    else if (ev.type === "lay") play("lay");
    else if (ev.type === "mine") { scene.mineBlast(ev); play("mine"); }
    else if (ev.type === "dud") scene.mineDud(ev);
    else if (ev.type === "blink") scene.blink(ev);
    else if (ev.type === "revive") { scene.revive(ev); play("raise"); }
    else if (ev.type === "unbound") { scene.revive(ev); play("absorb"); status("The " + ev.name.toLowerCase() + " broke free. Nothing slows it for a few seconds."); }
    else if (ev.type === "kill") { if (!ev.enemy.swallowed) scene.burst(ev.enemy); if (ev.bonus) scene.bounty(ev); play("kill", ev.enemy.spec.size); }
    else if (ev.type === "arc") {
      const coil = { x: ev.from.x, y: ev.from.y, h: muzzleHeight("arc", ev.from.tier) };
      view.arcs.push({ points: [coil, ...ev.points], life: 1 });
      for (const p of ev.points) view.flashes.push({ x: p.x, y: p.y, kind: "arc", life: 1 });
      scene.sparks(ev.points); play("shot:arc");
    }
    else if (ev.type === "cleared") {
      if (!simulation.level.free) writeBest(bestKey(simulation.map, simulation.difficulty), ev.wave);
      autosave();
      play("cleared");
      notesAhead();
      if (auto) autoTimer = AUTO_COUNT;
    } else if (ev.type === "heal") { play("heal"); status("+" + ev.lives + (ev.lives === 1 ? " life." : " lives.")); autosave(); }
    else if (ev.type === "leak") {
      play("leak");
      if (ev.finale) status("The " + ev.enemy.spec.name.toLowerCase() + " reached the door. Nothing is held back from that.");
      else status(ev.lost > 1 ? "A " + ev.enemy.spec.name.toLowerCase() + " got through: " + ev.lost + " lives." : "One got through.");
      // A life lost is written down at once: whatever takes the page away
      // next, the run must never come back with it still in hand.
      autosave();
    }
    else if (ev.type === "won") {
      play("won");
      showVeil("won", "Road held", "All " + CAMPAIGN_WAVES + " waves stopped with " + simulation.lives + " lives left. Keep going into endless waves, or start a new run.", "New run", "Keep going");
    } else if (ev.type === "lost") {
      clearRun();
      play("lost");
      const best = readBest(bestKey(simulation.map, simulation.difficulty));
      const text = "Held for " + simulation.cleared + (simulation.cleared === 1 ? " wave" : " waves") + " on " + simulation.map.name.toLowerCase() + ", " + simulation.level.name.toLowerCase() + ", " + simulation.kills + " stopped." + (best > simulation.cleared ? " Best " + best + "." : "");
      const through = ev.through;
      setTimeout(() => {
        // Not "try again": the button goes back to the chooser, not back onto
        // the road, and the won screen already calls that same trip a new run.
        showVeil("lost", "Road overrun", text, "New run", null);
        showThrough(through);
      }, 700);
    }
  }
  simulation.events.length = 0;
}
/**
 * What walked through on the leak that ended the run: its portrait, its name
 * and what it took. A run that ran out of road to a boss it never saw coming
 * should be able to see what it was.
 */
function showThrough(through) {
  if (!through || !ENEMIES[through.type]) { veilThrough.hidden = true; veilThrough.innerHTML = ""; return; }
  const spec = specFor(through.type, through.mut);
  const took = through.finale
    ? "Took the road with it"
    : "Took " + through.lost + (through.lost === 1 ? " life" : " lives");
  veilThrough.innerHTML =
    '<img alt="" src="' + scene.thumbnail(through.type, 96, true, through.mut || null) + '">' +
    "<div><small>Leaked</small>" +
    // specFor already writes the mutation into the name, so putting it in front
    // again is how "Blight blight juggernaut" happens. Sentence case, like the
    // status line under it: one capital, and the cube in lower case after it.
    "<b>" + spec.name.charAt(0) + spec.name.slice(1).toLowerCase() + "</b>" +
    "<span>" + took + " on wave " + through.wave + ".</span></div>";
  veilThrough.hidden = false;
  scene.dropThumbnails();
}
function autosave() { if (simulation && simulation.phase !== "lost") saveRun(simulation.snapshot()); }
/**
 * Save the run this instant, a wave under way included. A closed tab or one
 * sent to the background says so with `pagehide` or `visibilitychange`. Only a run under way is written: the board
 * behind the chooser or the towers step is a preview, and a lost run has
 * already been let go.
 */
function stash() {
  try {
    // The chooser and the towers step only show a preview behind them. The
    // mode outlives the veil, so it is the veil being up that counts.
    const choosing = veil.classList.contains("on") && (veilMode === "choose" || veilMode === "kit");
    if (!simulation || simulation.phase === "lost" || choosing) return;
    saveRun(simulation.snapshot());
  } catch (e) { /* not remembered, still playable */ }
}
window.addEventListener("pagehide", stash);
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") stash(); });

// ---- Overlay -------------------------------------------------------
let veilMode = "choose"; // choose | kit | paused | won | lost
let savedRun = null;
const veilRoutes = $("veilRoutes"), veilLevels = $("veilLevels");

// ---- Choosing a run's towers -----------------------------------------
// Its own step, after the route: the board slides aside and the rack comes up
// beside it. Towers are dragged into the slots they will answer to, or simply
// clicked, and whichever one is under the pointer turns on the table.
const kitStage = $("kitStage"), kitRack = $("kitRack"), kitAbout = $("kitAbout");
let kitBuilt = false, kitShown = null;
// The chips hold pictures, and a browser will happily start dragging a
// picture on its own and then open it when it is dropped, taking the whole
// page with it. Nothing on the stage is dragged, natively or otherwise.
kitStage.addEventListener("dragstart", (e) => e.preventDefault());

function buildRack() {
  kitRack.innerHTML = "";
  for (const kind of Object.keys(TOWERS)) {
    const spec = TOWERS[kind];
    const b = document.createElement("button");
    b.type = "button";
    b.dataset.kind = kind;
    // A kind the level does not sell stays on the rack, out of sight, so a
    // change of level can show it again without rebuilding the rack.
    b.style.display = allowed(kind) ? "" : "none";
    b.innerHTML = '<img alt="" draggable="false" src="' + scene.thumbnail(kind, 48) + '"><span>' + spec.name + "<small>" + spec.cost + " gold</small></span><kbd></kbd>";
    b.setAttribute("aria-pressed", "false");
    b.addEventListener("pointerenter", () => showTower(kind, false));
    b.addEventListener("focus", () => showTower(kind, false));
    b.addEventListener("click", () => toggleKit(kind));
    kitRack.appendChild(b);
  }
  scene.dropThumbnails();
  kitBuilt = true;
}

/** Add a tower to the run or take it back off, up to what is allowed. */
function toggleKit(kind) {
  const at = loadout.indexOf(kind);
  if (at >= 0) { loadout.splice(at, 1); play("sell"); }
  else if (loadout.length >= slots()) { play("denied"); return; }
  else { loadout.push(kind); play("click"); showTower(kind, true); }
  afterKit();
}

/** Everything that follows a change to the rack. */
function afterKit() {
  loadout = loadout.filter(Boolean);
  saveLoadout(loadout);
  markKit();
  buildShop();
  // The guide names the key that reaches each tower, so it is out of date now.
  towersBuilt = false;
}

// ---- Presets ---------------------------------------------------------
// Named racks. The built-in three come first and cannot be removed; the
// player's own are kept between runs. One is lit when the rack matches it.
const kitPresets = $("kitPresets"), saveForm = $("kitSaveForm"), saveName = $("kitSaveName");
let presets = loadPresets().filter((p) => !PRESETS.some((b) => b.name === p.name));

/** Every preset, built in and saved, trimmed to what this difficulty allows. */
const allPresets = () => [...PRESETS.map((p) => ({ ...p, builtin: true })), ...presets];
const sameRack = (a, b) => a.length === b.length && a.every((k) => b.includes(k));

function buildPresets() {
  kitPresets.innerHTML = '<span class="label" id="presetLabel">Preset</span>';
  const box = document.createElement("div");
  box.className = "select";
  box.id = "presetPick";
  const trigger = document.createElement("button");
  trigger.type = "button";
  trigger.className = "trigger";
  trigger.setAttribute("aria-haspopup", "listbox");
  trigger.setAttribute("aria-expanded", "false");
  trigger.setAttribute("aria-labelledby", "presetLabel presetValue");
  trigger.innerHTML = '<span id="presetValue"></span><i class="chev" aria-hidden="true"></i>';
  const menu = document.createElement("div");
  menu.className = "menu";
  menu.setAttribute("role", "listbox");
  menu.hidden = true;
  const options = allPresets().map((preset) => {
    const option = document.createElement("button");
    option.type = "button";
    option.setAttribute("role", "option");
    option.dataset.preset = preset.name;
    option.title = preset.kinds.map((k) => (TOWERS[k] ? TOWERS[k].name : k)).join(", ");
    option.innerHTML = "<span>" + preset.name + "</span>" + (preset.builtin ? "" : '<i title="Remove this preset" aria-label="Remove this preset">\u00d7</i>');
    option.addEventListener("click", (e) => {
      // The cross removes a saved preset rather than loading it.
      if (e.target.tagName === "I") { closePresetMenu(false); removePreset(preset.name); return; }
      applyPreset(preset);
      closePresetMenu(true);
    });
    menu.appendChild(option);
    return option;
  });
  trigger.addEventListener("click", () => { if (menu.hidden) openPresetMenu(); else closePresetMenu(true); });
  trigger.addEventListener("keydown", (e) => {
    if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) { e.preventDefault(); e.stopPropagation(); openPresetMenu(); }
  });
  // The page watches for keys of its own, so the menu keeps its to itself.
  menu.addEventListener("keydown", (e) => {
    const at = options.indexOf(document.activeElement);
    if (e.key === "ArrowDown") { e.preventDefault(); e.stopPropagation(); options[Math.min(options.length - 1, at + 1)].focus(); }
    else if (e.key === "ArrowUp") { e.preventDefault(); e.stopPropagation(); options[Math.max(0, at - 1)].focus(); }
    else if (e.key === "Home") { e.preventDefault(); e.stopPropagation(); options[0].focus(); }
    else if (e.key === "End") { e.preventDefault(); e.stopPropagation(); options[options.length - 1].focus(); }
    else if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); closePresetMenu(true); }
    else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); if (at >= 0) options[at].click(); }
  });
  box.append(trigger, menu);
  kitPresets.appendChild(box);
  const more = document.createElement("button");
  more.type = "button";
  more.className = "btn btn-secondary saveas-btn";
  more.textContent = "Save as\u2026";
  more.title = "Keep this rack under a name";
  more.addEventListener("click", () => { closePresetMenu(false); saveForm.hidden = false; saveName.value = ""; saveName.focus(); });
  kitPresets.appendChild(more);
  markPresets();
}
/** The dropdown names whichever preset the rack matches, or says it is its own. */
function markPresets() {
  const box = $("presetPick");
  if (!box) return;
  const match = allPresets().find((p) => sameRack(loadout, p.kinds.filter((k) => TOWERS[k] && allowed(k)).slice(0, slots())));
  box.querySelector("#presetValue").textContent = match ? match.name : "Custom";
  for (const option of box.querySelectorAll('[role="option"]')) {
    option.setAttribute("aria-selected", String(!!match && option.dataset.preset === match.name));
  }
}
function openPresetMenu() {
  const box = $("presetPick");
  if (!box) return;
  box.dataset.open = "true";
  box.querySelector(".menu").hidden = false;
  box.querySelector(".trigger").setAttribute("aria-expanded", "true");
  (box.querySelector('[aria-selected="true"]') || box.querySelector('[role="option"]')).focus();
}
function closePresetMenu(toTrigger) {
  const box = $("presetPick");
  if (!box || !box.dataset.open) return;
  delete box.dataset.open;
  box.querySelector(".menu").hidden = true;
  const trigger = box.querySelector(".trigger");
  trigger.setAttribute("aria-expanded", "false");
  if (toTrigger) trigger.focus();
}
// A press anywhere else puts the menu away.
document.addEventListener("pointerdown", (e) => {
  const box = $("presetPick");
  if (box && box.dataset.open && !box.contains(e.target)) closePresetMenu(false);
});
/** Load a preset: what it names, trimmed to the allowance, becomes the rack. */
function applyPreset(preset) {
  loadout = preset.kinds.filter((k) => TOWERS[k] && allowed(k)).slice(0, slots());
  play("click");
  if (loadout[0]) showTower(loadout[0], true);
  afterKit();
}
/** Keep the rack as it stands under a name; the same name again replaces it. */
function savePresetAs(name) {
  name = name.trim().slice(0, 24);
  if (!name || !loadout.length) return;
  if (PRESETS.some((b) => b.name.toLowerCase() === name.toLowerCase())) { play("denied"); saveName.select(); return; }
  const kinds = loadout.slice();
  const at = presets.findIndex((p) => p.name.toLowerCase() === name.toLowerCase());
  if (at >= 0) presets[at] = { name, kinds }; else presets.push({ name, kinds });
  savePresets(presets);
  saveForm.hidden = true;
  play("place");
  closePresetMenu(false);
  buildPresets();
}
async function removePreset(name) {
  if (!(await ask("Remove this preset?", "\u201c" + name + "\u201d will be gone for good. The rack as it stands is untouched.", "Remove", "Keep it"))) return;
  presets = presets.filter((p) => p.name !== name);
  savePresets(presets);
  play("sell");
  buildPresets();
}
saveForm.addEventListener("submit", (e) => { e.preventDefault(); savePresetAs(saveName.value); });
$("kitSaveNo").addEventListener("click", () => { saveForm.hidden = true; });
// The page watches for keys of its own; typing a name keeps them to itself.
saveName.addEventListener("keydown", (e) => { e.stopPropagation(); if (e.key === "Escape") { e.preventDefault(); saveForm.hidden = true; } });

/** Mark the rack: which are coming and on which key, and whether the run can start. */
function markKit() {
  markPresets();
  for (const b of kitRack.querySelectorAll("button[data-kind]")) {
    const at = loadout.indexOf(b.dataset.kind);
    b.setAttribute("aria-pressed", String(at >= 0));
    // A chosen tower wears the number key that will reach it in the shop.
    b.querySelector("kbd").textContent = at >= 0 ? String((at + 1) % 10) : "";
    // No tooltip: hovering already puts the whole tower up beside the rack,
    // and a browser one arrives late and covers the row under it.
    b.removeAttribute("title");
    b.setAttribute("aria-label", TOWERS[b.dataset.kind].name + (at >= 0 ? " on key " + ((at + 1) % 10) : ""));
  }
  const note = $("kitNote");
  const short = slots() - loadout.length;
  if (note) {
    note.innerHTML = "<b>" + loadout.length + " of " + slots() + "</b> chosen on " + DIFFICULTIES[difficulty].name.toLowerCase()
      + (short > 0 ? " &middot; room for " + short + " more" : " &middot; full")
      + '<span class="how">Click a tower to bring it, and again to leave it behind. Its number is the key that reaches it. Leaving slots empty is allowed, and harder.</span>';
  }
  // Going in short-handed is a way to play, not a mistake: only an empty kit
  // is refused, since there would be nothing to build with.
  $("kitGo").disabled = !loadout.length;
}

/** Show a tower on the table beside the rack. Sticky ones survive un-hovering. */
function showTower(kind, sticky) {
  if (sticky) kitShown = kind;
  const spec = TOWERS[kind];
  scene.showcase($("kitCanvas"));
  scene.showcaseSet(kind);
  if (!spec) { kitAbout.innerHTML = ""; return; }
  const nums = statLines(spec.base).filter(([l]) => l !== "Hidden").map(([l, v]) => "<span>" + l + " <i>" + v + "</i></span>").join("");
  const paths = spec.paths.map((path) => "<span><i>" + path.name + "</i>" + path.upgrades.map((u) => u.name).join(", ") + "</span>").join("");
  kitAbout.innerHTML = '<div class="head"><b>' + spec.name + "</b><em>" + spec.cost + " gold</em></div>" +
    '<div class="nums">' + nums + "</div>" +
    "<p>" + spec.blurb + "</p>" +
    '<div class="paths">' + paths + "</div>";
}
// Leaving the panel puts back whichever tower was last settled on.
kitStage.addEventListener("pointerleave", () => { if (kitShown) showTower(kitShown, false); });

/** Open the towers step: the board slides aside and the rack comes up. */
/**
 * How far to slide the board left while the picker is up: a fifth of the way
 * into the band the picker leaves on the left, which shows some of the route
 * without dragging its far edge off the screen and leaving the whole screen
 * looking bunched to the left. Measured off the picker where it has actually
 * landed, so the two agree however the layout works out.
 */
function kitSlide() {
  if (window.innerWidth <= 900) return 0; // the picker is centred down there
  return Math.round(Math.max(0, kitStage.offsetLeft) * 0.2);
}
/**
 * Where there is room left of the picker, the board is shrunk into it and the
 * whole route shows beside the picker, with nothing to hover for. Where there
 * is not, it only slides a little and looking at it leans the picker aside.
 */
let kitBoardFits = false;
function placeKitBoard() {
  const w = window.innerWidth, edge = kitStage.offsetLeft - 24;
  kitBoardFits = w > 900 && edge >= 360;
  if (!kitBoardFits) { scene.panTo(kitSlide(), 1); return; }
  setPeek(false);
  scene.frameIn(24, edge);
}
/**
 * Looking at the board beside the picker leans the picker out of the way, so
 * most of the route can be read without leaving the step; looking back at it
 * puts it where it was. It steps aside by half its own width and no further,
 * and the board does not move with it: one thing shifting a little says the
 * same as two things shifting a long way, without the lurch.
 *
 * The line it turns on is the picker's own left edge, but once the picker is
 * out of the way the line moves out to the last third of the window, so the
 * board can be swept over without having to chase the picker into the corner
 * to bring it back.
 */
let peeking = false;
function peekShift() {
  return Math.round(Math.min(kitStage.offsetWidth * 0.5, Math.max(0, window.innerWidth - 56 - kitStage.offsetLeft)));
}
function setPeek(on) {
  if (peeking === on) return;
  peeking = on;
  if (on) kitStage.style.setProperty("--peek", peekShift() + "px");
  veil.classList.toggle("peeking", on);
}
veil.addEventListener("pointermove", (e) => {
  if (veilMode !== "kit" || window.innerWidth <= 900 || kitBoardFits) return;
  setPeek(e.clientX < (peeking ? window.innerWidth * 0.62 : kitStage.offsetLeft));
});
veil.addEventListener("pointerleave", () => setPeek(false));

function openKit() {
  // The sandbox brings every tower, so there is nothing to choose.
  if (sandbox) { newRun(mapIndex); return; }
  if (!kitBuilt) { buildRack(); buildPresets(); }
  saveForm.hidden = true;
  showVeil("kit", "Choose your towers", "", null, null);
  markKit();
  showTower(kitShown || loadout[0] || Object.keys(TOWERS)[0], true);
  // Asked for after the rack and the table are built; the board starts moving
  // on the first frame drawn after that, so it does not spend the beginning of
  // the move behind the work of building them.
  placeKitBoard();
  // The board stays where it is, full size, behind the wash; the picker
  // comes in from the right and sits in front of it.
  play("click");
}
$("kitBack").addEventListener("click", () => { chooseRoute(true); pickRoute(mapIndex); });
$("kitGo").addEventListener("click", () => { if (!loadout.length) return; newRun(mapIndex); });

/** Nothing moves on to the towers until a route is settled on. */
function refreshStart() {
  if (veilMode === "kit") { $("kitGo").disabled = !loadout.length; return; }
  if (veilMode !== "choose") return;
  veilBtn.disabled = chosen < 0 || (sandbox && !beaten(MAPS[chosen], difficulty));
}
function showVeil(mode, title, text, main, alt) {
  veilMode = mode;
  // Only a loss has something through the door to show.
  if (mode !== "lost") { veilThrough.hidden = true; veilThrough.innerHTML = ""; }
  // Changes is the menu's, not a run's: the chooser has it and nothing else does.
  menuCorner.hidden = mode !== "choose";
  dismissNotes();
  veilTitle.textContent = title;
  veilText.textContent = text;
  veilBtn.textContent = main || "";
  veilBtn.hidden = !main;
  veilBtn.disabled = mode === "choose";
  veilAlt.hidden = !alt;
  if (alt) veilAlt.textContent = alt;
  veil.classList.toggle("intro", mode === "choose" || mode === "paused");
  // The HUD only appears once a run is under way.
  if (mode === "choose" || mode === "kit") { for (const el of hudParts) el.hidden = true; detail.hidden = true; pop.hidden = true; epop.hidden = true; towersBuilt = false; }
  closeAsk(false);
  veil.classList.toggle("peek", mode === "choose" || mode === "kit");
  veil.classList.toggle("kitstep", mode === "kit");
  veilRoutes.hidden = veilLevels.hidden = mode !== "choose";
  kitStage.hidden = mode !== "kit";
  if (mode !== "kit") { scene.showcaseSet(null); scene.panTo(0, 1); peeking = false; veil.classList.remove("peeking"); }
  veil.classList.toggle("choosing", mode === "choose");
  if (mode === "choose") {
    veilRoutes.innerHTML = "";
    MAPS.forEach((m, i) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "route";
      b.setAttribute("aria-pressed", "false");
      b.innerHTML = "<b>" + m.name + "</b><span>" + m.note + "</span><small></small>";
      // Hovering shows the route behind the overlay; clicking settles on it.
      b.addEventListener("pointerenter", () => preview(i));
      b.addEventListener("focus", () => preview(i));
      b.addEventListener("click", () => { preview(i); pickRoute(i); });
      veilRoutes.appendChild(b);
    });
    // Leaving the routes falls back to whichever one has been settled on, and
    // to an empty board when none has.
    veilRoutes.onpointerleave = () => { if (chosen >= 0) preview(chosen); };
    veilRoutes.onfocusout = (e) => { if (!veilRoutes.contains(e.relatedTarget) && chosen >= 0) preview(chosen); };
    // Difficulty: one button each, the sandbox switch beside them, and what
    // the choice means under them.
    veilLevels.innerHTML = '<span class="label" id="levelLabel">Difficulty</span><div class="levelrow"><div class="seg" id="levelPick" role="radiogroup" aria-labelledby="levelLabel"></div><button class="btn btn-secondary sandboxswitch" id="sandboxSwitch" type="button" aria-pressed="false" aria-label="Sandbox" title="Sandbox: free to build, nothing lost, any wave"><svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 14.5 5 10.5h14l2.5 4v5h-19Z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M2.5 14.5h19" stroke="currentColor" stroke-width="1.7"/><path d="M6 14.5c1.2-2.2 2.6-3.2 4.2-3.2s2.8 1 3.8 3.2" fill="currentColor"/><path d="M17 3.5v7" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><path d="M15.3 10.2h3.4l-.5 2.6a1.2 1.2 0 0 1-2.4 0Z" fill="currentColor"/></svg></button></div><p class="levelnote" id="levelNote"></p>';
    $("sandboxSwitch").addEventListener("click", () => {
      if (!sandbox && !sandboxOpen(difficulty)) { play("denied"); return; }
      sandbox = !sandbox;
      try { localStorage.setItem("td.sandbox", sandbox ? "1" : "0"); } catch {}
      pickLevel(difficulty);
      play("click");
    });
    for (const key of Object.keys(DIFFICULTIES)) {
      const option = document.createElement("button");
      option.type = "button";
      option.setAttribute("role", "radio");
      option.dataset.key = key;
      option.textContent = DIFFICULTIES[key].name;
      option.addEventListener("click", () => { pickLevel(key); play("click"); });
      $("levelPick").appendChild(option);
    }
    pickLevel(difficulty);
  }
  veil.classList.add("on");
}
/** Settle on a difficulty: mark the choice, refresh each route's best for it, and preview at it. */
function pickLevel(key) {
  if (key !== difficulty) forgetBook();
  difficulty = key;
  try { localStorage.setItem("td.difficulty", key); } catch {}
  // The rack shows what this level sells: Ruin has no mint to offer.
  for (const b of document.querySelectorAll("#kitRack button[data-kind]")) b.style.display = allowed(b.dataset.kind) ? "" : "none";
  // Moving to a difficulty the sandbox has not been earned at puts it away.
  const open = sandboxOpen(key);
  if (sandbox && !open) {
    sandbox = false;
    try { localStorage.setItem("td.sandbox", "0"); } catch {}
  }
  const box = $("levelPick");
  if (box) {
    for (const option of box.querySelectorAll('[role="radio"]')) option.setAttribute("aria-checked", String(option.dataset.key === key));
    const swtch = $("sandboxSwitch");
    swtch.setAttribute("aria-pressed", String(sandbox));
    swtch.disabled = !open;
    swtch.title = open
      ? "Sandbox: free to build, nothing lost, any wave"
      : "Sandbox: carry a route through all " + CAMPAIGN_WAVES + " waves on " + DIFFICULTIES[key].name.toLowerCase() + " to open it";
    // The note says what the difficulty is, and nothing about the switch beside
    // it: what the sandbox wants is on the switch itself.
    $("levelNote").textContent = DIFFICULTIES[key].note + "." + (sandbox ? " " + SANDBOX_NOTE + "." : "");
  }
  Array.prototype.forEach.call(veilRoutes.children, (b, i) => {
    const best = readBest(bestKey(MAPS[i], key));
    const held = beaten(MAPS[i], key);
    // In the sandbox only the routes already carried at this difficulty are open.
    b.disabled = sandbox && !held;
    b.querySelector("small").textContent = sandbox
      ? (held ? "Anything goes" : "Hold it here first")
      : best ? "Best " + best + " waves" : "Not yet played";
  });
  // A route settled on before the sandbox went on may no longer be open.
  if (sandbox && chosen >= 0 && !beaten(MAPS[chosen], key)) {
    chosen = -1;
    Array.prototype.forEach.call(veilRoutes.children, (b) => b.setAttribute("aria-pressed", "false"));
  }
  refreshStart();
  if (simulation && !simulation.towers.length && simulation.wave === 0 && (simulation.difficulty !== key || simulation.sandbox !== sandbox)) { simulation = new Simulation(simulation.map, key, sandbox); scene.draw(simulation, view); }
  // A harder run brings fewer towers, so anything over the new allowance is
  // put back on the rack, off the end of the list; and a kind the level does
  // not sell goes back whatever its place.
  if (loadout.length > slots() || loadout.some((k) => !allowed(k))) {
    loadout = loadout.filter(allowed).slice(0, slots());
    saveLoadout(loadout);
    buildShop();
    towersBuilt = false;
  }
  if (veilMode === "kit") markKit();
}
/** Which route is on the board: an index, -1 for none, null before either. */
let previewing = null;
/** How long the routes have to be left alone before the board comes back up, in ms. */
const PREVIEW_SETTLE = 260;
let settleTimer = 0, askedAt = 0;
/** The route the player has settled on while the chooser is up, or -1. */
let chosen = -1;
/** The facts of a route for the card beside the chooser, or nothing for none. */
function showRouteCard(i) {
  const card = $("routeCard");
  const map = MAPS[i];
  if (!map) { card.innerHTML = ""; return; }
  const routes = routesOf(map);
  const ends = (pick) => new Set(routes.map((wp) => String(pick(wp)))).size;
  const road = routeCells(map).size;
  const stat = (label, value) => "<div><dt>" + label + "</dt><dd>" + value + "</dd></div>";
  const bests = ["easy", "normal", "hard"].map((key) => {
    const best = readBest(bestKey(map, key));
    return '<span class="' + (best ? "held" : "") + '">' + DIFFICULTIES[key].name + "<b>" + (best ? best : "—") + "</b></span>";
  }).join("");
  card.innerHTML =
    '<div class="nav"><button class="btn btn-secondary step" type="button" data-step="-1" aria-label="Previous route"><svg class="ico" viewBox="0 0 16 16" aria-hidden="true"><path d="M10 3 5 8l5 5" fill="none" stroke="currentColor" stroke-width="2"/></svg></button>' +
    "<h6>Route " + (i + 1) + " of " + MAPS.length + "</h6>" +
    '<button class="btn btn-secondary step" type="button" data-step="1" aria-label="Next route"><svg class="ico" viewBox="0 0 16 16" aria-hidden="true"><path d="m6 3 5 5-5 5" fill="none" stroke="currentColor" stroke-width="2"/></svg></button></div>' +
    "<h3>" + map.name + "</h3>" +
    "<p>" + map.note + ".</p>" +
    "<dl>" +
    stat("Board", map.cols + " × " + map.rows) +
    stat("Road", road + " cells") +
    stat("Ways in", ends((wp) => wp[0])) +
    stat("Ways out", ends((wp) => wp[wp.length - 1])) +
    stat("Build spots", map.cols * map.rows - road) +
    stat("In the way", propsFor(map).size) +
    "</dl>" +
    '<div class="bests">' + bests + "</div>" +
    '<div class="dots">' + MAPS.map((m, k) => '<button type="button" data-route="' + k + '" aria-label="Route ' + (k + 1) + ": " + m.name + '" aria-current="' + (k === i) + '"></button>').join("") + "</div>" +
    '<div class="dotname" aria-hidden="true">' + (pointedDot >= 0 ? "Route " + (pointedDot + 1) + " · " + MAPS[pointedDot].name : "") + "</div>";
}
/** Step the card to a route, which picks it too. */
function showRoute(i) {
  const n = MAPS.length, at = ((i % n) + n) % n;
  preview(at);
  pickRoute(at);
}
// Pointing at a dot names its route under the row, before it is clicked,
// and the name stays through the click, which rebuilds the card.
let pointedDot = -1;
$("routeCard").addEventListener("pointerover", (e) => {
  const dot = e.target.closest("[data-route]"), label = $("routeCard").querySelector(".dotname");
  pointedDot = dot ? Number(dot.dataset.route) : -1;
  if (label) label.textContent = pointedDot >= 0 ? "Route " + (pointedDot + 1) + " · " + MAPS[pointedDot].name : "";
});
$("routeCard").addEventListener("pointerleave", () => { pointedDot = -1; const label = $("routeCard").querySelector(".dotname"); if (label) label.textContent = ""; });
// The card is rebuilt for every route, so its buttons are answered here once.
$("routeCard").addEventListener("click", (e) => {
  const step = e.target.closest("[data-step]"), dot = e.target.closest("[data-route]");
  if (step) { showRoute((chosen >= 0 ? chosen : previewing || 0) + Number(step.dataset.step)); play("click"); }
  else if (dot) { showRoute(Number(dot.dataset.route)); play("click"); }
});
function preview(i) {
  if (previewing === i) return;
  previewing = i;
  showRouteCard(i);
  // Every route is shown from the same angle at its own fitted distance, so
  // the board the player left behind cannot carry its zoom into the chooser.
  scene.lock(true);
  // Nothing to show: sink the board and leave it down.
  clearTimeout(settleTimer);
  if (i < 0) { scene.dropOut(() => scene.hideBoard()); return; }
  // Sink the current board, and rise again with the route asked for once the
  // asking has stopped: flicking through routes keeps the board down rather
  // than bobbing it up and down for every one passed over.
  askedAt = performance.now();
  const settle = () => {
    if (previewing !== i) return;
    const wait = PREVIEW_SETTLE - (performance.now() - askedAt);
    if (wait > 0) { clearTimeout(settleTimer); settleTimer = setTimeout(settle, wait); return; }
    rise();
  };
  const rise = () => {
    simulation = new Simulation(MAPS[i], difficulty, sandbox);
    view = { hover: null, placing: null, selected: null, watching: null, flashes: [], arcs: [] };
    scene.draw(simulation, view);
    // The same route as the run just left is not rebuilt, so it would keep
    // however far that run had turned or zoomed.
    scene.frame();
    // Every route is its own shape, so it is fitted beside the chooser afresh.
    if (veilMode === "choose") placeChooser();
    if (veilMode === "kit") placeKitBoard();
    scene.dropIn();
  };
  scene.dropOut(settle);
}
function pickRoute(i) {
  if (sandbox && !beaten(MAPS[i], difficulty)) return;
  chosen = i;
  mapIndex = i;
  Array.prototype.forEach.call(veilRoutes.children, (b, k) => b.setAttribute("aria-pressed", String(k === i)));
  refreshStart();
}
/**
 * Back to the route chooser. The board sinks and is left down, unless
 * `keepBoard` says it already shows the route the chooser is returning to,
 * which is how coming back from the picker works: the route has not changed,
 * so dropping it out and back in again would be a lot of movement for
 * nothing. It only slides back across.
 */
/**
 * With the routes in a panel down the left, the board previews beside it:
 * slid over to the middle of what is left and shrunk to fit there. A narrow
 * window keeps the routes centred over the board instead.
 */
function placeChooser() {
  const w = window.innerWidth;
  if (w <= 900) { scene.panTo(0, 1); return; }
  const left = $("chooser").getBoundingClientRect().right + 24;
  scene.frameIn(left, w - 24);
}
function chooseRoute(keepBoard) {
  chosen = -1;
  // Whatever run was saved has been given up by the time the chooser is back,
  // and the board behind it is only a preview, so the save goes with it.
  clearRun();
  // Nothing from the last run is still selected behind the chooser.
  view.selected = null;
  view.watching = null;
  view.placing = null;
  showVeil("choose", "Choose a route", "Each wave follows the roads from their entrances to their exits. Allocate a limited budget between towers, their upgrades and the clearing of ground, so that nothing reaches an exit.", "Next", null);
  placeChooser();
  if (keepBoard) return;
  // The route just played is already picked, so another run on it is one
  // press away; with nothing played yet the board stays down and waits.
  if (lastPlayed >= 0 && MAPS[lastPlayed]) { pickRoute(lastPlayed); preview(lastPlayed); }
  else { pickRoute(0); preview(0); } // nothing played yet: the first route, so the board is never empty and Next is ready
}
veilBtn.addEventListener("click", () => {
  if (veilMode === "choose") openKit();
  else if (veilMode === "paused") resume();
  else chooseRoute();
  veilBtn.blur();
});
veilAlt.addEventListener("click", async () => {
  if (veilMode === "won") { simulation.goEndless(); begin(); }
  // Leaving a run asks first, a saved one brought back under the pause menu included.
  else if (veilMode === "paused") { if (!simulation.towers.length || await confirmSwitch()) chooseRoute(); }
  veilAlt.blur();
});
window.addEventListener("beforeunload", stash);

// ---- Loop ----------------------------------------------------------
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000 || 0);
  last = now;
  if (simulation) {
    if (!paused) {
      const wasWave = simulation.phase === "wave";
      for (let k = 0; k < speed; k++) simulation.update(dt);
      drain();
      for (const f of view.flashes) f.life -= dt * 3 * speed;
      view.flashes = view.flashes.filter((f) => f.life > 0);
      for (const a of view.arcs) a.life -= dt * 2.6 * speed;
      view.arcs = view.arcs.filter((a) => a.life > 0);
      if (wasWave || simulation.phase === "wave") update();
      // The countdown to an automatic start.
      if (autoTimer > 0 && simulation.phase === "build" && !veil.classList.contains("on")) {
        const was = Math.ceil(autoTimer);
        autoTimer -= dt;
        // A wave counted in lands on "go", which is what the ticks were for; one
        // started by hand keeps the plain cue, having been asked for.
        if (autoTimer <= 0) { autoTimer = 0; if (simulation.startWave()) { play("go"); update(); } }
        // Nothing paints between waves, so a second going by asks for it, and
        // says so: one tick a second, down to the wave itself.
        else if (Math.ceil(autoTimer) !== was) { play("tick"); update(); }
      }
    }
    // Panning eases in and out, so it runs every frame: a glide carries on
    // for a moment after the keys are let go.
    if (veil.classList.contains("on") || !bookPanel.hidden || !changePanel.hidden || !askPanel.hidden) panHeld.clear();
    let right = 0, up = 0;
    for (const key of panHeld) { right += PAN_KEYS[key][0]; up += PAN_KEYS[key][1]; }
    scene.steer(right * 1.4, up * 1.4, dt);
    scene.draw(simulation, view, paused ? 0 : speed);
    // The turntable on the towers step turns under its own steam.
    if (veilMode === "kit") scene.drawShowcase(dt);
    placePop();
    const live = !paused && simulation.phase === "wave";
    const beams = (kind) => (live ? simulation.towers.filter((t) => t.kind === kind && t.beams).reduce((a, t) => a + t.beams.length, 0) : 0);
    setLoops({ prism: beams("prism"), flame: live ? simulation.towers.filter((t) => t.flame).length : 0 });
  }
  requestAnimationFrame(frame);
}

// ---- Start ---------------------------------------------------------
scene.fit();
savedRun = loadRun();
// A run saved on a route that has since been redrawn or retired has nowhere to resume.
if (savedRun && !MAPS.some((m) => m.id === savedRun.map)) { clearRun(); savedRun = null; }
// Nothing built and no wave begun is no run worth coming back to.
if (savedRun && !savedRun.towers.length && !(savedRun.wave > 0)) savedRun = null;
let restored = null;
// A save that cannot be read at all is dropped for the chooser rather than left to stop the page.
try { restored = savedRun && Simulation.restore(MAPS.find((m) => m.id === savedRun.map), savedRun); } catch (e) { clearRun(); restored = null; }
if (restored) {
  // A saved run comes back just as the pause menu left it: the board as it
  // stood, wave and all, held still until Resume.
  resumeRun(restored);
  if (simulation.phase === "won") showVeil("won", "Road held", "All " + CAMPAIGN_WAVES + " waves stopped with " + simulation.lives + " lives left. Keep going into endless waves, or start a new run.", "New run", "Keep going");
  else togglePause();
} else {
  simulation = new Simulation(MAPS[0], difficulty, sandbox);
  mapIndex = 0;
  chooseRoute();
}
update();
scene.draw(simulation, view);
requestAnimationFrame(frame);
