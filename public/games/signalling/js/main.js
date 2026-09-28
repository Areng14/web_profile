// The interface: the zone on screen, route setting by pointing, the menus,
// interposing, the timetable, train and alarm panels, the clock, and the
// start and end of a shift. Everything that decides what a click means is
// here; everything that decides whether it is allowed is in model.js.

import { ZONES } from "./layouts.js";
import { compile, Simulation, MARKS_ALLOWED, ON_TIME, wholeMinutes, PHONE_WORDS, hhmm, clock, placeName, exitName, tcName, standsAt, workedPast } from "./model.js";
import { KINDS, LEVELS, OPERATORS, SERVICES, TRAINING, CLOCK_INS, DEPOTS, CALLS, LIMP, FALSE_CALL, isDepotRoad, foldJourney, planFor, shiftAt, shiftName, dayName, forecastFor } from "./schedule.js";
import { Tutor, actWords, actSpot } from "./tutor.js";
import { KEYS, PHONE_KEYS, keyFor, keyLabel, leftToControl } from "./keys.js";
import { Screen } from "./view.js";
import { NetworkMap, SCHOOL } from "./map.js";
import * as store from "./storage.js";
import * as sound from "./sound.js";

const $ = (id) => document.getElementById(id);
const net = compile();

/** Which places the timetable panel lists for each zone. */
const PLACES_IN = { WS: ["BD", "WS"], WH: ["TF", "WH"], RS: ["LV", "RS", "SE"], CT: ["CT", "BR"], LF: ["LF", "PK", "AP", "AC", "CA"], ER: ["ER", "ES", "RG"], TH: ["TH", "DL"], CL: ["OO", "TM", "CD", "CL"], SC: ["WI", "MB", "SR"] };

let sim = null;
let level = "mixed";
let desk = "CT";
let entrance = null;
let picked = null;
/** The train whose timetable is up over the board, from a click on its headcode, or null. */
let popped = null;
let pane = "timetable";
let lastPanels = 0;
let lastSave = 0;
/** The number of the newest of the desk's alarms already chimed for: a new one is numbered past it. */
let alarmsSeen = 0;
/** The trains on the desk when the last frame looked, for the ding when one comes on; null until a shift's first frame has looked. */
let onDesk = null;
let shownResults = false;
let interposing = null;
let mapOpen = false;
/** The lesson, while the training desk is being worked; null on a real shift. */
let tutor = null;
/** What the lesson bar shows, as last drawn, so a frame that changes nothing touches nothing. */
let lessonDrawn = "";
/** The step just done, shown with its tick until `until`, before the next comes up. */
let lessonBeat = null;
/** The clock as the lesson last put it, "hold" or "run", and the pace the pupil last ran it at. */
let lessonClock = null;
let lessonPace = 1;
/** What the lesson last pointed at, so the board is brought round to it once, not every frame. */
let lessonSpotted = null;
/** What the lesson bar says after a refusal, and until when. */
let lessonHint = "";
let lessonHintUntil = 0;
/** The timer that stops the board pointing at what an alarm is about. */
let pointing = null;
/** The railway the alarm rows on the page were drawn for, whose alarms their buttons change. */
let alarmsFor = null;

const screen = new Screen(net, $("display"), {
  signal: onSignal,
  point: onPoint,
  berth: onBerth,
  exit: onExit,
  track: onTrack,
  lc: onCrossing,
  clear: clearSelection,
  describe: (t) => describe(t),
  moved: putCardAway,
});
screen.overview($("overview"));
/** The railway's own diagram, drawn the first time it is asked for. */
const map = new NetworkMap(net, $("networkPic"));
/** The school's own diagram, for the training desk. */
const school = new NetworkMap(net, $("schoolPic"), SCHOOL);
/** The diagram the desk being worked is on. */
function diagram() {
  return sim?.training ? school : map;
}

/* ---- Saying things ------------------------------------------------------ */

/** Put a message in the Last box; an alarm's reporter takes the box's heading, with what they said under it. */
function say(text, ok = true, from = null) {
  const box = $("say");
  box.textContent = text;
  box.classList.toggle("bad", !ok);
  $("sayFrom").textContent = from ?? "Last";
}

function tell(result) {
  say(result.text, result.ok);
  sound.play(result.ok ? "set" : "refuse");
  return result.ok;
}

/**
 * Where a train runs from and to, as its timetable says it: the places, and
 * a depot's short name for its road at the same place as the other end, so
 * a move into the siding reads "Chattanooga – siding" and fits the column.
 */
function journey(first, last) {
  const end = (e) => (isDepotRoad(e.at, e.plat) && first.at === last.at ? DEPOTS[e.at].short : placeName(e.at));
  return `${end(first)} – ${end(last)}`;
}

/* ---- The start of a shift ------------------------------------------------ */

/**
 * The desk picker on the start screen: each zone drawn the way its own
 * screen draws it, small, with its name and a line about it. One is chosen
 * for the whole shift.
 */
function buildZonePick() {
  const host = $("zonePick");
  host.textContent = "";
  for (const z of ZONES) {
    if (z.training) continue;
    const b = document.createElement("button");
    b.type = "button";
    b.className = "deskCard";
    b.setAttribute("role", "radio");
    b.dataset.zone = z.id;
    b.setAttribute("aria-checked", String(z.id === desk));
    const preview = document.createElement("div");
    preview.className = "deskPreview";
    b.appendChild(preview);
    const name = document.createElement("div");
    name.className = "deskName";
    name.textContent = z.name;
    b.appendChild(name);
    const note = document.createElement("div");
    note.className = "deskNote";
    note.textContent = z.note;
    // The whole note again for a hover, for a screen short enough to cut it.
    b.dataset.full = z.note;
    b.appendChild(note);
    b.addEventListener("click", () => {
      desk = z.id;
      for (const o of host.querySelectorAll("button")) o.setAttribute("aria-checked", String(o === b));
      bestNote();
    });
    host.appendChild(b);
    // The same renderer as the desk, with nobody's hands on it.
    const small = new Screen(net, preview, {});
    small.show(z.id);
    small.svg.classList.add("preview");
    small.svg.setAttribute("aria-label", `${z.name}, drawn small`);
  }
}

/** The three conditions along the bottom of the start screen. */
function buildLevels() {
  const host = $("levels");
  host.textContent = "";
  for (const [key, shape] of Object.entries(LEVELS)) {
    const b = document.createElement("button");
    b.type = "button";
    b.setAttribute("role", "radio");
    b.dataset.level = key;
    b.setAttribute("aria-checked", String(key === level));
    const name = document.createElement("b");
    name.textContent = shape.name;
    const note = document.createElement("span");
    note.textContent = shape.note;
    b.dataset.full = shape.note;
    b.appendChild(name);
    b.appendChild(note);
    b.addEventListener("click", () => {
      level = key;
      for (const o of host.querySelectorAll("button")) o.setAttribute("aria-checked", String(o === b));
      forecast();
    });
    host.appendChild(b);
  }
}

/** The best shift finished on the desk picked, in whatever conditions it was set. */
function bestNote() {
  const best = store.readBest(desk);
  const name = ZONES.find((z) => z.id === desk)?.name ?? desk;
  const set = best && LEVELS[best.level] ? ` (${LEVELS[best.level].name.toLowerCase()}${best.start ? `, in at ${best.start}` : ""})` : "";
  $("best").textContent = best ? `Best at ${name}: ${best.ppm}% on time, ${best.points} points${set}.` : `You have not worked a shift at ${name} yet.`;
}

/** The times a shift can start, in the picker on the start screen. */
function buildClockIns() {
  const pick = $("clockIn");
  for (const t of CLOCK_INS) {
    const o = document.createElement("option");
    o.value = t;
    o.textContent = t;
    pick.appendChild(o);
  }
  pick.addEventListener("change", shiftPreview);
}

/**
 * The number the shift is rolled from, never shown: the day, and everything
 * that goes wrong. A fresh one each time the start screen opens.
 */
let rolled = 1;

function openStart() {
  // A fresh shift each time the start screen opens: a new number behind it,
  // and a time to clock in picked at random, which the signaller can change.
  rolled = 1 + Math.floor(Math.random() * 9999);
  $("clockIn").value = CLOCK_INS[Math.floor(Math.random() * CLOCK_INS.length)];
  const saved = store.loadRun();
  const resumable = saved && !saved.finished;
  $("resumeBtn").hidden = !resumable;
  $("startBtn").textContent = resumable ? "Start a new shift" : "Start the shift";
  // A resumed shift sets the desk and the conditions from the save, so the
  // cards are put back in step with what the next shift will run.
  for (const b of $("zonePick").querySelectorAll("button")) b.setAttribute("aria-checked", String(b.dataset.zone === desk));
  for (const b of $("levels").querySelectorAll("button")) b.setAttribute("aria-checked", String(b.dataset.level === level));
  shiftPreview();
  bestNote();
  $("veil").hidden = false;
}

/** The shift on the start screen: the time picked to clock in, on the day rolled for it. */
function pickedShift() {
  return shiftAt($("clockIn").value || CLOCK_INS[0], rolled);
}

/** Which two hours of the day the shift is, and how many trains they hold. */
function shiftPreview() {
  const shift = pickedShift();
  $("veilTitle").textContent = `${shiftName(shift)} shift, ${shift.start} to ${shift.end}`;
  $("veilText").textContent = `Eight zones of Chattanooga's railway, ${planFor(SERVICES, shift).length} trains in two hours. Pick a desk; it is yours until the shift ends.`;
  forecast();
}

/** The shift's day and what the weather will do, as far as a forecast says: it changes with the time picked and with the conditions. */
function forecast() {
  const shift = pickedShift();
  $("forecast").textContent = forecastFor(rolled, level, planFor(SERVICES, shift), shift);
}

/** Which start is the latest: a shift taken over, or the training desk, since. */
let starting = 0;
/** Steps of the hour before the clock-in run between one frame and the next. */
const WARM_SLICE = 200;

async function begin(fresh) {
  const mine = ++starting;
  endLesson();
  askLesson(false);
  toggle("phone", false);
  if (fresh) {
    // The railway's hour before the clock-in is run first, a slice at a time
    // behind the start screen, and the shift is taken over running.
    const next = new Simulation(net, { seed: rolled, level, zone: desk, shift: pickedShift(), warm: true });
    const button = $("startBtn"), label = button.textContent;
    $("veil").inert = true;
    button.textContent = $("veilStatus").textContent = "Taking over the desk…";
    try {
      while (!next.warmUp(WARM_SLICE)) {
        await new Promise((go) => setTimeout(go));
        if (mine !== starting) return;
      }
    } finally {
      $("veil").inert = false;
      button.textContent = label;
      $("veilStatus").textContent = "";
    }
    if (mine !== starting) return;
    sim = next;
  } else {
    const saved = store.loadRun();
    if (!saved) return begin(true);
    sim = Simulation.restore(net, saved);
    level = sim.level;
    desk = sim.zone;
  }
  shownResults = false;
  alarmsSeen = fresh ? 0 : Math.max(0, ...ownAlarms().map((a) => a.seq));
  onDesk = null;
  picked = null;
  closeMenus();
  $("veil").hidden = true;
  $("results").hidden = true;
  showMap(false);
  // A shift is never held, not even on the way back to one, or the key that
  // swaps the page away would be a Hold; it comes back at 1× whatever speed it
  // was left at.
  setRate(1);
  showZone(sim.zone);
  const zoneName = ZONES.find((z) => z.id === sim.zone)?.name ?? sim.zone;
  $("shiftInfo").textContent = `${LEVELS[level].name} conditions, the ${zoneName} desk. ${dayName(sim.shift.day)}, ${sim.shift.start} to ${sim.shift.end}.`;
  $("clock").textContent = hhmm(sim.time, true);
  say(fresh ? `Your shift begins at ${sim.shift.start} on ${dayName(sim.shift.day)}. ${zoneName} is yours; the other desks are staffed. Three black marks and the board relieves you.` : "Shift resumed where it was left.");
  if (!store.guideSeen()) { say("First shift? Learn the desk, in the menu, puts you on the training desk with the story and the lesson over the board; the ? at the top is the written guide.", true); store.markGuideSeen(); }
}

