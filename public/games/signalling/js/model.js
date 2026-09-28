// The rules: the network compiled into a graph, every route a signal can
// set, the interlocking that decides whether it may, the trains, the train
// describer, automatic route setting for the zones the signaller is not
// looking at, what goes wrong during a shift, and how the shift is scored.
// Nothing here touches the document, so all of it runs under test.

import { ZONES, SCALE, SPEED } from "./layouts.js";
import { KINDS, DEPOTS, planFor, disruptionsFor, treatmentTrain, SHIFT, isDepotRoad, stablingsFrom, FAULT_TEAM, RINGS_IN, LIMP, FALSE_CALL } from "./schedule.js";

const nodeKey = (zone, xy) => `${zone}:${xy[0]},${xy[1]}`;

/** Seconds since midnight for "HH:MM" or "HH:MM:SS". */
export function clock(text) {
  const [h, m, s = "0"] = text.split(":");
  return Number(h) * 3600 + Number(m) * 60 + Number(s);
}
/** "HH:MM" for a time in seconds; with `seconds` on, "HH:MM:SS". */
export function hhmm(t, seconds = false) {
  t = Math.max(0, Math.round(t));
  const h = Math.floor(t / 3600) % 24, m = Math.floor(t / 60) % 60, s = t % 60;
  const two = (n) => String(n).padStart(2, "0");
  return seconds ? `${two(h)}:${two(m)}:${two(s)}` : `${two(h)}:${two(m)}`;
}

/* ---- The graph -------------------------------------------------------- */

/**
 * Turn the zones into one graph. Strokes become edges between nodes keyed
 * by zone and coordinate, with linked boundary nodes folded into one; every
 * point, crossing, signal and fringe is resolved to the strokes it touches.
 */
export function compile(zones = ZONES) {
  const canon = new Map();
  for (const z of zones) {
    for (const l of z.links) {
      const a = nodeKey(z.id, l.node), b = nodeKey(l.zone, l.at);
      const c = a < b ? a : b;
      canon.set(a, c);
      canon.set(b, c);
    }
  }
  const canonical = (k) => canon.get(k) ?? k;
  const nodes = new Map();
  const nodeAt = (zone, xy) => {
    const k = canonical(nodeKey(zone, xy));
    let n = nodes.get(k);
    if (!n) {
      n = { key: k, strokes: [], point: null, crossing: null, signals: [], fringe: null };
      nodes.set(k, n);
    }
    return n;
  };
  const strokes = [];
  const tcs = new Map();
  for (const z of zones) {
    for (const s of z.strokes) {
      let a = s.a, b = s.b;
      // `a` is always the western end, so that "E" means a to b.
      if (a[0] > b[0] || (a[0] === b[0] && a[1] > b[1])) [a, b] = [b, a];
      const px = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const stroke = {
        id: strokes.length,
        zone: z.id,
        tc: s.tc,
        a, b,
        na: nodeAt(z.id, a).key,
        nb: nodeAt(z.id, b).key,
        len: s.len ?? px * SCALE,
        speed: s.speed ?? (a[1] === b[1] ? SPEED.main : SPEED.junction),
        hidden: !!s.hidden,
        dir: s.dir ?? "both",
        platform: s.platform ?? null,
        waypoint: s.waypoint ?? null,
        single: s.single ?? null,
        flyover: !!s.flyover,
      };
      strokes.push(stroke);
      nodes.get(stroke.na).strokes.push(stroke.id);
      nodes.get(stroke.nb).strokes.push(stroke.id);
      let tc = tcs.get(s.tc);
      if (!tc) tcs.set(s.tc, (tc = { id: s.tc, zone: z.id, strokes: [], platform: null, waypoint: null, single: null }));
      tc.strokes.push(stroke.id);
      if (stroke.platform) tc.platform = stroke.platform;
      if (stroke.waypoint) tc.waypoint = stroke.waypoint;
      if (stroke.single) tc.single = stroke.single;
    }
  }
  // A road the board writes a name beside, a letter and a number, is
  // printed by that name wherever its circuit is named (`tcName()`).
  for (const tc of tcs.values()) {
    const road = tc.platform?.[1];
    if (road && /^[A-Za-z]\d+$/.test(road)) PRINTED.set(tc.id, road.toUpperCase());
  }
  /** The stroke at `node` whose other end is `far`, in that zone's coordinates. */
  const strokeToward = (zone, node, far, what) => {
    const from = canonical(nodeKey(zone, node)), to = canonical(nodeKey(zone, far));
    const n = nodes.get(from);
    if (!n) throw new Error(`${what}: no track at ${from}`);
    const found = n.strokes.find((id) => {
      const s = strokes[id];
      return (s.na === from && s.nb === to) || (s.nb === from && s.na === to);
    });
    if (found === undefined) throw new Error(`${what}: no stroke from ${from} toward ${to}`);
    return found;
  };
  const points = new Map();
  const gangs = new Map();
  const signals = new Map();
  const fringes = new Map();
  for (const z of zones) {
    for (const p of z.points) {
      const node = nodes.get(canonical(nodeKey(z.id, p.node)));
      if (node.strokes.length !== 3) throw new Error(`point ${p.id}: ${node.strokes.length} strokes meet at its node`);
      const toe = strokeToward(z.id, p.node, p.toe, `point ${p.id}`);
      const reverse = strokeToward(z.id, p.node, p.reverse, `point ${p.id}`);
      const normal = node.strokes.find((id) => id !== toe && id !== reverse);
      if (points.has(p.id)) throw new Error(`point ${p.id} is in two zones: numbers are one series over the railway`);
      points.set(p.id, { id: p.id, zone: z.id, node: node.key, x: p.node[0], y: p.node[1], toe, normal, reverse, gang: p.gang ?? p.id });
      node.point = p.id;
      if (!gangs.has(p.gang ?? p.id)) gangs.set(p.gang ?? p.id, []);
      gangs.get(p.gang ?? p.id).push(p.id);
    }
    for (const x of z.crossings ?? []) {
      const node = nodes.get(canonical(nodeKey(z.id, x.node)));
      node.crossing = x.pairs.map((pair) => pair.map((far) => strokeToward(z.id, x.node, far, "crossing")));
    }
    for (const s of z.signals) {
      const node = nodes.get(canonical(nodeKey(z.id, s.node)));
      const from = strokeToward(z.id, s.node, s.from, `signal ${s.id}`);
      const dx = s.node[0] - s.from[0], dy = s.node[1] - s.from[1], d = Math.hypot(dx, dy);
      signals.set(s.id, { id: s.id, zone: z.id, node: node.key, from, kind: s.kind, x: s.node[0], y: s.node[1], dx: dx / d, dy: dy / d, routes: [] });
      node.signals.push(s.id);
    }
    for (const f of z.fringes) {
      const node = nodes.get(canonical(nodeKey(z.id, f.node)));
      const from = strokeToward(z.id, f.node, f.from, `fringe ${f.id}`);
      fringes.set(f.id, { id: f.id, name: f.name, line: f.line ?? null, zone: z.id, node: node.key, from, out: f.out, x: f.node[0], y: f.node[1] });
      node.fringe = f.id;
    }
  }
  const lcs = new Map();
  for (const z of zones) {
    for (const lc of z.lcs ?? []) {
      for (const tc of lc.tcs) if (!tcs.has(tc)) throw new Error(`crossing ${lc.id}: no circuit ${tc}`);
      lcs.set(lc.id, { id: lc.id, name: lc.name, zone: z.id, x: lc.x, top: lc.top, bottom: lc.bottom, tcs: lc.tcs });
    }
  }
  const net = { zones, strokes, nodes, tcs, points, gangs, signals, fringes, lcs, routes: new Map(), canonical };
  for (const signal of signals.values()) {
    for (const route of findRoutes(net, signal)) {
      if (net.routes.has(route.id)) {
        // Two ways between the same pair: keep the one a signaller would
        // mean, the straighter, with fewer points reversed, and then the
        // shorter. Across a ladder of crossovers the zigzag over the other
        // line and back can be the shorter in metres.
        const had = net.routes.get(route.id);
        const reversed = (r) => r.points.filter((p) => p.lie === "R").length;
        if (reversed(had) < reversed(route) || (reversed(had) === reversed(route) && had.len <= route.len)) continue;
        signal.routes = signal.routes.filter((id) => id !== route.id);
      }
      net.routes.set(route.id, route);
      signal.routes.push(route.id);
    }
  }
  return net;
}

/** The node at the far end of `stroke` from `node`. */
export function farEnd(net, strokeId, node) {
  const s = net.strokes[strokeId];
  return s.na === node ? s.nb : s.na;
}

/** Whether running along `stroke` away from `node` is the stroke's allowed way. */
function runnable(net, strokeId, node) {
  const s = net.strokes[strokeId];
  if (s.dir === "both") return true;
  return (s.na === node ? "E" : "W") === s.dir;
}

/**
 * The strokes a train arriving at `node` along `from` can continue on. At a
 * facing point both legs are offered with the lie each needs; at a trailing
 * point the one continuation needs the lie that leads from that leg; a
 * crossing carries straight over. `lies` narrows a facing point to its
 * current lie when given.
 */
export function continuations(net, node, from, lies = null) {
  const n = net.nodes.get(node);
  if (n.point) {
    const p = net.points.get(n.point);
    if (from === p.toe) {
      const both = [{ stroke: p.normal, need: { id: p.id, lie: "N" } }, { stroke: p.reverse, need: { id: p.id, lie: "R" } }];
      return lies ? both.filter((o) => o.need.lie === lies.get(p.id)) : both;
    }
    if (from === p.normal) return [{ stroke: p.toe, need: { id: p.id, lie: "N" } }];
    if (from === p.reverse) return [{ stroke: p.toe, need: { id: p.id, lie: "R" } }];
    return [];
  }
  if (n.crossing) {
    for (const pair of n.crossing) {
      if (pair[0] === from) return [{ stroke: pair[1], need: null }];
      if (pair[1] === from) return [{ stroke: pair[0], need: null }];
    }
    return [];
  }
  const rest = n.strokes.filter((id) => id !== from);
  return rest.length === 1 ? [{ stroke: rest[0], need: null }] : [];
}

/** The same-direction signal standing at `node` for a train that arrived along `from`, if any. */
export function signalAt(net, node, from) {
  const n = net.nodes.get(node);
  for (const id of n.signals) if (net.signals.get(id).from === from) return net.signals.get(id);
  return null;
}

/** The longest a route may be, in metres: past this a search has left the railway. */
const ROUTE_REACH = 7000;

/**
 * Every route from a signal: each way forward through the points to the
 * next signal facing the same way, to a fringe that leads off the network,
 * or to a buffer stop.
 */
export function findRoutes(net, signal) {
  const routes = [];
  const walk = (node, from, strokes, points, len) => {
    if (from !== signal.from) {
      const exit = signalAt(net, node, from);
      if (exit) return routes.push(finish({ kind: "signal", id: exit.id }));
      const n = net.nodes.get(node);
      if (n.fringe) {
        const f = net.fringes.get(n.fringe);
        if (f.out && f.from === from) return routes.push(finish({ kind: "fringe", id: f.id }));
      }
    }
    const options = continuations(net, node, from);
    let went = 0;
    for (const o of options) {
      const s = net.strokes[o.stroke];
      if (s.hidden || strokes.includes(o.stroke) || !runnable(net, o.stroke, node)) continue;
      if (len + s.len > ROUTE_REACH) continue;
      went++;
      const need = o.need ? [...points, { ...o.need, tcs: [net.strokes[from].tc, s.tc] }] : points;
      walk(farEnd(net, o.stroke, node), o.stroke, [...strokes, o.stroke], need, len + s.len);
    }
    if (!went && strokes.length && options.length === 0) routes.push(finish({ kind: "buffer", id: node }));
    function finish(exit) {
      const tcs = [];
      for (const id of strokes) if (!tcs.includes(net.strokes[id].tc)) tcs.push(net.strokes[id].tc);
      // A crossover moves as one, so the partner point needs the same lie.
      const needed = new Map();
      for (const p of points) {
        for (const id of net.gangs.get(net.points.get(p.id).gang)) {
          if (!needed.has(id)) needed.set(id, { id, lie: p.lie, tcs: p.tcs });
        }
      }
      return {
        id: `${signal.id}>${exit.id}`,
        entry: signal.id,
        exit,
        strokes,
        tcs,
        points: [...needed.values()],
        diverging: points.some((p) => p.lie === "R"),
        len,
      };
    }
  };
  walk(signal.node, signal.from, [], [], 0);
  return routes;
}

/**
 * The berth a train is described in while it runs along `path` from stroke
 * `idx`: the next signal it faces, the fringe it is heading off, or, at a
 * buffer stop, the signal that will take it out again.
 */
export function berthAhead(net, path, idx) {
  for (let k = Math.max(0, idx); k < path.length; k++) {
    const s = net.strokes[path[k].stroke];
    const end = path[k].forward ? s.nb : s.na;
    const sig = signalAt(net, end, s.id);
    if (sig) return sig.id;
    const n = net.nodes.get(end);
    if (n.fringe) {
      const f = net.fringes.get(n.fringe);
      if (f.from === s.id) return f.id;
    }
  }
  const last = path[path.length - 1];
  if (!last) return null;
  const s = net.strokes[last.stroke];
  const back = signalAt(net, last.forward ? s.na : s.nb, s.id);
  return back ? back.id : null;
}

/* ---- The shift -------------------------------------------------------- */

/** How long points take to move, and how long a cancelled route stays held. */
const POINTS_TIME = 4;
const APPROACH_LOCK = 120;
/** How close to a signal a train counts as approaching it, in metres. */
const APPROACH = 1200;
/** How far ahead of a train automatic route setting looks, in metres. */
const ARS_REACH = 1800;
/** Metres short of a signal or a buffer stop a train comes to rest. */
const STAND_OFF = 8;
const BUFFER_OFF = 10;
/** Speed under an authority to pass a signal at danger. */
const CAUTION = 5;
/** A yard arrival is taken off the reception line after this long. */
const DISPOSE = 90;
/** The kinds of train that carry passengers. */
const PASSENGER = new Set(["express", "local", "high"]);
/** The faults on the ground, which the fault team mends once they are rung in. */
const GROUND = new Set(["tc", "points", "signal"]);
/**
 * What each kind of thing on the phone is, in a sentence, and the question
 * asking for its number: the answer asks it again when a number was not
 * one, and the phone's box is labelled with it.
 */
export const PHONE_WORDS = {
  signal: { a: "a signal", ask: "Which signal?" },
  points: { a: "a set of points", ask: "Which points?" },
  tc: { a: "a circuit", ask: "Which circuit?" },
  train: { a: "a train", ask: "Which train, by its headcode?" },
};
/** Which way a train's front is heading, "E" or "W", by the stroke it is on. */
function headingOf(net, train) {
  let k = 0;
  while (k < train.path.length - 1 && train.cum[k + 1] < train.pos) k++;
  const p = train.path[k];
  const s = net.strokes[p.stroke];
  return (s.b[0] - s.a[0]) * (p.forward ? 1 : -1) >= 0 ? "E" : "W";
}

/** How long before a train in a platform is due away its dispatcher presses train ready to start, in seconds. */
const TRTS_LEAD = 30;
/** Simulation step, in seconds of railway time. */
export const STEP = 0.5;
/**
 * The railway's hour before the clock-in, in seconds, run before a shift is
 * handed over (`warmUp()`): every train out at the clock-in set off inside
 * it, the longest booked run being under fifty minutes.
 */
export const WARM_UP = 3600;
/** Seconds late at which a train is late: under it, it is on time, for the score and for everything the page shows. */
export const ON_TIME = 300;
/** Whole minutes late, or early as a negative, the way the railway counts them: under a minute is on time, and 4:59 is four. */
export function wholeMinutes(seconds) {
  return Math.trunc(seconds / 60);
}
/** Alarms kept on the list, for every desk together. */
const ALARMS_KEPT = 40;
/** The desk that is nobody's, worked while the hour before the clock-in runs: ARS works all eight, and nothing is marked. */
const NOBODY = "-";
/** A train stood this long on the signaller's own desk with nowhere to go is a black mark. */
const MARK_STAND = 600;
/** Delay a train picks up crossing the signaller's own zone that earns a mark. */
const MARK_DELAY = 600;
/** How often a waiting train's way on is looked at to see whether it is shut, in seconds. */
const SHUT_CHECK = 15;
/** Marks the board allows before it relieves the signaller. */
export const MARKS_ALLOWED = 3;
/** How long a colleague on another desk takes to interpose, authorise, or find another platform. */
const COLLEAGUE = { interpose: 60, authorise: 90, replatform: 120 };
/** How long a driver stands at a failed automatic before passing it by the rule. */
const STOP_AND_PROCEED = 60;
/** How close a train follows the tail of the one ahead, in metres. */
const FOLLOW = 25;
/** How long barriers take to come down, and to go up, in seconds. */
const LC_LOWER = 20;
const LC_RAISE = 10;
/** Barriers down this long with nothing signalled over them is a road queue. */
const LC_QUEUE = 240;
/**
 * How long a train stands at a signal it cannot go on from before it counts
 * as sent the wrong way, and how long it then stands in a platform before
 * the driver changes ends.
 */
const LOST_WAIT = 60;
const LOST_TURN = 90;

/** A speed in metres a second as the drivers hear it. */
const mph = (v) => Math.round(v * 2.237 / 5) * 5;

