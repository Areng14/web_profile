// The network diagram: the whole railway on one picture, drawn the way the
// diagram on a station wall draws it for passengers. A band for each
// operator's passenger trains, a dot where they call, and the names once.
// Freight is not on it, nor a yard or works no passenger train calls at: it
// is for the people on the platform. No trains and no desks: it is the
// printed thing. The pure parts, where a place sits along the picture, are exported
// on their own so they can be checked without a browser.

import { PLACES, ZONES, mapX } from "./layouts.js";
import { OPERATORS } from "./schedule.js";
import { el } from "./view.js";

/** The picture, proportioned to the board's screen, and how the diagram is scaled up into it, under the wordmark and over the key. */
export const PICTURE = { width: 1600, height: 1000 };
const DIAGRAM = { scale: 1.2, dx: -110, dy: 98 };

/**
 * The spines the bands follow, as polylines in the picture's coordinates,
 * each with the zone it draws and the knots that tie a board's x to a
 * vertex: a place by name, looked up on the boards, the zone's east edge,
 * or a bare board x, so that anything on a board can be found along the
 * picture. The west comes down from the top left,
 * the main line runs across, the branch climbs off it after Chattanooga,
 * and Georgia falls away to the bottom right. The high-speed line leaves
 * the main at the junction past Brainerd and falls away beside it, by
 * Lovell Field, towards Atlanta, and the airport branch turns off it past
 * Lovell Field, by the parkway to the airport. A stub beyond each fringe
 * runs on off the diagram, labelled with where its trains go as the
 * timetable names it, and with no dot or station name, since the railway
 * has no station there.
 */
/** How far apart the bands run: a little more than a band is wide, so a thin line of dark shows between each. */
export const PITCH = 12;
/** How far along each axis the outer of two bands on a diagonal runs from its spine. */
const OUTSIDE = PITCH / 2 / Math.SQRT2;

export const SPINES = {
  west0: { zone: "WS", points: [[212, 112], [230, 130], [260, 160]], knots: [{ x: -400, at: 0 }, { place: "BD", at: 1 }, { place: "WS", at: 2 }, { edge: 0, at: 2 }] },
  west1: { zone: "WH", points: [[260, 160], [310, 210], [370, 270], [400, 300]], knots: [{ x: 0, at: 0 }, { place: "TF", at: 1 }, { place: "WH", at: 2 }, { edge: 0, at: 3 }] },
  west2: { zone: "RS", points: [[400, 300], [440, 340], [480, 380], [600, 380], [620, 380]], knots: [{ x: 0, at: 0 }, { place: "LV", at: 1 }, { place: "RS", at: 2 }, { place: "SE", at: 3 }, { edge: 0, at: 4 }] },
  main: { zone: "CT", points: [[620, 380], [760, 380], [820, 380], [900, 380], [950, 380]], knots: [{ x: 0, at: 0 }, { place: "CT", at: 1 }, { place: "BR", at: 3 }, { edge: 0, at: 4 }] },
  branch: { zone: "CT", points: [[820, 362], [940, 242], [960, 242]], knots: [{ x: mapX("CT", 1090), at: 0 }, { edge: 0, at: 2 }] },
  er: { zone: "ER", points: [[950, 380], [962, 380], [1010, 380], [1040, 380], [1085, 425], [1130, 470], [1160, 500]], knots: [{ x: 0, at: 0 }, { x: mapX("ER", 130), at: 1 }, { place: "ER", at: 2 }, { place: "ES", at: 4 }, { place: "RG", at: 5 }, { edge: 0, at: 6 }] },
  // Off the main at the junction, from under the bands that run on east,
  // with a knot where the airport branch leaves it at 927, and Calhoun far
  // enough on that its name is clear of the branch.
  hs: { zone: "LF", points: [[962, 404], [976, 404], [1036, 464], [1056, 484], [1146, 574], [1186, 614]], knots: [{ x: 0, at: 1 }, { place: "LF", at: 2 }, { x: 1520, at: 3 }, { place: "CA", at: 4 }, { edge: 400, at: 5 }] },
  // The airport branch, from under the high-speed line's outer band, away
  // from the line to Atlanta: the parkway, then the airport.
  ap: { zone: "LF", points: [[1056 - OUTSIDE, 484 + OUTSIDE], [1016 - OUTSIDE, 524 + OUTSIDE], [956 - OUTSIDE, 584 + OUTSIDE]], knots: [{ x: 1520, at: 0 }, { place: "PK", at: 1 }, { place: "AP", at: 2 }] },
  th: { zone: "TH", points: [[1160, 500], [1190, 530], [1240, 580], [1262, 602]], knots: [{ x: 0, at: 0 }, { place: "TH", at: 1 }, { place: "DL", at: 2 }, { edge: 400, at: 3 }] },
  cl: { zone: "CL", points: [[960, 242], [1040, 242], [1160, 242], [1320, 242]], knots: [{ x: 0, at: 0 }, { place: "OO", at: 1 }, { place: "CD", at: 2 }, { place: "CL", at: 3 }, { edge: 0, at: 3 }] },
};