/**
 * The training desk: the school's own line, a shift of eight trains, and
 * the lesson over the board. Nothing of it is saved or kept as a best.
 */
function beginTraining() {
  starting++;
  endLesson();
  askLesson(false);
  toggle("phone", false);
  // The school's desk and conditions are the lesson's own: the desk and
  // conditions picked on the start screen are kept for the real shift after.
  sim = new Simulation(net, { seed: 1, level: "calm", zone: "SC", services: TRAINING.services, shift: TRAINING.shift, training: true });
  sim.disruptions = TRAINING.disruptions.map((d) => ({ ...d }));
  // The automatics clear at once, so with the clock held they already show
  // what the lesson says of them rather than all standing at red.
  sim.autos();
  tutor = new Tutor();
  lessonDrawn = "";
  lessonBeat = null;
  lessonClock = null;
  lessonPace = 1;
  lessonSpotted = null;
  lessonHintUntil = 0;
  shownResults = false;
  alarmsSeen = 0;
  onDesk = null;
  picked = null;
  closeMenus();
  $("veil").hidden = true;
  $("results").hidden = true;
  showMap(false);
  setRate(0);
  showZone(sim.zone);
  $("shiftInfo").textContent = `The training desk. ${dayName(sim.shift.day)}, ${sim.shift.start} to ${sim.shift.end}.`;
  $("clock").textContent = hhmm(sim.time, true);
  say("The training desk is yours. Follow the steps over the board; the clock waits until the lesson runs it.");
  showLesson();
}

/** Put the lesson away, whatever it was showing. */
function endLesson() {
  tutor = null;
  $("tutor").hidden = true;
  screen.spotlight(null);
  pointAtControl(null);
}

/** What the pupil has on the go, as the lesson's words for a step need it. */
function lessonUi() {
  return { entrance, interposing, phone: { up: phoneUp(), calling } };
}

/** The words for the lesson bar's badge, by what the step is waiting on; `held` is a watch the pupil has held. */
const LESSON_PHASE = {
  read: "Read",
  do: "Do · clock waits",
  watch: "Watch · clock runs",
  held: "Watch · clock held",
  free: "Yours",
  done: "✓ Done",
};
/** The pace button that runs a held watch again. */
const RUN_AGAIN = '#rate [data-rate="1"]';

/**
 * Draw the lesson bar for where the lesson is: the step and how far through
 * the lesson that is, what it is waiting on, what it teaches, and what it
 * asks for, each thing a line that takes a tick once done; and point at the
 * thing to click. A step just done keeps the bar a moment, every line
 * ticked, before the next comes up in its place.
 */
function showLesson(now = performance.now()) {
  if (!tutor) return;
  if (lessonBeat && now >= lessonBeat.until) lessonBeat = null;
  const beat = lessonBeat;
  const at = beat ? beat.at : tutor.at;
  const step = tutor.steps[at] ?? null;
  const bar = $("tutor");
  if (!step) {
    bar.hidden = true;
    screen.spotlight(null);
    pointAtControl(null);
    return;
  }
  const phase = beat ? "done" : tutor.phase;
  // A watch the pupil has held goes nowhere until the clock runs again, and
  // the bar says so rather than that it runs.
  const held = phase === "watch" && sim.rate === 0;
  const ui = lessonUi();
  const acts = step.acts ?? [];
  const ticks = beat ? acts.length : tutor.ticks;
  // One line for each thing the step asks for, then what to watch or what is yours.
  const lines = acts.map((a, i) => ({ state: i < ticks ? "done" : i === ticks && phase === "do" ? "now" : "todo", text: actWords(a, i === ticks && phase === "do" ? ui : null) }));
  if (step.watch) lines.push({ state: phase === "watch" ? "now" : phase === "done" ? "done" : "todo", text: step.watch, watch: true });
  if (step.yours) lines.push({ state: "now", text: step.yours, watch: true });
  const hint = now < lessonHintUntil ? lessonHint : held ? "The clock is held: 1× runs it again." : "";
  const key = JSON.stringify([at, phase, held, lines, hint]);
  if (key !== lessonDrawn) {
    const fresh = !lessonDrawn.startsWith(`[${at},`);
    lessonDrawn = key;
    bar.hidden = false;
    bar.dataset.phase = phase;
    $("tutorStep").textContent = beat ? `Step ${at + 1} done` : `Step ${at + 1} of ${tutor.steps.length}`;
    $("tutorFill").style.width = `${((beat ? at + 1 : at) / tutor.steps.length) * 100}%`;
    $("tutorPhase").textContent = LESSON_PHASE[held ? "held" : phase];
    $("tutorText").textContent = step.text;
    const list = $("tutorActs");
    list.textContent = "";
    for (const line of lines) {
      const li = document.createElement("li");
      li.className = `${line.state}${line.watch ? " watch" : ""}`;
      li.textContent = line.text;
      list.appendChild(li);
    }
    list.hidden = !lines.length;
    $("tutorHint").textContent = hint;
    $("tutorHint").hidden = !hint;
    $("tutorNext").hidden = phase !== "read";
    // A new step arrives where the pupil is looking; the same step redrawn does not.
    if (fresh && !beat) {
      bar.classList.remove("arrive");
      void bar.offsetWidth;
      bar.classList.add("arrive");
    }
  }
  const act = phase === "do" ? tutor.act : null;
  lessonPoint(act ? actSpot(act, ui) : (step.spot ?? null));
  // The watched thing stays lit on the board, and 1× blinks beside the clock.
  if (held) pointAtControl(RUN_AGAIN);
}

/**
 * Point at what the lesson wants clicked: a thing on the board, brought on
 * to the screen the first time it is pointed at, or a control off it. An
 * alarm being shown on the board keeps the pointer until it is done.
 */
function lessonPoint(spot) {
  const control = spot?.startsWith("ui:") ? spot.slice(3) : null;
  pointAtControl(control);
  if (pointing) return;
  screen.spotlight(control ? null : spot);
  if (spot !== lessonSpotted) {
    lessonSpotted = spot;
    if (spot && !control) screen.bringIn(spot);
  }
}

/** Mark the control off the board the lesson wants pressed, by its selector, or none. */
function pointAtControl(selector) {
  const el = selector ? document.querySelector(selector) : null;
  for (const other of document.querySelectorAll(".lessonSpot")) if (other !== el) other.classList.remove("lessonSpot");
  el?.classList.add("lessonSpot");
}

/** The step that was on show done: its tick for a moment, and a note to say so. A step gone by in the same moment, never seen, is not the one ticked. */
function stepDone(was) {
  lessonBeat = { at: was, until: performance.now() + 1100 };
  lessonHintUntil = 0;
  sound.play("step");
}

/**
 * Hold the clock while a step is read or asks for something done, and run it
 * again, at the pace the pupil last ran it, while one is watched or the desk
 * is theirs. Only when the step changes what it waits on: the pupil may hold
 * a watched step, or set the pace, in between.
 */
function clockForLesson() {
  if (!sim || sim.finished) return;
  const want = tutor.holdsClock ? "hold" : "run";
  if (want === lessonClock) return;
  lessonClock = want;
  if (want === "hold") {
    if (sim.rate > 0) lessonPace = sim.rate;
    setRate(0);
  } else if (sim.rate === 0) setRate(lessonPace);
}

/**
 * Whether the lesson lets `action` happen now. What it does not is refused
 * where the pupil is looking: the bar says what the step wants instead and
 * gives a shake, and the thing it wants keeps blinking.
 */
function lessonLets(action) {
  if (!tutor || tutor.allows(action)) return true;
  const phase = tutor.phase;
  lessonHint = phase === "do" ? `Not that yet: ${actWords(tutor.act, lessonUi()).replace(/^./, (c) => c.toLowerCase())}.`
    : phase === "watch" ? "Nothing to do on this step but watch; the clock runs at 1×, and 2×, 4× and 8× hurry it."
    : "Read this step, then press Next.";
  lessonHintUntil = performance.now() + 3500;
  sound.play("refuse");
  const bar = $("tutor");
  bar.classList.remove("nudge");
  void bar.offsetWidth;
  bar.classList.add("nudge");
  showLesson();
  return false;
}

/** Tell the lesson `action` has happened, and show the tick if it was what the step asked for; a refusal's words go with it. */
function lessonDid(action) {
  if (!tutor?.did(action)) return;
  lessonHintUntil = 0;
  showLesson();
}

$("learnBtn").addEventListener("click", beginTraining);
$("tutorNext").addEventListener("click", () => {
  if (!tutor || tutor.phase !== "read") return;
  tutor.advance();
  lessonHintUntil = 0;
  showLesson();
});

function setRate(rate) {
  if (!sim) return;
  sim.rate = rate;
  sim.paused = rate === 0;
  // Only the training desk's clock can be held: a shift's runs on, as a real one does.
  $("rate").querySelector('[data-rate="0"]').hidden = !sim.training;
  for (const b of $("rate").querySelectorAll("button")) b.setAttribute("aria-checked", String(Number(b.dataset.rate) === rate));
  $("clockSub").textContent = rate === 0 ? "Held" : `Running at ${rate}×`;
}

/** Put the signaller's own zone on screen; the others are worked from the other desks and never shown. */
function showZone(id) {
  if (!sim) return;
  screen.show(id);
  clearSelection();
  closeMenus();
  panels(true);
}

/** Put the railway's diagram over the board, or take it away again. */
function showMap(on) {
  mapOpen = on ?? !mapOpen;
  if (mapOpen) {
    clearSelection();
    $("networkPic").hidden = !!sim.training;
    $("schoolPic").hidden = !sim.training;
    diagram().update();
  }
  $("network").hidden = !mapOpen;
  $("mapBtn").setAttribute("aria-pressed", String(mapOpen));
  $("mapBtn").textContent = mapOpen ? "Board" : "Network";
}

$("mapBtn").addEventListener("click", () => { if (sim) showMap(); });
$("networkClose").addEventListener("click", () => showMap(false));

/* ---- Pointing at things ------------------------------------------------- */

function clearSelection() {
  entrance = null;
  screen.select(null);
  closeMenus();
}