export class Simulation {
  constructor(net, { seed = 1, level = "mixed", zone = "CT", services = undefined, shift = SHIFT, training = false, warm = false } = {}) {
    this.net = net;
    // On the training desk nobody is counting: a mark is written, and nobody is relieved.
    this.training = training;
    this.seed = seed;
    this.level = level;
    this.zone = zone;
    // The shift's window: when the clock starts, when the last train is due, and when it is over regardless.
    this.shift = { ...shift };
    this.window = { start: clock(shift.start), end: clock(shift.end), hardEnd: clock(shift.hardEnd) };
    // A shift taken over warm starts its clock an hour early, and runs that
    // hour before it is handed over (`warmUp()`); `from` is where it starts.
    this.warm = warm && !training;
    this.window.from = this.window.start - (this.warm ? WARM_UP : 0);
    this.time = this.window.from;
    this.rate = 1;
    this.paused = true;
    this.finished = false;
    this.plan = new Map(planFor(services, this.shift, this.warm ? WARM_UP : 0).map((s) => [s.id, s]));
    // What goes wrong is rolled from the shift's own trains, the same with the hour before or without it.
    this.disruptions = disruptionsFor(seed, level, [...this.plan.values()].filter((s) => !s.warm), this.shift, zone);
    // Leaf fall sends for the railhead treatment train, which the timetable never had.
    const leaves = this.disruptions.find((d) => d.kind === "leaves");
    if (leaves) for (const s of planFor([treatmentTrain(leaves, this.shift)], this.shift)) this.plan.set(s.id, s);
    // Empty stock booked again from where it was left (`rebook()`), kept for the save.
    this.rebooked = [];
    this.points = new Map([...net.points.keys()].map((id) => [id, { lie: "N", wanted: "N", moving: 0, failed: false }]));
    this.tcs = new Map([...net.tcs.keys()].map((id) => [id, { trains: new Set(), failed: false, blocked: false, wanted: false, mending: false, lockedBy: null }]));
    this.routes = new Map();
    this.signals = new Map([...net.signals.keys()].map((id) => [id, { route: null, reminder: false, authorised: false, failed: false }]));
    this.berths = new Map();
    for (const id of net.signals.keys()) this.berths.set(id, null);
    for (const id of net.fringes.keys()) this.berths.set(id, null);
    this.trains = new Map();
    this.spawned = new Set();
    this.results = new Map();
    this.alarms = [];
    // Each alarm's number, counted up as they come, so the page can tell a new one from the list alone.
    this.alarmSeq = 0;
    this.log = [];
    this.nextTrain = 1;
    this.arsClock = 0;
    this.marks = [];
    this.relieved = false;
    this.relievedAt = null;
    this.lcs = new Map([...net.lcs.keys()].map((id) => [id, { barriers: "up", timer: 0, since: this.time }]));
    // The fault team's trips to where a report with the wrong number sent
    // them, and nothing was wrong when they got there.
    this.visits = [];
    // Calls about nothing, each taken off the shift's points (`FALSE_CALL`).
    this.falseCalls = [];
    // A line under possession is the engineers' from the start of the
    // shift: at once, or, taken over warm, at the clock-in (`warmUp()`).
    if (!this.warm) for (const d of this.disruptions) if (d.kind === "possession") this.apply(d);
    // Which desk each place in the timetable is on, for when the signaller's
    // own desk has nothing more coming to it.
    this.placeZone = placeZones(net);
    this.clearedAt = null;
    this.runningOut = false;
  }

  /** Whether a signal is on the signaller's own desk. */
  mine(signal) {
    return !!signal && signal.zone === this.zone;
  }

  /* ---- Reading the state ------------------------------------------- */

  /** The active route from a signal, or null. */
  routeFrom(signalId) {
    const id = this.signals.get(signalId).route;
    return id ? this.routes.get(id) : null;
  }

  /** Whether a point is held by an active route, and in which lie. */
  pointLock(pointId) {
    for (const r of this.routes.values()) {
      const need = r.def.points.find((p) => p.id === pointId);
      if (need && need.tcs.some((tc) => r.held.has(tc))) return need.lie;
    }
    return null;
  }

  /** Whether a track circuit reads as occupied: a train on it, or a failure. */
  occupied(tc) {
    const t = this.tcs.get(tc);
    return t.trains.size > 0 || t.failed;
  }

  /** The circuit beyond a route's exit signal, which must be clear to set it. */
  overlapOf(def) {
    if (def.exit.kind !== "signal") return null;
    const exit = this.net.signals.get(def.exit.id);
    // No overlap is asked beyond an automatic: the block past it is the
    // next block, and a train is signalled up to an automatic at red with
    // the one ahead still in it, which is what the blocks are for.
    if (exit.kind === "auto") return null;
    const lies = new Map([...this.points].map(([id, p]) => [id, p.lie]));
    const on = continuations(this.net, exit.node, exit.from, lies);
    if (!on.length) return null;
    const s = this.net.strokes[on[0].stroke];
    return s.hidden ? null : s.tc;
  }

  /** Whether a signal shows a proceed aspect. */
  proceed(signalId) {
    const route = this.routeFrom(signalId);
    if (!route || route.entered || route.cancelAt !== null) return false;
    const sig = this.signals.get(signalId);
    if (sig.reminder || sig.failed) return false;
    for (const p of route.def.points) {
      const pt = this.points.get(p.id);
      if (pt.lie !== p.lie || pt.moving > 0) return false;
    }
    for (const tc of route.def.tcs) {
      const t = this.tcs.get(tc);
      if (this.occupied(tc) || t.blocked || t.mending || (t.lockedBy && t.lockedBy !== route.id)) return false;
    }
    for (const tc of route.def.tcs) {
      const lc = this.lcOf(tc);
      if (lc && this.lcs.get(lc.id).barriers !== "down") return false;
    }
    const overlap = this.overlapOf(route.def);
    if (overlap && this.occupied(overlap)) return false;
    return true;
  }

  /**
   * The aspect a signal shows, four-aspect: red with no route or a route
   * not yet clear; off, a yellow with one section in hand, to a signal at
   * red or a buffer stop; a double yellow with two, to a signal showing a
   * single yellow; and green with three or more. Shunt signals only show
   * off or on.
   */
  aspect(signalId) {
    if (!this.proceed(signalId)) return "red";
    if (this.net.signals.get(signalId).kind === "shunt") return "off";
    return ["yellow", "double", "green"][this.inHand(signalId) - 1];
  }

  /**
   * How many sections a main signal that is off has in hand, counting no
   * further than `most`: one when its route ends at a signal at red or a
   * buffer stop, and one more for each signal off beyond. A route off the
   * edge of the railway, or to a shunt signal, has as many as are counted.
   */
  inHand(signalId, most = 3) {
    const exit = this.routeFrom(signalId).def.exit;
    if (exit.kind === "buffer") return 1;
    if (exit.kind !== "signal" || this.net.signals.get(exit.id).kind === "shunt") return most;
    if (!this.proceed(exit.id)) return 1;
    return most <= 2 ? most : 1 + this.inHand(exit.id, most - 1);
  }

  /** The level crossing a circuit belongs to, if any. */
  lcOf(tc) {
    for (const lc of this.net.lcs.values()) if (lc.tcs.includes(tc)) return lc;
    return null;
  }

  /** Whether a route is set over a crossing, or a train is on it. */
  lcHeld(lc) {
    return lc.tcs.some((tc) => this.tcs.get(tc).lockedBy || this.tcs.get(tc).trains.size);
  }

  /** Why a route cannot be set now, or null if it can. */
  refusal(def) {
    const sig = this.signals.get(def.entry);
    if (sig.route) return `${def.entry} already has a route set`;
    if (sig.reminder) return `${def.entry} has a reminder applied`;
    // A circuit that has failed reads as occupied, but the route may still
    // be set over it so that the points are locked: the signal stays on, and
    // the train is taken past under an authority.
    for (const tc of def.tcs) {
      const t = this.tcs.get(tc);
      if (t.blocked) return `${tcName(tc)} is blocked`;
      if (t.mending) return `the fault team has ${tcName(tc)}`;
      // Nothing new is set over a circuit the fault team is waiting for, so it clears for them.
      if (t.wanted) return `the fault team is waiting for ${tcName(tc)}`;
      if (t.trains.size) return `${tcName(tc)} is occupied`;
      if (t.lockedBy) return `conflicts with route ${t.lockedBy}`;
    }
    for (const p of def.points) {
      const pt = this.points.get(p.id);
      const held = this.pointLock(p.id);
      if (held && held !== p.lie) return `points ${p.id} are locked ${held === "N" ? "normal" : "reverse"}`;
      if (pt.failed && pt.lie !== p.lie) return `points ${p.id} have failed`;
    }
    const overlap = this.overlapOf(def);
    if (overlap && this.tcs.get(overlap).trains.size) return `overlap ${tcName(overlap)} is occupied`;
    return null;
  }

  /** The route from `entry` that ends at `exit`: a signal, fringe, or buffer node. */
  routeBetween(entry, exit) {
    const sig = this.net.signals.get(entry);
    if (!sig) return null;
    for (const id of sig.routes) {
      const def = this.net.routes.get(id);
      if (def.exit.id === exit) return def;
    }
    return null;
  }

  /**
   * A route towards a signal that lies beyond one or more automatic
   * signals, however many: the first route of the run, up to the first
   * automatic, since the automatics see to the rest themselves. Null when
   * no such run ends at `exit`.
   */
  routeThrough(entry, exit) {
    const sig = this.net.signals.get(entry);
    if (!sig) return null;
    for (const id of sig.routes) {
      const first = this.net.routes.get(id);
      if (this.automaticsTo(first, exit).length) return first;
    }
    return null;
  }

  /**
   * The automatics a road runs on through from the end of route `def` to
   * `exit`, first to last, or none when the run of automatics beyond it
   * does not end there.
   */
  automaticsTo(def, exit) {
    const autos = [];
    let at = def;
    while (at.exit.kind === "signal" && at.exit.id !== exit) {
      const sig = this.net.signals.get(at.exit.id);
      if (sig.kind !== "auto" || sig.routes.length !== 1 || autos.includes(sig.id)) return [];
      autos.push(sig.id);
      at = this.net.routes.get(sig.routes[0]);
    }
    return at.exit.id === exit ? autos : [];
  }

  /* ---- The signaller's commands ------------------------------------- */

  setRoute(entry, exit, by = "signaller") {
    const def = this.routeBetween(entry, exit) ?? this.routeThrough(entry, exit);
    if (!def) return this.say(`No route from ${entry} to ${exitName(this.net, exit)}`, false);
    const why = this.refusal(def);
    if (why) return this.say(`${def.entry} to ${exitName(this.net, exit)}: ${why}`, false);
    const route = { id: def.id, def, entered: false, cancelAt: null, held: new Set(def.tcs), train: null, setAt: this.time, by };
    this.routes.set(def.id, route);
    this.signals.get(def.entry).route = def.id;
    for (const tc of def.tcs) this.tcs.get(tc).lockedBy = def.id;
    for (const p of def.points) this.move(p.id, p.lie);
    // A road asked past automatics says it goes on through them, so it
    // does not read as stopping at the first.
    const autos = def.exit.id !== exit ? this.automaticsTo(def, exit) : [];
    const through = !autos.length ? "" : autos.length > 3 ? `, on through ${autos.length} automatics from ${autos[0]}` : `, on through the automatic${autos.length > 1 ? "s" : ""} ${andList(autos)}`;
    return this.say(`${def.entry} to ${exitName(this.net, exit)}: route set${through}${by === "ars" ? " by ARS" : ""}`, true, by !== "signaller");
  }

  /**
   * The automatic signals clear themselves: each has one route, to the
   * next signal along the line, and it is set whenever the block is free,
   * on every desk, with nothing for anyone to do. A reminder keeps one on.
   */
  autos() {
    for (const sig of this.net.signals.values()) {
      if (sig.kind !== "auto" || this.signals.get(sig.id).route) continue;
      const def = this.net.routes.get(sig.routes[0]);
      if (def && !this.refusal(def)) this.setRoute(def.entry, def.exit.id, "auto");
    }
  }

  cancelRoute(entry) {
    const route = this.routeFrom(entry);
    if (!route) return this.say(`${entry}: no route to cancel`, false);
    if (route.entered) return this.say(`${entry}: a train has passed, the route releases behind it`, false);
    if (route.cancelAt !== null) return this.say(`${entry}: already cancelling, released at ${hhmm(route.cancelAt, true)}`, false);
    // The routes strung on beyond this one for the same move go with it:
    // the train is not coming now, and a signal left off for a train that
    // is not coming is a signal off for whatever comes instead.
    const chain = this.chainBeyond(route);
    const approaching = this.approaching(entry);
    for (const t of this.trains.values()) this.truncate(t, entry);
    for (const r of chain) this.withdraw(r);
    const also = chain.length ? `, and the ${chain.length === 1 ? "route" : `${chain.length} routes`} beyond it` : "";
    if (approaching) {
      route.cancelAt = this.time + APPROACH_LOCK;
      return this.say(`${entry}: replaced to danger, approach locked for ${APPROACH_LOCK / 60} min${also}`, true);
    }
    this.release(route);
    return this.say(`${entry}: route cancelled${also}`, true);
  }

  /**
   * The routes set on from a route's exit signal for the same train, or
   * for nobody yet, as far as they run: not one a train has passed or that
   * is already going, and not one another train has taken up. A route into
   * a signal cannot be set while a train stands at that signal, so a route
   * beyond that is anyone's is this train's.
   */
  chainBeyond(route) {
    const chain = [];
    let at = route;
    while (at.def.exit.kind === "signal") {
      const next = this.routeFrom(at.def.exit.id);
      if (!next || next.entered || next.cancelAt !== null || (next.train !== null && next.train !== route.train)) break;
      // An automatic's route is nobody's to take away, since it clears
      // itself; the walk goes on through it to what was set beyond.
      if (next.by !== "auto") chain.push(next);
      at = next;
    }
    return chain;
  }

  /** Take a route away: at once, or after the approach lock if a train has seen its signal. */
  withdraw(route) {
    if (this.approaching(route.def.entry)) route.cancelAt = this.time + APPROACH_LOCK;
    else this.release(route);
  }

  /** Whether a train is close enough to a signal to have seen its aspect. */
  approaching(signalId) {
    const sig = this.net.signals.get(signalId);
    for (const t of this.trains.values()) {
      const k = this.nodeIndex(t, sig.node, sig.from);
      if (k === null) continue;
      const dist = t.cum[k] - t.pos;
      if (dist < APPROACH && dist > -1) return true;
    }
    return false;
  }

  swingPoints(pointId) {
    const gang = this.net.gangs.get(this.net.points.get(pointId).gang);
    for (const id of gang) {
      const held = this.pointLock(id);
      if (held) return this.say(`Points ${id} are locked by a route`, false);
      if (this.points.get(id).failed) return this.say(`Points ${id} have failed`, false);
    }
    const to = this.points.get(pointId).wanted === "N" ? "R" : "N";
    for (const id of gang) this.move(id, to);
    return this.say(`Points ${gang.join("/")} called ${to === "N" ? "normal" : "reverse"}`, true);
  }

  setReminder(signalId, on) {
    const sig = this.signals.get(signalId);
    const route = this.routeFrom(signalId);
    if (on && route && route.by !== "auto") return this.say(`${signalId}: cancel the route before applying a reminder`, false);
    // An automatic's own route was set for nobody, so the reminder takes it
    // away: at once, or after the approach lock if a train has seen the
    // signal off. One a train has passed releases behind the train. The
    // automatic stays on until the reminder comes off, then sets itself
    // again.
    if (on && route && !route.entered && route.cancelAt === null) {
      for (const t of this.trains.values()) this.truncate(t, signalId);
      this.withdraw(route);
    }
    sig.reminder = on;
    return this.say(`${signalId}: reminder ${on ? "applied" : "removed"}`, true);
  }

  /** Let the train standing at a signal pass it at danger, at caution. */
  authorise(signalId) {
    const route = this.routeFrom(signalId);
    if (!route) return this.say(`${signalId}: set a route first, so the points are locked`, false);
    const road = route.def.tcs.map((tc) => this.lcOf(tc)).find(Boolean);
    if (road && this.lcs.get(road.id).barriers !== "down") return this.say(`${signalId}: ${road.name} is open to the road; lower the barriers first`, false);
    if (route.entered) return this.say(`${signalId}: the train is already past`, false);
    // A route being cancelled is going: set it again, once it has gone, to take the train on.
    if (route.cancelAt !== null) return this.say(`${signalId}: the route is being cancelled, released at ${hhmm(route.cancelAt, true)}; set it again once it has gone`, false);
    for (const p of route.def.points) {
      const pt = this.points.get(p.id);
      if (pt.lie !== p.lie || pt.moving > 0) return this.say(`${signalId}: points ${p.id} are not yet lying for the route`, false);
    }
    const sig = this.net.signals.get(signalId);
    const train = this.standingAt(sig);
    if (!train) return this.say(`${signalId}: no train standing at the signal`, false);
    if (this.proceed(signalId)) return this.say(`${signalId}: the signal is off, no authority is needed`, false);
    train.caution = 2;
    this.signals.get(signalId).authorised = true;
    this.extend(train, route);
    return this.say(`${signalId}: driver authorised to pass at danger and proceed at caution`, true);
  }

  interpose(berthId, text) {
    const code = String(text).toUpperCase().replace(/[^0-9A-Z]/g, "").slice(0, 4);
    if (!/^[0-9][A-Z][0-9]{2}$/.test(code)) return this.say(`"${text}" is not a headcode`, false);
    this.berths.set(berthId, code);
    for (const t of this.trains.values()) if (t.berth === berthId) t.desc = code;
    return this.say(`${code} interposed at ${berthId}`, true);
  }

  cancelDescription(berthId) {
    const had = this.berths.get(berthId);
    this.berths.set(berthId, null);
    for (const t of this.trains.values()) if (t.berth === berthId) t.desc = null;
    return this.say(had ? `${had} cancelled from ${berthId}` : `${berthId}: nothing to cancel`, !!had);
  }

  lowerBarriers(lcId) {
    const lc = this.net.lcs.get(lcId);
    const state = this.lcs.get(lcId);
    if (!lc) return this.say(`No crossing ${lcId}`, false);
    if (state.barriers === "down" || state.barriers === "lowering") return this.say(`${lc.name}: the barriers are already ${state.barriers === "down" ? "down" : "coming down"}`, false);
    state.barriers = "lowering";
    state.timer = LC_LOWER;
    state.since = this.time;
    return this.say(`${lc.name}: barriers lowering`, true);
  }

  raiseBarriers(lcId) {
    const lc = this.net.lcs.get(lcId);
    const state = this.lcs.get(lcId);
    if (!lc) return this.say(`No crossing ${lcId}`, false);
    if (state.barriers === "up" || state.barriers === "raising") return this.say(`${lc.name}: the barriers are already ${state.barriers === "up" ? "up" : "going up"}`, false);
    if (this.lcHeld(lc)) return this.say(`${lc.name}: a route is set over the crossing`, false);
    state.barriers = "raising";
    state.timer = LC_RAISE;
    state.since = this.time;
    return this.say(`${lc.name}: barriers raising`, true);
  }