/** A knot's board x: a place looked up on the boards, the zone's east edge (so far beyond it), or a bare number. */
function knotX(spine, k, spots) {
  if (k.place) return spots.get(k.place)?.x ?? 0;
  if (k.edge !== undefined) return (ZONES.find((z) => z.id === spine.zone)?.width ?? 1600) + k.edge;
  return k.x;
}

/**
 * The bands: one for each operator's passenger trains, which is how a
 * commuter railway's diagram is keyed, with the county's own operator given
 * a band for each of its lines. `slot` is how far below its spine a band
 * runs, written in pitches (`PITCH`), so the bands sit side by side a pitch
 * apart and never further, or a band past a gap reads as a line of its own
 * and its dots as another station; a route is the spines it follows, a
 * section of one where it leaves partway, with its own slot where it runs
 * alone. `calls` is where the trains stop: all of them, or only some.
 */
export const LINES = [
  { id: "ridgeline", name: ["Ridgeline", "express"], slot: PITCH / 2, route: ["west0", "west1", "west2", "main", "er", "th"], calls: { CT: "all" } },
  { id: "valley", name: ["Valley Rail", "stopping trains"], slot: -PITCH / 2, route: ["west0", "west1", "west2", "main", "er", "th"], calls: { WS: "all", TF: "all", WH: "all", LV: "all", SE: "all", CT: "all", BR: "all", ER: "all", RG: "all", TH: "all" } },
  { id: "cleveland", name: ["Valley Rail", "Cleveland line"], slot: -PITCH * 1.5, route: ["west0", "west1", "west2", { spine: "main", to: 2 }, { spine: "branch", slot: 0 }, { spine: "cl", slot: 0 }], calls: { WS: "some", TF: "some", WH: "some", LV: "some", SE: "some", CT: "all", OO: "all", CD: "all", CL: "all" } },
  // Out of Chattanooga under everything that runs on east, the next bands
  // down with no gap, so the station is one station, and off at the
  // junction: the high-speed trains, and outside them the airport trains,
  // which turn off for the airport past Lovell Field.
  { id: "peachline", name: ["Peachline", "high speed"], slot: PITCH * 1.5, route: [{ spine: "main", from: 1 }, { spine: "er", to: 1 }, { spine: "hs", slot: -PITCH / 2 }], calls: { CT: "all", LF: "some" } },
  { id: "lovell", name: ["Lovell Link", "airport"], slot: PITCH * 2.5, route: [{ spine: "main", from: 1 }, { spine: "er", to: 1 }, { spine: "hs", slot: PITCH / 2, to: 3 }, { spine: "ap", slot: 0 }], calls: { CT: "all", BR: "all", LF: "all", PK: "all", AP: "all" } },
];

/**
 * The school's own diagram: one straight line, the river at one end and
 * the ridge at the other, one band, one station. The school prints it for
 * the pupils, since the school's line is on the railway's diagram nowhere.
 */