function onSignal(id, ev) {
  if (!sim || sim.finished) return;
  if (ev.type === "contextmenu") return signalMenu(id, ev);
  closeMenus();
  if (!entrance) {
    // An automatic starts no road, so a click on one goes on to the next
    // signal worked past it, which is where the road on past it is set from.
    let from = id, via = "";
    if (net.signals.get(id).kind === "auto") {
      const next = workedPast(net, id);
      if (!next || next.zone !== sim.zone) { say(`${id} is automatic: it clears itself whenever the block ahead is free, and the line past it runs on to ${next ? `${next.id}, on the next desk` : "the edge"} with nothing for you to set.`, false); return; }
      from = next.id;
      via = `${id} is automatic, so the road on is set from ${from}, the next signal you work. `;
    }
    if (sim.routeFrom(from)) { say(`${via}${from} already has a route set. Right-click it to cancel.`, false); return; }
    if (!net.signals.get(from).routes.length) { say(`${via}${from} has no routes from it.`, false); return; }
    if (!lessonLets({ kind: "pick", signal: from })) return;
    entrance = from;
    screen.select(from);
    if (via) screen.bringIn(`signal:${from}`);
    say(`${via}Route from ${from}: now click the signal, platform end or edge it should run to.`);
    sound.play("click");
    return;
  }
  // The signal chosen again, or an automatic short of it, which a click on
  // chose it by, puts the choice down.
  if (entrance === id || (net.signals.get(id).kind === "auto" && workedPast(net, id)?.id === entrance)) { clearSelection(); say("Route cancelled before it was asked for."); return; }
  const from = entrance;
  if (!lessonLets({ kind: "route", from, to: id })) return;
  clearSelection();
  if (tell(sim.setRoute(from, id))) lessonDid({ kind: "route", from, to: id });
}

function onExit(id, ev) {
  if (!sim || sim.finished) return;
  closeMenus();
  if (ev.type === "contextmenu") return;
  if (!entrance) { say("Click the signal the route starts from first.", false); return; }
  const from = entrance;
  if (!lessonLets({ kind: "route", from, to: id })) return;
  clearSelection();
  if (tell(sim.setRoute(from, id))) lessonDid({ kind: "route", from, to: id });
}

function onPoint(id, ev) {
  if (!sim || sim.finished) return;
  const p = net.points.get(id);
  const gang = net.gangs.get(p.gang);
  const state = sim.points.get(id);
  const held = sim.pointLock(id);
  const lie = state.moving > 0 ? "moving" : state.lie === "N" ? "lying normal" : "lying reverse";
  const items = [{ title: `Points ${gang.join("/")}: ${lie}${state.failed ? ", failed" : held ? `, held ${held === "N" ? "normal" : "reverse"} by a route` : ""}` }];
  items.push({ label: `Swing to ${state.wanted === "N" ? "reverse" : "normal"}`, disabled: !!held || state.failed || state.moving > 0, does: { kind: "swing", points: id }, run: () => tell(sim.swingPoints(id)) });
  menu(items, ev);
}

function onBerth(id, ev) {
  if (!sim || sim.finished) return;
  const was = popped;
  closeMenus();
  const had = sim.berths.get(id);
  const owner = had ? [...sim.trains.values()].find((t) => t.berth === id) : null;
  const service = owner?.service ?? had;
  if (ev.type === "contextmenu") {
    menu([
      { title: `Berth ${id}${had ? `: ${had}` : ": empty"}` },
      { label: `Timetable for ${had ?? "the train"}`, disabled: !had || !sim.plan.has(service), run: () => popTrain(service, ev) },
      { label: "Interpose a description", does: { kind: "interposeOpen", berth: id }, run: () => openInterpose(id) },
      { label: "Cancel the description", disabled: !had, does: { kind: "uninterpose", berth: id }, run: () => tell(sim.cancelDescription(id)) },
    ], ev);
    return;
  }
  // A described train opens its timetable where it was clicked, and a
  // second click on it puts it away; an empty berth asks for a description.
  if (had && sim.plan.has(service)) { if (was !== service) popTrain(service, ev); }
  else if (lessonLets({ kind: "interposeOpen", berth: id })) openInterpose(id);
}

/** One train's timetable over the board, at the pointer, kept up to date until the next click elsewhere. */
function popTrain(id, ev) {
  popped = id;
  const box = $("trainPop");
  // A card opens folded, whatever was opened on the last one.
  delete $("trainPopBody").dataset.open;
  trainCard(id, $("trainPopHead"), $("trainPopBody"));
  box.hidden = false;
  place(box, ev.clientX + 8, ev.clientY + 8);
}

/** Show one train's timetable in the side panel, or put it away again. */
function pick(id) {
  picked = id && sim.plan.has(id) && picked !== id ? id : null;
  delete $("trainBody").dataset.open;
  panels(true);
}

function onCrossing(id, ev) {
  if (!sim || sim.finished) return;
  closeMenus();
  const lc = net.lcs.get(id);
  const state = sim.lcs.get(id);
  const words = { up: "up", lowering: "coming down", down: "down", raising: "going up" };
  menu([
    { title: `${lc.name}: barriers ${words[state.barriers]}` },
    { label: "Lower the barriers", disabled: state.barriers !== "up", does: { kind: "lower", lc: id }, run: () => tell(sim.lowerBarriers(id)) },
    { label: "Raise the barriers", disabled: state.barriers !== "down", does: { kind: "raise", lc: id }, run: () => tell(sim.raiseBarriers(id)) },
  ], ev);
}

/** Why a circuit is blocked, as a click on it says: engineering work until when, or what is on the line and until it is cleared. */
function blockedFor(tc) {
  const d = sim.disruptions.find((x) => x.started && !x.ended && (x.kind === "possession" ? x.tc === tc : x.kind === "examine" && x.tcs.includes(tc)));
  if (d?.kind === "examine") return `blocked both ways, ${d.reason[0].toLowerCase()}${d.reason.slice(1)} ${d.where}, until it has been cleared`;
  return `blocked for engineering work${d?.until ? ` until ${hhmm(d.until)}` : ""}`;
}

function onTrack(tc, ev) {
  if (!sim) return;
  closeMenus();
  const t = sim.tcs.get(tc);
  const name = tcName(tc);
  const who = [...t.trains].map((id) => sim.trains.get(id)?.desc ?? "an undescribed train");
  let text;
  if (who.length) text = `${name}: occupied by ${who.join(" and ")}`;
  else if (t.mending) text = `${name}: the fault team has it, and nothing passes while they mend the fault`;
  else if (t.failed) text = `${name}: showing occupied, and nothing is on it${t.wanted ? "; the fault team is waiting for it" : ""}`;
  else if (t.wanted) text = `${name}: the fault team is waiting for it to clear`;
  else if (t.blocked) text = `${name}: ${blockedFor(tc)}`;
  else if (t.lockedBy) text = `${name}: held by route ${t.lockedBy}`;
  else text = `${name}: clear`;
  say(text);
  void ev;
}

function signalMenu(id, ev) {
  const state = sim.signals.get(id);
  const route = sim.routeFrom(id);
  // A signal held only by an open road says so, since nothing else on the screen names it.
  const road = route ? route.def.tcs.map((tc) => sim.lcOf(tc)).find(Boolean) : null;
  const held = road && sim.lcs.get(road.id).barriers !== "down" ? `, set, waiting for the barriers at ${road.name}` : ", set, waiting";
  const aspect = sim.aspect(id);
  const showing = `showing ${aspect === "double" ? "double yellow" : aspect}`;
  const auto = net.signals.get(id).kind === "auto";
  // An automatic has nothing to set or cancel: it says what it is showing and why. A failed signal shows nothing at all.
  const items = [{ title: auto
    ? `${id}: automatic, ${state.failed ? "failed, showing nothing: drivers stop a minute and go on at caution" : aspect !== "red" ? showing : state.reminder ? "held on by a reminder" : route ? "on, the block ahead is occupied" : "on, the block ahead is not free"}`
    : `${id}${state.failed ? `: failed, showing nothing${route ? `, route to ${exitName(net, route.def.exit.id)}` : ""}` : route ? `: route to ${exitName(net, route.def.exit.id)}${route.entered ? ", train past" : route.cancelAt !== null ? ", approach locked" : aspect !== "red" ? `, ${aspect === "off" ? "off" : showing}` : held}` : ": no route"}` }];
  if (auto) { /* nothing to set */ }
  else if (route) items.push({ label: "Cancel the route", disabled: route.entered || route.cancelAt !== null, does: { kind: "cancel", signal: id }, run: () => tell(sim.cancelRoute(id)) });
  else items.push({ label: "Start a route from here", disabled: state.reminder, does: { kind: "pick", signal: id }, run: () => { entrance = id; screen.select(id); say(`Route from ${id}: now click where it should run to.`); } });
  // A reminder goes on an automatic whatever it is showing: its own route goes with it.
  items.push({ label: state.reminder ? "Remove the reminder" : "Apply a reminder", disabled: !state.reminder && !!route && !auto, does: { kind: "reminder", signal: id }, run: () => tell(sim.setReminder(id, !state.reminder)) });
  items.push({ label: "Authorise the driver past at danger", disabled: !route || route.entered || route.cancelAt !== null || sim.proceed(id) || state.authorised, does: { kind: "authorise", signal: id }, run: () => tell(sim.authorise(id)) });
  menu(items, ev);
}

/* ---- Menus and the interpose box ---------------------------------------- */

function menu(items, ev) {
  putCardAway();
  const box = $("ctx");
  box.textContent = "";
  for (const item of items) {
    if (item.title) {
      const h = document.createElement("h6");
      h.textContent = item.title;
      box.appendChild(h);
      continue;
    }
    const b = document.createElement("button");
    b.type = "button";
    b.setAttribute("role", "menuitem");
    b.textContent = item.label;
    // What changes the railway says so (`does`), and in the lesson only what the step asks for is open.
    b.disabled = !!item.disabled || (!!item.does && !!tutor && !tutor.allows(item.does));
    b.addEventListener("click", () => {
      closeMenus();
      if (item.does && !lessonLets(item.does)) return;
      if (item.run() && item.does) lessonDid(item.does);
    });
    box.appendChild(b);
  }
  box.hidden = false;
  place(box, ev.clientX, ev.clientY);
  const first = box.querySelector("button:not(:disabled)");
  if (first) first.focus();
}

function place(box, x, y) {
  const w = box.offsetWidth, h = box.offsetHeight;
  box.style.left = `${Math.min(x, window.innerWidth - w - 8)}px`;
  box.style.top = `${Math.min(y, window.innerHeight - h - 8)}px`;
}

/**
 * A booking Control has booked again (`rebook()`) is followed to the working
 * that stands in for it, in the side pane and on the card over the board, so
 * neither is left showing a working that has gone; a card whose booking has
 * gone any other way is put away.
 */
function followBookings() {
  picked = sim.bookingNow(picked);
  const card = sim.bookingNow(popped);
  if (card !== popped) {
    if (card) popped = card;
    else putCardAway();
  }
}

/** Put away the train's card over the board: it is only good where it was clicked, so a menu opened or the board moved takes it away too. */
function putCardAway() {
  $("trainPop").hidden = true;
  popped = null;
}

function closeMenus() {
  $("ctx").hidden = true;
  putCardAway();
  if (interposing !== null) { $("interpose").hidden = true; interposing = null; }
}

function openInterpose(id) {
  const at = screen.berthAt(id);
  const box = $("interpose");
  interposing = id;
  box.hidden = false;
  const input = $("interposeInput");
  input.value = sim.berths.get(id) ?? "";
  place(box, (at?.x ?? 200) - 60, (at?.y ?? 200) + 16);
  input.focus();
  input.select();
}