  selectZone(zoneId) {
    if (!this.net.zones.some((z) => z.id === zoneId)) return;
    this.zone = zoneId;
  }

  say(text, ok, quiet = false) {
    if (!quiet) this.log.push({ time: this.time, text, ok });
    if (this.log.length > 200) this.log.splice(0, this.log.length - 200);
    return { ok, text };
  }

  /**
   * Raise an alarm: its words, the desk it belongs to, a key that keeps one
   * alarm per thing rather than one per report, and who reported it, as a
   * control room hears it: a driver, a dispatcher, control, the fault team.
   */
  alarm(text, zone = null, key = null, from = null, at = null) {
    if (key) {
      const had = this.alarms.find((a) => a.key === key);
      if (had) { had.text = text; had.time = this.time; had.from = from; had.at = at; return; }
    } else if (this.alarms.some((a) => a.text === text && this.time - a.time < 600)) return;
    this.alarms.push({ seq: ++this.alarmSeq, time: this.time, text, zone, key, ack: false, from, at });
    // The list is kept short: what the signaller has acknowledged goes first,
    // then what is another desk's, and only then their oldest still to see.
    while (this.alarms.length > ALARMS_KEPT) {
      let i = this.alarms.findIndex((a) => a.ack);
      if (i < 0) i = this.alarms.findIndex((a) => a.zone && a.zone !== this.zone);
      this.alarms.splice(Math.max(i, 0), 1);
    }
    this.log.push({ time: this.time, text: from ? `${from}: ${text}` : text, ok: false, alarm: true });
  }

  /** The station a train is standing in, for the dispatcher on its platform, or null. */
  stationOf(train) {
    const k = Math.min(train.passed - 1, train.path.length - 1);
    const s = this.net.strokes[train.path[Math.max(0, k)].stroke];
    return (s.platform ?? s.waypoint)?.[0] ?? null;
  }

  /* ---- Points and routes -------------------------------------------- */

  move(pointId, lie) {
    const p = this.points.get(pointId);
    p.wanted = lie;
    if (p.failed || p.lie === lie) return;
    p.moving = POINTS_TIME;
  }

  release(route) {
    for (const tc of route.held) {
      const t = this.tcs.get(tc);
      if (t.lockedBy === route.id) t.lockedBy = null;
    }
    route.held.clear();
    this.routes.delete(route.id);
    const sig = this.signals.get(route.def.entry);
    if (sig.route === route.id) sig.route = null;
    sig.authorised = false;
  }

  /** The index in a train's path of the stroke that starts at `node`, arriving along `from`. */
  nodeIndex(train, node, from) {
    for (let k = 1; k < train.path.length; k++) {
      if (train.path[k - 1].stroke !== from) continue;
      const s = this.net.strokes[from];
      const end = train.path[k - 1].forward ? s.nb : s.na;
      if (end === node) return k;
    }
    const last = train.path[train.path.length - 1];
    if (last && last.stroke === from) {
      const s = this.net.strokes[from];
      if ((last.forward ? s.nb : s.na) === node) return train.path.length;
    }
    return null;
  }

  /** Take back a train's authority beyond a signal whose route is going. */
  truncate(train, signalId) {
    const sig = this.net.signals.get(signalId);
    const k = this.nodeIndex(train, sig.node, sig.from);
    if (k === null || k >= train.path.length) return;
    if (train.pos > train.cum[k] - 1) return;
    train.path.length = k;
    train.cum.length = k + 1;
    train.caution = 0;
    // A route the train had taken up beyond the cut is nobody's now, or
    // its signal would stay off for a train that never comes to it.
    for (const route of this.routes.values()) {
      if (route.train !== train.id || route.entered) continue;
      const sig = this.net.signals.get(route.def.entry);
      const at = this.nodeIndex(train, sig.node, sig.from);
      if (at === null || at >= train.path.length) route.train = null;
    }
  }

  /** Append a route's strokes to the train that stands at its entry signal. */
  extend(train, route) {
    // An automatic's route is nobody's decision: the last signal worked by a desk stays the one that sent the train.
    if (route.by !== "auto") {
      train.routedBy = route.by;
      train.routedFrom = route.def.entry;
    }
    // The first train over a line that was blocked examines it: at caution
    // to the next signal, and the line is examined behind it.
    for (const d of this.disruptions) {
      if (d.kind !== "examine" || !d.unexamined?.length) continue;
      const hit = route.def.tcs.filter((tc) => d.unexamined.includes(tc));
      if (!hit.length) continue;
      d.unexamined = d.unexamined.filter((tc) => !hit.includes(tc));
      train.caution = Math.max(train.caution, 2);
      this.say(`${train.desc ?? "A train"} examines the line ${d.where}, at caution to the next signal`, true);
    }
    let node = this.endNode(train);
    for (const id of route.def.strokes) {
      const s = this.net.strokes[id];
      const forward = s.na === node;
      train.path.push({ stroke: id, forward });
      train.cum.push(train.cum[train.cum.length - 1] + s.len);
      node = forward ? s.nb : s.na;
    }
    if (route.def.exit.kind === "fringe") {
      const f = this.net.fringes.get(route.def.exit.id);
      const n = this.net.nodes.get(f.node);
      const beyond = n.strokes.find((id) => id !== f.from);
      if (beyond !== undefined) {
        const s = this.net.strokes[beyond];
        train.path.push({ stroke: beyond, forward: s.na === node });
        train.cum.push(train.cum[train.cum.length - 1] + s.len);
      }
    }
    route.train = train.id;
  }

  endNode(train) {
    const last = train.path[train.path.length - 1];
    const s = this.net.strokes[last.stroke];
    return last.forward ? s.nb : s.na;
  }

  /** The signal a train's authority ends at, if its path ends at one. */
  signalAhead(train) {
    const last = train.path[train.path.length - 1];
    return signalAt(this.net, this.endNode(train), last.stroke);
  }

  /**
   * The train standing at a signal: drawn up to it, or waiting in the
   * platform it is the starter of, back along it where a train that has
   * turned round stands.
   */
  standingAt(signal) {
    for (const t of this.trains.values()) {
      if (this.signalAhead(t) !== signal) continue;
      if (t.cum[t.path.length] - t.pos < STAND_OFF + 2) return t;
      if (t.state === "stop" && this.inStarterPlatform(t)) return t;
    }
    return null;
  }

  /**
   * Whether a train standing in a platform has only the platform between it
   * and the signal ahead: its authority ends at the far end of the platform
   * its front is in. A train that has turned round stands back from that
   * signal by the length it came in on.
   */
  inStarterPlatform(train) {
    if (train.stopped !== "platform" && train.stopped !== "origin") return false;
    const k = train.path.length - 1;
    return !!this.net.strokes[train.path[k].stroke].platform && train.pos >= train.cum[k];
  }

  /* ---- Trains --------------------------------------------------------- */

  /**
   * Bring a train onto the railway for a service: in off the fringe it is
   * booked from, or standing in `tc`, the place `startIn()` found for it.
   */
  spawn(service, late = 0, described = true, tc = null) {
    const kind = KINDS[service.kind];
    const origin = service.entries[0];
    const train = {
      id: `t${this.nextTrain++}`,
      service: service.id,
      desc: described ? service.id : null,
      kind: service.kind,
      length: kind.length,
      vmax: kind.vmax,
      accel: kind.accel,
      brake: kind.brake,
      path: [],
      cum: [0],
      pos: 0,
      v: 0,
      passed: 1,
      caution: 0,
      state: "run",
      stopped: null,
      next: 0,
      arrivedAt: null,
      dwellUntil: null,
      failedUntil: null,
      held: null,
      berth: null,
      late: late * 60,
      changes: 0,
      missed: 0,
      wrongExit: false,
      born: this.time,
      calls: [],
    };
    if (origin.fringe) {
      const f = this.net.fringes.get(origin.fringe);
      const s = this.net.strokes[f.from];
      train.path.push({ stroke: f.from, forward: s.nb === f.node });
      train.cum.push(s.len);
      train.pos = train.length + 20;
      this.freeRun(train);
      train.v = Math.min(train.vmax, s.speed);
    } else {
      const s = this.net.strokes[this.net.tcs.get(tc).strokes[0]];
      const forward = this.facing(service) === "E";
      train.path.push({ stroke: s.id, forward });
      train.cum.push(s.len);
      train.pos = s.len - STAND_OFF;
      train.state = "stop";
      train.stopped = "origin";
      train.arrivedAt = this.time;
      train.dwellUntil = origin.dep;
      // On its circuit at once rather than at the next rebuild, so a train
      // due to start in the same moment sees this one is there.
      this.tcs.get(tc).trains.add(train.id);
    }
    train.next = 1;
    train.berth = berthAhead(this.net, train.path, 0);
    if (train.desc && train.berth) this.berths.set(train.berth, train.desc);
    train.zoneWas = this.zoneOf(train);
    train.lateIn = train.late;
    train.marked = false;
    this.trains.set(train.id, train);
    this.spawned.add(service.id);
    // Put in another platform than the one it was booked in, which is
    // blocked: the passengers are sent round to it, and it is a platform
    // change, as one at a call is.
    const plat = tc ? this.net.tcs.get(tc).platform?.[1] : null;
    if (plat && plat !== origin.plat) {
      train.changes++;
      train.calls.push({ entry: 0, at: origin.at, plat, booked: origin.plat, time: this.time, changed: true });
      this.alarm(`${train.desc ?? service.id} starts from platform ${plat}: platform ${origin.plat} is blocked`, this.net.tcs.get(tc).zone, null, `Dispatcher at ${placeName(origin.at)}`, `tc:${tc}`);
    }
    if (late) this.alarm(`${service.id} running ${late} min late from ${service.entries[0].name}`, null, null, "Control");
    if (!described) {
      const first = this.net.strokes[train.path[0].stroke];
      this.alarm(`Train without description entering from ${service.entries[0].name}`, first.zone, null, "Describer", `tc:${first.tc}`);
    }
    return train;
  }

  /** Extend an entering train's path up to the first signal it meets. */
  freeRun(train) {
    for (let guard = 0; guard < 8; guard++) {
      if (this.signalAhead(train)) return;
      const node = this.endNode(train);
      const last = train.path[train.path.length - 1];
      const lies = new Map([...this.points].map(([id, p]) => [id, p.lie]));
      const on = continuations(this.net, node, last.stroke, lies);
      if (!on.length) return;
      const s = this.net.strokes[on[0].stroke];
      train.path.push({ stroke: s.id, forward: s.na === node });
      train.cum.push(train.cum[train.cum.length - 1] + s.len);
    }
  }

  /** Whether a stroke is somewhere the timetable entry can be kept: any numbered platform at the station, or exactly the siding, loop or yard named. */
  serves(stroke, entry) {
    const place = stroke.platform ?? stroke.waypoint;
    if (!place || place[0] !== entry.at) return false;
    const numbered = (p) => /^\d+$/.test(p ?? "");
    if (numbered(entry.plat) && numbered(place[1])) return true;
    // So does another road of the same depot, a freight put into the other
    // cargo road at the airport as much as a train into another platform.
    if (isDepotRoad(entry.at, entry.plat) && isDepotRoad(place[0], place[1])) return true;
    return place[1] === entry.plat;
  }

  /** The index of the first entry still to come that this stroke serves, or -1. */
  upcoming(train, stroke) {
    const entries = this.serviceOf(train).entries;
    for (let i = train.next; i < entries.length; i++) if (this.serves(stroke, entries[i])) return i;
    return -1;
  }

  /** Move a train's timetable on to entry `i`, counting the calls it was sent past. */
  skipTo(train, i) {
    const entries = this.serviceOf(train).entries;
    for (let k = train.next; k < i; k++) if (entries[k].call && !entries[k].optional) train.missed++;
    train.next = i;
  }

  /** The track circuit of a platform, siding or loop named in the timetable. */
  tcAt(station, plat) {
    for (const tc of this.net.tcs.values()) {
      if (tc.platform && tc.platform[0] === station && tc.platform[1] === plat) return tc.id;
      if (tc.waypoint && tc.waypoint[0] === station && tc.waypoint[1] === plat) return tc.id;
    }
    return null;
  }

  /** The zone a train's front is in. */
  zoneOf(train) {
    let k = Math.min(train.passed - 1, train.path.length - 1);
    return this.net.strokes[train.path[Math.max(0, k)].stroke].zone;
  }

  /**
   * The trains on the signaller's desk, and of them the ones that have come
   * onto it since `before` was taken: over its boundary from the next desk,
   * or onto the railway at its edge. A train that starts from a platform or
   * siding on the desk was there already, and with no `before`, as at the
   * start of a shift or on resuming one, nothing has come on. `zone` is the
   * signaller's desk unless another is named.
   */
  arrivals(before, zone = this.zone) {
    const here = new Set(), came = [];
    for (const t of this.trains.values()) {
      if (t.state === "done" || t.exited || this.zoneOf(t) !== zone) continue;
      here.add(t.id);
      if (!before || before.has(t.id)) continue;
      const origin = this.serviceOf(t)?.entries[0];
      if (t.state === "stop" && t.stopped === "origin" && origin && !origin.fringe) continue;
      came.push(t);
    }
    return { here, came };
  }

  /** The service a train is running, as the timetable has it. */
  serviceOf(train) {
    return this.plan.get(train.service);
  }

  /** The timetable entry a train is working towards. */
  entryOf(train) {
    return this.serviceOf(train).entries[train.next] ?? null;
  }

  /* ---- The clock ------------------------------------------------------ */

  /** Advance by `seconds` of railway time, in fixed steps. */
  advance(seconds) {
    if (this.paused || this.finished) return;
    if (this.time < this.window.start) this.warmUp();
    this.carry = (this.carry ?? 0) + seconds;
    while (this.carry >= STEP) {
      this.carry -= STEP;
      this.step(STEP);
    }
  }

  /**
   * Run the railway's hour before the clock-in, `steps` steps at a time, and
   * hand the shift over when it is done: true once the clock stands at the
   * clock-in. ARS works every desk through that hour, the signaller's own
   * included, as the signaller before worked it. So the shift is taken over
   * running: trains out on the line where their times put them, and every
   * train that starts in a platform brought there by the train that forms
   * it, never put there out of nothing. Nothing in the hour is the
   * signaller's: its alarms and log are cleared at the clock-in, a train's
   * delay on the desk counts from there, and its trains are not scored.
   */
  warmUp(steps = Infinity) {
    if (this.time >= this.window.start) return true;
    const zone = this.zone;
    this.zone = NOBODY;
    try {
      for (let n = 0; n < steps && this.time < this.window.start; n++) this.step(STEP);
    } finally {
      this.zone = zone;
    }
    if (this.time < this.window.start) return false;
    this.alarms = [];
    this.log = [];
    for (const train of this.trains.values()) {
      train.zoneWas = this.zoneOf(train);
      train.lateIn = train.late;
    }
    // The engineers take their line at the clock-in, and not in the hour
    // before, when nobody would have taken a train round it by hand; once
    // it is clear of trains and of routes (`applyDisruptions()`).
    for (const d of this.disruptions) if (d.kind === "possession") d.at = this.window.start;
    this.applyDisruptions();
    // One they cannot take yet is the signaller's to clear, and they are told so.
    for (const d of this.disruptions) {
      if (d.kind !== "possession" || d.started) continue;
      this.alarm(`Engineers waiting to take ${tcName(d.tc)} for work until ${hhmm(d.until)}: clear it, and route nothing more onto it`, this.net.tcs.get(d.tc).zone, `possession:${d.tc}`, "Engineer", `tc:${d.tc}`);
    }
    return true;
  }

  step(dt) {
    this.time += dt;
    this.applyDisruptions();
    this.spawnDue();
    for (const p of this.points.values()) {
      if (p.moving > 0) {
        p.moving = Math.max(0, p.moving - dt);
        if (p.moving === 0) p.lie = p.wanted;
      }
    }
    for (const lc of this.lcs.values()) {
      if (lc.timer <= 0) continue;
      lc.timer = Math.max(0, lc.timer - dt);
      if (lc.timer === 0) { lc.barriers = lc.barriers === "lowering" ? "down" : "up"; lc.since = this.time; }
    }
    this.occupy();
    this.releaseRoutes();
    for (const t of this.trains.values()) this.drive(t, dt);
    this.occupy();
    this.releaseRoutes();
    this.attribute();
    this.arsClock += dt;
    if (this.arsClock >= 2) {
      this.arsClock = 0;
      this.faultTeam();
      this.autos();
      this.ars();
      this.watch();
    }
    if (this.time >= this.window.end && ![...this.trains.values()].some((t) => t.state !== "done") && this.spawned.size >= this.plan.size) this.finish();
    if (this.time >= this.window.hardEnd) this.finish();
    if (!this.finished && !this.runningOut && this.net.zones.some((z) => z.id === this.zone) && !this.deskBusy()) this.runOut();
  }

  /**
   * Whether the signaller's own desk has anything left: a train on it, or a
   * train, running or not yet on the railway, with a place on the desk still
   * ahead in its timetable. Every station a train passes is a timing point,
   * so a train that will cross the desk has one of its places ahead.
   */
  deskBusy() {
    const here = (e) => this.placeZone.get(e.at) === this.zone;
    // A train stabled on the desk is done with: it holds its road, not the desk.
    const working = (id) => this.trains.get(id)?.state !== "done";
    for (const [id, t] of this.tcs) if ([...t.trains].some(working) && this.net.tcs.get(id).zone === this.zone) return true;
    for (const t of this.trains.values()) if (t.state !== "done" && this.serviceOf(t).entries.slice(t.next).some(here)) return true;
    for (const s of this.plan.values()) if (!this.spawned.has(s.id) && s.entries.some(here)) return true;
    return false;
  }

  /**
   * Nothing more is coming to the signaller's desk, so the shift is over for
   * them: what the rest of the railway still has out is worked through at
   * once, as the other desks would have worked it, and the shift ends there.
   * The score is what it would have been, and nobody waits on a train that
   * has left their desk.
   */
  runOut() {
    this.runningOut = true;
    this.clearedAt = this.time;
    this.say("Nothing more is coming to your desk: the rest of the railway is worked through to the end", true, true);
    while (!this.finished) this.step(STEP);
    this.runningOut = false;
  }