export const SCHOOL_SPINES = {
  school: { zone: "SC", points: [[260, 400], [380, 400], [740, 400], [1110, 400], [1250, 400]], knots: [{ x: -400, at: 0 }, { place: "WI", at: 1 }, { place: "MB", at: 2 }, { place: "SR", at: 3 }, { edge: 400, at: 4 }] },
};
export const SCHOOL_LINES = [
  { id: "school", name: ["Signalling", "school"], slot: 0, route: ["school"], calls: { MB: "all" } },
];

/**
 * The operators, as the railway's diagram keys them: each one's symbol, from
 * its own artwork for a dark ground (`logos/`), in a row at the bottom right
 * before the dots, as the station wall's key has them. A symbol carries its
 * operator's colours, so it reads against the bands without a word: Valley
 * Rail's two strokes are its stopping trains and its Cleveland line. Each
 * stands on the dark panel as it is drawn, never on a square, which the
 * artwork keeps for the railway itself. Lookout Freight has no band on a
 * passenger map, and its symbol stays off it too. `bands` says which bands
 * are the operator's, and what each is, for the name a symbol gives on hover.
 */
export const OPERATOR_KEY = [
  { operator: "ridgeline", logo: "ridgeline", bands: [{ id: "ridgeline", what: "express" }] },
  { operator: "valley", logo: "valley-rail", bands: [{ id: "valley", what: "stopping trains" }, { id: "cleveland", what: "Cleveland line" }] },
  { operator: "peachline", logo: "peachline", bands: [{ id: "peachline", what: "high speed" }] },
  { operator: "lovell", logo: "lovell-link", bands: [{ id: "lovell", what: "airport" }] },
];

/** Where each place's name goes: beside it on a diagonal, to the left of one that falls to the right, above or below on the flat, or past the end of the line. */
const NAMES = { WS: "diag", TF: "diag", WH: "diag", LV: "diag", SE: "below", CT: "above", BR: "below", ER: "above", RG: "diag", TH: "diag", OO: "above", CD: "above", CL: "end", LF: "left", PK: "left", AP: "left" };
/** Where the trains go beyond each fringe, by the name the timetable gives the place. */
const BEYOND = { BD: "to Bridgeport", DL: "to Dalton", CA: "to Calhoun" };
/** Where a line's destination is written when on past its end would sit on another line: under the end. */
const BEYOND_UNDER = new Set(["CA"]);

/**
 * A diagram: its spines and bands, where the names go, where the line goes on
 * to, and its wordmark. No end of the line is barred: everybody who rides to
 * Cleveland knows it is the last stop.
 */
export const RAILWAY = { id: "railway", spines: SPINES, lines: LINES, operators: OPERATOR_KEY, names: NAMES, beyond: BEYOND, beyondUnder: BEYOND_UNDER, title: "chattanooga rail", label: "The whole railway as the diagram on a station wall, one band for each operator, and each operator's symbol in the key: Ridgeline, Valley Rail, Peachline and Lovell Link" };
export const SCHOOL = { id: "school", spines: SCHOOL_SPINES, lines: SCHOOL_LINES, names: { MB: "above" }, beyond: { WI: "to Williams Island", SR: "to Stringers Ridge" }, title: "signalling school", label: "The school's own line as the school prints it: one band, one station, and the line on either side to Williams Island and Stringers Ridge" };

/**
 * Where each place sits on its board: the middle of its numbered
 * platforms, or of whatever it has, or the fringe node for the two places
 * off the edge, with the zone it is in. A terminus's neck, off up the
 * line, does not count.
 */
export function placeSpots(net) {
  const spots = new Map();
  for (const numbered of [true, false]) {
    for (const s of net.strokes) {
      if (!s.platform) continue;
      const [place, num] = s.platform;
      if (/^\d+$/.test(num) !== numbered) continue;
      const spot = spots.get(place) ?? { zone: s.zone, min: Infinity, max: -Infinity, numbered };
      if (spot.numbered !== numbered) continue;
      spot.min = Math.min(spot.min, s.a[0], s.b[0]);
      spot.max = Math.max(spot.max, s.a[0], s.b[0]);
      spots.set(place, spot);
    }
  }
  for (const f of net.fringes.values()) {
    const place = Object.keys(PLACES).find((id) => PLACES[id].name === f.name);
    if (place && !spots.has(place)) spots.set(place, { zone: f.zone, min: f.x, max: f.x });
  }
  return new Map([...spots].map(([id, s]) => [id, { zone: s.zone, x: (s.min + s.max) / 2 }]));
}