$("interposeOk").addEventListener("click", () => {
  if (interposing === null) return;
  const id = interposing;
  const desc = $("interposeInput").value;
  if (!lessonLets({ kind: "interpose", berth: id, desc })) return;
  if (!tell(sim.interpose(id, desc))) return;
  closeMenus();
  lessonDid({ kind: "interpose", berth: id, desc });
});
$("interposeCancel").addEventListener("click", () => {
  if (interposing === null || !lessonLets({ kind: "uninterpose", berth: interposing })) return;
  tell(sim.cancelDescription(interposing));
  closeMenus();
});
$("interposeInput").addEventListener("keydown", (ev) => {
  if (ev.key === "Enter") { ev.preventDefault(); $("interposeOk").click(); }
});
document.addEventListener("pointerdown", (ev) => {
  if (ev.target.closest("#ctx, #interpose, #trainPop")) return;
  if ($("ctx").hidden && interposing === null && popped === null) return;
  if (ev.target.closest(".hit")) return;
  closeMenus();
});

/* ---- The panels ---------------------------------------------------------- */

function statusOf(service) {
  const r = sim.results.get(service.id);
  if (r) {
    if (r.unfinished) return { text: "not finished", late: true };
    if (r.wrongExit) return { text: "wrong way", late: true };
    const m = wholeMinutes(r.late);
    return { text: m > 0 ? `done +${m}` : "done", late: r.late >= ON_TIME, done: true };
  }
  const train = trainOf(service.id);
  if (train) {
    const sig = sim.signalAhead(train);
    const behind = lateNow(train);
    const late = wholeMinutes(behind);
    // Standing in a platform: which one, where the row is for, or the
    // station it stands at anywhere else, so a platform never reads as minutes.
    const standing = train.stopped === "platform" || train.stopped === "origin";
    const station = standing ? sim.stationOf(train) : null;
    const plat = sim.platformOf(train);
    const row = timeAt(service, PLACES_IN[sim.zone] ?? [])?.entry.at;
    const where = standing
      ? (station && station !== row ? `at ${placeName(station)}` : `in ${/^\d+$/.test(plat ?? "") ? `P${plat}` : (plat ?? "platform")}`)
      : train.state === "stop" ? `at ${sig?.id ?? "the stop"}` : `to ${sig?.id ?? aheadName(train)}`;
    return { text: `${where}${late > 0 ? ` +${late}` : ""}`, late: behind >= ON_TIME, here: true, waiting: sim.waitingSince(train) !== null && sim.isMine(train) };
  }
  const delay = expectedDelay(service);
  const at = timeAt(service, PLACES_IN[sim.zone] ?? []);
  const m = wholeMinutes(delay);
  return { text: `${at ? inMinutes(at.time + delay) : "due"}${m > 0 ? ` +${m}` : ""}`, late: delay >= ON_TIME };
}

/** A train's lateness now: what it carries, or, standing past its time with no road, how far past. */
function lateNow(t) {
  const overdue = (t.stopped === "platform" || t.stopped === "origin") && t.dwellUntil !== null ? sim.time - t.dwellUntil : 0;
  return Math.max(t.late, overdue);
}

/** The train running a service, if it is on the railway. */
function trainOf(serviceId) {
  return [...sim.trains.values()].find((t) => t.service === serviceId) ?? null;
}

/** The delay a service not yet on the railway will bring: the one it is due to arrive with, or the lateness of the train that forms it. */
function expectedDelay(s) {
  const d = sim.disruptions.find((x) => x.kind === "late" && x.service === s.id);
  if (d) return d.minutes * 60;
  const from = s.formedBy ? [...sim.plan.values()].find((o) => o.then === s.id) : null;
  const feeder = from ? trainOf(from.id) : null;
  return feeder ? Math.max(0, feeder.late) : 0;
}

/** How far off a time is, in words: now, or in so many minutes. */
function inMinutes(when) {
  const m = Math.round((when - sim.time) / 60);
  return m <= 0 ? "now" : m === 1 ? "in 1 min" : `in ${m} min`;
}

/** The kinds of train that carry passengers, whose platform matters even where they only pass: it is the one they would stop at. */
const PASSENGER = new Set(["express", "local", "high"]);

/**
 * A platform for print: P2 for a numbered one, the name of any other, or
 * nothing. A freight passing through a station is given none: it stops
 * nowhere there, so there is nothing for it to be at.
 */
function platOf(e, kind) {
  if (e.pass !== null && !PASSENGER.has(kind)) return "";
  return standsAt(net, e) ? ` ${/^\d+$/.test(e.plat) ? "P" + e.plat : e.plat}` : "";
}

/**
 * The next arrival, pass or departure booked on this desk, at its present
 * lateness, or null, and how to say it (`how`): a train standing at a stop
 * on the desk still has to leave it, so its departure counts, and a train
 * booked on at the edge comes in from there rather than away from it.
 */
function nextHere() {
  const places = PLACES_IN[sim.zone] ?? [];
  let best = null;
  for (const s of sim.plan.values()) {
    if (sim.results.has(s.id)) continue;
    const train = trainOf(s.id);
    const late = train ? Math.max(0, lateNow(train)) : expectedDelay(s);
    const standing = !!train && train.state === "stop" && (train.stopped === "platform" || train.stopped === "origin");
    for (let i = train ? (standing ? train.next - 1 : train.next) : 0; i < s.entries.length; i++) {
      const e = s.entries[i];
      if (!places.includes(e.at)) continue;
      const leaves = (standing && i === train.next - 1) || (i === 0 && !e.fringe);
      const when = (leaves ? (e.dep ?? e.arr) : (e.arr ?? e.pass ?? e.dep)) + late;
      const how = leaves ? "away from" : i === 0 ? "in from" : e.call ? "into" : "through";
      if (!best || when < best.when) best = { s, e, when, late, how };
      break;
    }
  }
  return best;
}

/** The platform on this desk the picked train is booked into next, as a track circuit, or null. */
function wantedTc(serviceId, train) {
  if (sim.results.has(serviceId)) return null;
  const s = sim.plan.get(serviceId);
  const places = PLACES_IN[sim.zone] ?? [];
  for (let i = train ? train.next : 0; i < s.entries.length; i++) {
    const e = s.entries[i];
    if (!places.includes(e.at) || e.fringe) continue;
    return e.plat && /^\d+$/.test(e.plat) && (e.pass === null || PASSENGER.has(s.kind)) ? sim.tcAt(e.at, e.plat) : null;
  }
  return null;
}

/** A train in a few lines, for a tooltip: who it is, where it runs, where it is, and what is next here. */
function describe(t) {
  const s = sim.serviceOf(t);
  const first = s.entries[0], last = s.entries[s.entries.length - 1];
  const late = wholeMinutes(lateNow(t));
  const c = comingHere(t);
  const lines = [
    `${t.desc ?? "No description"}${t.desc !== s.id ? ` (${s.id})` : ""} · ${OPERATORS[s.operator]?.name ?? ""} · ${journey(first, last)}`,
    `${whereIs(t)[0].toUpperCase()}${whereIs(t).slice(1)}${late > 0 ? `, ${late} late` : late < 0 ? `, ${-late} early` : ""}`,
  ];
  if (c) lines.push(`Next here: ${placeName(c.entry.at)}${platOf(c.entry, s.kind)} ~${hhmm(c.eta)}, ${inMinutes(c.eta)}`);
  return lines.join("\n");
}

/** What a train with no signal ahead is running to: the edge or a buffer stop. */
function aheadName(train) {
  const last = train.path[train.path.length - 1];
  const s = net.strokes[last.stroke];
  if (s.hidden) {
    const from = last.forward ? s.na : s.nb;
    const fringe = net.nodes.get(from).fringe;
    return fringe ? net.fringes.get(fringe).name : "the edge";
  }
  const end = last.forward ? s.nb : s.na;
  return net.nodes.get(end).strokes.length === 1 ? "the buffer stop" : "the edge";
}

function timeAt(service, places) {
  // Where the train stops on the desk; or, running through, the first line
  // or platform it is booked on, fast or slow; or, failing both, the edge it
  // comes in or goes off by.
  const here = service.entries.filter((e) => places.includes(e.at));
  const e = here.find((x) => x.call) ?? here.find((x) => !x.fringe) ?? here[0];
  return e ? { entry: e, time: e.arr ?? e.pass ?? e.dep } : null;
}

function panels(force = false) {
  if (!sim) return;
  const now = performance.now();
  if (!force && now - lastPanels < 400) return;
  lastPanels = now;
  const unacked = ownAlarms().filter((a) => !a.ack);
  const badge = $("alarmBadge");
  badge.hidden = unacked.length === 0;
  badge.textContent = String(unacked.length);
  const showing = !!picked && sim.plan.has(picked);
  $("paneTrain").hidden = !showing;
  $("paneTimetable").hidden = showing || pane !== "timetable";
  $("paneTrains").hidden = showing || pane !== "trains";
  $("paneAlarms").hidden = showing || pane !== "alarms";
  if (popped && sim.plan.has(popped)) trainCard(popped, $("trainPopHead"), $("trainPopBody"));
  if (showing) trainPane();
  else if (pane === "timetable") timetablePane();
  else if (pane === "trains") trainsPane();
  else alarmsPane();
}

/** What the finder box asks for, lower-cased, or an empty string. */
function filterText() {
  return $("sideFilter").value.trim().toLowerCase();
}

/** The words a train can be found by: headcode, description, operator, its places and where it is. */
function searchable(service, train, where = "") {
  return [service.id, train?.desc ?? "", OPERATORS[service.operator]?.name ?? "", ...service.entries.map((e) => placeName(e.at)), where].join(" ").toLowerCase();
}

function timetablePane() {
  const places = PLACES_IN[sim.zone] ?? [];
  const body = $("ttBody");
  const rows = [];
  const q = filterText();
  for (const s of sim.plan.values()) {
    // A train of the hour before the clock-in is listed while it is on the
    // desk or has it still ahead, not for where it went before the clock-in.
    if (s.warm) {
      const train = trainOf(s.id);
      if (sim.results.has(s.id) || (train && sim.zoneOf(train) !== sim.zone && !s.entries.slice(train.next).some((e) => places.includes(e.at)))) continue;
    }
    const at = timeAt(s, places);
    if (!at) continue;
    if (q && !searchable(s, null).includes(q)) continue;
    rows.push({ s, at });
  }
  rows.sort((a, b) => a.at.time - b.at.time);
  body.textContent = "";
  for (const { s, at } of rows) {
    const tr = document.createElement("tr");
    const st = statusOf(s);
    tr.className = `${st.done ? "done" : ""} ${st.here ? "here" : ""} ${st.late ? "late" : ""} ${st.waiting ? "waiting" : ""} ${picked === s.id ? "picked" : ""}`.trim();
    const first = s.entries[0], last = s.entries[s.entries.length - 1];
    const cells = [
      ["code", s.id],
      ["journey", `${journey(first, last)}`],
      ["", at.entry.arr && at.entry.dep ? `${hhmm(at.entry.arr)}–${hhmm(at.entry.dep).slice(3)}` : hhmm(at.time)],
      ["", standsAt(net, at.entry) ? at.entry.plat : "—"],
      ["now", st.text],
    ];
    for (const [cls, text] of cells) {
      const td = document.createElement("td");
      if (cls) td.className = cls;
      td.textContent = text;
      tr.appendChild(td);
    }
    tr.addEventListener("click", () => pick(s.id));
    body.appendChild(tr);
  }
  if (!rows.length) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 5;
    td.className = "muted";
    td.textContent = q ? "Nothing matches." : "Nothing booked on this desk.";
    tr.appendChild(td);
    body.appendChild(tr);
  }
}