  finish() {
    for (const t of this.trains.values()) this.result(t, { unfinished: true });
    for (const s of this.plan.values()) if (!this.results.has(s.id)) this.results.set(s.id, { id: s.id, late: null, changes: 0, missed: 0, wrongExit: false, unfinished: true, calls: [] });
    this.finished = true;
  }

  /** Work out which circuits every train is on. */
  occupy() {
    for (const t of this.tcs.values()) t.trains.clear();
    for (const train of this.trains.values()) {
      const rear = train.pos - train.length;
      for (let k = 0; k < train.path.length; k++) {
        if (train.cum[k] >= train.pos) break;
        if (train.cum[k + 1] <= rear) continue;
        this.tcs.get(this.net.strokes[train.path[k].stroke].tc).trains.add(train.id);
      }
    }
  }

  releaseRoutes() {
    for (const route of [...this.routes.values()]) {
      // A cancelled route a train has run on to after all, past its signal
      // at danger, is the train's: it releases behind the train like any
      // other, never all at once under it when the approach lock runs out.
      if (route.entered) route.cancelAt = null;
      if (route.cancelAt !== null && this.time >= route.cancelAt) {
        this.release(route);
        continue;
      }
      if (!route.entered) continue;
      const train = this.trains.get(route.train);
      if (!train) { this.release(route); continue; }
      // Sectional release: a circuit is given back once the whole train is past it.
      const rear = train.pos - train.length;
      for (const tc of [...route.held]) {
        let end = -Infinity;
        for (let k = 0; k < train.path.length; k++) {
          if (this.net.strokes[train.path[k].stroke].tc === tc) end = Math.max(end, train.cum[k + 1]);
        }
        if (end === -Infinity || rear > end) {
          route.held.delete(tc);
          if (this.tcs.get(tc).lockedBy === route.id) this.tcs.get(tc).lockedBy = null;
        }
      }
      // The signal is free for another route once the train is clear of
      // the first circuit beyond it; the rest of the route goes on
      // releasing behind the train on its own.
      const sig = this.signals.get(route.def.entry);
      if (sig.route === route.id && !route.held.has(route.def.tcs[0])) { sig.route = null; sig.authorised = false; }
      if (route.held.size === 0) this.release(route);
    }
  }

  spawnDue() {
    for (const service of this.plan.values()) {
      if (this.spawned.has(service.id) || service.formedBy) continue;
      const origin = service.entries[0];
      const late = this.disruptions.find((d) => d.kind === "late" && d.service === service.id)?.minutes ?? 0;
      const undescribed = this.disruptions.some((d) => d.kind === "nodesc" && d.service === service.id);
      let due;
      if (origin.fringe) {
        const s = this.net.strokes[this.net.fringes.get(origin.fringe).from];
        due = origin.dep + late * 60 - (s.len - KINDS[service.kind].length - 20) / Math.min(KINDS[service.kind].vmax, s.speed);
      } else if (isDepotRoad(origin.at, origin.plat)) {
        // Stock on a depot is there when the shift starts, not an hour on.
        due = this.window.from;
      } else if (this.warm && service.standing) {
        // So is the stock of a first train out that nothing brings in: it
        // has stood in its platform since before the railway's hour began.
        due = this.window.from;
      } else {
        due = origin.dep + late * 60 - SHIFT.ready;
      }
      if (this.time < due) continue;
      if (origin.fringe && this.approachTaken(origin.fringe, KINDS[service.kind].length)) continue;
      const tc = origin.fringe ? null : this.startIn(service);
      if (!origin.fringe && !tc) continue;
      this.spawn(service, late, !undescribed, tc);
    }
  }

  /** Whether another train is still close to the start of a fringe's approach, so the next must wait behind it. */
  approachTaken(fringeId, length) {
    const f = this.net.fringes.get(fringeId);
    for (const t of this.trains.values()) {
      if (t.path[0].stroke !== f.from) continue;
      if (t.pos - t.length < length + 60) return true;
    }
    return false;
  }

  /**
   * Where a train booked to start on the railway starts: the platform,
   * siding or road it is booked in, or, while that is blocked, or the fault
   * team has it or is waiting for it, another numbered platform at the
   * station, found as a train booked in is found another (`anotherWay()`):
   * the first that is free, long enough for the train, and has a road out
   * the way it faces to the next place it is booked. Null while there is
   * none, and the train waits, for a platform or for the line to be given
   * back. Nor is a train put where another is still standing: it waits for
   * that one to go.
   */
  startIn(service) {
    const origin = service.entries[0];
    const booked = this.tcAt(origin.at, origin.plat);
    if (!booked) throw new Error(`${service.id}: nowhere to start at ${origin.at} ${origin.plat}`);
    // The fault team's line, taken or waited for, is as shut to a train
    // starting as a possession is.
    const shut = (t) => t.blocked || t.mending || t.wanted;
    const there = this.tcs.get(booked);
    if (!shut(there)) return there.trains.size ? null : booked;
    if (!/^\d+$/.test(origin.plat)) return null;
    const heading = this.facing(service);
    for (const tc of this.net.tcs.values()) {
      if (tc.id === booked || tc.platform?.[0] !== origin.at || !/^\d+$/.test(tc.platform[1])) continue;
      const t = this.tcs.get(tc.id);
      if (this.occupied(tc.id) || shut(t) || t.lockedBy) continue;
      if (tc.strokes.reduce((m, id) => m + this.net.strokes[id].len, 0) < KINDS[service.kind].length) continue;
      const s = this.net.strokes[tc.strokes[0]];
      const starter = signalAt(this.net, heading === "E" ? s.nb : s.na, s.id);
      if (starter && this.routeToward(starter, service.entries[1])) return tc.id;
    }
    return null;
  }

  /**
   * Which way a train starting on the railway faces: as its first leg
   * says, or else away from the buffer stop at the end of the place it is
   * booked to start in.
   */
  facing(service) {
    const origin = service.entries[0];
    if (origin.dir) return origin.dir;
    const s = this.net.strokes[this.net.tcs.get(this.tcAt(origin.at, origin.plat)).strokes[0]];
    return this.net.nodes.get(s.na).strokes.length === 1 ? "E" : "W";
  }

  /** The speed a train may be doing right now, from everything ahead of it. */
  allowed(train) {
    const b = train.brake;
    let cap = train.vmax;
    const consider = (dist, v) => {
      const here = dist <= 0 ? v : Math.sqrt(v * v + 2 * b * dist);
      if (here < cap) cap = here;
    };
    const rear = train.pos - train.length;
    const target = this.stopPoint(train);
    if (target !== null) consider(target - train.pos, 0);
    for (let k = 0; k < train.path.length; k++) {
      if (train.cum[k + 1] <= rear) continue;
      const s = this.net.strokes[train.path[k].stroke];
      let limit = this.limitOn(s);
      if (train.caution) limit = Math.min(limit, CAUTION);
      consider(train.cum[k] - train.pos, limit);
      if (train.cum[k] - train.pos > 1500) break;
    }
    if (train.failedUntil !== null && this.time < train.failedUntil) cap = 0;
    return cap;
  }

  /** The speed a stroke allows right now: its line speed, or less under the weather or the leaves. */
  limitOn(s) {
    let limit = s.speed;
    for (const d of this.disruptions) {
      if (!d.started || d.ended || d.cap === undefined) continue;
      if (d.tcs && !d.tcs.includes(s.tc)) continue;
      if (d.cap < limit) limit = d.cap;
    }
    return limit;
  }

  /** Where the train must next come to rest, as a distance along its path, or null. */
  stopPoint(train) {
    let stop = train.cum[train.path.length];
    const endNode = this.endNode(train);
    const last = this.net.strokes[train.path[train.path.length - 1].stroke];
    if (last.hidden) stop = Infinity;
    else if (this.net.nodes.get(endNode).strokes.length === 1) stop -= BUFFER_OFF;
    else stop -= STAND_OFF;
    const call = train.stopped === "platform" ? null : this.callOnPath(train);
    if (call) {
      // At a through platform whose starter ends the path, stand where the
      // signal would have the train stand, so the end of the dwell is not
      // a two-metre creep to a second stop.
      const atStarter = call.k + 1 === train.path.length && this.net.nodes.get(endNode).strokes.length > 1;
      const end = train.cum[call.k + 1];
      let platformStop = end - (atStarter ? STAND_OFF : BUFFER_OFF);
      // A route set on beyond the starter while the train is already braking
      // for it must not move its stop back behind it, or the call is lost:
      // it stands where the starter would have had it stand.
      if (platformStop <= train.pos - 1 && end - STAND_OFF > train.pos - 1) platformStop = end - STAND_OFF;
      if (platformStop < stop && platformStop > train.pos - 1) stop = platformStop;
    }
    const tail = this.tailAhead(train);
    if (tail !== null && tail - FOLLOW < stop && tail - FOLLOW > train.pos - 1) stop = tail - FOLLOW;
    return stop === Infinity ? null : stop;
  }

  /**
   * The next booked call that lies on the train's present path: the index
   * `k` of the path stroke it is made at and the timetable entry. Null when
   * the first place ahead that the timetable names is passed, not called at.
   */
  callOnPath(train) {
    const entries = this.serviceOf(train).entries;
    if (train.next >= entries.length) return null;
    for (let k = Math.max(0, train.passed - 1); k < train.path.length; k++) {
      const i = this.upcoming(train, this.net.strokes[train.path[k].stroke]);
      if (i < 0) continue;
      return entries[i].call ? { k, entry: entries[i] } : null;
    }
    return null;
  }

  /**
   * Where the tail of the nearest train ahead on this train's path is, as a
   * distance along the path, or null. The interlocking keeps two trains out of
   * one section, so this only matters where it does not reach: a train
   * following another in from the edge, or one taken past a signal under an
   * authority.
   */
  tailAhead(train) {
    let nearest = null;
    for (const other of this.trains.values()) {
      if (other === train) continue;
      const rear = other.pos - other.length;
      for (let j = 0; j < other.path.length; j++) {
        if (other.cum[j + 1] <= rear) continue;
        if (other.cum[j] >= other.pos) break;
        // The stroke `other` covers, found on this train's path ahead of it.
        for (let k = Math.max(0, train.passed - 1); k < train.path.length; k++) {
          if (train.path[k].stroke !== other.path[j].stroke) continue;
          const s = this.net.strokes[other.path[j].stroke];
          const off = Math.max(0, rear - other.cum[j]);
          const along = train.path[k].forward === other.path[j].forward ? off : s.len - Math.min(s.len, other.pos - other.cum[j]);
          const at = train.cum[k] + along;
          if (at > train.pos - 1 && (nearest === null || at < nearest)) nearest = at;
        }
      }
    }
    return nearest;
  }

  drive(train, dt) {
    if (train.state === "done") return;
    // Take up authority the moment the signal ahead comes off.
    const sig = this.signalAhead(train);
    if (sig) {
      const route = this.routeFrom(sig.id);
      if (route && route.train === null && !route.entered && this.proceed(sig.id)) this.extend(train, route);
    }
    if (train.state === "stop") {
      if (!this.mayDepart(train)) return;
      if (train.stopped === "platform" || train.stopped === "origin") this.departed(train);
      train.state = "run";
      train.stopped = null;
    }
    const cap = this.allowed(train);
    if (train.v < cap) train.v = Math.min(cap, train.v + train.accel * dt);
    else train.v = Math.max(cap, train.v - train.brake * 1.25 * dt);
    if (train.v < 0.3 && cap < 0.5) train.v = 0;
    const target = this.stopPoint(train);
    let pos = train.pos + train.v * dt;
    if (target !== null && pos >= target - 0.5) {
      pos = Math.max(train.pos, target);
      train.v = 0;
    }
    train.pos = pos;
    while (train.passed < train.path.length && train.pos > train.cum[train.passed]) {
      this.crossed(train, train.passed);
      train.passed++;
    }
    // At the stop point, or a metre past one that moved back under it when
    // a route was set beyond the platform in the same moment it stopped.
    if (train.v === 0 && target !== null && train.pos >= target - 0.6) this.cameToRest(train);
    if (train.exited && train.pos - train.length > train.cum[train.path.length - 1]) this.remove(train);
  }

  /** A stopped train may go once it has stood its time and has somewhere to go. */
  mayDepart(train) {
    if (train.failedUntil !== null && this.time < train.failedUntil) return false;
    if (train.stopped === "end") return false;
    if (train.stopped === "platform" || train.stopped === "origin") {
      if (train.dwellUntil !== null && this.time < train.dwellUntil) return false;
      // With the starter still on, a train in its platform stays where it
      // is, as a driver would: one that has turned round is back along the
      // platform, and would otherwise draw up to the red and stop being a
      // train in a platform at all. Once the signal is off, the route ahead
      // has already been taken up and the platform is no longer the end.
      if (this.inStarterPlatform(train)) return false;
    }
    const target = this.stopPoint(train);
    return target === null || target > train.pos + 1;
  }

  /** The train's front has just crossed the node at the start of path stroke `k`. */
  crossed(train, k) {
    const prev = train.path[k - 1];
    const s = this.net.strokes[prev.stroke];
    const node = prev.forward ? s.nb : s.na;
    const sig = signalAt(this.net, node, prev.stroke);
    const n = this.net.nodes.get(node);
    if (sig) {
      const route = this.routeFrom(sig.id);
      if (route) { route.entered = true; route.train = train.id; }
      const state = this.signals.get(sig.id);
      if (state.authorised) state.authorised = false;
      if (train.caution) train.caution--;
      this.stepDescription(train, k);
    } else if (n.fringe) {
      const f = this.net.fringes.get(n.fringe);
      if (f.out && f.from === prev.stroke) { this.exitAt(train, f); this.moveDescription(train, f.id); }
      else this.stepDescription(train, k);
    }
    const here = this.net.strokes[train.path[k].stroke];
    const i = this.upcoming(train, here);
    if (i >= 0 && !this.serviceOf(train).entries[i].call) {
      this.skipTo(train, i);
      this.passed(train, this.serviceOf(train).entries[i]);
    }
  }

  stepDescription(train, k) {
    this.moveDescription(train, berthAhead(this.net, train.path, k));
  }

  moveDescription(train, to) {
    if (to === train.berth) return;
    if (train.desc && train.berth && this.berths.get(train.berth) === train.desc) this.berths.set(train.berth, null);
    train.berth = to;
    if (train.desc && to) this.berths.set(to, train.desc);
  }

  /** A train leaves a platform: the call it just made records when, and how late. */
  departed(train) {
    // A platform change is noted apart from the call it was made at, so the
    // call a departure completes is the last that is not such a note. A
    // train put in another platform to start has only the note so far.
    const call = train.calls.findLast((c) => !c.changed);
    const service = this.serviceOf(train);
    const entry = service.entries[train.next - 1];
    if (call && !call.dep) {
      call.dep = this.time;
      if (entry && entry.dep) { call.depLate = this.time - entry.dep; train.late = call.depLate; }
    }
    if (train.stopped === "origin" && !call) {
      train.calls.push({ entry: 0, at: entry?.at ?? service.entries[0].at, plat: this.platformOf(train), booked: service.entries[0].plat, time: train.arrivedAt, dep: this.time, depLate: this.time - service.entries[0].dep, origin: true });
    }
  }

  /** A timing point passed without stopping. Every call records which entry of the timetable it was made against, so a service that names one place three times still lines up. */
  passed(train, entry) {
    train.late = this.time - (entry.pass ?? entry.dep ?? entry.arr);
    train.calls.push({ entry: train.next, at: entry.at, plat: this.platformOf(train), booked: entry.plat, time: this.time, late: train.late });
    train.next++;
  }

  platformOf(train) {
    return this.standingIn(train)?.plat ?? null;
  }

  /** The place, and the platform or road in it, where a train's front is, as the layout names them, or null on plain line. */
  standingIn(train) {
    const k = Math.min(train.passed - 1, train.path.length - 1);
    const s = this.net.strokes[train.path[Math.max(0, k)].stroke];
    const place = s.platform ?? s.waypoint;
    return place ? { at: place[0], plat: place[1] } : null;
  }

  cameToRest(train) {
    if (train.state === "stop") return;
    train.state = "stop";
    train.arrivedAt = this.time;
    const here = this.net.strokes[train.path[Math.min(train.passed - 1, train.path.length - 1)].stroke];
    const i = this.upcoming(train, here);
    const entry = i >= 0 ? this.serviceOf(train).entries[i] : null;
    const atStation = entry && entry.call;
    if (atStation) {
      this.skipTo(train, i);
      train.stopped = "platform";
      const plat = (here.platform ?? here.waypoint)[1];
      if (entry.plat && plat !== entry.plat) {
        train.changes++;
        train.calls.push({ entry: i, at: entry.at, plat, booked: entry.plat, time: this.time, changed: true });
        this.say(`${train.desc ?? "Train"} into ${placeName(entry.at)} platform ${plat}, booked ${entry.plat}: passengers moved`, true, true);
      }
      const hold = this.disruptions.find((d) => (d.kind === "fail" || d.kind === "crew") && d.service === train.service && d.at === entry.at && !d.done);
      if (hold) {
        hold.done = true;
        train.failedUntil = this.time + hold.minutes * 60;
        train.held = hold.kind;
        const name = train.desc ?? train.service;
        if (hold.kind === "crew") this.alarm(`${name} at ${placeName(entry.at)} platform ${plat}: no driver to take it forward, the relief is ${hold.minutes} min away`, here.zone, null, "Crew control", `tc:${here.tc}`);
        else this.alarm(`A fault on the train at ${placeName(entry.at)} platform ${plat}: ${hold.minutes} min to fix`, here.zone, null, `Driver of ${name}`, `tc:${here.tc}`);
      }
      const last = train.next === this.serviceOf(train).entries.length - 1;
      if (last) this.terminate(train, entry, plat);
      else {
        const kind = KINDS[train.kind];
        train.dwellUntil = Math.max(entry.dep, this.time + kind.dwell);
        train.late = Math.max(0, this.time + kind.dwell - entry.dep);
        train.calls.push({ entry: i, at: entry.at, plat, booked: entry.plat, time: this.time, late: this.time - entry.arr });
        train.next++;
        if (entry.reverse) this.reverse(train);
      }
    } else {
      train.stopped = "signal";
      train.dwellUntil = null;
    }
  }