const LENGTHS = new Map();
/** The distance along a spine at each of its vertices. */
function lengths(spineId, spines = SPINES) {
  let out = LENGTHS.get(spineId);
  if (out) return out;
  const { points } = spines[spineId];
  out = [0];
  for (let i = 1; i < points.length; i++) out.push(out[i - 1] + Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]));
  LENGTHS.set(spineId, out);
  return out;
}

/** How far along a spine a board x is, from its knots. */
export function along(spineId, x, spots, spines = SPINES) {
  const L = lengths(spineId, spines);
  const spine = spines[spineId];
  const knots = spine.knots.map((k) => [knotX(spine, k, spots), L[k.at]]).sort((a, b) => a[0] - b[0]);
  if (x <= knots[0][0]) return knots[0][1];
  for (let i = 1; i < knots.length; i++) {
    const [x0, d0] = knots[i - 1], [x1, d1] = knots[i];
    if (x <= x1) return x1 === x0 ? d1 : d0 + ((x - x0) / (x1 - x0)) * (d1 - d0);
  }
  return knots[knots.length - 1][1];
}

/** The point a distance along a spine, with the way the spine runs there. */
export function pointAt(spineId, d, spines = SPINES) {
  const { points } = spines[spineId];
  const L = lengths(spineId, spines);
  d = Math.max(0, Math.min(L[L.length - 1], d));
  let i = 1;
  while (i < points.length - 1 && d > L[i]) i++;
  const a = points[i - 1], b = points[i];
  const len = L[i] - L[i - 1];
  const f = len > 0 ? (d - L[i - 1]) / len : 0;
  return { x: a[0] + (b[0] - a[0]) * f, y: a[1] + (b[1] - a[1]) * f, ux: (b[0] - a[0]) / len, uy: (b[1] - a[1]) / len };
}

/** A polyline moved sideways: `dist` below the line as it runs, with mitred corners. */
function offset(points, dist) {
  const out = [];
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    const prev = points[i - 1] ?? null, next = points[i + 1] ?? null;
    const dir = (a, b) => { const l = Math.hypot(b[0] - a[0], b[1] - a[1]); return [(b[0] - a[0]) / l, (b[1] - a[1]) / l]; };
    const nIn = prev ? dir(prev, p) : null, nOut = next ? dir(p, next) : null;
    // Below the line is minus the left normal (uy, -ux).
    const below = (u) => [-u[1], u[0]];
    let m;
    if (nIn && nOut) {
      const a = below(nIn), b = below(nOut);
      const s = [a[0] + b[0], a[1] + b[1]];
      const l = Math.hypot(s[0], s[1]) || 1;
      const bis = [s[0] / l, s[1] / l];
      const cos = bis[0] * a[0] + bis[1] * a[1] || 1;
      m = [bis[0] / cos, bis[1] / cos];
    } else m = below(nIn ?? nOut);
    out.push([p[0] + m[0] * dist, p[1] + m[1] * dist]);
  }
  return out;
}