/** A signal by name, an automatic said to be one. */
function signalName(sig) {
  return sig.kind === "auto" ? `${sig.id}, automatic` : sig.id;
}

/** Where a train is, in words: standing, stood at a signal, or running to one. */
function whereIs(t) {
  const sig = sim.signalAhead(t);
  const service = sim.serviceOf(t);
  if (t.stopped === "stabled") {
    // Where it stands, which is where it was booked unless a colleague put it somewhere else.
    const last = service.entries[service.entries.length - 1];
    const { at, plat } = sim.standingIn(t) ?? last;
    if (!isDepotRoad(at, plat)) return `stabled in ${placeName(at)} platform ${plat}`;
    // A siding of one road is just the siding; a depot says which road.
    const depot = DEPOTS[at];
    return depot.roads.length > 1 ? `stabled in ${depot.name}, road ${plat.replace(/^\D+/, "")}` : `stabled in ${depot.name}`;
  }
  if (t.state !== "stop") return `running, ${Math.round(t.v * 2.237)} mph, to ${sig ? signalName(sig) : aheadName(t)}`;
  if (t.stopped === "platform" || t.stopped === "origin") return `standing at ${placeName(service.entries[Math.max(0, t.next - 1)].at)} ${sim.platformOf(t) ?? ""}${sim.readyToStart(t) ? ", ready to start" : ""}`;
  return sig ? `stood at ${signalName(sig)}${sim.signals.get(sig.id).failed ? ", which has failed" : sig.kind === "auto" ? autoHolds(sig) : ""}` : "stood at the stop";
}

/**
 * Why an automatic holds a train, in words: the block ahead, or a circuit
 * in it, or in the overlap past the signal at its end, that has failed and
 * shows occupied with nothing on it, which only an authority takes a train
 * past, at the automatic and at each signal after it over the failure.
 */
function autoHolds(sig) {
  const def = net.routes.get(sig.routes[0]);
  const failed = def ? [...def.tcs, sim.overlapOf(def)].find((tc) => tc && sim.tcs.get(tc).failed && !sim.tcs.get(tc).trains.size) : null;
  return failed ? `, held by circuit ${tcName(failed)}, which has failed: authorise the driver past` : ", waiting on the block ahead";
}

/** The next place on this desk a train elsewhere is booked at, and when it should get there at its present lateness. */
function comingHere(t) {
  const places = PLACES_IN[sim.zone] ?? [];
  const entries = sim.serviceOf(t).entries;
  for (let i = t.next; i < entries.length; i++) {
    if (!places.includes(entries[i].at)) continue;
    return { entry: entries[i], eta: (entries[i].arr ?? entries[i].pass ?? entries[i].dep) + Math.max(0, lateNow(t)) };
  }
  return null;
}

/** The booked time of the next thing a train has to do, for ordering. */
function nextTime(t) {
  const e = sim.serviceOf(t).entries[t.next];
  return e ? (e.arr ?? e.pass ?? e.dep ?? 0) : Infinity;
}

function trainsPane() {
  const host = $("trainList");
  host.textContent = "";
  const q = filterText();
  const mine = [], coming = [], elsewhere = [], stabled = [];
  for (const t of sim.trains.values()) {
    if (q && !searchable(sim.serviceOf(t), t, whereIs(t)).includes(q)) continue;
    // Stock done with is listed on its own, after everything still working.
    if (t.state === "done") { stabled.push(t); continue; }
    // Where the train is, not where its authority ends: a train routed
    // through to the next desk's signal is still on this one.
    if (sim.zoneOf(t) === sim.zone) mine.push(t);
    else if (comingHere(t)) coming.push(t);
    else elsewhere.push(t);
  }
  // The desk's own trains, the ones waiting for the signaller first; then
  // what is on its way, a train stood at the desk's boundary signal first
  // and the rest soonest first; then the rest of the railway.
  const waiting = (t) => (sim.waitingSince(t) !== null && sim.isMine(t) ? 1 : 0);
  mine.sort((a, b) => waiting(b) - waiting(a) || nextTime(a) - nextTime(b));
  coming.sort((a, b) => waiting(b) - waiting(a) || comingHere(a).eta - comingHere(b).eta);
  elsewhere.sort((a, b) => (a.desc ?? "~").localeCompare(b.desc ?? "~"));
  const section = (title, list, extra) => {
    if (!list.length) return;
    const head = document.createElement("div");
    head.className = "row head";
    head.textContent = title;
    host.appendChild(head);
    for (const t of list) host.appendChild(trainRow(t, extra ? extra(t) : ""));
  };
  const due = (t) => { const c = comingHere(t); return c ? ` · next ${placeName(c.entry.at)}${platOf(c.entry, sim.serviceOf(t).kind)} ~${hhmm(c.eta)}, ${inMinutes(c.eta)}` : ""; };
  section("On this desk", mine, due);
  section("Coming this way", coming, due);
  section("Elsewhere", elsewhere);
  stabled.sort((a, b) => (a.desc ?? "~").localeCompare(b.desc ?? "~"));
  section("Stabled", stabled);
  if (!mine.length && !coming.length && !elsewhere.length && !stabled.length) {
    const p = document.createElement("div");
    p.className = "row";
    p.textContent = q ? "No train matches." : "Nothing on the railway yet.";
    host.appendChild(p);
  }
  dueRows(host, q);
}

/** Why a train in the list is standing, when it is held. */
const HELD = { crew: "no driver", isolating: "isolating the fault" };

/** One train in the list: who it is, where it is, and how late. */
function trainRow(t, extra = "") {
  const row = document.createElement("div");
  const needs = sim.waitingSince(t) !== null && sim.isMine(t);
  row.className = `row train${needs ? " waiting" : ""}`;
  const zone = ZONES.find((z) => z.id === sim.zoneOf(t))?.name ?? "";
  const service = sim.serviceOf(t);
  const first = service.entries[0], last = service.entries[service.entries.length - 1];
  const late = wholeMinutes(lateNow(t));
  row.innerHTML = `<span class="code">${t.desc ?? "????"}</span> ${t.desc ? "" : "<b>no description</b> "}<span class="when">${OPERATORS[service.operator]?.name ?? ""} · ${zone}</span>${late > 0 ? `<span class="late">+${late}</span>` : ""}<br>${t.desc === t.service || !t.desc ? `${journey(first, last)}` : `described as ${t.desc}`}, ${whereIs(t)}${extra}${t.failedUntil !== null && sim.time < t.failedUntil ? ` · ${HELD[t.held] ?? "fault"}, ${Math.ceil((t.failedUntil - sim.time) / 60)} min` : t.limp ? ` · fault isolated, ${LIMP.mph} mph` : ""}`;
  row.addEventListener("click", () => pick(t.service));
  return row;
}

/** The next few services not yet on the railway that will come to this desk, and when. */
function dueRows(host, q = "") {
  const places = PLACES_IN[sim.zone] ?? [];
  const due = [];
  for (const s of sim.plan.values()) {
    if (sim.spawned.has(s.id)) continue;
    if (q && !searchable(s, null).includes(q)) continue;
    const at = timeAt(s, places);
    if (at) due.push({ s, at });
  }
  due.sort((a, b) => a.at.time - b.at.time);
  if (!due.length) return;
  const head = document.createElement("div");
  head.className = "row head";
  head.textContent = "Due on this desk";
  host.appendChild(head);
  for (const { s, at } of due.slice(0, 5)) {
    const row = document.createElement("div");
    row.className = "row";
    const first = s.entries[0], last = s.entries[s.entries.length - 1];
    const how = at.entry.at === first.at ? "leaves" : at.entry.call ? "calls at" : "passes";
    const delay = expectedDelay(s);
    row.innerHTML = `<span class="code">${s.id}</span> <span class="when">${OPERATORS[s.operator]?.name ?? ""}</span>${delay >= 60 ? `<span class="late">+${wholeMinutes(delay)}</span>` : ""}<br>${journey(first, last)}, ${how} ${placeName(at.entry.at)}${platOf(at.entry, s.kind)} ${hhmm(at.time)}${delay >= 60 ? `, expect ~${hhmm(at.time + delay)}` : ""}, ${inMinutes(at.time + delay)}`;
    row.addEventListener("click", () => pick(s.id));
    host.appendChild(row);
  }
}

/**
 * Bring the board round to what an alarm is about, "tc:CT.UM4" or
 * "signal:CT13", and point at it for a few seconds, the way the lesson points
 * at its steps; the lesson's own pointer comes back after.
 */
function showOnBoard(at) {
  if (mapOpen) showMap(false);
  screen.bringIn(at);
  screen.spotlight(at);
  clearTimeout(pointing);
  pointing = setTimeout(() => {
    pointing = null;
    screen.spotlight(null);
    if (tutor) showLesson();
  }, 4000);
}

/** The alarms for this desk: its own zone's, and the ones about no zone in particular. */
function ownAlarms() {
  return sim.alarms.filter((a) => !a.zone || a.zone === sim.zone);
}

function alarmsPane() {
  const host = $("alarmList");
  const alarms = ownAlarms().reverse();
  $("ackAllBar").hidden = alarms.filter((a) => !a.ack).length < 2;
  // The rows are drawn apart and only put on the page when they say something
  // new: the panes are redrawn every 400 ms, and a row swapped out from under
  // a press loses the click.
  const fresh = host.cloneNode(false);
  alarmRows(fresh, alarms);
  if (alarmsFor === sim && fresh.innerHTML === host.innerHTML) return;
  alarmsFor = sim;
  host.replaceChildren(...fresh.childNodes);
}

/** The alarm rows, newest first, into `host`, or a line saying there are none. */
function alarmRows(host, alarms) {
  if (!alarms.length) {
    const p = document.createElement("div");
    p.className = "row";
    p.textContent = "Nothing to report.";
    host.appendChild(p);
    return;
  }
  for (const a of alarms) {
    const row = document.createElement("div");
    row.className = `row alarm${a.ack ? " ack" : ""}${a.at ? " at" : ""}`;
    // An alarm about a place shows it: a click, or Enter on the row, brings
    // the board round to it. The row keeps the key to itself, so Enter is not
    // Next as well; on its Acknowledge button, Enter presses the button.
    if (a.at) {
      row.tabIndex = 0;
      row.setAttribute("role", "button");
      row.addEventListener("click", () => showOnBoard(a.at));
      row.addEventListener("keydown", (ev) => {
        if (ev.target !== row || (ev.key !== "Enter" && ev.key !== " ")) return;
        ev.preventDefault();
        ev.stopPropagation();
        showOnBoard(a.at);
      });
    }
    const when = document.createElement("span");
    when.className = "when";
    when.textContent = hhmm(a.time);
    row.appendChild(when);
    // Who reported it on the first line, with the time and the button, and what they said under it.
    if (a.from) {
      const from = document.createElement("span");
      from.className = "from";
      from.textContent = a.from;
      row.appendChild(from);
    }
    if (!a.ack) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "ackBtn";
      b.textContent = "Acknowledge";
      b.addEventListener("click", (ev) => { ev.stopPropagation(); a.ack = true; panels(true); });
      row.appendChild(b);
    }
    const said = document.createElement("div");
    said.className = "said";
    said.textContent = a.text;
    row.appendChild(said);
    host.appendChild(row);
  }
}