  /** The train has finished its service at a platform, siding or yard. */
  terminate(train, entry, plat) {
    const service = this.serviceOf(train);
    train.late = this.time - entry.arr;
    train.calls.push({ entry: service.entries.length - 1, at: entry.at, plat, booked: entry.plat, time: this.time, late: train.late });
    this.result(train, {});
    if (this.zoneOf(train) === this.zone) this.crossedOut(train);
    if (service.then && this.plan.has(service.then)) {
      let next = this.plan.get(service.then);
      const turn = KINDS[next.kind].turn ?? 300;
      // A train turns round to form its next working, unless that working
      // says it sets off the way the train is already heading, as empty
      // stock going on to the depot past where it came in can.
      const want = next.entries[0].dir;
      if (!want || headingOf(this.net, train) !== want) this.reverse(train);
      // Empty stock left where its way to the depot does not go from, put
      // in another platform than the one it was booked into, is booked
      // again from where it is.
      if (next.stabling && !this.setsOff(train, next.entries[1])) next = this.rebook(train, service, next, entry.at, plat) ?? next;
      train.service = next.id;
      train.kind = next.kind;
      // A train that went on with its fault isolated is seen to where it
      // finished, and goes out again at its own speed.
      if (train.limp) {
        train.limp = false;
        train.vmax = KINDS[next.kind].vmax;
      }
      train.next = 1;
      train.stopped = "origin";
      train.dwellUntil = Math.max(next.entries[0].dep, this.time + turn);
      train.changes = 0;
      train.missed = 0;
      train.calls = [];
      train.late = 0;
      // The working it forms starts here, and starts its own account: what
      // the desk answers for is what it adds from now, not what the last
      // working lost, nor the lateness the turn round leaves it no way to
      // make up (`crossedOut()`).
      train.lateIn = Math.max(0, train.dwellUntil - next.entries[0].dep);
      train.shutFor = 0;
      train.arrivedAt = this.time;
      this.spawned.add(next.id);
      train.formAt = this.time + Math.min(60, turn / 2);
      this.say(`${train.desc ?? service.id} arrived ${placeName(entry.at)} ${plat}, forms ${next.id}`, true, true);
    } else if (isDepotRoad(entry.at, plat) || /^\d+$/.test(plat ?? "")) {
      // Stabled: a train done with in a depot's road stays there, one to a
      // road, and so does one left in a platform with nowhere else to go.
      // It is finished (`done`), so nothing routes it or waits on it, but
      // it holds the track it stands on.
      train.state = "done";
      train.stopped = "stabled";
      train.v = 0;
      this.say(`${train.desc ?? service.id} stabled at ${placeName(entry.at)} ${plat}`, true, true);
    } else {
      // A freight into a yard is taken off the reception line by the yard's
      // own shunter, into roads the board does not show.
      train.disposeAt = this.time + DISPOSE;
      train.stopped = "end";
    }
  }

  /** Whether a train standing where it is has a road from the signal ahead of it towards `entry`. */
  setsOff(train, entry) {
    const sig = this.signalAhead(train);
    return !!entry && !!sig && this.routeToward(sig, entry) !== null;
  }

  /**
   * Empty stock booked again from where its train was left, as control
   * would when the way to the depot it was booked does not go from there:
   * stock for Chattanooga's siding, which is only reached from platform 1
   * and the bay, left in another platform, goes up the branch to Ooltewah
   * TMD. It takes the first way `stablingsFrom()` gives with a road free at
   * its depot and a road from here, turned the way that way sets off. The
   * empty train it was comes out of the plan, the new one goes in under a
   * headcode of its own, and the save keeps it (`rebooked`). Null, and the
   * train left facing as it was, if no way goes from here.
   */
  rebook(train, feeder, ecs, at, plat) {
    const facing = headingOf(this.net, train);
    const dep = Math.ceil(Math.max(ecs.entries[0].dep, this.time + KINDS.empty.turn) / 60) * 60;
    const taken = new Set([...this.plan.keys(), ...this.spawned]);
    for (const way of stablingsFrom(feeder, at, plat, dep, taken)) {
      const road = way.depot ? DEPOTS[way.depot].roads.find((r) => this.roadFree(way.depot, r)) : null;
      if (way.depot && !road) continue;
      if (way.dir && headingOf(this.net, train) !== way.dir) this.reverse(train);
      if (!this.setsOff(train, way.toward(road))) continue;
      const next = way.make(road);
      // It stands in for the booking it replaces, the hour before the clock-in's or the shift's.
      if (ecs.warm) next.warm = true;
      this.plan.delete(ecs.id);
      this.plan.set(next.id, next);
      feeder.then = next.id;
      this.rebooked.push({ feeder: feeder.id, old: ecs.id, service: next });
      const was = ecs.entries[ecs.entries.length - 1], goes = next.entries[next.entries.length - 1];
      const tc = [...this.net.tcs.values()].find((t) => t.platform?.[0] === at && t.platform?.[1] === plat);
      this.alarm(`${ecs.id} cannot reach the ${DEPOTS[was.at]?.short ?? was.name} from platform ${plat}: it runs to ${goes.name} as ${next.id}`, tc?.zone ?? null, null, "Control", tc ? `tc:${tc.id}` : null);
      return next;
    }
    if (headingOf(this.net, train) !== facing) this.reverse(train);
    return null;
  }

  /** The booking a service now goes by: itself, the working Control booked in its place (`rebook()`), or null once it has gone. */
  bookingNow(id) {
    for (let guard = 0; id && !this.plan.has(id) && guard < 8; guard++) id = this.rebooked.find((r) => r.old === id)?.service.id ?? null;
    return id && this.plan.has(id) ? id : null;
  }

  /** Whether stock can be booked into a depot's road now: nothing stands on it, and nothing still to come is booked into it or out of it. */
  roadFree(depot, road) {
    for (const t of this.net.tcs.values()) if (t.platform?.[0] === depot && t.platform[1] === road && this.tcs.get(t.id).trains.size) return false;
    for (const s of this.plan.values()) {
      if (this.results.has(s.id)) continue;
      const first = s.entries[0], last = s.entries[s.entries.length - 1];
      if (last.at === depot && last.plat === road) return false;
      if (!this.spawned.has(s.id) && first.at === depot && first.plat === road) return false;
    }
    return true;
  }

  /** Turn a train round where it stands: its path becomes the strokes under it, the other way. */
  reverse(train) {
    const rear = train.pos - train.length;
    const covered = [];
    for (let k = 0; k < train.path.length; k++) {
      if (train.cum[k] >= train.pos) break;
      if (train.cum[k + 1] <= rear) continue;
      covered.push(k);
    }
    const first = covered[0], last = covered[covered.length - 1];
    const path = [];
    for (let k = last; k >= first; k--) path.push({ stroke: train.path[k].stroke, forward: !train.path[k].forward });
    const cum = [0];
    for (const p of path) cum.push(cum[cum.length - 1] + this.net.strokes[p.stroke].len);
    const newPos = train.cum[last + 1] - rear;
    train.path = path;
    train.cum = cum;
    train.pos = newPos;
    train.passed = path.length;
    train.v = 0;
    train.caution = 0;
    const berth = berthAhead(this.net, train.path, path.length - 1);
    if (berth !== train.berth) {
      if (train.desc && train.berth && this.berths.get(train.berth) === train.desc) this.berths.set(train.berth, null);
      train.berth = berth;
      if (train.desc && berth) this.berths.set(berth, train.desc);
    }
  }

  /** The train's front has passed a fringe on the way off the network. */
  exitAt(train, fringe) {
    const service = this.serviceOf(train);
    const final = service.entries[service.entries.length - 1];
    // Off towards the right place on another of its lines, the slow for the
    // fast, is where it was going, the way a train in another platform has
    // made its call: it counts as a change, like a platform change.
    const place = (id) => id.split("-")[0];
    if (final.fringe && fringe.id !== final.fringe && place(fringe.id) === place(final.fringe)) {
      train.changes++;
      const booked = this.net.fringes.get(final.fringe);
      this.say(`${train.desc ?? train.service} left for ${fringe.name} on the ${fringe.line ?? "other line"}, booked the ${booked?.line ?? "other"}`, true, true);
    }
    if (final.fringe && place(fringe.id) === place(final.fringe)) {
      train.late = this.time - (final.pass ?? final.arr);
      train.calls.push({ entry: service.entries.length - 1, at: final.at, plat: null, booked: null, time: this.time, late: train.late });
      this.skipTo(train, service.entries.length - 1);
      train.next = service.entries.length;
    } else {
      train.wrongExit = true;
      this.alarm(`${train.desc ?? train.service} has left towards ${fringe.name}, which is not where it was going`, null, null, "Control");
      if (fringe.zone === this.zone) this.mark(train, `${train.desc ?? train.service} was sent off towards ${fringe.name}, which is not where it was going`);
    }
    this.result(train, {});
    train.exited = true;
    if (fringe.zone === this.zone) this.crossedOut(train);
  }

  remove(train) {
    if (train.desc && train.berth && this.berths.get(train.berth) === train.desc) this.berths.set(train.berth, null);
    for (const route of this.routes.values()) if (route.train === train.id) this.release(route);
    // Off its circuits now rather than at the next step, or a train that has
    // gone would keep them red in between, and for good if the clock stopped there.
    for (const t of this.tcs.values()) t.trains.delete(train.id);
    this.trains.delete(train.id);
  }

  /**
   * Write down how a service ended. The first word is final: a train that
   * has arrived or left is scored then, and still stands on the railway for
   * a while afterwards, so the sweep at the end of the shift must not be
   * allowed to call it unfinished.
   */
  result(train, extra) {
    const id = train.service;
    if (this.results.has(id)) return;
    this.results.set(id, {
      id,
      at: this.time,
      late: extra.unfinished ? null : train.late,
      changes: train.changes,
      missed: train.missed,
      wrongExit: train.wrongExit,
      unfinished: !!extra.unfinished,
      calls: train.calls.slice(),
    });
  }

  /* ---- The signaller's own zone --------------------------------------- */

  /** Notice trains crossing into or out of the signaller's zone. */
  attribute() {
    if (this.relieved) return;
    for (const train of this.trains.values()) {
      const zone = this.zoneOf(train);
      if (zone === train.zoneWas) continue;
      if (zone === this.zone) { train.lateIn = train.late; train.shutFor = 0; }
      else if (train.zoneWas === this.zone) this.crossedOut(train);
      train.zoneWas = zone;
    }
  }

  /** A train has left the signaller's zone: the delay it picked up there is the signaller's. */
  crossedOut(train) {
    if (train.marked || this.relieved) return;
    // What it lost shut in by the engineers or a fault rung in is not the desk's (`checkShut()`).
    const added = train.late - train.lateIn - (train.shutFor ?? 0);
    if (added >= MARK_DELAY) {
      this.mark(train, `${train.desc ?? train.service} left ${placeName(zonePlace(this.zone))} ${Math.floor(added / 60)} minutes later than it came`);
    }
  }

  /**
   * Every `SHUT_CHECK` seconds while a train on the desk waits, whether its
   * every way on is shut (`shutIn()`): when it is, its waiting counts again
   * from then (`shutAt`), and the time since the last look, if that found
   * it shut too, is time it lost that the desk could not help (`shutFor`).
   */
  checkShut(train, sig) {
    if (this.time - (train.shutLook ?? -Infinity) < SHUT_CHECK) return;
    const shut = this.shutIn(train, sig);
    if (shut && train.shutAt !== undefined && train.shutAt === train.shutLook) train.shutFor = (train.shutFor ?? 0) + (this.time - train.shutAt);
    if (shut) train.shutAt = this.time;
    train.shutLook = this.time;
  }

  /**
   * Whether every way on from where a train stands is shut by something
   * the signaller cannot move: a line under possession or blocked, a
   * circuit the fault team has or is waiting to take, or points failed
   * lying the wrong way once they are rung in. A way held by other trains, or by a fault nobody has
   * rung in yet, is not shut: the first can be worked, the second rung in.
   */
  shutIn(train, sig) {
    const entry = this.serviceOf(train)?.entries[train.next];
    if (!sig || !entry) return false;
    let ways = 0;
    for (const id of sig.routes) {
      const def = this.net.routes.get(id);
      if (!this.leadsTo(def, entry)) continue;
      ways++;
      const lines = def.tcs.some((tc) => { const t = this.tcs.get(tc); return t.blocked || t.mending || t.wanted; });
      const points = def.points.some((p) => {
        const pt = this.points.get(p.id);
        return pt.failed && pt.lie !== p.lie && this.disruptions.some((d) => d.kind === "points" && d.point === p.id && d.started && !d.ended && d.reportedAt !== undefined);
      });
      if (!lines && !points) return false;
    }
    return ways > 0;
  }

  /** Whether a route leads towards a timetable entry: into it, or on through routes from its exit. */
  leadsTo(def, entry) {
    if (entry.fringe && def.exit.kind === "fringe") return def.exit.id === entry.fringe;
    const into = def.tcs.some((tc) => {
      const t = this.net.tcs.get(tc);
      const place = t.platform ?? t.waypoint;
      return !!place && place[0] === entry.at && place[1] === entry.plat;
    });
    return into || (def.exit.kind === "signal" && this.search(this.net.signals.get(def.exit.id), entry, 0) !== null);
  }

  /** The board writes a black mark against the signaller. Three and it relieves them. */
  mark(train, text) {
    if (this.relieved) return;
    train.marked = true;
    this.marks.push({ time: this.time, text, train: train.desc ?? train.service });
    if (this.training) { this.alarm(`On a real desk that is a black mark: ${text}`, this.zone, `mark:${this.marks.length}`, "Instructor"); return; }
    const left = MARKS_ALLOWED - this.marks.length;
    this.alarm(`Black mark: ${text}. ${left === 0 ? "The board has relieved you." : left === 1 ? "One more and you are relieved." : `${left} more and you are relieved.`}`, this.zone, `mark:${this.marks.length}`, "Shift manager");
    if (this.marks.length >= MARKS_ALLOWED) {
      this.relieved = true;
      this.relievedAt = this.time;
      this.finish();
    }
  }

  /**
   * How long a train has been waiting for the signaller, or null if it is
   * not: since it stood at the signal or its stop was up, or, held by a
   * fault or with no driver, since it was free. A train nobody could have
   * sent anywhere was not waiting on the signaller, and counted from the end
   * of its stop it was kept standing the moment the fitter or the relief
   * let it go, before its route could have been set for it.
   */
  waitingSince(train) {
    if (train.state !== "stop" || train.failedUntil !== null && this.time < train.failedUntil) return null;
    let since = null;
    if (train.stopped === "signal") since = train.arrivedAt;
    else if ((train.stopped === "platform" || train.stopped === "origin") && train.dwellUntil !== null && this.time >= train.dwellUntil) since = train.dwellUntil;
    if (since === null) return null;
    return train.failedUntil !== null ? Math.max(since, train.failedUntil) : since;
  }

  /**
   * Train ready to start: standing in a platform, loaded, and due away
   * within `TRTS_LEAD` seconds or past it, whatever the signal shows. On
   * the real screens the dispatcher presses a plunger a little before the
   * train is due, and the platform indication shows it until the train
   * goes; here it shows on its own. Pressed only at the booked time, it
   * never showed at all under a signal already off, since the train went
   * the moment it was due. A train with a fault or no driver is not ready.
   */
  readyToStart(train) {
    if (train.state !== "stop" || (train.stopped !== "platform" && train.stopped !== "origin")) return false;
    if (train.failedUntil !== null && this.time < train.failedUntil) return false;
    return train.dwellUntil !== null && this.time >= train.dwellUntil - TRTS_LEAD;
  }

  /**
   * What the platform a train stands in shows for it: `loading` while it
   * is not yet due away, and `ready` once it is (train ready to start)
   * until it goes. Null for a train not standing in a platform.
   */
  platformState(train) {
    if (train.state !== "stop" || (train.stopped !== "platform" && train.stopped !== "origin")) return null;
    return this.readyToStart(train) ? "ready" : "loading";
  }

  /** Whether a waiting train is the signaller's to route. */
  isMine(train) {
    const sig = this.signalAhead(train);
    // A train at an automatic is waiting on the block ahead, not on a desk.
    if (sig && sig.kind === "auto") return false;
    return sig ? sig.zone === this.zone : this.zoneOf(train) === this.zone;
  }

  /* ---- Automatic route setting -------------------------------------- */