/** The path of a polyline with its corners rounded. */
function rounded(points, r = 22) {
  let d = `M ${points[0][0].toFixed(1)} ${points[0][1].toFixed(1)}`;
  for (let i = 1; i < points.length - 1; i++) {
    const p = points[i], a = points[i - 1], b = points[i + 1];
    const lIn = Math.hypot(p[0] - a[0], p[1] - a[1]), lOut = Math.hypot(b[0] - p[0], b[1] - p[1]);
    const uIn = [(p[0] - a[0]) / lIn, (p[1] - a[1]) / lIn], uOut = [(b[0] - p[0]) / lOut, (b[1] - p[1]) / lOut];
    if (Math.abs(uIn[0] * uOut[1] - uIn[1] * uOut[0]) < 0.01) { d += ` L ${p[0].toFixed(1)} ${p[1].toFixed(1)}`; continue; }
    const rr = Math.min(r, lIn / 2, lOut / 2);
    d += ` L ${(p[0] - uIn[0] * rr).toFixed(1)} ${(p[1] - uIn[1] * rr).toFixed(1)} Q ${p[0].toFixed(1)} ${p[1].toFixed(1)} ${(p[0] + uOut[0] * rr).toFixed(1)} ${(p[1] + uOut[1] * rr).toFixed(1)}`;
  }
  const last = points[points.length - 1];
  return `${d} L ${last[0].toFixed(1)} ${last[1].toFixed(1)}`;
}

/** The sections of a line's route, each a spine, a run of its vertices, and the slot the band takes there. */
export function sections(line, spines = SPINES) {
  return line.route.map((r) => {
    const section = typeof r === "string" ? { spine: r } : r;
    const n = spines[section.spine].points.length;
    return { spine: section.spine, from: section.from ?? 0, to: section.to ?? n - 1, slot: section.slot ?? line.slot };
  });
}

/** For each spine, the lowest and highest slot any band takes on it. */
function extents(lines = LINES, spines = SPINES) {
  const out = {};
  for (const line of lines) {
    for (const s of sections(line, spines)) {
      const e = out[s.spine] ?? (out[s.spine] = { min: Infinity, max: -Infinity });
      e.min = Math.min(e.min, s.slot);
      e.max = Math.max(e.max, s.slot);
    }
  }
  return out;
}

export class NetworkMap {
  /**
   * @param net the compiled network
   * @param host the element the SVG goes in
   * @param diagram which diagram: the railway's, or the school's
   */
  constructor(net, host, diagram = RAILWAY) {
    this.net = net;
    this.host = host;
    this.diagram = diagram;
    this.svg = null;
    this.spots = placeSpots(net);
    this.extents = extents(diagram.lines, diagram.spines);
  }