/** In words, what a train is doing now, or when it is due, or how it finished. */
function nowText(s, train, r) {
  if (r) {
    if (r.unfinished) return "Still on the railway when the shift ended.";
    if (r.wrongExit) return "Sent off the railway the wrong way.";
    const m = wholeMinutes(r.late);
    const lastCall = r.calls[r.calls.length - 1];
    return `Finished at ${placeName(lastCall?.at ?? s.entries[s.entries.length - 1].at)} ${lastCall ? hhmm(lastCall.time) : ""}, ${m > 0 ? `${m} late` : "on time"}.`;
  }
  if (train) {
    const late = wholeMinutes(train.late);
    const tail = late > 0 ? `, ${late} late` : late < 0 ? `, ${-late} early` : "";
    return `${whereIs(train)[0].toUpperCase()}${whereIs(train).slice(1)}${tail}.${train.desc !== s.id ? ` Running as ${train.desc ?? "no description"}.` : ""}`;
  }
  const d = sim.disruptions.find((x) => x.kind === "late" && x.service === s.id);
  const first = s.entries[0];
  if (s.formedBy) {
    const from = [...sim.plan.values()].find((o) => o.then === s.id);
    return `Formed by ${from?.id ?? "another train"} at ${placeName(first.at)}, away ${hhmm(first.dep)}.`;
  }
  return `Due ${first.fringe ? `from ${placeName(first.at)}` : `away from ${placeName(first.at)}`} ${hhmm(first.dep)}${d ? `, running ${d.minutes} late` : ""}.`;
}

/** The signed minutes a time is off its booking, as the table prints it. */
function offBy(seconds) {
  const m = wholeMinutes(seconds);
  return m > 0 ? `+${m}` : m < 0 ? `−${-m}` : "0";
}

/**
 * One train's whole timetable: every place with its booked times, what
 * actually happened where it has been, and what to expect where it has not.
 */
function trainPane() {
  trainCard(picked, $("trainHead"), $("trainBody"));
}

/**
 * A train's card, its heading and its timetable, drawn into the heading and
 * table body given. The timetable is drawn as the train's line, in its
 * operator's colour from the network map: a circle at each stop, a tick at
 * each place it only passes, a solid dot at either end, the line it has run
 * over dimmed, and the train itself on the line, at the stop it stands at or
 * between the two it runs between. The places a long way from the desk fold
 * into one dotted row until it is clicked (`foldJourney()`).
 */
function trainCard(id, head, body) {
  const s = sim.plan.get(id);
  const kind = KINDS[s.kind];
  const train = trainOf(s.id);
  const r = sim.results.get(s.id);
  const calls = r?.calls ?? train?.calls ?? [];
  // What it is running to at the moment: its lateness, or, standing past
  // its time, how far past; a train not yet on the railway carries the
  // delay it is due to arrive with.
  const behind = train ? lateNow(train) : expectedDelay(s);
  const first = s.entries[0], last = s.entries[s.entries.length - 1];
  const formedBy = [...sim.plan.values()].find((o) => o.then === s.id);
  head.innerHTML = `<div class="trainTitle"><span class="code">${s.id}</span> <span class="muted">${OPERATORS[s.operator]?.name ?? ""} · ${kind.name}</span></div>
    <div>${journey(first, last)}${formedBy ? ` · formed by ${formedBy.id}` : ""}${s.then ? ` · forms ${s.then}` : ""}</div>
    <div class="muted">${nowText(s, train, r)}</div>`;
  // Where the train is along its timetable, counted in rows: on a row while
  // it stands there, halfway between two while it is on its way, before the
  // first until it is on the railway, and past the last once it is done.
  const standing = train?.state === "stop" && (train.stopped === "platform" || train.stopped === "origin");
  const at = r ? Infinity : train ? (standing ? Math.max(0, train.next - 1) : train.next - 0.5) : -Infinity;
  body.parentElement.dataset.operator = s.operator;
  const out = document.createElement("tbody");
  const rows = body.dataset.open === s.id
    ? s.entries.map((_, i) => ({ show: i }))
    : foldJourney(s.entries.map((e) => e.at), PLACES_IN[sim.zone] ?? [], train && !r ? [train.next - 1, train.next] : []);
  for (const row of rows) {
    if (row.fold) {
      out.appendChild(foldedRow(s, row.fold, at, () => { body.dataset.open = s.id; trainCard(id, head, body); keepOnScreen(body); }));
      continue;
    }
    const i = row.show, e = s.entries[i];
    const lastLeg = i === s.entries.length - 1;
    // A call is matched to its entry of the timetable, not to its place: the
    // empty stock at Cleveland names the same place three times.
    const call = calls.find((c) => c.entry === i && !c.changed);
    const changed = calls.find((c) => c.entry === i && c.changed);
    const state = r ? "done" : train ? (i < train.next ? "done" : i === train.next ? "next" : "later") : "later";
    const tr = document.createElement("tr");
    tr.className = state;
    const plat = platOf(e, s.kind).trim();
    const booked = e.arr && e.dep ? `${hhmm(e.arr)}–${hhmm(e.dep).slice(3)}` : hhmm(e.arr ?? e.pass ?? e.dep);
    let actual = "", off = "", cls = "";
    if (call) {
      if (i === 0) actual = hhmm(call.dep ?? call.time);
      else if (call.dep && !lastLeg) actual = `${hhmm(call.time)}–${hhmm(call.dep).slice(3)}`;
      else actual = hhmm(call.time);
      const l = call.depLate ?? call.late;
      if (l !== undefined) off = offBy(l);
    } else if (state !== "done") {
      // What to expect at its present lateness; a train not yet on the railway carries the delay it is due to arrive with.
      actual = `~${hhmm((e.arr ?? e.pass ?? e.dep) + Math.max(0, behind))}`;
      off = offBy(Math.max(0, behind));
      cls = "eta";
    }
    const mark = i === 0 || lastLeg ? "end" : e.call ? "stop" : "pass";
    const where = changed ? `P${changed.plat} <span class="muted">· booked ${plat}</span>` : plat;
    const cells = [
      [`place ${rail(i, at)} ${mark}`, `<span class="mark"></span>${at === i - 0.5 ? '<span class="train"></span>' : ""}<div class="placeRow"><span>${placeName(e.at)}${mark === "pass" ? ' <span class="sr">passes</span>' : ""}</span>${where ? `<span class="plat">${where}</span>` : ""}</div>`],
      ["", booked],
      [cls, actual],
      [cls, off],
    ];
    for (const [c, html] of cells) {
      const td = document.createElement("td");
      if (c) td.className = c;
      td.innerHTML = html;
      tr.appendChild(td);
    }
    out.appendChild(tr);
  }
  // Put on the page only when something in it has changed: the card is
  // redrawn every 400 ms, and a row put back each time would take the focus
  // off a fold before it could be pressed, and could lose a click on it.
  if (out.innerHTML !== body.innerHTML) body.replaceChildren(...out.childNodes);
}

/** The card over the board, grown by a fold opened, moved up as far as it needs to stay in the window. */
function keepOnScreen(body) {
  if (body !== $("trainPopBody")) return;
  const box = $("trainPop");
  const r = box.getBoundingClientRect();
  place(box, r.left, r.top);
}

/**
 * How a row of a train's line is drawn from where the train is, counted in
 * rows as `trainCard()` counts it: the half of the line above the row and
 * the half below dimmed once run over, the row's own mark once passed, and
 * the mark filled where the train stands. The train running is drawn by
 * `trainCard()`, as a berth on the line just short of where it is going.
 */
function rail(i, at) {
  return ["rail", i <= at ? "upGone" : "", i + 0.5 <= at ? "downGone" : "", i < at ? "gone" : "", at === i ? "at" : ""].filter(Boolean).join(" ");
}

/** The places folded out of a train's card, as one dotted row that names them and opens them all when clicked. */
function foldedRow(s, run, at, open) {
  const tr = document.createElement("tr");
  const lastOf = run[run.length - 1];
  tr.className = `fold ${lastOf < at ? "done" : ""}`;
  const td = document.createElement("td");
  td.colSpan = 4;
  td.className = `place folded ${rail(lastOf, at)}`;
  const names = run.map((i) => placeName(s.entries[i].at));
  const b = document.createElement("button");
  b.type = "button";
  b.className = "foldBtn";
  b.textContent = `${run.length} more: ${names.join(", ")}`;
  b.setAttribute("aria-label", `Show ${run.length} more: ${names.join(", ")}`);
  b.addEventListener("click", open);
  td.appendChild(b);
  tr.appendChild(td);
  return tr;
}

for (const b of document.querySelectorAll(".tabs button[data-pane]")) {
  b.addEventListener("click", () => {
    pane = b.dataset.pane;
    picked = null;
    for (const o of document.querySelectorAll(".tabs button[data-pane]")) o.setAttribute("aria-selected", String(o === b));
    panels(true);
    if (pane === "timetable") toWhatIsNext();
  });
}

/**
 * The timetable opened at what is still to come: the first train not done
 * just under the heading, rather than the top of a list that the shift has
 * been filling with trains finished and gone.
 */
function toWhatIsNext() {
  const host = $("paneTimetable");
  const row = [...$("ttBody").rows].find((tr) => !tr.classList.contains("done"));
  if (!row) return;
  const head = host.querySelector("thead").getBoundingClientRect().height;
  host.scrollTop += row.getBoundingClientRect().top - host.getBoundingClientRect().top - head;
}
$("trainBack").addEventListener("click", () => { picked = null; panels(true); });
$("ackAll").addEventListener("click", () => { for (const a of ownAlarms()) a.ack = true; panels(true); });
$("sideFilter").addEventListener("input", () => { picked = null; panels(true); });

/* ---- The clock ----------------------------------------------------------- */

function hud() {
  $("clock").textContent = hhmm(sim.time, true);
  const sum = sim.summary();
  $("ppm").textContent = sum.finished ? `${sum.ppm}%` : "—";
  $("ppmSub").textContent = `${sum.finished} of ${sum.total} finished`;
  const marks = $("marks");
  marks.textContent = `${sum.marks} of ${MARKS_ALLOWED}`;
  marks.classList.toggle("bad", sum.marks > 0);
  $("marksSub").textContent = sim.training ? "Nobody is counting here" : sim.relieved ? `Relieved at ${hhmm(sim.relievedAt)}` : sum.marks === 0 ? "Three and you are relieved" : sum.marks === MARKS_ALLOWED - 1 ? "One more and you are relieved" : `${MARKS_ALLOWED - sum.marks} more and you are relieved`;
  const entries = sim.log.slice(-3);
  const key = entries.map((l) => `${l.time}|${l.text}`).join("\n");
  const log = $("log");
  if (log.dataset.last !== key) {
    log.dataset.last = key;
    log.textContent = "";
    entries.forEach((l, i) => {
      if (i) log.appendChild(document.createTextNode(" · "));
      const span = document.createElement("span");
      span.className = l.ok ? "" : "bad";
      span.textContent = `${hhmm(l.time)} ${l.text}`;
      log.appendChild(span);
    });
  }
  const nxt = nextHere();
  const nextText = nxt ? `${nxt.how} ${placeName(nxt.e.at)}${platOf(nxt.e, nxt.s.kind)} ${nxt.late > 0 ? "~" : ""}${hhmm(nxt.when)}, ${inMinutes(nxt.when)}` : "Nothing due";
  // The headcode is written on its own, since two trains can be due at the same place in the same minute.
  const nextId = nxt ? nxt.s.id : "—";
  if ($("next").textContent !== nextId) $("next").textContent = nextId;
  if ($("nextSub").textContent !== nextText) $("nextSub").textContent = nextText;
  // New is numbered past the last one chimed for: the list is kept to forty,
  // so a count stands still once it is full, as one comes and another goes.
  const fresh = ownAlarms().filter((a) => a.seq > alarmsSeen);
  if (fresh.length) {
    sound.play("alarm");
    const last = fresh[fresh.length - 1];
    say(last.text, false, last.from);
    alarmsSeen = last.seq;
  }
}