  /** Set routes for the zones the signaller is not working. */
  ars() {
    // Only the first train at a signal asks for a road from it, as the
    // describer shows only the first: a train queued behind one standing
    // there, undescribed or waiting its time, would otherwise have the road
    // set for it and the one in front take it.
    const first = new Map();
    for (const train of this.trains.values()) {
      if (train.state === "done" || train.exited) continue;
      const sig = this.signalAhead(train);
      if (!sig) continue;
      const dist = train.cum[train.path.length] - train.pos;
      if (!first.has(sig.id) || dist < first.get(sig.id).dist) first.set(sig.id, { train, dist });
    }
    const wanting = [];
    for (const train of this.trains.values()) {
      if (train.state === "done" || train.exited) continue;
      const sig = this.signalAhead(train);
      if (!sig || sig.zone === this.zone) continue;
      if (first.get(sig.id).train !== train) continue;
      if (this.signals.get(sig.id).route) continue;
      // Routes are set no further ahead than this, whether the train is
      // running or standing at a platform with its road already set.
      const dist = train.cum[train.path.length] - train.pos;
      if (dist > ARS_REACH) continue;
      if (!train.desc) { train.arsWhy = "no description"; continue; }
      const service = this.plan.get(train.desc);
      if (!service) { train.arsWhy = `${train.desc} is not in the timetable`; continue; }
      const entry = service.id === train.service ? this.entryOf(train) : service.entries[1];
      const when = entry ? (entry.arr ?? entry.pass ?? entry.dep ?? 0) : 0;
      // A train booked to stop before it reaches this signal is not given
      // the road beyond until it is nearly time to leave, whether it is on
      // its way there or still standing at the call before: where two
      // stations are close, a road set out of the next platform while the
      // train stands in the last shuts whatever it crosses for minutes.
      let ready = true;
      const standing = train.stopped === "platform" || train.stopped === "origin";
      const call = this.callOnPath(train);
      if (call && call.entry.dep) ready = this.time >= call.entry.dep - 60;
      if (standing && train.dwellUntil !== null) ready &&= this.time >= train.dwellUntil - 60;
      // A train booked to reverse in a neck is not drawn up towards it
      // while another train is in it: it would stand across the lead the
      // one in the neck has to come back out over, and neither could move.
      const neck = entry?.reverse ? this.tcAt(entry.at, entry.plat) : null;
      if (neck && [...this.tcs.get(neck).trains].some((id) => id !== train.id)) { train.arsWhy = `waiting for ${tcName(neck)} to clear`; continue; }
      let def = this.arsRoute(sig, service, train);
      // A train that has been sent the wrong way is planned back once it
      // stands at a signal: at once if it is already known to be lost, else
      // after it has waited long enough to be sure. Where changing ends is
      // the shorter way back, it waits for the driver to do so rather than
      // being sent further on.
      if (!def && (train.lostAt !== undefined || this.time - train.arrivedAt >= LOST_WAIT) && this.lost(train, sig)) {
        this.noteLost(train);
        const plan = this.planBack(train, sig);
        if (plan && !plan.turn) def = plan.def;
      }
      if (!def) { train.arsWhy = `no route towards the next timing point from ${sig.id}`; continue; }
      wanting.push({ train, sig, def, when, ready, service });
    }
    wanting.sort((a, b) => a.when - b.when);
    for (const w of wanting) {
      if (!w.ready) continue;
      // Timetable order at a junction: an earlier-booked train that is
      // nearly due and wants a conflicting route goes first, unless it has
      // kept this one waiting too long already. Empty stock going to the
      // depot gives way to any booked train nearly due, whenever it was
      // booked, and waits longer for it.
      const humble = !!w.service.stabling;
      // Never behind a train that wants the track this one stands on: it
      // cannot go until this one has.
      const inTheWay = (o) => o.def.tcs.some((tc) => this.tcs.get(tc).trains.has(w.train.id));
      const rival = wanting.find((o) => o !== w && (o.when < w.when || (humble && !o.service.stabling)) && o.when - this.time < 240 && !this.signals.get(o.def.entry).route && conflicts(o.def, w.def) && !inTheWay(o));
      if (rival) {
        w.train.heldSince ??= this.time;
        if (this.time - w.train.heldSince < (humble ? 300 : 150)) { w.train.arsWhy = `regulated behind ${rival.train.desc}`; continue; }
      }
      let def = w.def;
      let why = this.refusal(def) ?? this.crossingRule(def, w.train, w.service);
      if (why) {
        // The booked road is shut. After a while the colleague on that desk
        // finds another platform at the same station, if there is one.
        w.train.refusedSince ??= this.time;
        if (this.time - w.train.refusedSince >= COLLEAGUE.replatform && this.stuck(def)) {
          const entry = this.net.signals.get(w.def.entry);
          const other = this.anotherWay(entry, w.service, w.train) ?? this.pastOptional(entry, w.service, w.train);
          if (other) { def = other; why = null; }
        }
      }
      w.train.arsWhy = why ? `${def.id}: ${why}` : null;
      if (!why) { this.setRoute(def.entry, def.exit.id, "ars"); w.train.heldSince = undefined; w.train.refusedSince = undefined; }
    }
  }

  /**
   * Whether a refused route is shut for good rather than for a moment: a
   * circuit under possession, a train standing on it that is not going
   * anywhere, or points that have failed the wrong way. Traffic is not
   * stuck, and a colleague does not re-platform for traffic.
   */
  stuck(def) {
    for (const tc of def.tcs) {
      const t = this.tcs.get(tc);
      if (t.blocked || t.mending) return true;
      for (const id of t.trains) {
        const other = this.trains.get(id);
        if (!other || other.state !== "stop") continue;
        if (other.failedUntil !== null && this.time < other.failedUntil) return true;
        if (other.stopped === "end") return true;
        const since = this.waitingSince(other);
        if (since !== null && this.time - since >= COLLEAGUE.replatform) return true;
      }
    }
    for (const p of def.points) {
      const pt = this.points.get(p.id);
      if (pt.failed && pt.lie !== p.lie) return true;
    }
    return false;
  }

  /**
   * A route towards any other platform at the station the train is booked
   * for next: one the train can leave the way it is going, so a through
   * train is never put into a bay it would have to reverse out of.
   */
  anotherWay(sig, service, train) {
    const start = service.id === train.service ? train.next : 1;
    const entry = service.entries[start];
    if (!entry) return null;
    // Off the edge on another line to the same place, the slow for the fast.
    if (entry.fringe) return this.otherLine(sig, entry, (def) => !this.refusal(def) && !this.crossingRule(def, train, service));
    // A call goes to another numbered platform. A train booked through on a
    // line of its own, the fast line past Lovell Field, can be taken through
    // on any line the station has, without stopping.
    const numbered = /^\d+$/.test(entry.plat ?? "");
    if (!numbered && (entry.call || entry.optional)) return null;
    for (const tc of this.net.tcs.values()) {
      const place = tc.platform ?? tc.waypoint;
      if (!place || place[0] !== entry.at || place[1] === entry.plat) continue;
      if (numbered && !(tc.platform && /^\d+$/.test(tc.platform[1]))) continue;
      // Never a platform the train does not fit: it would stand past the
      // signal that takes it out again, with nothing to start it.
      if (tc.platform && tc.strokes.reduce((m, id) => m + this.net.strokes[id].len, 0) < train.length) continue;
      const chain = this.search(sig, { at: entry.at, plat: place[1], fringe: null }, 0);
      if (!chain || this.refusal(chain.first) || this.crossingRule(chain.first, train, service)) continue;
      if (this.onward(chain.last, tc.id, service.entries[start + 1], entry.reverse)) return chain.first;
    }
    return null;
  }

  /**
   * Whether a train brought into a platform by `def` can go on from it to
   * `after`, the next place in its timetable: the far end of the platform,
   * the way it is going, has a signal with a route that way. A train that
   * ends there, or changes ends there by the timetable, can.
   */
  onward(def, tc, after, reverses) {
    if (!after || reverses) return true;
    let node = this.net.signals.get(def.entry).node;
    for (const id of def.strokes) {
      const s = this.net.strokes[id];
      const forward = s.na === node;
      node = forward ? s.nb : s.na;
      if (s.tc !== tc) continue;
      const starter = signalAt(this.net, node, s.id);
      return !!starter && this.routeToward(starter, after) !== null;
    }
    return false;
  }

  /**
   * The rule of a passing loop before a single line, which the interlocking
   * does not know because it is about what happens next: a train is not
   * sent on to the single line unless a platform it can reach is free at the
   * loop it will come to, and a train is not given the last such platform,
   * to wait there for the line, while a train the other way is on the line
   * and will need it. Either way round, the line is a train with nowhere
   * to go. Returns why the route must wait, or null.
   */
  crossingRule(def, train, service) {
    const single = def.tcs.map((tc) => this.net.tcs.get(tc).single).find(Boolean);
    const start = service.id === train.service ? train.next : 1;
    const ahead = service.entries.slice(start).map((e) => e.at);
    // Where the train is coming from: a shunt to the neck at Cleveland runs
    // over the line's circuits without going anywhere along it.
    const from = service.entries[start - 1]?.at ?? null;
    if (single) {
      const end = single.find((e) => e.at !== from && ahead.includes(e.at));
      if (end && !this.loopFree(end, null).length) return `waiting for a platform at ${placeName(end.at)}`;
      return null;
    }
    // Into a loop platform, to go on to the single line: the platform stays
    // free for a train already on the line if it is the last one that
    // train could take.
    const platform = def.tcs.map((tc) => this.net.tcs.get(tc)).find((t) => t.platform);
    if (!platform) return null;
    for (const tc of this.net.tcs.values()) {
      if (!tc.single) continue;
      const here = tc.single.find((e) => e.at === platform.platform[0]);
      const beyond = tc.single.find((e) => e.at !== platform.platform[0]);
      if (!here || from === beyond.at || !ahead.includes(beyond.at)) return null;
      for (const other of this.onLine(tc.single)) {
        if (other === train || !this.serviceOf(other).entries.slice(other.next).some((e) => e.at === here.at)) continue;
        if (!this.loopFree(here, platform.id).length) return `keeping a platform at ${placeName(here.at)} for ${other.desc ?? "the train"} on the single line`;
      }
      return null;
    }
    return null;
  }

  /** The platforms at the end of a single line that are free and can be reached off it, leaving out `except`. */
  loopFree(end, except) {
    const sig = this.net.signals.get(end.from);
    const out = [];
    for (const tc of this.net.tcs.values()) {
      if (tc.id === except || !tc.platform || tc.platform[0] !== end.at || !/^\d+$/.test(tc.platform[1])) continue;
      const t = this.tcs.get(tc.id);
      if (t.trains.size || t.lockedBy || t.blocked || t.mending || t.wanted) continue;
      const def = this.routeToward(sig, { at: end.at, plat: tc.platform[1], fringe: null });
      if (!def) continue;
      const why = this.refusal(def);
      if (why && !why.startsWith(`${sig.id} already`)) continue;
      out.push(tc.id);
    }
    return out;
  }

  /** The trains on a single line, or holding a route on to it. */
  onLine(single) {
    const out = [];
    for (const t of this.trains.values()) {
      if (t.state === "done") continue;
      const on = [...this.tcs.values()].some((c) => c.single === single && c.trains.has(t.id));
      const sig = this.signalAhead(t);
      const route = sig ? this.routeFrom(sig.id) : null;
      const onto = !!route && (route.train === null || route.train === t.id) && route.def.tcs.some((tc) => this.net.tcs.get(tc).single === single);
      if (on || onto) out.push(t);
    }
    return out;
  }

  /**
   * A route past an optional call whose road is shut, towards the place
   * after it: a freight booked into a loop under possession runs by on the
   * main instead of standing at the junction for the rest of the shift.
   */
  pastOptional(sig, service, train) {
    const start = service.id === train.service ? train.next : 1;
    const entries = service.entries;
    if (!entries[start]?.optional) return null;
    for (let i = start + 1; i < entries.length; i++) {
      const def = this.routeToward(sig, entries[i]);
      if (def && !this.refusal(def)) return def;
    }
    return null;
  }

  /** The first route towards the next place the timetable wants this train. */
  arsRoute(sig, service, train) {
    const start = service.id === train.service ? train.next : 1;
    for (let i = start; i < service.entries.length; i++) {
      const entry = service.entries[i];
      const def = this.routeToward(sig, entry);
      if (def) return def;
      // Off the edge where the booked line cannot be reached from here, as
      // after a crossover that would not move: the same place by another of
      // its lines is where the train is going.
      if (entry.fringe) {
        const other = this.otherLine(sig, entry, () => true);
        if (other) return other;
      }
    }
    return null;
  }

  /** The first route towards another of the lines off the edge to the place `entry` names, that `ok` accepts, or null. */
  otherLine(sig, entry, ok) {
    const place = entry.fringe.split("-")[0];
    for (const f of this.net.fringes.values()) {
      if (!f.out || f.id === entry.fringe || f.id.split("-")[0] !== place) continue;
      const chain = this.search(sig, { at: entry.at, plat: null, fringe: f.id }, 0);
      if (chain && ok(chain.first)) return chain.first;
    }
    return null;
  }

  routeToward(sig, entry) {
    return this.search(sig, entry, 0)?.first ?? null;
  }

  /**
   * Breadth-first over the routes from `sig` for a chain that reaches
   * `entry`: the first route of the chain, the last, and how many routes it is. With
   * `turns` above zero the chain may change ends that many times in a
   * platform that has a signal back out, which is how a train sent the
   * wrong way finds its timetable again. A train with passengers aboard is
   * not taken into a depot's road to do it (`depots` false).
   */
  search(sig, entry, turns, depots = true) {
    const reaches = (def) => {
      if (entry.fringe) return def.exit.kind === "fringe" && def.exit.id === entry.fringe;
      for (const tc of def.tcs) {
        const t = this.net.tcs.get(tc);
        if (t.platform && t.platform[0] === entry.at && t.platform[1] === entry.plat) return true;
        if (t.waypoint && t.waypoint[0] === entry.at && t.waypoint[1] === entry.plat) return true;
      }
      return false;
    };
    // An automatic costs nothing to set, so a chain runs straight through
    // one at the same depth: the run of plain line to the next controlled
    // signal counts as one step whether it is one block or three.
    const through = (item) => {
      let cur = item;
      for (let n = 0; n < 8 && cur.def.exit.kind === "signal" && !reaches(cur.def); n++) {
        const at = this.net.signals.get(cur.def.exit.id);
        if (at.kind !== "auto" || at.routes.length !== 1) break;
        cur = { def: this.net.routes.get(at.routes[0]), first: cur.first, turned: cur.turned };
      }
      return cur;
    };
    // The straight road before a diverging one, so a train with no platform booked keeps to the main.
    const straightFirst = (list) => list.sort((a, b) => Number(a.def.diverging) - Number(b.def.diverging));
    const seen = new Set([`${sig.id}@0`]);
    let frontier = straightFirst(sig.routes.map((id) => through({ def: this.net.routes.get(id), first: this.net.routes.get(id), turned: 0 })));
    // A turn round and back is a long way in controlled signals: the branch
    // to Collegedale and back over the TMD's junction is fourteen of them.
    for (let depth = 0; depth < (turns ? 16 : 8) && frontier.length; depth++) {
      const next = [];
      for (const f of frontier) {
        if (reaches(f.def)) return { first: f.first, last: f.def, depth: depth + 1 };
        if (f.def.exit.kind === "signal" && !seen.has(`${f.def.exit.id}@${f.turned}`)) {
          seen.add(`${f.def.exit.id}@${f.turned}`);
          for (const id of this.net.signals.get(f.def.exit.id).routes) next.push(through({ def: this.net.routes.get(id), first: f.first, turned: f.turned }));
        }
        if (f.turned >= turns) continue;
        const back = this.turnSignal(f.def, depots);
        if (!back || seen.has(`${back.id}@${f.turned + 1}`)) continue;
        seen.add(`${back.id}@${f.turned + 1}`);
        for (const id of back.routes) next.push({ def: this.net.routes.get(id), first: f.first, turned: f.turned + 1 });
      }
      frontier = straightFirst(next);
    }
    return null;
  }

  /** The signal that takes a train back out of the platform or siding a route runs into, the way it came, or null; a depot's road only with `depots`. */
  turnSignal(def, depots = true) {
    let node = this.net.signals.get(def.entry).node;
    for (const id of def.strokes) {
      const s = this.net.strokes[id];
      if (s.platform && (depots || !isDepotRoad(s.platform[0], s.platform[1]))) {
        const back = signalAt(this.net, node, s.id);
        if (back) return back;
      }
      node = s.na === node ? s.nb : s.na;
    }
    return null;
  }

  /* ---- The phone ------------------------------------------------------ */

  /** Whether the signaller works a desk of the railway, rather than watching every desk run itself. */
  onDesk() {
    return this.net.zones.some((z) => z.id === this.zone);
  }

  /** The signal, points or circuit a fault on the ground is on. */
  faultOn(d) {
    return d.kind === "signal" ? d.signal : d.kind === "points" ? d.point : d.tc;
  }

  /** The desk a signal, a set of points or a circuit is on. */
  deskOf(kind, id) {
    return (kind === "signal" ? this.net.signals : kind === "points" ? this.net.points : this.net.tcs).get(id).zone;
  }

  /**
   * The circuit the fault team takes to mend a thing, since they work on the
   * track: the one a train stands on at a signal, the one at the switch end
   * of a set of points, or the circuit itself.
   */
  mendingCircuit(kind, id) {
    if (kind === "signal") return this.net.strokes[this.net.signals.get(id).from].tc;
    if (kind === "points") return this.net.strokes[this.net.points.get(id).toe].tc;
    return id;
  }

  /** A thing as the phone says it: "signal CT13", "points 129A", "circuit UM6". */
  thingName(kind, id) {
    return kind === "signal" ? `signal ${id}` : kind === "points" ? `points ${id}` : `circuit ${tcName(id)}`;
  }

  /**
   * A circuit by the name a signaller would type. Names repeat from desk to
   * desk, so the signaller's own desk's comes first, then the only one of
   * that name elsewhere, or a name written with its desk, "RS.UM6".
   * `several` lists them when the name is on more than one other desk.
   */
  circuitNamed(name) {
    if (name.includes(".")) return this.net.tcs.has(name) ? { id: name } : null;
    if (this.net.tcs.has(`${this.zone}.${name}`)) return { id: `${this.zone}.${name}` };
    // A road by the name the board writes beside it, C1 for the first air
    // cargo road, where only one road on the desk has that name.
    const roads = [...this.net.tcs.values()].filter((t) => t.zone === this.zone && t.platform && !/^\d+$/.test(t.platform[1]) && t.platform[1].toUpperCase() === name);
    if (roads.length === 1) return { id: roads[0].id };
    const all = [...this.net.tcs.keys()].filter((id) => tcName(id) === name);
    if (all.length === 1) return { id: all[0] };
    return all.length ? { several: all } : null;
  }

  /**
   * A set of points by the number the board shows, "129", or by either end
   * of a pair, "129A": a pair is worked as one, so the call is about the end
   * with the fault on it if either has one, and otherwise the end named, or
   * the first.
   */
  pointsNamed(typed) {
    const gang = this.net.gangs.get(typed) ?? (this.net.points.has(typed) ? this.net.gangs.get(this.net.points.get(typed).gang) : null);
    if (!gang) return null;
    const faulty = gang.find((id) => this.disruptions.some((d) => d.kind === "points" && d.point === id && d.started && !d.ended));
    return faulty ?? (gang.includes(typed) ? typed : gang[0]);
  }

  /** Everything a typed number could be: a signal, a set of points, a circuit, a train. */
  identify(typed) {
    const found = [];
    if (this.net.signals.has(typed)) found.push({ kind: "signal", id: typed });
    const points = this.pointsNamed(typed);
    if (points) found.push({ kind: "points", id: points });
    const tc = this.circuitNamed(typed);
    if (tc) found.push({ kind: "tc", ...tc });
    const live = [...this.trains.values()].filter((t) => t.state !== "done");
    const train = live.find((t) => t.desc === typed) ?? live.find((t) => t.service === typed);
    if (train) found.push({ kind: "train", id: train.service, train });
    else if (this.plan.has(typed)) found.push({ kind: "train", id: typed, away: true });
    return found;
  }