  /** Draw the diagram once. */
  build() {
    if (this.svg) return;
    const { spines, lines, names, beyond } = this.diagram;
    const svg = el("svg", { viewBox: `0 0 ${PICTURE.width} ${PICTURE.height}`, preserveAspectRatio: "xMidYMid meet", class: "map", role: "img" });
    svg.setAttribute("aria-label", this.diagram.label);
    const layers = {};
    const diagram = el("g", { class: "map-diagram", transform: `translate(${DIAGRAM.dx} ${DIAGRAM.dy}) scale(${DIAGRAM.scale})` }, svg);
    // Where a line runs off the picture, its bands fade out along the stub
    // rather than stop: a mask over the bands, clear everywhere but there.
    const fadeId = `${this.diagram.id}-fade`;
    const defs = el("defs", {}, diagram);
    const fade = el("mask", { id: fadeId, maskUnits: "userSpaceOnUse", x: -2000, y: -2000, width: 6000, height: 6000 }, defs);
    el("rect", { x: -2000, y: -2000, width: 6000, height: 6000, fill: "#fff" }, fade);
    for (const name of ["bands", "marks", "names"]) layers[name] = el("g", { class: `map-${name}` }, diagram);
    layers.bands.setAttribute("mask", `url(#${fadeId})`);
    layers.panels = el("g", { class: "map-panels" }, svg);

    // The bands, one per line, following their spines side by side.
    for (const line of lines) {
      const points = [];
      for (const s of sections(line, spines)) {
        const run = spines[s.spine].points.slice(s.from, s.to + 1);
        for (const p of offset(run, s.slot)) {
          const last = points[points.length - 1];
          if (!last || Math.hypot(last[0] - p[0], last[1] - p[1]) > 0.5) points.push(p);
        }
      }
      el("path", { d: rounded(points), class: `map-band band-${line.id}` }, layers.bands);
    }

    // The places: a dot on each band whose trains call, a ring where only
    // some do, and the name once; and where the line runs off the edge, the
    // bands fading out with where they go written past them, and no name of
    // a station, since there is none there. A place no band calls at, a
    // yard or a works, still ties its spine to the boards but is not drawn.
    for (const [spineId, spine] of Object.entries(spines)) {
      const L = lengths(spineId, spines);
      const ext = this.extents[spineId];
      for (const knot of spine.knots) {
        if (!knot.place) continue;
        const at = pointAt(spineId, L[knot.at], spines);
        const p = [at.x, at.y];
        const n = [at.uy, -at.ux];
        const place = knot.place;
        const fringe = PLACES[place]?.fringe;
        if (!fringe && !lines.some((line) => line.calls[place])) continue;
        if (fringe) {
          // Beyond the edge: the bands fade out along the stub, from the
          // place to the end of the line, and where the line goes follows
          // on past them.
          const end = spine.points[knot.at === 1 ? 0 : spine.points.length - 1];
          const out = knot.at === 1 ? [-at.ux, -at.uy] : [at.ux, at.uy];
          const half = (ext.max - ext.min) / 2 + 12;
          const mid = [end[0] - ((ext.min + ext.max) / 2) * n[0], end[1] - ((ext.min + ext.max) / 2) * n[1]];
          const from = [p[0] - ((ext.min + ext.max) / 2) * n[0], p[1] - ((ext.min + ext.max) / 2) * n[1]];
          const gradient = el("linearGradient", { id: `${fadeId}-${place}`, gradientUnits: "userSpaceOnUse", x1: from[0], y1: from[1], x2: mid[0], y2: mid[1] }, defs);
          el("stop", { offset: 0, "stop-color": "#fff" }, gradient);
          el("stop", { offset: 1, "stop-color": "#000" }, gradient);
          const corner = (along, across) => `${mid[0] + out[0] * along + n[0] * across},${mid[1] + out[1] * along + n[1] * across}`;
          const back = Math.hypot(mid[0] - from[0], mid[1] - from[1]);
          el("polygon", { points: [corner(-back, -half), corner(-back, half), corner(20, half), corner(20, -half)].join(" "), fill: `url(#${fadeId}-${place})` }, fade);
          const under = this.diagram.beyondUnder?.has(place);
          const t = under
            ? el("text", { x: mid[0] + out[0] * 10, y: mid[1] + out[1] * 10 + 22, class: "map-beyond", "text-anchor": "middle" }, layers.names)
            : el("text", { x: mid[0] + out[0] * 10 + (knot.at === 1 ? -6 : 6), y: mid[1] + out[1] * 10 + 5, class: "map-beyond", "text-anchor": knot.at === 1 ? "end" : "start" }, layers.names);
          t.textContent = beyond[place] ?? "";
          continue;
        } else {
          for (const line of lines) {
            const how = line.calls[place];
            if (!how) continue;
            const section = sections(line, spines).find((s) => s.spine === spineId && knot.at >= s.from && knot.at <= s.to);
            if (!section) continue;
            const cx = p[0] - section.slot * n[0], cy = p[1] - section.slot * n[1];
            el("circle", { cx, cy, r: how === "all" ? 5.5 : 4.5, class: `map-dot${how === "all" ? "" : " ring"}` }, layers.marks);
          }
        }
        const where = names[place] ?? "above";
        const name = PLACES[place]?.name ?? place;
        const top = [p[0] - ext.min * n[0], p[1] - ext.min * n[1]];
        const bottom = [p[0] - ext.max * n[0], p[1] - ext.max * n[1]];
        const attrs = where === "diag" ? { x: top[0] + 16, y: top[1] + 5, "text-anchor": "start" }
          : where === "left" ? { x: bottom[0] - 16, y: bottom[1] + 5, "text-anchor": "end" }
          : where === "above" ? { x: p[0], y: p[1] + ext.min - 13, "text-anchor": "middle" }
          : where === "below" ? { x: p[0], y: p[1] + ext.max + 25, "text-anchor": "middle" }
          : { x: p[0] + 18, y: p[1] + 5, "text-anchor": "start" };
        const t = el("text", { ...attrs, class: "map-name" }, layers.names);
        t.textContent = name;
      }
    }

    // The title, top left, and the key along the bottom.
    const panel = el("g", { class: "map-title" }, layers.panels);
    el("path", { d: "M 0 0 H 520 V 44 Q 520 92 472 92 H 0 Z", class: "map-panel" }, panel);
    const title = el("text", { x: 30, y: 62, class: "map-wordmark" }, panel);
    title.textContent = this.diagram.title;
    // The key, bottom right, as the station wall's: each operator's symbol
    // in a dark box of its own, then a chip for each band no operator keys,
    // as the school's, and one for each kind of mark the bands carry, all as
    // high as each other in their bar with the same room all round. A
    // symbol is 40 in its box of 60, so on a screen as small as 1280 by 720
    // it is still more than the 16 pixels its artwork asks for at the least.
    const h = 60, pad = 24, symbol = 40;
    const operators = this.diagram.operators ?? [];
    const keyed = new Set(operators.flatMap((o) => o.bands.map((b) => b.id)));
    const key = el("g", { class: "map-key" }, layers.panels);
    const calls = new Set(lines.flatMap((l) => Object.values(l.calls)));
    const chips = [
      ...operators.map((o) => ({ symbol: o, w: h, gap: 12 })),
      ...lines.filter((l) => !keyed.has(l.id)).map((l) => ({ cls: `key-${l.id}`, text: l.name, w: 150, gap: 12 })),
      { cls: "key-dot", text: ["Most", "services"], dot: "all", w: 150, gap: 12 },
      ...(calls.has("some") ? [{ cls: "key-dot", text: ["Limited", "service"], dot: "some", w: 150, gap: 12 }] : []),
    ];
    const keyTop = PICTURE.height - h - pad * 2;
    const top = keyTop + pad;
    const span = chips.reduce((sum, c, i) => sum + c.w + (i < chips.length - 1 ? c.gap : 0), 0);
    let x = PICTURE.width - pad - span;
    const left = x - pad;
    el("path", { d: `M ${left} ${PICTURE.height} V ${keyTop + 26} Q ${left} ${keyTop} ${left + 26} ${keyTop} H ${PICTURE.width} V ${PICTURE.height} Z`, class: "map-panel" }, key);
    for (const c of chips) {
      if (c.symbol) {
        // The name on the whole box, so resting the pointer anywhere on it says whose it is.
        const g = el("g", { class: "map-keychip key-operator" }, key);
        el("title", {}, g).textContent = `${OPERATORS[c.symbol.operator].name}: ${c.symbol.bands.map((b) => b.what).join(" and ")}`;
        el("rect", { x, y: top, width: c.w, height: h, rx: 8 }, g);
        el("image", { href: `logos/${c.symbol.logo}-symbol-dark.svg`, x: x + (c.w - symbol) / 2, y: top + (h - symbol) / 2, width: symbol, height: symbol }, g);
      } else {
        const g = el("g", { class: `map-keychip ${c.cls}` }, key);
        el("rect", { x, y: top, width: c.w, height: h, rx: 8 }, g);
        const tx = c.dot ? x + 38 : x + c.w / 2;
        if (c.dot) el("circle", { cx: x + 21, cy: top + h / 2, r: c.dot === "all" ? 7 : 6, class: `map-dot${c.dot === "all" ? "" : " ring"}` }, g);
        c.text.forEach((line, i) => {
          const t = el("text", { x: tx, y: c.text.length === 1 ? top + h / 2 + 5 : top + h / 2 - 4 + i * 17, "text-anchor": c.dot ? "start" : "middle" }, g);
          t.textContent = line;
        });
      }
      x += c.w + c.gap;
    }
    this.svg = svg;
    this.host.appendChild(svg);
  }

  /** Draw the diagram the first time it is asked for. It is the printed thing, so it carries no clock and no desk, and never changes after. */
  update() {
    if (!this.svg) this.build();
  }
}