let lastFrame = performance.now();
function frame(now) {
  const dt = Math.min(0.25, (now - lastFrame) / 1000);
  lastFrame = now;
  if (sim) {
    if (!sim.finished) sim.advance(dt * sim.rate);
    // A ding for a train come onto the desk, one however many came at once.
    const { here, came } = sim.arrivals(onDesk);
    if (came.length) sound.play("arrive");
    onDesk = here;
    if (tutor) {
      const was = lessonBeat?.at ?? tutor.at;
      if (tutor.tick(sim)) stepDone(was);
      clockForLesson();
      showLesson(now);
    }
    followBookings();
    const card = popped ?? picked;
    const shown = card ? trainOf(card) : null;
    screen.pick(shown?.berth ?? null, card && sim.plan.has(card) ? wantedTc(card, shown) : null);
    screen.update(sim);
    if (mapOpen) diagram().update();
    hud();
    panels();
    if (sim.finished && !shownResults) results();
    if (now - lastSave > 10000) { stash(); lastSave = now; }
  }
  requestAnimationFrame(frame);
}

/* ---- The end of a shift -------------------------------------------------- */

function results() {
  shownResults = true;
  const sum = sim.summary();
  const better = sim.relieved || sim.training ? false : store.keepBest(sim.zone, sum, { level: sim.level, start: sim.shift.start });
  // A lesson was never saved, and must not throw away a shift that was.
  if (!sim.training) store.clearRun();
  sound.play(sim.relieved ? "refuse" : "end");
  const zoneName = ZONES.find((z) => z.id === sim.zone)?.name ?? sim.zone;
  const which = `${dayName(sim.shift.day)}, ${sim.shift.start} to ${sim.shift.end}, the ${zoneName} desk.`;
  if (sim.training) {
    $("resultTitle").textContent = "Training over";
    $("resultText").textContent = `That was the desk: ${sum.counted ? `${sum.counted} of ${sum.total} trains finished where they were going, ${sum.ppm}% of the timetable on time` : "no train finished where it was going"}${sim.marks.length ? `, and ${sim.marks.length} thing${sim.marks.length === 1 ? "" : "s"} that would have been a black mark` : ""}. A real shift is two hours of the whole railway with seven other desks staffed around yours; the written guide, the ? at the top, says the rest.${store.loadRun() ? " Your shift is saved: Resume it from the start screen." : ""}`;
  } else if (sim.relieved) {
    $("resultTitle").textContent = `Relieved of duty at ${hhmm(sim.relievedAt)}`;
    $("resultText").textContent = `${which} Three black marks. ${sum.counted ? `${sum.counted} of ${sum.total} trains had finished where they were going by then, ${sum.ppm}% of the timetable on time` : "No train had finished where it was going by then"}.`;
  } else {
    // A shift ends once nothing more is coming to the desk, and says so.
    const cleared = sim.clearedAt !== null ? ` Your desk was clear at ${hhmm(sim.clearedAt)}, so the shift ended there, and the trains still out elsewhere were worked through to the end of their journeys.` : "";
    const marks = sum.marks ? ` ${sum.marks} black mark${sum.marks === 1 ? "" : "s"}.` : "";
    const calls = sum.falseCalls ? ` ${sum.falseCalls} call${sum.falseCalls === 1 ? "" : "s"} about nothing, ${sum.falseCalls * FALSE_CALL} points.` : "";
    if (!sum.counted) {
      // A shift ended before a train got through has no score, not 0% on time.
      $("resultTitle").textContent = "No score";
      $("resultText").textContent = `${which}${cleared} No train finished where it was going, so there is no score for the shift.${marks}${calls}`;
    } else {
      $("resultTitle").textContent = `On time: ${sum.ppm}%`;
      $("resultText").textContent = `${which}${cleared} ${sum.points} points. ${sum.counted} of ${sum.total} trains finished where they were going, ${Math.round(sum.avgLate / 60 * 10) / 10} minutes late on average.${marks}${calls}${better ? " A best for this desk." : ""}`;
    }
  }
  const list = $("marksList");
  list.textContent = "";
  list.hidden = sim.marks.length === 0;
  for (const m of sim.marks) {
    const row = document.createElement("div");
    const when = document.createElement("span");
    when.className = "when";
    when.textContent = hhmm(m.time);
    row.appendChild(when);
    row.appendChild(document.createTextNode(m.text));
    list.appendChild(row);
  }
  const body = $("resultsBody");
  body.textContent = "";
  const rows = sim.shiftResults().sort((a, b) => a.id.localeCompare(b.id));
  for (const r of rows) {
    const s = sim.plan.get(r.id);
    const tr = document.createElement("tr");
    const notes = [];
    if (r.unfinished) notes.push("still on the railway");
    if (r.wrongExit) notes.push("sent the wrong way");
    if (r.changes) notes.push(`${r.changes} platform change${r.changes === 1 ? "" : "s"}`);
    if (r.missed) notes.push(`${r.missed} call${r.missed === 1 ? "" : "s"} sent past`);
    const late = r.late === null ? "—" : `${Math.max(0, wholeMinutes(r.late))} min`;
    const first = s.entries[0], last = s.entries[s.entries.length - 1];
    for (const [cls, text] of [["code", r.id], ["", `${journey(first, last)}`], [r.late !== null && r.late >= ON_TIME ? "late-bad" : "", late], ["", notes.join(", ") || "—"]]) {
      const td = document.createElement("td");
      if (cls) td.className = cls;
      td.textContent = text;
      tr.appendChild(td);
    }
    body.appendChild(tr);
  }
  askLesson(false);
  toggle("phone", false);
  $("results").hidden = false;
}

$("againBtn").addEventListener("click", () => { $("results").hidden = true; endLesson(); sim = null; openStart(); });
$("endShift").addEventListener("click", () => { if (sim && !sim.finished) { sim.finish(); toggle("settings", false); } });

/* ---- Buttons ------------------------------------------------------------- */

/** The clock set by the signaller, from its buttons or keys, as far as the lesson lets it. */
function pace(rate) {
  if (!sim || !lessonLets({ kind: "rate", rate })) return;
  setRate(rate);
  lessonDid({ kind: "rate", rate });
}
for (const b of $("rate").querySelectorAll("button")) b.addEventListener("click", () => pace(Number(b.dataset.rate)));
$("startBtn").addEventListener("click", () => begin(true));
$("resumeBtn").addEventListener("click", () => begin(false));

/** The panels over the top right of the board, each with the button that opens it; one is up at a time. */
const PANELS = { guide: "guideBtn", settings: "menuBtn", phone: "phoneBtn" };

function toggle(id, on) {
  const panel = $(id);
  const show = on ?? panel.hidden;
  const was = !panel.hidden;
  panel.hidden = !show;
  $(PANELS[id]).setAttribute("aria-expanded", String(show));
  if (show) {
    // A panel's own button is a click that has already put the train's card
    // away, but its key is not, and the phone comes up at the pointer, where
    // the card was put: it would sit on top of the phone.
    putCardAway();
    for (const [other, btn] of Object.entries(PANELS)) {
      if (other === id || $(other).hidden) continue;
      $(other).hidden = true;
      $(btn).setAttribute("aria-expanded", "false");
      if (other === "phone") hungUp(false);
    }
    askLesson(false);
  }
  if (id === "phone" && show && !was) pickedUp();
  if (id === "phone" && !show && was) hungUp();
  if (id === "guide" && show) openRuleBook();
}
/**
 * Learn the desk is the lesson: the menu's button, or its key, puts the
 * signaller on the training desk, as the start screen's does. In the middle
 * of a shift it asks first, since it takes the signaller off the desk; the
 * shift is saved, so Resume brings it back after. A lesson already on the
 * board is left where it is. Help, the ?, is the written guide.
 */
function learnTheDesk() {
  if (tutor) {
    if (!$("settings").hidden) { toggle("settings", false); $("menuBtn").focus(); }
    say("The lesson is on the board: follow the step over it.", true);
    return;
  }
  if (sim && !sim.finished && $("veil").hidden) { askLesson($("lessonAsk").hidden); return; }
  closeMenus();
  beginTraining();
}

/** Show or put away the question Learn the desk asks before it leaves a shift for the lesson. */
function askLesson(show) {
  $("lessonAsk").hidden = !show;
  $("learnDesk").setAttribute("aria-expanded", String(show));
  if (show) {
    toggle("settings", false);
    toggle("guide", false);
    toggle("phone", false);
    $("lessonGo").focus();
  }
}

function leaveForLesson() {
  askLesson(false);
  const playing = sim && !sim.finished && $("veil").hidden;
  if (playing) stash();
  closeMenus();
  beginTraining();
  if (playing) say("Your shift is saved. Resume it from the start screen once the lesson is over.", true);
}
$("learnDesk").addEventListener("click", learnTheDesk);
$("lessonGo").addEventListener("click", leaveForLesson);
// The menu it was asked from has gone, so back to the menu's own button.
$("lessonStay").addEventListener("click", () => { askLesson(false); $("menuBtn").focus(); });
// A press anywhere else puts the question away, as the shift goes on.
document.addEventListener("pointerdown", (ev) => {
  if (!$("lessonAsk").hidden && !ev.target.closest("#lessonAsk, #learnDesk")) askLesson(false);
});
$("guideBtn").addEventListener("click", () => toggle("guide"));
$("guideClose").addEventListener("click", () => toggle("guide", false));
$("menuBtn").addEventListener("click", () => toggle("settings"));

/* ---- The phone ----------------------------------------------------------- */

/** The call chosen from the phone's list, by its issue, or null at the list. */
let calling = null;

/** Whether the phone is up. */
function phoneUp() {
  return !$("phone").hidden;
}

/** Who answered on the phone and what they said. `asks` marks an answer that wants the number again. */
function phoneSays(from, text, asks = false) {
  $("phoneFrom").textContent = from;
  $("phoneSaid").textContent = text;
  $("phoneReply").classList.toggle("asks", asks);
}

/** Back to the list: nothing chosen, the box empty and shut. */
function phoneList() {
  calling = null;
  for (const b of $("phoneList").querySelectorAll("button")) b.setAttribute("aria-pressed", "false");
  const input = $("phoneInput");
  input.value = "";
  input.disabled = true;
  $("phoneRing").disabled = true;
  $("phoneBack").disabled = true;
  $("phoneAsk").textContent = "Choose what is wrong first";
  if (phoneUp()) $("phoneList").querySelector("button")?.focus();
}

function pickedUp() {
  phoneSays("The phone", "What is wrong? Choose it from the list, then say where.");
  phoneList();
}