  /**
   * A call on the phone: what is wrong, the `issue` ("signal", "points",
   * "tc" or "train"), and the number typed for where. The answer is the
   * person rung's, with the number read back. `ask` is true when they want
   * the number again: it was not one of the kind the issue is about, or not
   * on the railway at all. A number that is real but not the one at fault is
   * taken at its word, and it costs the time it takes to find out.
   */
  ring(issue, text) {
    const typed = String(text ?? "").toUpperCase().replace(/\s+/g, "");
    const words = PHONE_WORDS[issue];
    const from = issue === "train" ? "Control" : "Fault control";
    const ask = (said) => ({ ok: false, ask: true, from, text: said ? `${said} ${words.ask}` : words.ask });
    if (!words) return { ok: false, ask: false, from: "Phone", text: "Nobody answers that" };
    if (!typed) return ask("");
    const found = this.identify(typed);
    const hit = found.find((f) => f.kind === issue);
    if (!hit) {
      if (found.length) return ask(`${typed} is ${PHONE_WORDS[found[0].kind].a}, not ${words.a}.`);
      if (issue === "points") return ask(`There are no points ${typed}.`);
      if (issue === "tc") return ask(`There is no circuit ${typed}.`);
      return ask(`There is no ${issue} ${typed}.`);
    }
    if (hit.several) return ask(`There is a ${typed} on ${hit.several.length} desks: say which, as ${hit.several[0]}.`);
    return issue === "train" ? this.ringDriver(hit, typed) : this.ringFaultControl(issue, hit.id);
  }

  /** The answer to a call, into the log with who gave it, and back to the phone. */
  answer(from, text) {
    this.say(`${from}: ${text}`, true);
    return { ok: true, ask: false, from, text };
  }

  /**
   * A fault rung through to Fault control. They cannot tell a right number
   * from a wrong one, so either way they read it back and send the team:
   * to the fault, or to a thing with nothing wrong with it, and a look.
   */
  ringFaultControl(kind, id) {
    const zone = this.deskOf(kind, id);
    const where = `${capital(this.thingName(kind, id))} at ${placeName(zonePlace(zone))}`;
    const d = this.disruptions.find((x) => x.kind === kind && this.faultOn(x) === id && x.started && !x.ended);
    if (d && d.reportedAt !== undefined) {
      const how = d.mendingFrom !== undefined ? `the fault team has ${this.thingName("tc", d.circuit)} until ${hhmm(d.until)}` : this.time >= d.teamAt ? `the fault team is there, waiting for ${this.thingName("tc", d.circuit)}` : `the fault team is due ${hhmm(d.teamAt)}`;
      return this.answer("Fault control", `${where}, rung in already: ${how}.`);
    }
    const going = this.visits.find((v) => v.kind === kind && v.id === id && !v.done);
    if (!d && going) return this.answer("Fault control", `${where}, rung in already: the fault team is due ${hhmm(going.at)}.`);
    const due = this.time + (FAULT_TEAM.travel[zone] ?? 10) * 60;
    if (d) this.report(d, null);
    else this.visits.push({ kind, id, zone, at: due, done: false });
    return this.answer("Fault control", `${where}: the fault team is on its way, with you about ${hhmm(due)}. Once they have found the fault they will want ${this.thingName("tc", this.mendingCircuit(kind, id))} for ${FAULT_TEAM.work[kind]} minutes to mend it.`);
  }

  /**
   * A train's driver rung about a fault on the train. The fitter comes for
   * a fault whatever anyone says, so the call is for the other way: the
   * driver isolates the fault and takes the train on at `LIMP` speed to the
   * end of its working, which frees the platform now and has a slow train
   * on the line for the rest of the way.
   */
  ringDriver(hit, typed) {
    if (hit.away) return { ok: false, ask: true, from: "Control", text: `${typed} is not on the railway just now. ${PHONE_WORDS.train.ask}` };
    const train = hit.train;
    const zone = this.zoneOf(train);
    if (this.onDesk() && zone !== this.zone) return { ok: false, ask: true, from: "Control", text: `${hit.id} is on the ${placeName(zonePlace(zone))} desk, not yours. ${PHONE_WORDS.train.ask}` };
    const name = train.desc ?? hit.id;
    const held = train.failedUntil !== null && this.time < train.failedUntil;
    if (held && train.held === "crew") return this.answer("Crew control", `${name} has no driver to ring: the relief is due ${hhmm(train.failedUntil)}.`);
    if (train.limp) return this.answer(`Driver of ${name}`, `${name}: isolated already, and going on at ${LIMP.mph} mph.`);
    if (!held || train.held !== "fail") {
      const said = this.answer(`Driver of ${name}`, `${name}: nothing wrong with this one.`);
      this.falseCall(`the driver of ${name} had nothing wrong with the train`);
      return said;
    }
    const station = this.stationOf(train);
    train.failedUntil = this.time + LIMP.isolate * 60;
    train.held = "isolating";
    train.limp = true;
    train.vmax = Math.min(train.vmax, LIMP.mph / 2.237);
    return this.answer(`Driver of ${name}`, `${name}${station ? ` at ${placeName(station)} platform ${this.platformOf(train)}` : ""}: isolating it now, ready in a minute, and on at ${LIMP.mph} mph from there.`);
  }

  /**
   * A call about nothing, which the shift manager takes points for
   * (`FALSE_CALL`). It is not a black mark, so no number of them relieves
   * the signaller; on the training desk the instructor only says what it
   * would cost.
   */
  falseCall(text) {
    this.falseCalls.push({ time: this.time, text });
    const key = `call:${this.falseCalls.length}`;
    if (this.training) this.alarm(`On a real desk a call about nothing costs ${FALSE_CALL} points: ${text}`, this.zone, key, "Instructor");
    else this.alarm(`A call about nothing, ${FALSE_CALL} points off: ${text}`, this.zone, key, "Shift manager");
  }

  /** A fault rung in and the fault team sent: by the signaller (`who` null), or by someone who says so. */
  report(d, who) {
    const id = this.faultOn(d);
    const zone = this.deskOf(d.kind, id);
    d.reportedAt = this.time;
    d.reportedBy = who ?? "the signaller";
    d.teamAt = this.time + (FAULT_TEAM.travel[zone] ?? 10) * 60;
    d.circuit = this.mendingCircuit(d.kind, id);
    if (who) this.alarm(`${capital(this.thingName(d.kind, id))} rung in by ${who}: the fault team is due ${hhmm(d.teamAt)}`, zone, null, "Fault control", `${d.kind}:${id}`);
  }

  /**
   * The fault team's rounds. A fault nobody has rung in is rung in by
   * whoever would: the signaller on another desk after a minute, and on the
   * signaller's own desk a driver come to a signal showing nothing, or
   * Control, as late as the conditions say (`RINGS_IN`). The team, once
   * there, waits for the line at the fault to be clear, takes it and mends
   * the fault; and a team sent to a thing with nothing wrong with it says so.
   */
  faultTeam() {
    const rule = this.training ? RINGS_IN.school : (RINGS_IN[this.level] ?? RINGS_IN.mixed);
    for (const d of this.disruptions) {
      if (!GROUND.has(d.kind) || !d.started || d.ended) continue;
      const id = this.faultOn(d);
      const zone = this.deskOf(d.kind, id);
      if (d.reportedAt === undefined) {
        if (zone !== this.zone) {
          if (this.time - d.at >= RINGS_IN.colleague) this.report(d, `the signaller at ${placeName(zonePlace(zone))}`);
        } else if (rule.control !== null && this.time - d.at >= rule.control) this.report(d, "Control");
        else if (d.kind === "signal" && rule.driver !== null) {
          const train = this.standingAt(this.net.signals.get(id));
          if (train && d.metAt === undefined) {
            d.metAt = this.time;
            d.metBy = train.desc ?? "a train";
          }
          if (d.metAt !== undefined && this.time - d.metAt >= rule.driver) this.report(d, `the driver of ${d.metBy}`);
        }
        continue;
      }
      const t = this.tcs.get(d.circuit);
      if (d.wantedFrom === undefined && this.time >= d.teamAt) {
        d.wantedFrom = this.time;
        t.wanted = true;
        // A circuit is said to be one, since some are named for the points on them, as 939 is.
        const what = d.kind === "tc" ? "it" : this.thingName("tc", d.circuit);
        this.alarm(`At ${this.thingName(d.kind, id)}: we want ${what} to ourselves for ${FAULT_TEAM.work[d.kind]} minutes, as soon as it is clear`, zone, null, "Fault team", `tc:${d.circuit}`);
      }
      if (d.wantedFrom !== undefined && d.mendingFrom === undefined && !t.trains.size && !t.lockedBy) {
        d.mendingFrom = this.time;
        t.wanted = false;
        t.mending = true;
        d.until = Math.min(d.until ?? Infinity, this.time + FAULT_TEAM.work[d.kind] * 60);
        this.alarm(`${capital(this.thingName("tc", d.circuit))} taken, and mending ${d.kind === "tc" ? "it" : this.thingName(d.kind, id)} until ${hhmm(d.until)}`, zone, null, "Fault team", `tc:${d.circuit}`);
      }
    }
    for (const v of this.visits) {
      if (v.done || this.time < v.at + FAULT_TEAM.look * 60) continue;
      v.done = true;
      this.alarm(`At ${this.thingName(v.kind, v.id)}: nothing wrong with ${v.kind === "points" ? "them" : "it"}. Ring again with the one that has failed`, v.zone, null, "Fault team", `${v.kind}:${v.id}`);
      this.falseCall(`the fault team found nothing wrong with ${this.thingName(v.kind, v.id)}`);
    }
  }

  /* ---- Things going wrong --------------------------------------------- */

  applyDisruptions() {
    for (const d of this.disruptions) {
      if (!d.started && d.at !== undefined && this.time >= d.at) {
        // A line is taken for engineering only with nothing on it or set over it, and not once its time is up.
        if (d.kind === "possession") {
          if (this.time >= d.until) { d.started = true; d.ended = true; continue; }
          const t = this.tcs.get(d.tc);
          if (t.trains.size || t.lockedBy) continue;
        }
        d.started = true;
        this.apply(d);
      }
      if (d.kind === "leaves" && d.started && !d.ended && this.treated(d)) { d.ended = true; this.lift(d); }
      if (d.started && !d.ended && d.until !== undefined && this.time >= d.until) { d.ended = true; this.lift(d); }
    }
  }

  /** Whether the treatment train has been over the leaves and gone on: the railhead is clean behind it. */
  treated(d) {
    const train = [...this.trains.values()].find((t) => t.service === d.by);
    const on = !!train && d.tcs.some((tc) => this.tcs.get(tc).trains.has(train.id));
    if (on) d.treating = true;
    return !!d.treating && !on;
  }

  apply(d) {
    d.started = true;
    if (d.kind === "possession") {
      this.tcs.get(d.tc).blocked = true;
      this.alarm(`${tcName(d.tc)} blocked for engineering work until ${hhmm(d.until)}`, this.net.tcs.get(d.tc).zone, null, "Engineer", `tc:${d.tc}`);
    } else if (GROUND.has(d.kind)) {
      // A fault on the ground is mended once it has been rung in, and not
      // before: when is the fault team's to say, not the roll's. Frozen
      // points still thaw by themselves when the cold snap is over.
      if (!d.frozen) d.until = undefined;
      if (d.kind === "tc") {
        this.tcs.get(d.tc).failed = true;
        this.alarm(`Track circuit ${tcName(d.tc)} has failed: it shows occupied with nothing on it`, this.net.tcs.get(d.tc).zone, null, "Interlocking", `tc:${d.tc}`);
      } else if (d.kind === "points") {
        this.points.get(d.point).failed = true;
        const lie = this.points.get(d.point).lie === "N" ? "normal" : "reverse";
        this.alarm(d.frozen ? `Points ${d.point} frozen, lying ${lie}` : `Points ${d.point} have failed, lying ${lie}`, this.net.points.get(d.point).zone, null, "Interlocking", `points:${d.point}`);
      } else {
        this.signals.get(d.signal).failed = true;
        const auto = this.net.signals.get(d.signal).kind === "auto";
        this.alarm(`Signal ${d.signal} has failed, showing nothing${auto ? ": drivers stop a minute and go on at caution" : ""}`, this.net.signals.get(d.signal).zone, null, "Interlocking", `signal:${d.signal}`);
      }
    } else if (d.kind === "weather") {
      if (d.what === "wind") this.alarm(`High winds: ${mph(d.cap)} mph over the whole railway until ${hhmm(d.until)}`, null, null, "Control");
      else if (d.what === "snow") this.alarm(`Snow: ${mph(d.cap)} mph over the whole railway until ${hhmm(d.until)}`, null, null, "Control");
      else if (d.what === "heat") this.alarm(`Rail temperature: ${mph(d.cap)} mph over the whole railway until ${hhmm(d.until)}, or until it cools`, null, null, "Control");
      else this.alarm(`Water over the rails ${d.where}: ${mph(d.cap)} mph until ${hhmm(d.until)}`, this.net.tcs.get(d.tcs[0]).zone, null, "Mobile operations", `tc:${d.tcs[0]}`);
    } else if (d.kind === "examine") {
      for (const tc of d.tcs) this.tcs.get(tc).blocked = true;
      this.alarm(`${d.reason} ${d.where}: the line is blocked both ways until it has been cleared`, this.net.tcs.get(d.tcs[0]).zone, null, d.from ?? "Control", `tc:${d.tcs[0]}`);
    } else if (d.kind === "leaves") {
      const train = this.plan.get(d.by);
      const first = train?.entries[0];
      this.alarm(`Leaf fall ${d.where}: the railhead is greasy and we are running at ${mph(d.cap)} mph over it. ${d.by} is booked from ${first ? placeName(first.at) : "the depot"} at ${first ? hhmm(first.dep) : "?"} to treat it`, this.net.tcs.get(d.tcs[0]).zone, null, "Drivers", `tc:${d.tcs[0]}`);
    }
  }

  lift(d) {
    if (d.kind === "possession") {
      this.tcs.get(d.tc).blocked = false;
      this.alarm(`${tcName(d.tc)} handed back`, this.net.tcs.get(d.tc).zone, null, "Engineer", `tc:${d.tc}`);
    } else if (GROUND.has(d.kind)) {
      // The line the fault team had, or was waiting for, goes back, unless
      // another fault's team is on the same circuit.
      const mended = d.mendingFrom !== undefined;
      if (d.circuit && !this.disruptions.some((x) => x !== d && x.circuit === d.circuit && x.reportedAt !== undefined && !x.ended)) {
        const t = this.tcs.get(d.circuit);
        t.wanted = false;
        t.mending = false;
      }
      const back = mended ? `, and ${tcName(d.circuit)} handed back` : "";
      if (d.kind === "tc") {
        this.tcs.get(d.tc).failed = false;
        this.alarm(`Track circuit ${tcName(d.tc)} repaired and clear again${back}`, this.net.tcs.get(d.tc).zone, null, "Fault team", `tc:${d.tc}`);
      } else if (d.kind === "points") {
        const p = this.points.get(d.point);
        p.failed = false;
        if (p.wanted !== p.lie) p.moving = POINTS_TIME;
        this.alarm(d.frozen && !mended ? `Points ${d.point} thawed and working` : `Points ${d.point} repaired${back}`, this.net.points.get(d.point).zone, null, mended ? "Fault team" : "Interlocking", `points:${d.point}`);
      } else {
        this.signals.get(d.signal).failed = false;
        this.alarm(`Signal ${d.signal} restored${back}`, this.net.signals.get(d.signal).zone, null, "Fault team", `signal:${d.signal}`);
      }
    } else if (d.kind === "weather") {
      if (d.what === "wind") this.alarm("Wind restriction lifted, normal running", null, null, "Control");
      else if (d.what === "snow") this.alarm("Snow restriction lifted, normal running", null, null, "Control");
      else if (d.what === "heat") this.alarm("The rail has cooled: normal running", null, null, "Control");
      else this.alarm(`${d.where[0].toUpperCase()}${d.where.slice(1)}: the water has gone, normal running`, this.net.tcs.get(d.tcs[0]).zone, null, "Mobile operations", `tc:${d.tcs[0]}`);
    } else if (d.kind === "examine") {
      for (const tc of d.tcs) this.tcs.get(tc).blocked = false;
      d.unexamined = [...d.tcs];
      this.alarm(`${d.where[0].toUpperCase()}${d.where.slice(1)}: line clear. The first train each way examines it at caution`, this.net.tcs.get(d.tcs[0]).zone, null, "Mobile operations", `tc:${d.tcs[0]}`);
    } else if (d.kind === "leaves") {
      this.alarm(d.treating ? `${d.by} has been through ${d.where}: railhead treated, normal running` : `Leaf fall ${d.where}: normal running`, this.net.tcs.get(d.tcs[0]).zone, null, "Control", `tc:${d.tcs[0]}`);
    }
  }

  /**
   * The crossings. On another desk the colleague lowers the barriers as soon
   * as a route is set over them and raises them once nothing is; on this
   * desk they are the signaller's, and a road left waiting is an alarm.
   */
  crossings() {
    for (const lc of this.net.lcs.values()) {
      const state = this.lcs.get(lc.id);
      const held = this.lcHeld(lc);
      if (lc.zone !== this.zone) {
        if (held && state.barriers === "up") this.lowerBarriers(lc.id);
        else if (!held && state.barriers === "down" && this.time - state.since > 5) this.raiseBarriers(lc.id);
        continue;
      }
      if (!held && state.barriers === "down" && this.time - state.since > LC_QUEUE) {
        this.alarm(`${lc.name}: barriers down ${Math.floor((this.time - state.since) / 60)} minutes with nothing signalled over them, the road is queueing`, lc.zone, `lc:${lc.id}`, "Police", `lc:${lc.id}`);
      }
    }
  }

  /** Alarms for trains standing too long, and housekeeping for finished ones. */
  watch() {
    this.crossings();
    for (const train of [...this.trains.values()]) {
      if (train.disposeAt !== undefined && this.time >= train.disposeAt) { this.remove(train); continue; }
      if (train.formAt !== undefined && this.time >= train.formAt) {
        train.formAt = undefined;
        if (train.desc && train.berth) this.berths.set(train.berth, train.service);
        train.desc = train.desc ? train.service : null;
      }
      if (train.state !== "stop") continue;
      const stood = this.time - train.arrivedAt;
      const sig = this.signalAhead(train);
      this.stopAndProceed(train, sig);
      this.colleague(train, sig);
      this.strayed(train, sig);
      // Waiting that began before the clock-in counts from the clock-in, in the mark as in the rule.
      const since = this.waitingSince(train);
      if (since !== null && this.isMine(train)) this.checkShut(train, sig);
      const stoodFor = since === null ? 0 : this.time - Math.max(since, this.window.start, train.shutAt ?? -Infinity);
      if (since !== null && stoodFor >= MARK_STAND && !train.marked && this.isMine(train) && !this.relieved) {
        this.mark(train, `${train.desc ?? "a train"} stood ${sig ? `at ${sig.id}` : "on the desk"} for ${Math.floor(stoodFor / 60)} minutes with no route`);
      }
      if (train.stopped === "signal" && !train.desc && stood > 30 && sig) this.alarm(`Train without description standing at ${sig.id}`, sig.zone, `desc:${train.id}`, "Describer", `berth:${sig.id}`);
      if (train.stopped === "signal" && stood > 240 && sig) this.alarm(`Standing at ${sig.id} for ${Math.floor(stood / 60)} min`, sig.zone, `stood:${train.id}`, `Driver of ${train.desc ?? "a train"}`, `signal:${sig.id}`);
      // Past time from when it could have gone: not while its own fault or missing driver held it.
      if ((train.stopped === "platform" || train.stopped === "origin") && since !== null && this.time - since > 180 && sig) {
        const station = this.stationOf(train);
        this.alarm(`${train.desc ?? "A train"} is ${Math.floor((this.time - since) / 60)} min past time at ${sig.id}`, sig.zone, `held:${train.id}`, station ? `Dispatcher at ${placeName(station)}` : "Dispatcher", `signal:${sig.id}`);
      }
    }
  }

  /**
   * The other desks are staffed. A train standing on one of them with no
   * description is interposed after a minute; one whose route is set but
   * whose signal will not clear over a failed circuit is authorised past it.
   */
  colleague(train, sig) {
    // No desk of the signaller's means every desk is a colleague's.
    if (!sig || sig.zone === this.zone) return;
    const stood = this.time - train.arrivedAt;
    if (!train.desc && stood >= COLLEAGUE.interpose) {
      train.desc = train.service;
      if (train.berth) this.berths.set(train.berth, train.desc);
      this.say(`${sig.id}: ${train.desc} interposed from the other desk`, true);
      return;
    }
    const route = this.routeFrom(sig.id);
    if (!route || route.entered || this.proceed(sig.id) || this.signals.get(sig.id).authorised) return;
    if (stood < COLLEAGUE.authorise) return;
    const failedOnly = route.def.tcs.every((tc) => !this.tcs.get(tc).trains.size) && route.def.tcs.some((tc) => this.tcs.get(tc).failed);
    if (failedOnly || this.signals.get(sig.id).failed) this.authorise(sig.id);
  }

  /**
   * Stop and proceed: at an automatic that has failed, the driver stands
   * a minute, then passes it at danger and goes on at caution to the next
   * signal, as the rule book has it. Nobody's authority is needed, on any
   * desk; a block that is not free keeps the train where it is as ever.
   */
  stopAndProceed(train, sig) {
    if (!sig || sig.kind !== "auto" || !this.signals.get(sig.id).failed) return;
    if (this.time - train.arrivedAt < STOP_AND_PROCEED) return;
    const route = this.routeFrom(sig.id);
    if (!route || route.entered || this.signals.get(sig.id).authorised) return;
    train.caution = 2;
    this.signals.get(sig.id).authorised = true;
    this.extend(train, route);
    this.say(`${train.desc ?? "A train"} passed ${sig.id} at danger after a minute stood, as the rule allows at a failed automatic, and goes on at caution`, true);
  }

  /**
   * Whether a standing train has been sent somewhere its timetable cannot
   * be reached from: no chain of routes from the signal ahead leads to any
   * place it has still to call at. A train waiting for a route that exists
   * is not lost, however long it waits.
   */
  lost(train, sig) {
    if (train.state !== "stop" || train.stopped !== "signal") return false;
    const service = this.serviceOf(train);
    if (train.next >= service.entries.length) return false;
    // At a buffer stop with more of the timetable to keep, there is nowhere on.
    if (!sig) return true;
    if (this.routeFrom(sig.id)) return false;
    return this.arsRoute(sig, service, train) === null;
  }

  /** The signal that would take the train back out of the platform or siding it stands in, the way it came, or null. */
  backSignal(train) {
    const k = Math.max(0, Math.min(train.passed - 1, train.path.length - 1));
    const s = this.net.strokes[train.path[k].stroke];
    if (!s.platform) return null;
    return signalAt(this.net, train.path[k].forward ? s.na : s.nb, s.id);
  }

  /** Whether the train stands in a platform or siding with a signal to take it back out the way it came. */
  canTurnHere(train) {
    return this.backSignal(train) !== null;
  }

  /**
   * How a train sent the wrong way gets back to its timetable: the route to
   * take now (`def`), or the word to change ends where it stands (`turn`),
   * whichever reaches the next timing point it can still keep in fewer
   * moves. Null when neither does.
   */
  planBack(train, sig) {
    const service = this.serviceOf(train);
    const entries = service.entries;
    const back = this.canTurnHere(train) ? this.backSignal(train) : null;
    // Empty stock, freight and engines may change ends in a depot's road;
    // a train with passengers aboard is turned in a platform.
    const depots = !PASSENGER.has(service.kind);
    for (let i = train.next; i < entries.length; i++) {
      const on = sig ? this.search(sig, entries[i], 2, depots) : null;
      const turned = back ? this.search(back, entries[i], 1, depots) : null;
      if (on && (!turned || on.depth <= turned.depth + 1)) return { def: on.first, turn: false };
      if (turned) return { def: null, turn: true };
    }
    return null;
  }

  /**
   * The moment a train is found to have been sent the wrong way. The desk
   * whose signaller gave it that road is marked for it; the automatic
   * setting on the other desks never sends a train anywhere its timetable
   * cannot be reached from.
   */
  noteLost(train) {
    if (train.lostAt !== undefined) return;
    train.lostAt = this.time;
    const from = train.routedFrom ? this.net.signals.get(train.routedFrom) : null;
    if (train.routedBy !== "signaller" || !from || from.zone !== this.zone || this.relieved) return;
    this.mark(train, `${train.desc ?? train.service} was sent the wrong way from ${from.id}`);
  }

  /**
   * A train sent the wrong way. Standing in a platform or siding, the
   * driver changes ends after a while and it can be routed back the way it
   * came; standing anywhere else, the desk is told it needs a platform to
   * reverse in. On the other desks the colleague finds it one.
   */
  strayed(train, sig) {
    const stood = this.time - train.arrivedAt;
    if (stood < LOST_WAIT || !this.lost(train, sig)) return;
    this.noteLost(train);
    const here = this.net.strokes[train.path[Math.min(train.passed - 1, train.path.length - 1)].stroke];
    const name = train.desc ?? train.service;
    const plan = this.planBack(train, sig);
    if (plan ? plan.turn : this.canTurnHere(train)) {
      if (stood < LOST_TURN) return;
      this.reverse(train);
      train.arrivedAt = this.time;
      train.stopped = "signal";
      train.dwellUntil = null;
      this.say(`${name} was sent the wrong way: the driver has changed ends at ${placeName(here.platform[0])} ${here.platform[1]}`, true);
      return;
    }
    const entry = this.serviceOf(train).entries[train.next];
    if (sig) this.alarm(`At ${sig.id} and cannot reach ${placeName(entry.at)} from here: we need a platform to reverse in`, sig.zone, `lost:${train.id}`, `Driver of ${name}`, `signal:${sig.id}`);
  }

  /* ---- The score ------------------------------------------------------ */

  /** How the shift's own trains ended: the hour before the clock-in is nobody's to score. */
  shiftResults() {
    return [...this.results.values()].filter((r) => !this.plan.get(r.id)?.warm);
  }

  summary() {
    const rows = this.shiftResults();
    const total = [...this.plan.values()].filter((s) => !s.warm).length;
    let onTime = 0, points = 0, lateSum = 0, counted = 0;
    for (const r of rows) {
      if (r.unfinished || r.wrongExit || r.late === null) continue;
      counted++;
      lateSum += Math.max(0, r.late);
      if (r.late < ON_TIME) onTime++;
      // Ten points a minute late, weighed by the class: double for an
      // express or a high-speed train, half for anything carrying no passengers.
      const weight = KINDS[this.plan.get(r.id)?.kind]?.weight ?? 1;
      points += Math.max(0, 100 - (weight * Math.max(0, r.late)) / 6) - 15 * r.changes - 40 * r.missed;
    }
    points -= FALSE_CALL * this.falseCalls.length;
    return {
      seed: this.seed,
      total,
      finished: rows.length,
      counted,
      // On time is judged on the trains that are done, not the ones still to
      // come; once the shift is over every train has a result, so a train
      // left on the railway counts against it then, and not before.
      ppm: rows.length ? Math.round((100 * onTime) / rows.length) : 0,
      avgLate: counted ? lateSum / counted : 0,
      points: Math.max(0, Math.round(points)),
      marks: this.marks.length,
      falseCalls: this.falseCalls.length,
      relieved: this.relieved,
    };
  }

  /* ---- Saving --------------------------------------------------------- */

  snapshot() {
    return {
      version: 17,
      seed: this.seed, level: this.level, zone: this.zone, shift: { ...this.shift }, time: this.time, rate: this.rate, finished: this.finished,
      // Taken over warm, its plan holds the hour before the clock-in, and its trains may be of it.
      warm: this.warm,
      // Where the clock is between steps, and between the rounds the
      // automatics, ARS and the watch are worked in, so a shift resumes
      // exactly where it was rather than a second or two out of step.
      carry: this.carry ?? 0, arsClock: this.arsClock,
      points: [...this.points].map(([id, p]) => [id, { ...p }]),
      tcs: [...this.tcs].map(([id, t]) => [id, { failed: t.failed, blocked: t.blocked, wanted: t.wanted, mending: t.mending }]),
      routes: [...this.routes.values()].map((r) => ({ id: r.id, entered: r.entered, cancelAt: r.cancelAt, held: [...r.held], train: r.train, setAt: r.setAt, by: r.by })),
      signals: [...this.signals].map(([id, s]) => [id, { ...s }]),
      berths: [...this.berths],
      trains: [...this.trains.values()].map((t) => ({ ...t, path: t.path.map((p) => ({ ...p })), cum: [...t.cum], calls: t.calls.map((c) => ({ ...c })) })),
      spawned: [...this.spawned],
      results: [...this.results.values()],
      alarms: this.alarms.map((a) => ({ ...a })),
      alarmSeq: this.alarmSeq,
      log: this.log.slice(-60),
      disruptions: this.disruptions.map((d) => ({ ...d })),
      rebooked: this.rebooked.map((r) => structuredClone(r)),
      visits: this.visits.map((v) => ({ ...v })),
      falseCalls: this.falseCalls.map((c) => ({ ...c })),
      nextTrain: this.nextTrain,
      marks: this.marks.map((m) => ({ ...m })),
      relieved: this.relieved,
      relievedAt: this.relievedAt,
      lcs: [...this.lcs].map(([id, l]) => [id, { ...l }]),
    };
  }

  static restore(net, snap) {
    const sim = new Simulation(net, { seed: snap.seed, level: snap.level, zone: snap.zone, shift: snap.shift ?? SHIFT, warm: !!snap.warm });
    sim.time = snap.time;
    sim.carry = snap.carry ?? 0;
    sim.arsClock = snap.arsClock ?? 0;
    sim.rate = snap.rate ?? 1;
    sim.finished = !!snap.finished;
    for (const [id, p] of snap.points) if (sim.points.has(id)) sim.points.set(id, { ...p });
    for (const [id, t] of snap.tcs) if (sim.tcs.has(id)) Object.assign(sim.tcs.get(id), { failed: t.failed, blocked: t.blocked, wanted: !!t.wanted, mending: !!t.mending });
    for (const r of snap.routes) {
      const def = net.routes.get(r.id);
      if (!def) continue;
      const route = { id: r.id, def, entered: r.entered, cancelAt: r.cancelAt, held: new Set(r.held), train: r.train, setAt: r.setAt, by: r.by };
      sim.routes.set(r.id, route);
      for (const tc of route.held) sim.tcs.get(tc).lockedBy = r.id;
    }
    for (const [id, s] of snap.signals) if (sim.signals.has(id)) sim.signals.set(id, { ...s });
    for (const [id, text] of snap.berths) if (sim.berths.has(id)) sim.berths.set(id, text);
    for (const t of snap.trains) sim.trains.set(t.id, { ...t });
    sim.spawned = new Set(snap.spawned);
    sim.results = new Map(snap.results.map((r) => [r.id, r]));
    sim.alarms = snap.alarms.map((a) => ({ ...a }));
    // A save from before alarms were numbered has them numbered as they stand, oldest first.
    sim.alarmSeq = snap.alarmSeq ?? 0;
    for (const a of sim.alarms) if (a.seq === undefined) a.seq = ++sim.alarmSeq;
    sim.log = snap.log.map((l) => ({ ...l }));
    sim.disruptions = snap.disruptions.map((d) => ({ ...d }));
    for (const r of snap.rebooked ?? []) {
      sim.plan.delete(r.old);
      sim.plan.set(r.service.id, structuredClone(r.service));
      if (sim.plan.has(r.feeder)) sim.plan.get(r.feeder).then = r.service.id;
      sim.rebooked.push(structuredClone(r));
    }
    sim.visits = (snap.visits ?? []).map((v) => ({ ...v }));
    sim.falseCalls = (snap.falseCalls ?? []).map((c) => ({ ...c }));
    sim.nextTrain = snap.nextTrain;
    sim.marks = (snap.marks ?? []).map((m) => ({ ...m }));
    for (const [id, l] of snap.lcs ?? []) if (sim.lcs.has(id)) sim.lcs.set(id, { ...l });
    sim.relieved = !!snap.relieved;
    sim.relievedAt = snap.relievedAt ?? null;
    sim.occupy();
    return sim;
  }
}

/** Whether two routes cannot be set together. */
export function conflicts(a, b) {
  for (const tc of a.tcs) if (b.tcs.includes(tc)) return true;
  for (const p of a.points) {
    const q = b.points.find((x) => x.id === p.id);
    if (q && q.lie !== p.lie) return true;
  }
  return false;
}

/** The place a zone is named for, as the timetable codes it. */
export function zonePlace(zone) {
  return { WH: "WH", RS: "RS", CT: "CT", ER: "ER", CL: "CL", SC: "MB" }[zone] ?? zone;
}

/**
 * The desk each place in the timetable is on: found from the platforms,
 * sidings and loops that carry its code, and from the fringes named for the
 * places off the edge of the railway.
 */
export function placeZones(net) {
  const out = new Map();
  for (const tc of net.tcs.values()) {
    const place = tc.platform ?? tc.waypoint;
    if (place && !out.has(place[0])) out.set(place[0], tc.zone);
  }
  for (const f of net.fringes.values()) {
    const code = f.id.split("-")[0];
    if (!out.has(code)) out.set(code, f.zone);
  }
  return out;
}

/** A sentence's first letter made a capital. */
function capital(text) {
  return text ? text[0].toUpperCase() + text.slice(1) : text;
}

/** Names in a sentence: "A", "A and B", "A, B and C". */
function andList(names) {
  return names.length < 2 ? names.join("") : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
}

/**
 * The first signal somebody works past an automatic, down its run of
 * automatics: where a road on past it is set from. Null when the run goes
 * off the railway's edge first.
 */
export function workedPast(net, id) {
  const seen = new Set();
  let sig = net.signals.get(id);
  while (sig?.kind === "auto" && !seen.has(sig.id)) {
    seen.add(sig.id);
    const exit = net.routes.get(sig.routes[0]).exit;
    if (exit.kind !== "signal") return null;
    sig = net.signals.get(exit.id);
  }
  return sig && sig.kind !== "auto" ? sig : null;
}

/**
 * Whether the place a timetable entry names is somewhere a train can be: a
 * platform or a road, or a loop it is booked to stand in. A line it only
 * runs along is not, the fast line through Lovell Field or the way off the
 * edge, so it is never printed as if it were a platform.
 */
export function standsAt(net, e) {
  if (!e.plat || e.fringe) return false;
  if (e.call) return true;
  for (const tc of net.tcs.values()) if (tc.platform && tc.platform[0] === e.at && tc.platform[1] === e.plat) return true;
  return false;
}

/**
 * Circuits the board names by the road they are, as it writes the road
 * beside it: the air cargo roads' AC1 and AC2 are C1 and C2, and the TMD's
 * TM1 to TM4 are R1 to R4. Filled by `compile()`; the layouts are fixed, so
 * every network compiled from them agrees.
 */
const PRINTED = new Map();

/** A circuit's name as the screen prints it: the zone dropped, or the road's name where the board writes one beside it. */
export function tcName(tc) {
  return PRINTED.get(tc) ?? tc.replace(/^\w+\./, "");
}

export function placeName(code) {
  return {
    BD: "Bridgeport", WS: "Whiteside", TF: "Tiftonia", WH: "Wauhatchie", LV: "Lookout Valley", RS: "Riverside", SE: "St Elmo", CT: "Chattanooga", BR: "Brainerd",
    ER: "East Ridge", ES: "Enterprise South", RG: "Ringgold", TH: "Tunnel Hill", DL: "Dalton", OO: "Ooltewah", CD: "Collegedale", CL: "Cleveland",
    LF: "Lovell Field", PK: "Lovell Field Parkway", AP: "Lovell Field Airport", AC: "Airport cargo", CA: "Calhoun", TM: "Ooltewah TMD",
    WI: "Williams Island", MB: "Moccasin Bend", SR: "Stringers Ridge",
  }[code] ?? code;
}

/** What a route's exit is called on the screen. */
export function exitName(net, id) {
  if (net.signals.has(id)) return id;
  if (net.fringes.has(id)) return net.fringes.get(id).name;
  const n = net.nodes.get(id);
  if (n) {
    for (const sid of n.strokes) {
      const s = net.strokes[sid];
      if (s.platform) return `${placeName(s.platform[0])} ${/^\d/.test(s.platform[1]) ? "platform " : ""}${s.platform[1]}`;
    }
    return "the buffer stop";
  }
  return String(id);
}