/** The phone put down. Put down for another panel, it leaves the focus to that one rather than taking it back to its button. */
function hungUp(refocus = true) {
  calling = null;
  $("phoneInput").value = "";
  if (refocus && document.activeElement?.closest?.("#phone")) $("phoneBtn").focus();
}

/** A call chosen from the list, by its place in it: the box asks where. */
function choose(i) {
  const call = CALLS[i];
  if (!call || !lessonLets({ kind: "call", issue: call.issue })) return;
  calling = call.issue;
  for (const b of $("phoneList").querySelectorAll("button")) b.setAttribute("aria-pressed", String(b.dataset.call === String(i)));
  const input = $("phoneInput");
  input.disabled = false;
  $("phoneRing").disabled = false;
  $("phoneBack").disabled = false;
  $("phoneAsk").textContent = PHONE_WORDS[call.issue].ask;
  phoneSays(call.to, PHONE_WORDS[call.issue].ask);
  input.value = "";
  input.focus();
}

/** Ring, with the number in the box. An answer asking again keeps the box; any other puts the phone back at its list. */
function ringNow() {
  if (!sim || !calling) return;
  const call = { kind: "ring", issue: calling, id: $("phoneInput").value };
  if (!lessonLets(call)) return;
  const answer = sim.ring(calling, call.id);
  if (answer.ok) lessonDid(call);
  phoneSays(answer.from, answer.text, answer.ask);
  say(answer.text, answer.ok, answer.from);
  sound.play(answer.ok ? "set" : "refuse");
  if (answer.ask) {
    $("phoneInput").select();
    return;
  }
  const said = { from: answer.from, text: answer.text };
  phoneList();
  phoneSays(said.from, said.text);
  panels(true);
}

/** Where the pointer last was over the page, so the phone P puts up comes up there. */
let pointer = null;
document.addEventListener("pointermove", (ev) => { pointer = { x: ev.clientX, y: ev.clientY }; }, { passive: true });

/**
 * The phone put up where the signaller is looking: by P at the pointer, as
 * the menu on a right-click is, kept inside the window, and by its button,
 * or before the pointer has been anywhere, where the panels come.
 */
function phoneAt(at) {
  const box = $("phone");
  box.style.left = box.style.top = box.style.right = "";
  toggle("phone", true);
  if (!at) return;
  box.style.right = "auto";
  place(box, at.x, at.y);
}

/** The phone's own keys while it is up: a number from its list, and P to put it down. */
function phoneKey(ev) {
  if (ev.repeat) return;
  if (/^[1-9]$/.test(ev.key) && CALLS[Number(ev.key) - 1]) {
    ev.preventDefault();
    choose(Number(ev.key) - 1);
  } else if (keyFor(ev.key)?.id === "phone") {
    ev.preventDefault();
    toggle("phone", false);
  }
}

{
  const list = $("phoneList");
  CALLS.forEach((call, i) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "phoneCall";
    b.dataset.call = String(i);
    b.setAttribute("aria-pressed", "false");
    const key = document.createElement("kbd");
    key.textContent = String(i + 1);
    const says = document.createElement("span");
    says.textContent = call.says;
    const to = document.createElement("span");
    to.className = "phoneTo";
    to.textContent = call.to;
    b.append(key, says, to);
    b.addEventListener("click", () => choose(i));
    list.appendChild(b);
  });
  $("phoneKeys").textContent = PHONE_KEYS.map((k) => `${k.key === "1" ? `1–${CALLS.length}` : keyLabel(k.key)} ${k.short}`).join(" · ");
}
$("phoneInput").addEventListener("keydown", (ev) => {
  if (ev.key === "Enter") {
    ev.preventDefault();
    ringNow();
  } else if (ev.key === "Backspace" && !$("phoneInput").value) {
    ev.preventDefault();
    phoneList();
    phoneSays("The phone", "What is wrong? Choose it from the list, then say where.");
  }
});
$("phoneRing").addEventListener("click", ringNow);
$("phoneBack").addEventListener("click", () => { phoneList(); phoneSays("The phone", "What is wrong? Choose it from the list, then say where."); });
$("phoneHang").addEventListener("click", () => toggle("phone", false));
$("phoneBtn").addEventListener("click", () => {
  if (phoneUp()) toggle("phone", false);
  else if (lessonLets({ kind: "phone" })) phoneAt(null);
});

/* ---- Keys ---------------------------------------------------------------- */

/** How far an arrow moves the board: a quarter of what is on screen. */
function nudge(across, down) {
  const host = $("display");
  screen.panBy(across * host.clientWidth / 4, down * host.clientHeight / 4);
}

/** A zoom by key, about the middle of the board, as the wheel zooms about the pointer. */
function zoomKey(factor) {
  const host = $("display");
  screen.zoomAt(host.clientWidth / 2, host.clientHeight / 2, factor);
}

/** What each key in `KEYS` does, by its id. */
const ON_KEY = {
  hold: () => (sim.training ? pace(0) : say("The clock never stops on a shift: only the training desk's can be held.")),
  rate1: () => pace(1),
  rate2: () => pace(2),
  rate4: () => pace(4),
  rate8: () => pace(8),
  west: () => nudge(1, 0),
  east: () => nudge(-1, 0),
  north: () => nudge(0, 1),
  south: () => nudge(0, -1),
  zoomIn: () => zoomKey(1.25),
  zoomOut: () => zoomKey(1 / 1.25),
  home: () => screen.home(),
  fit: () => screen.fit(),
  drop: () => { if (entrance) { clearSelection(); say("Route put down before it was asked for."); } },
  network: () => showMap(),
  timetable: () => document.querySelector('.tabs [data-pane="timetable"]').click(),
  trains: () => document.querySelector('.tabs [data-pane="trains"]').click(),
  alarms: () => document.querySelector('.tabs [data-pane="alarms"]').click(),
  // Every alarm waiting, one or many, whether or not the Alarms tab is up to show its button.
  ackAll: () => $("ackAll").click(),
  find: () => $("sideFilter").focus(),
  phone: () => { if (lessonLets({ kind: "phone" })) phoneAt(pointer); },
  lesson: () => learnTheDesk(),
  guide: () => toggle("guide"),
  menu: () => toggle("settings"),
  next: () => { if (tutor && !$("tutorNext").hidden) $("tutorNext").click(); },
};

// The keys only work the desk: not under the start screen or the results,
// not while a box is being typed in, and never with Ctrl, Alt or the command
// key held, which belong to the browser. The board's keys wait while the
// network diagram is over it.
document.addEventListener("keydown", (ev) => {
  if (ev.ctrlKey || ev.metaKey || ev.altKey) return;
  // A box's typing, and Enter on a button or a link, are the control's own.
  // The path starts at what has the focus, which in the rule book's shadow
  // root the event's target does not reach.
  if (leftToControl(ev.key, ev.composedPath()[0])) return;
  if (!sim || !$("veil").hidden || !$("results").hidden) return;
  // While the phone is up its keys are the phone's, and the desk's wait.
  if (phoneUp()) {
    phoneKey(ev);
    return;
  }
  const entry = keyFor(ev.key);
  if (!entry) return;
  if (ev.repeat && !entry.repeat) return;
  if (mapOpen && entry.group === "The board" && entry.id !== "network") return;
  ev.preventDefault();
  ON_KEY[entry.id]();
});

// Every key is written where its action is: in the tip on its control, or in
// the box's own words for the finder. The written guide's Appendix A lists
// them all, in its own file, and a test holds it to this table.
for (const k of KEYS) {
  const el = k.el && document.querySelector(k.el);
  if (!el) continue;
  if (el.tagName === "INPUT") el.placeholder = `${el.placeholder} (${keyLabel(k.key)})`;
  else el.dataset.tip = `${el.dataset.tip ?? k.does} (${keyLabel(k.key)})`;
}

/* ---- The written guide ---------------------------------------------------- */

/**
 * The written guide is the rule book, Rule Book Module SO/01, a document of
 * its own in `guide/`, fetched the first time the guide is opened and set out
 * in a shadow root, so its printed page's styles and the desk's never meet.
 */
const RULE_BOOK = new URL("guide/so01.html", document.baseURI);
/** A page of the rule book, as wide as it is printed. */
const PAGE_WIDTH = 794;
let ruleBook = null;
let ruleBookRead = false;

async function openRuleBook() {
  if (!ruleBook) {
    ruleBook = $("guideDoc").attachShadow({ mode: "open" });
    // Its cross-references move the reader within it, not the page's address.
    ruleBook.addEventListener("click", (ev) => {
      const link = ev.target.closest?.('a[href^="#"]');
      if (!link) return;
      ev.preventDefault();
      ruleBook.getElementById(link.getAttribute("href").slice(1))?.scrollIntoView({ block: "start" });
    });
  }
  fitRuleBook();
  if (ruleBookRead) return;
  try {
    const answer = await fetch(RULE_BOOK);
    if (!answer.ok) throw new Error(`${answer.status}`);
    const doc = new DOMParser().parseFromString(await answer.text(), "text/html");
    // Its figures are named from its own folder, and what it says of its body is said of the host.
    for (const img of doc.querySelectorAll("img")) img.src = new URL(img.getAttribute("src"), RULE_BOOK).href;
    const style = document.createElement("style");
    style.textContent = [...doc.querySelectorAll("style")].map((s) => s.textContent).join("\n").replace(/(^|[\s}])body\s*\{/g, "$1:host{")
      // A reference followed lands below the panel's bar, not under it.
      + "\n[id]{scroll-margin-top:72px}";
    ruleBook.replaceChildren(style, ...doc.body.childNodes);
    ruleBookRead = true;
  } catch {
    ruleBook.textContent = "The rule book could not be fetched. Close the guide and open it again to try once more.";
  }
}

/** Its pages at the size they are printed, or smaller where the panel is narrower than a page. */
function fitRuleBook() {
  if (!ruleBook || $("guide").hidden) return;
  // The panel, not the host: the host's own width is counted in its zoom.
  const room = $("guide").clientWidth - 24;
  ruleBook.host.style.zoom = String(Math.min(1, room / PAGE_WIDTH));
}
addEventListener("resize", fitRuleBook);

sound.setLevels(store.readSound());
$("masterLevel").value = String(Math.round(sound.levelOf("master") * 100));
$("effectsLevel").value = String(Math.round(sound.levelOf("effects") * 100));
$("arrivalsLevel").value = String(Math.round(sound.levelOf("arrivals") * 100));
// Each slider plays what it sets the level of, at the level it now has.
for (const [id, which, sample] of [["masterLevel", "master", "click"], ["effectsLevel", "effects", "click"], ["arrivalsLevel", "arrivals", "arrive"]]) {
  $(id).addEventListener("input", () => { sound.setLevel(which, Number($(id).value) / 100); store.saveSound(sound.allLevels()); sound.play(sample); });
}

/* ---- Saving -------------------------------------------------------------- */

function stash() {
  // A lesson is not a shift to come back to.
  if (!sim || tutor) return;
  if (sim.finished) store.clearRun();
  else store.saveRun(sim.snapshot());
}
window.addEventListener("pagehide", stash);
window.addEventListener("beforeunload", stash);
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") stash(); });

buildZonePick();
buildLevels();
buildClockIns();
// A shift left in progress, by the key that swaps the page away or by a
// closed tab, is picked up where it was rather than offered again.
if (store.loadRun()?.finished === false) begin(false);
else openStart();
requestAnimationFrame(frame);
void clock;
