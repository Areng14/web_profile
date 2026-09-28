// The screen: one zone of the railway drawn the way a modern control centre
// draws it. Track is grey until a route is set over it, then white; a train
// on it turns it red. Points show their lie by a gap in the leg they are not
// set for. Signals are a disc on a stem: red, yellow, two yellows side by
// side for a double yellow, or green. Every signal has a
// berth beside it for the description of the train standing at or coming to
// it. Nothing here decides anything: it reads the simulation and draws it.

import { ZONES } from "./layouts.js";
import { farEnd, tcName } from "./model.js";

const NS = "http://www.w3.org/2000/svg";

export function el(name, attrs = {}, parent = null) {
  const node = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined) continue;
    node.setAttribute(k, String(v));
  }
  if (parent) parent.appendChild(node);
  return node;
}

/** How the picture is proportioned. */
const SIGNAL_R = 5.5;
/** An automatic's head, smaller than a controlled signal's. */
const AUTO_R = 4;
/** Each of the two lamps a controlled signal shows for a double yellow, as big as an automatic's head. */
const LAMP_R = AUTO_R;
const BERTH = { w: 44, h: 18 };
/** A signal's post: how far it stands off the line, and how far it runs along it before the head. */
const POST = 11;
const ARM = 12;
/** How wide a letter of a signal's number is drawn (10px, 0.04em apart), and of a fringe's name (10px, 0.1em apart), measured on the page. */
const ID_W = 6.9;
const NAME_W = 7.6;
/** How far short of a point's node its two legs stop. */
const GAP = 14;
/** How far along a flyover either side of a line under it the gap in that line runs. */
const BRIDGE = 9;

/**
 * How the board is looked at. It opens as tall as its zone and zooms from a
 * tenth of that out to three times in. It can be moved off the drawing until
 * a view and a half of nothing lies between them, so the edge is never a
 * wall, but nobody ends up a mile out with no idea which way is back.
 */
const ZOOM = { least: 0.1, most: 3 };
const WANDER = 1.5;
/** The room left round the drawing, in pixels, when the whole desk is fitted to the board. */
const FIT_MARGIN = 24;
/** The arrows out past the drawing, in pixels: a row every `down`, an arrow every `across` along it, each row set half a step along from the last. */
const FIELD = { across: 240, down: 120, length: 46, head: 13 };
/** How far a press on the board moves before it is a drag rather than a click. */
const SLOP = 4;

export class Screen {
  /**
   * @param net the compiled network
   * @param host the element the SVG goes in
   * @param handlers { signal(id, ev), point(id, ev), berth(id, ev), exit(id, ev), track(tc, ev), lc(id, ev), clear(ev), describe(train) → the words a berth's tooltip says, moved() once the view is moved }
   */
  constructor(net, host, handlers) {
    this.net = net;
    this.host = host;
    this.on = handlers;
    this.built = new Map();
    this.zone = null;
    this.svg = null;
    this.parts = null;
    this.selected = null;
    this.shown = null;
    this.picked = null;
    this.wanted = null;
    // The routes an automatic keeps for itself. It sets one whenever the
    // block ahead is free, which is how it clears, so it is no road anybody
    // set: the line past it is white only as part of a road a train has
    // been given (`carried()`), never on its own.
    this.ownRoutes = new Set([...net.routes.values()].filter((r) => net.signals.get(r.entry)?.kind === "auto").map((r) => r.id));
    this.dragged = false;
    this.swallowed = null;
    this.strip = null;
    // The desk's own board is looked at through a camera, { x, y } its top
    // left corner in board units and `zoom` against the view it opens at; a
    // preview is always drawn whole.
    this.pan = Boolean(handlers.signal);
    this.cam = { x: 0, y: 0, zoom: 1, home: true };
    this.extents = new Map();
    this.field = null;
    this.moved = null;
    if (this.pan) this.pannable(host);
  }

  /**
   * The board is worked the way the graph in the calculator is: the wheel
   * zooms about the pointer, the middle button drags it from anywhere, and a
   * double-click puts it back. The left button drags it too, from anywhere
   * that is not a thing to click on, and a drag is not a click on whatever it
   * ended over. On a touch screen one finger drags and two pinch. A sideways
   * roll, from a trackpad or a wheel with Shift held, still moves it
   * sideways, and a pinch on a trackpad arrives as a wheel with Ctrl held.
   */
  pannable(host) {
    this.field = el("svg", { class: "beyond", "aria-hidden": "true" }, host);
    this.fieldPath = el("path", {}, this.field);
    this.fieldNote = el("text", { "text-anchor": "middle", "dominant-baseline": "middle" }, this.field);
    this.fieldNote.textContent = "Nothing out here. Double-click to go back to the desk.";
    this.noteWidth = 0;

    host.addEventListener("wheel", (ev) => {
      ev.preventDefault();
      const unit = ev.deltaMode === 1 ? 16 : ev.deltaMode === 2 ? host.clientHeight : 1;
      // Some browsers hand a shifted roll over as a sideways one and some
      // leave it up and down, so Shift is read for itself.
      if (!ev.ctrlKey && (ev.shiftKey || Math.abs(ev.deltaX) > Math.abs(ev.deltaY))) {
        this.panBy(-(ev.deltaX || ev.deltaY) * unit, 0);
        return;
      }
      const r = host.getBoundingClientRect();
      const rate = ev.ctrlKey ? 0.01 : 0.0015;
      this.zoomAt(ev.clientX - r.left, ev.clientY - r.top, clamp(Math.exp(-ev.deltaY * unit * rate), 0.5, 2));
    }, { passive: false });

    // Every pointer down on the board, where it is, and whether it may drag
    // the board on its own: a press on a signal is a click until a second
    // finger joins it.
    const held = new Map();
    let gesture = null;
    const at = (ev) => {
      const r = host.getBoundingClientRect();
      return { x: ev.clientX - r.left, y: ev.clientY - r.top };
    };
    const middle = () => {
      const marks = [...held.values()];
      return {
        x: marks.reduce((sum, m) => sum + m.x, 0) / marks.length,
        y: marks.reduce((sum, m) => sum + m.y, 0) / marks.length,
        apart: marks.length > 1 ? Math.hypot(marks[0].x - marks[1].x, marks[0].y - marks[1].y) : 0,
      };
    };
    // A gesture is worked out from where it started, so a long drag cannot
    // gather rounding, and it starts again whenever a finger joins or leaves.
    const begin = (moved) => {
      const v = this.view;
      gesture = { ...middle(), from: { x: v.x, y: v.y, s: v.s, zoom: this.cam.zoom }, moved };
    };
    host.addEventListener("pointerdown", (ev) => {
      if (ev.button > 1) return;
      // The middle button is the board's own: nothing to scroll by it, nothing for it to open.
      if (ev.button === 1) ev.preventDefault();
      held.set(ev.pointerId, { ...at(ev), free: ev.button === 1 || !ev.target.closest(".hit") });
      if (held.size > 1) for (const mark of held.values()) mark.free = true;
      begin(gesture?.moved ?? false);
    });
    host.addEventListener("pointermove", (ev) => {
      const mark = held.get(ev.pointerId);
      if (!mark || !gesture) return;
      Object.assign(mark, at(ev));
      if (held.size === 1 && !mark.free) return;
      const now = middle();
      if (!gesture.moved) {
        if (Math.hypot(now.x - gesture.x, now.y - gesture.y) < SLOP && Math.abs(now.apart - gesture.apart) < SLOP) return;
        gesture.moved = true;
        host.classList.add("dragging");
        for (const id of held.keys()) {
          try { host.setPointerCapture(id); } catch { /* a pointer the browser will not hand over is still followed while it is over the board */ }
        }
      }
      const { from } = gesture;
      const zoom = clamp(from.zoom * (gesture.apart && now.apart ? now.apart / gesture.apart : 1), ZOOM.least, ZOOM.most);
      const s = (from.s * zoom) / from.zoom;
      // The point of the board the gesture started on stays under it.
      this.aim({ x: from.x + gesture.x / from.s - now.x / s, y: from.y + gesture.y / from.s - now.y / s, zoom });
    });
    const end = (ev) => {
      if (!held.delete(ev.pointerId)) return;
      const moved = gesture?.moved ?? false;
      // A drag with the left button ends in a click on whatever it was let
      // go over, which is swallowed. A finger's drag is no tap, the middle
      // button's release is no click, and a cancelled drag fires nothing.
      if (moved && ev.type === "pointerup" && ev.pointerType === "mouse" && ev.button === 0) this.dragged = true;
      if (held.size) begin(moved);
      else {
        gesture = null;
        host.classList.remove("dragging");
      }
    };
    host.addEventListener("pointerup", end);
    host.addEventListener("pointercancel", end);
    host.addEventListener("click", (ev) => {
      if (!this.dragged) return;
      this.dragged = false;
      this.swallowed = { at: ev.timeStamp, x: ev.clientX, y: ev.clientY };
      ev.stopPropagation();
      ev.preventDefault();
    }, true);
    host.addEventListener("mousedown", (ev) => { if (ev.button === 1) ev.preventDefault(); });
    host.addEventListener("auxclick", (ev) => { if (ev.button === 1) ev.preventDefault(); });
    // The click that ends a drag is swallowed, but the browser still counts
    // it, so a click straight after it on the same spot would make a
    // double-click out of letting go.
    host.addEventListener("dblclick", (ev) => {
      const last = this.swallowed;
      if (ev.target.closest(".hit")) return;
      if (last && ev.timeStamp - last.at < 800 && Math.hypot(ev.clientX - last.x, ev.clientY - last.y) < 8) return;
      this.home();
    });
    new ResizeObserver(() => this.apply()).observe(host);
  }

  /** The part of the board on screen, in board units, and how many pixels make a unit. */
  get view() {
    const zone = ZONES.find((z) => z.id === this.zone);
    const s = (this.host.clientHeight / zone.height) * this.cam.zoom;
    return { x: this.cam.x, y: this.cam.y, w: this.host.clientWidth / s, h: this.host.clientHeight / s, s };
  }

  /** Back to the view the board opens at: the whole height of its zone from the west end, or the middle of it when it is narrower than the screen. */
  home() {
    this.cam = { x: 0, y: 0, zoom: 1, home: true };
    this.apply();
    this.on.moved?.();
  }

  /** The whole desk in view, as large as the board allows, until the view is moved. */
  fit() {
    this.cam = { x: 0, y: 0, zoom: 1, home: false, fit: true };
    this.apply();
    this.on.moved?.();
  }

  /** Look from somewhere else, { x, y, zoom }. */
  aim(cam) {
    this.cam = { x: cam.x, y: cam.y, zoom: cam.zoom, home: false };
    this.apply();
    this.on.moved?.();
  }

  /** Zoom by a factor, above 1 to come in, about a point on the screen, so whatever is under it stays there. */
  zoomAt(px, py, factor) {
    const v = this.view;
    const zoom = clamp(this.cam.zoom * factor, ZOOM.least, ZOOM.most);
    const s = (v.s * zoom) / this.cam.zoom;
    this.aim({ x: v.x + px / v.s - px / s, y: v.y + py / v.s - py / s, zoom });
  }

  /** Move the board by so many pixels. */
  panBy(dx, dy) {
    const v = this.view;
    this.aim({ x: v.x - dx / v.s, y: v.y - dy / v.s, zoom: this.cam.zoom });
  }

  /** Put the camera on the picture, kept within reach of the drawing, with the arrows drawn when none of it is in view. */
  apply() {
    if (!this.pan || !this.svg) return;
    const width = this.host.clientWidth, height = this.host.clientHeight;
    // A board that is not on the page has no size to be looked at by.
    if (!width || !height) return;
    const zone = ZONES.find((z) => z.id === this.zone);
    const drawing = this.drawing();
    let view;
    if (this.cam.fit) {
      view = fitted(drawing, { width, height }, height / zone.height);
      this.cam.zoom = view.zoom;
    } else {
      view = this.view;
      view = this.cam.home ? { ...view, x: Math.min(0, (zone.width - view.w) / 2), y: 0 } : settle(view, drawing);
    }
    this.cam.x = view.x;
    this.cam.y = view.y;
    this.svg.setAttribute("viewBox", `${view.x} ${view.y} ${view.w} ${view.h}`);
    this.showBeyond(view, drawing, width, height);
    this.moved?.();
  }

  /**
   * The box the drawing takes up, in board units, measured off the picture
   * once it is on the page, so nothing drawn is ever taken for empty space.
   * Across, it is never less than the zone, whose ends are the ways on.
   */
  drawing() {
    const kept = this.extents.get(this.zone);
    if (kept) return kept;
    const zone = ZONES.find((z) => z.id === this.zone);
    let box = [0, Infinity, zone.width, -Infinity];
    for (const layer of this.svg.children) {
      let b;
      try { b = layer.getBBox(); } catch { continue; }
      if (!b.width && !b.height) continue;
      box = [Math.min(box[0], b.x), Math.min(box[1], b.y), Math.max(box[2], b.x + b.width), Math.max(box[3], b.y + b.height)];
    }
    // Until the picture has been laid out there is nothing to measure, and the zone's own size stands in.
    if (box[1] > box[3]) return [0, 0, zone.width, zone.height];
    this.extents.set(this.zone, box);
    return box;
  }

  /** Fill an empty view with arrows back to the drawing, or let the last of them fade once some of it is in view again. */
  showBeyond(view, drawing, width, height) {
    const arrows = beyond(view, drawing, { width, height });
    this.field.classList.toggle("on", arrows.length > 0);
    if (!arrows.length) return;
    this.fieldNote.setAttribute("x", String(width / 2));
    this.fieldNote.setAttribute("y", String(height / 2));
    // The words sit in the middle, with the lattice kept off them.
    this.noteWidth ||= this.fieldNote.getComputedTextLength();
    const across = this.noteWidth / 2 + FIELD.length, down = FIELD.length;
    let d = "";
    for (const a of arrows) {
      if (Math.abs(a.x - width / 2) < across && Math.abs(a.y - height / 2) < down) continue;
      d += arrowPath(a);
    }
    this.fieldPath.setAttribute("d", d);
  }

  /** Show a zone, building its picture the first time. */
  show(zoneId) {
    if (this.zone === zoneId && this.svg) return;
    let built = this.built.get(zoneId);
    if (!built) {
      built = this.build(zoneId);
      this.built.set(zoneId, built);
    }
    if (this.svg) this.svg.remove();
    this.zone = zoneId;
    this.svg = built.svg;
    this.parts = built.parts;
    // Under the arrows, which are drawn over whatever is on the board.
    this.host.insertBefore(this.svg, this.field);
    if (this.pan) this.home();
    this.strip?.show(zoneId);
  }

  /**
   * The whole desk in a strip under the board, drawn small and cut to the
   * band the track runs in, with the part of it on screen framed: a click
   * or a drag on the strip moves the board there. The strip follows the
   * board's zone and its trains.
   */
  overview(host) {
    const pic = document.createElement("div");
    pic.className = "overviewPic";
    host.appendChild(pic);
    const small = new Screen(this.net, pic, {});
    const frame = document.createElement("div");
    frame.className = "overviewFrame";
    let band = null;
    // The picture fits the strip, as large as its band allows, and the
    // frame is the part of the band that is on screen, none when the board
    // is looking at nothing.
    const place = () => {
      if (!band) return;
      const scale = Math.min(host.clientWidth / band.width, host.clientHeight / band.height);
      pic.style.width = `${band.width * scale}px`;
      pic.style.height = `${band.height * scale}px`;
      const part = this.svg && this.host.clientHeight ? framed(this.view, band.box) : null;
      frame.hidden = !part;
      if (!part) return;
      frame.style.left = `${part.left * 100}%`;
      frame.style.top = `${part.top * 100}%`;
      frame.style.width = `${part.width * 100}%`;
      frame.style.height = `${part.height * 100}%`;
    };
    this.moved = place;
    this.strip = {
      show: (zoneId) => {
        small.show(zoneId);
        small.svg.classList.add("preview");
        small.svg.setAttribute("aria-hidden", "true");
        const zone = ZONES.find((z) => z.id === zoneId);
        let top = Infinity, bottom = -Infinity;
        for (const s of zone.strokes) {
          if (s.hidden) continue;
          top = Math.min(top, s.a[1], s.b[1]);
          bottom = Math.max(bottom, s.a[1], s.b[1]);
        }
        band = { width: zone.width, height: bottom - top + 80, box: [0, top - 40, zone.width, bottom + 40] };
        small.svg.setAttribute("viewBox", `0 ${top - 40} ${band.width} ${band.height}`);
        pic.appendChild(frame);
        place();
      },
      update: (sim) => small.update(sim),
    };
    new ResizeObserver(place).observe(host);
    const go = (ev) => {
      if (!band || !this.svg) return;
      const r = pic.getBoundingClientRect();
      const [x1, y1, x2, y2] = band.box;
      const point = [x1 + ((ev.clientX - r.left) / (r.width || 1)) * (x2 - x1), y1 + ((ev.clientY - r.top) / (r.height || 1)) * (y2 - y1)];
      const to = toward(this.view, point, band.box);
      this.aim({ x: to.x, y: to.y, zoom: this.cam.zoom });
    };
    let pointer = null;
    pic.addEventListener("pointerdown", (ev) => {
      if (ev.button > 0) return;
      pointer = ev.pointerId;
      try { pic.setPointerCapture(ev.pointerId); } catch { /* a pointer the browser will not hand over is still followed while it is over the strip */ }
      go(ev);
      ev.preventDefault();
    });
    pic.addEventListener("pointermove", (ev) => { if (pointer === ev.pointerId) go(ev); });
    const end = (ev) => { if (pointer === ev.pointerId) pointer = null; };
    pic.addEventListener("pointerup", end);
    pic.addEventListener("pointercancel", end);
  }

  build(zoneId) {
    const net = this.net;
    const zone = ZONES.find((z) => z.id === zoneId);
    const svg = el("svg", { viewBox: `0 0 ${zone.width} ${zone.height}`, preserveAspectRatio: "xMidYMid meet", class: "screen", role: "img", "data-zone": zone.id });
    svg.setAttribute("aria-label", `${zone.name} signalling display`);
    const layers = {};
    for (const name of ["platforms", "labels", "track", "gaps", "fringes", "signals", "berths", "hits"]) layers[name] = el("g", { class: `layer-${name}` }, svg);
    const parts = { tcs: new Map(), points: new Map(), signals: new Map(), berths: new Map(), exits: new Map(), lcs: new Map(), platforms: new Map(), labels: layers.labels, boxes: [] };

    // Track, one line per stroke, grouped by circuit. The two legs of a
    // point stop short of its node, and a stub fills the gap on whichever
    // leg is set, so the other is seen to be broken away, as on a real
    // display.
    const legs = new Map();
    for (const p of net.points.values()) {
      if (p.zone !== zoneId) continue;
      legs.set(`${p.normal}@${p.node}`, { point: p.id, leg: "normal" });
      legs.set(`${p.reverse}@${p.node}`, { point: p.id, leg: "reverse" });
      parts.points.set(p.id, { legs: {}, label: null, hit: null });
    }
    // A flyover is drawn last, over a gap cut in each line it crosses, so
    // the line under it reads as passing beneath and not as a crossing.
    const shown = net.strokes.filter((s) => s.zone === zoneId && !s.hidden);
    const under = shown.filter((s) => !s.flyover);
    for (const s of [...under, ...shown.filter((x) => x.flyover)]) {
      if (s.flyover) {
        for (const t of under) {
          const at = crossingOf(s, t);
          if (!at) continue;
          const d = Math.hypot(s.b[0] - s.a[0], s.b[1] - s.a[1]);
          const ux = (s.b[0] - s.a[0]) / d, uy = (s.b[1] - s.a[1]) / d;
          el("line", { x1: at[0] - ux * BRIDGE, y1: at[1] - uy * BRIDGE, x2: at[0] + ux * BRIDGE, y2: at[1] + uy * BRIDGE, class: "bridge" }, layers.track);
        }
      }
      const d = Math.hypot(s.b[0] - s.a[0], s.b[1] - s.a[1]);
      const ux = (s.b[0] - s.a[0]) / d, uy = (s.b[1] - s.a[1]) / d;
      const trimA = legs.get(`${s.id}@${s.na}`), trimB = legs.get(`${s.id}@${s.nb}`);
      const a = trimA ? [s.a[0] + ux * GAP, s.a[1] + uy * GAP] : s.a;
      const b = trimB ? [s.b[0] - ux * GAP, s.b[1] - uy * GAP] : s.b;
      if (!parts.tcs.has(s.tc)) parts.tcs.set(s.tc, []);
      parts.tcs.get(s.tc).push(el("line", { x1: a[0], y1: a[1], x2: b[0], y2: b[1], class: "tc", "data-tc": s.tc }, layers.track));
      for (const [trim, end, sign] of [[trimA, s.a, 1], [trimB, s.b, -1]]) {
        if (!trim) continue;
        const stub = el("line", { x1: end[0], y1: end[1], x2: end[0] + ux * sign * GAP, y2: end[1] + uy * sign * GAP, class: "tc", "data-tc": s.tc }, layers.track);
        parts.tcs.get(s.tc).push(stub);
        parts.points.get(trim.point).legs[trim.leg] = stub;
      }
      // A wide invisible line makes the circuit easy to point at.
      const hit = el("line", { x1: s.a[0], y1: s.a[1], x2: s.b[0], y2: s.b[1], class: "hit hit-track" }, layers.hits);
      hit.addEventListener("click", (ev) => this.on.track?.(s.tc, ev));
      hit.addEventListener("contextmenu", (ev) => { ev.preventDefault(); this.on.track?.(s.tc, ev); });
    }

    // Platforms: a bar along the platform side of the line with its number.
    for (const s of net.strokes) {
      if (s.zone !== zoneId || !s.platform) continue;
      const [station, num] = s.platform;
      const numbered = /^\d+$/.test(num);
      const isYard = station === "RS";
      // Which side the platform face is on: away from the nearest other
      // line, worked out from where the pair sits in the picture.
      const side = platformSide(zone, s);
      const y = s.a[1] + side * 9;
      let x1 = Math.min(s.a[0], s.b[0]) + 6, x2 = Math.max(s.a[0], s.b[0]) - 6;
      // A signal at the platform's end whose head is drawn out over the
      // face, as the parkway's LF21 is, has the face start clear of it.
      for (const sig of net.signals.values()) {
        if (sig.zone !== zoneId) continue;
        const { head: [hx, hy], r } = signalShape(sig);
        if (hy + r < y - 2.5 || hy - r > y + 2.5 || hx + r < x1 || hx - r > x2) continue;
        if (hx < (x1 + x2) / 2) x1 = Math.max(x1, hx + r + 3);
        else x2 = Math.min(x2, hx - r - 3);
      }
      if (numbered) el("rect", { x: x1, y: y - 2.5, width: x2 - x1, height: 5, class: "platform" }, layers.platforms);
      const label = numbered ? num : num === "neck" ? "NECK" : isYard ? "RECEPTION" : num.toUpperCase();
      // The number keeps clear of the starter's berth: a platform signalled
      // at one end only carries it towards the other end.
      const starters = [s.na, s.nb].map((key) => net.nodes.get(key).signals.some((id) => net.signals.get(id).from === s.id));
      // With a starter at each end, the berth on the platform's own side
      // belongs to the signal at the far end for that direction, so the box
      // leans the other way.
      const lean = starters[0] === starters[1] ? (side < 0 ? 0.4 : 0.6) : starters[0] ? 0.7 : 0.3;
      const lx = x1 + (x2 - x1) * lean;
      const box = numbered ? el("rect", { x: lx - 9, y: y + side * 8 - 8, width: 18, height: 16, class: "platform-box" }, layers.platforms) : null;
      const t = el("text", { x: lx, y: y + side * 8 + 4.5, class: numbered ? "platform-num" : "note", "text-anchor": "middle" }, layers.platforms);
      t.textContent = label;
      if (box && side < 0) { box.setAttribute("y", y - 8 - 8); t.setAttribute("y", y - 8 + 4.5); }
      if (box) parts.boxes.push([lx - 9, Number(box.getAttribute("y")), lx + 9, Number(box.getAttribute("y")) + 16]);
      if (box) parts.platforms.set(s.tc, { box, text: t });
      if (!box) {
        // A siding's name sits beyond its buffer stop, out of the way of the
        // shunt signal's berth; a line open at both ends is named beneath.
        const dead = [s.na, s.nb].map((key) => net.nodes.get(key).strokes.length === 1);
        if (dead[0] || dead[1]) {
          t.setAttribute("x", dead[1] ? x2 + 18 : x1 - 18);
          t.setAttribute("text-anchor", dead[1] ? "start" : "end");
          t.setAttribute("y", s.a[1] + 3.5);
        } else t.setAttribute("y", side < 0 ? y - 10 : y + 16);
      }
    }

    // A depot's shed: the outline of the building over the roads that run
    // through it, under the track, with its name on the roof line.
    for (const shed of zone.sheds ?? []) {
      el("rect", { x: shed.x1, y: shed.y1, width: shed.x2 - shed.x1, height: shed.y2 - shed.y1, class: "shed" }, layers.platforms);
      const t = el("text", { x: shed.x2 - 3, y: shed.y1 - 4, class: "label-note", "text-anchor": "end" }, layers.labels);
      t.textContent = shed.name;
    }

    // Names of places, and the way off the edge.
    for (const label of zone.labels) {
      const t = el("text", { x: label.x, y: label.y, class: `label-${label.kind}`, "text-anchor": label.anchor ?? "start" }, layers.labels);
      t.textContent = label.text;
      const px = label.kind === "station" ? 19 : label.kind === "edge" ? 12 : 11;
      const w = label.text.length * px * 0.62;
      const left = label.anchor === "middle" ? label.x - w / 2 : label.anchor === "end" ? label.x - w : label.x;
      parts.boxes.push([left, label.y - px, left + w, label.y + 2]);
    }

    // Points: the number, on the side away from the reverse leg, stepped
    // along the line where it would run into a signal's number or head, or
    // sit on a line (`pointLabelSpot()`). The signals are drawn after, so
    // what they will take is worked out first.
    const signalRoom = [];
    for (const sig of net.signals.values()) {
      if (sig.zone !== zoneId) continue;
      const { head: [hx, hy], r } = signalShape(sig);
      signalRoom.push(signalLabel(sig, (b) => onZoneLine(zone, b)).box, [hx - r - 1, hy - r - 1, hx + r + 1, hy + r + 1]);
      if (sig.kind === "auto") signalRoom.push(lampBox(sig));
    }
    for (const p of net.points.values()) {
      if (p.zone !== zoneId) continue;
      const rs = net.strokes[p.reverse];
      const rfar = rs.na === p.node ? rs.b : rs.a;
      const at = pointLabelSpot(p, rfar, (r) => labelClashes(zone, [...signalRoom, ...parts.boxes], r));
      const label = el("text", { x: at.x, y: at.y, class: "point-num", "text-anchor": "middle" }, layers.gaps);
      label.textContent = p.id.replace(/[AB]$/, "");
      parts.boxes.push(at.box);
      const hit = el("circle", { cx: p.x, cy: p.y, r: 13, class: "hit", "data-hit": `point:${p.id}` }, layers.hits);
      // The number works the points as the points themselves do, wherever it
      // stepped to (`pointTarget()`).
      const [tx1, ty1, tx2, ty2] = pointTarget(at.box);
      const byNumber = el("rect", { x: tx1, y: ty1, width: tx2 - tx1, height: ty2 - ty1, class: "hit", "data-hit": `point:${p.id}` }, layers.hits);
      for (const target of [hit, byNumber]) {
        target.addEventListener("click", (ev) => this.on.point?.(p.id, ev));
        target.addEventListener("contextmenu", (ev) => { ev.preventDefault(); this.on.point?.(p.id, ev); });
      }
      Object.assign(parts.points.get(p.id), { label, hit });
    }

    // Signals, drawn as a control centre draws them (`signalShape()`), with
    // the number beyond the head.
    const signalled = [];
    for (const sig of net.signals.values()) {
      if (sig.zone !== zoneId) continue;
      const g = el("g", { class: `signal kind-${sig.kind}`, "data-signal": sig.id }, layers.signals);
      const { dx, dy } = sig;
      const { stem, head: [hx, hy], r } = signalShape(sig);
      el("polyline", { points: stem.map((p) => p.join(",")).join(" "), class: "stem" }, g);
      const ring = el("circle", { cx: hx, cy: hy, r: r + 3.5, class: "ring" }, g);
      const head = sig.kind === "shunt"
        ? el("rect", { x: hx - 4.5, y: hy - 4.5, width: 9, height: 9, class: "head" }, g)
        : el("circle", { cx: hx, cy: hy, r, class: "head" }, g);
      // A double yellow, lit only then, is two yellow lamps side by side along
      // the way the signal reads. A controlled signal shows the pair in place
      // of its head, so it reads post, arm, then the pair. An automatic keeps
      // its head on the pin and lights a second lamp just beyond it, so the
      // pin holds the one; that lamp counts as the signal's room when berths
      // and names are placed (`clashCount()`).
      let lamp = null;
      if (sig.kind === "main") for (const k of [-1, 1]) el("circle", { cx: hx + k * dx * (LAMP_R + 0.5), cy: hy + k * dy * (LAMP_R + 0.5), r: LAMP_R, class: "lamp" }, g);
      if (sig.kind === "auto") {
        lamp = [hx + dx * (2 * r + 2.5), hy + dy * (2 * r + 2.5)];
        el("circle", { cx: lamp[0], cy: lamp[1], r, class: "lamp" }, g);
      }
      // The number sits beyond the head, running from the post the way the
      // signal reads, with a small arrow on the approach side pointing that
      // way, as the real screens letter them (`signalLabel()`).
      const { tx, ty, anchor, box: text, ax } = signalLabel(sig, (b) => onZoneLine(zone, b));
      const id = el("text", { x: tx, y: ty, class: "signal-id", "text-anchor": anchor }, g);
      id.textContent = sig.id;
      const ay = ty - 3.5;
      el("polygon", { points: `${ax - dx * 3},${ay - 3} ${ax - dx * 3},${ay + 3} ${ax + dx * 3},${ay}`, class: "signal-arrow" }, g);
      const hit = el("circle", { cx: hx, cy: hy, r: 14, class: "hit", "data-hit": `signal:${sig.id}` }, layers.hits);
      if (sig.kind === "auto") el("title", {}, hit).textContent = `${sig.id}, automatic`;
      hit.addEventListener("click", (ev) => this.on.signal?.(sig.id, ev));
      hit.addEventListener("contextmenu", (ev) => { ev.preventDefault(); this.on.signal?.(sig.id, ev); });
      parts.signals.set(sig.id, { g, head, ring, hit, x: hx, y: hy, text, lamp: lamp && [lamp[0] - r, lamp[1] - r, lamp[0] + r, lamp[1] + r] });
      signalled.push(sig);
    }
    // The berths go down once every signal is drawn, so each keeps clear of
    // the signals further along as well as the ones before it.
    for (const sig of signalled) {
      const at = berthSpot(sig, zone, (r) => this.clashCount(zone, parts, r));
      this.berth(sig.id, at.x, at.y, layers, parts);
    }

    // Fringes: where trains come from and go to, with a berth each.
    for (const f of net.fringes.values()) {
      if (f.zone !== zoneId) continue;
      const inward = fringeInward(net, f, zone);
      // Where a place has a line of its own for each way, the marker names the line.
      const name = `${f.line ? `${f.line.toUpperCase()} ` : ""}${f.out ? "TO" : "FROM"} ${f.name.toUpperCase()}`;
      this.portal(zone, layers, parts, { x: f.x, y: f.y, inward, out: f.out, name, berthId: f.id, exitId: f.out ? f.id : null, side: f.out ? -1 : 1 });
    }

    // The next zone: a route whose exit signal is off this screen gets a
    // marker at the boundary carrying that signal's name, so it can be
    // pointed at, and the berth the description steps into.
    const seen = new Set();
    const exits = new Set();
    for (const sig of net.signals.values()) {
      if (sig.zone !== zoneId) continue;
      for (const rid of sig.routes) {
        const r = net.routes.get(rid);
        if (r.exit.kind !== "signal") continue;
        const exit = net.signals.get(r.exit.id);
        if (exit.zone === zoneId || seen.has(exit.id)) continue;
        let node = sig.node, last = null;
        for (const id of r.strokes) {
          const st = net.strokes[id];
          if (st.zone !== zoneId) break;
          last = st;
          node = farEnd(net, id, node);
        }
        if (!last) continue;
        seen.add(exit.id);
        const end = last.na === node ? last.a : last.b;
        const inward = inwardAt(end, last.na === node ? last.b : last.a, zone);
        exits.add(`${end[0]},${end[1]}`);
        this.portal(zone, layers, parts, { x: end[0], y: end[1], inward, out: true, name: exit.id, berthId: exit.id, exitId: exit.id, side: -inward, inside: true });
      }
    }

    // The other way across each boundary: a marker for the line trains come
    // in on, named for the zone they come from. They are described at the
    // first signal inside, so it carries no berth of its own.
    for (const link of zone.links) {
      if (exits.has(`${link.node[0]},${link.node[1]}`)) continue;
      const other = ZONES.find((z) => z.id === link.zone);
      const line = net.strokes.find((st) => st.zone === zoneId && !st.hidden && (near(st.a, link.node) || near(st.b, link.node)));
      const inward = inwardAt(link.node, line ? (near(line.a, link.node) ? line.b : line.a) : null, zone);
      this.portal(zone, layers, parts, { x: link.node[0], y: link.node[1], inward, out: false, name: `FROM ${other.name.toUpperCase()}`, berthId: null, exitId: null, side: 1 });
    }

    // Level crossings: the road across both lines, and a box between them
    // that shows what the barriers are doing.
    for (const lc of net.lcs.values()) {
      if (lc.zone !== zoneId) continue;
      const g = el("g", { class: "lc", "data-lc": lc.id }, layers.fringes);
      el("line", { x1: lc.x, y1: lc.top, x2: lc.x, y2: lc.bottom, class: "road" }, g);
      const cy = (lc.top + lc.bottom) / 2;
      el("rect", { x: lc.x - 15, y: cy - 9, width: 30, height: 18, class: "box" }, g);
      const t = el("text", { x: lc.x, y: cy + 4, class: "lc-text", "text-anchor": "middle" }, g);
      t.textContent = "LC";
      const name = el("text", { x: lc.x, y: lc.bottom + 14, class: "note", "text-anchor": "middle" }, g);
      name.textContent = lc.name.toUpperCase();
      const hit = el("rect", { x: lc.x - 17, y: cy - 12, width: 34, height: 24, class: "hit", "data-hit": `lc:${lc.id}` }, layers.hits);
      hit.addEventListener("click", (ev) => this.on.lc?.(lc.id, ev));
      hit.addEventListener("contextmenu", (ev) => { ev.preventDefault(); this.on.lc?.(lc.id, ev); });
      parts.lcs.set(lc.id, { g, x: lc.x, y: cy });
    }

    // Buffer stops at every dead end.
    for (const node of net.nodes.values()) {
      if (node.strokes.length !== 1 || node.fringe) continue;
      const s = net.strokes[node.strokes[0]];
      if (s.zone !== zoneId || s.hidden) continue;
      const end = s.na === node.key ? s.a : s.b;
      const other = s.na === node.key ? s.b : s.a;
      const dir = Math.sign(end[0] - other[0]) || 1;
      el("line", { x1: end[0] + dir * 2, y1: end[1] - 7, x2: end[0] + dir * 2, y2: end[1] + 7, class: "buffer" }, layers.track);
      const hit = el("rect", { x: end[0] - 12, y: end[1] - 12, width: 24, height: 24, class: "hit", "data-hit": `exit:${node.key}` }, layers.hits);
      hit.addEventListener("click", (ev) => this.on.exit?.(node.key, ev));
      parts.exits.set(node.key, { hit });
    }

    svg.addEventListener("click", (ev) => { if (ev.target === svg) this.on.clear?.(ev); });
    return { svg, parts };
  }

  berth(id, x, y, layers, parts) {
    // Kept inside the picture, so a berth behind a signal near the edge is
    // not lost off it.
    const zone = ZONES.find((z) => z.id === layers.track.ownerSVGElement?.dataset.zone) ?? null;
    const width = zone ? zone.width : 1600, height = zone ? zone.height : 560;
    x = Math.max(BERTH.w / 2 + 4, Math.min(width - BERTH.w / 2 - 4, x));
    y = Math.max(BERTH.h / 2 + 4, Math.min(height - BERTH.h / 2 - 4, y));
    const g = el("g", { class: "berth", "data-berth": id }, layers.berths);
    el("rect", { x: x - BERTH.w / 2, y: y - BERTH.h / 2, width: BERTH.w, height: BERTH.h, class: "berth-box" }, g);
    const text = el("text", { x, y: y + 4.5, class: "berth-text", "text-anchor": "middle" }, g);
    const hit = el("rect", { x: x - BERTH.w / 2 - 2, y: y - BERTH.h / 2 - 3, width: BERTH.w + 4, height: BERTH.h + 6, class: "hit", "data-hit": `berth:${id}` }, layers.hits);
    hit.addEventListener("click", (ev) => this.on.berth?.(id, ev));
    hit.addEventListener("contextmenu", (ev) => { ev.preventDefault(); this.on.berth?.(id, ev); });
    // The pointer resting on a described berth is told about the train.
    const title = el("title", {}, hit);
    parts.berths.set(id, { g, text, x, y, title });
  }

  /**
   * Which side of the line a portal's berth and name go: the side asked
   * for, unless something already drawn is in the way there and the other
   * side is clearer. `name` is null for a name that does not stack beyond
   * the berth: one written in its box, or reading on from the line.
   */
  freeSide(zone, parts, { x, y, inward, w, gap, name, side, berth }) {
    const bx = x + inward * (w / 2 + gap);
    const berthX = bx + inward * (w / 2 + BERTH.w / 2 + 10);
    const clashes = (which) => {
      const by = which < 0 ? y - 14 : y + 14;
      const rects = berth ? [[berthX - BERTH.w / 2, by - BERTH.h / 2, berthX + BERTH.w / 2, by + BERTH.h / 2]] : [];
      if (name) rects.push(portalName(zone, { x, y, inward, w, gap, name, side: which, berth }).box);
      let count = 0;
      for (const r of rects) count += this.clashCount(zone, parts, r);
      return count;
    };
    const asked = clashes(side);
    return asked === 0 || asked <= clashes(-side) ? side : -side;
  }

  /** How many things already drawn a box would sit on: track, berths, signals with their numbers and an automatic's second lamp, and every box placed so far. */
  clashCount(zone, parts, r) {
    let count = 0;
    for (const s of zone.strokes) if (!s.hidden && segmentHitsRect(s.a, s.b, r)) count++;
    for (const [a, b] of shedEdges(zone)) if (segmentHitsRect(a, b, r)) count++;
    for (const b of parts.berths.values()) if (overlaps(r, [b.x - BERTH.w / 2, b.y - BERTH.h / 2, b.x + BERTH.w / 2, b.y + BERTH.h / 2])) count++;
    for (const sg of parts.signals.values()) if (overlaps(r, [sg.x - 10, sg.y - 10, sg.x + 10, sg.y + 10]) || overlaps(r, sg.text) || (sg.lamp && overlaps(r, sg.lamp))) count++;
    for (const b of parts.boxes) if (overlaps(r, b)) count++;
    return count;
  }

  /**
   * A way off the edge of the picture: an arrow box on the line, the name of
   * where it leads, and a berth. An exit can be pointed at as the end of a
   * route. `side` says which side of the line the berth goes: -1 above.
   */
  portal(zone, layers, parts, { x, y, inward, out, name, berthId, exitId, side, inside = false }) {
    const w = inside ? 34 : 26, h = 14;
    const gap = markerGap(this.net, zone, { x, y, inward, w });
    // A name that reads on from its line leaves the berth alone to find
    // its side; one that stacks beyond the berth goes with it.
    const stacks = !inside && !partway(zone, x);
    side = this.freeSide(zone, parts, { x, y, inward, w, gap, name: stacks ? name : null, side, berth: !!berthId });
    const g = el("g", { class: `fringe ${out ? "out" : "in"}` }, layers.fringes);
    const bx = x + inward * (w / 2 + gap);
    const dirArrow = out ? -inward : inward;
    const path = dirArrow > 0
      ? `M ${bx - w / 2} ${y - h / 2} h ${w - 6} l 6 ${h / 2} l -6 ${h / 2} h ${-(w - 6)} z`
      : `M ${bx + w / 2} ${y - h / 2} h ${-(w - 6)} l -6 ${h / 2} l 6 ${h / 2} h ${w - 6} z`;
    el("path", { d: path, class: "fringe-arrow" }, g);
    // The next zone's signal is written inside an exit's box; any other
    // name goes where `portalName()` puts it.
    if (inside) {
      el("text", { x: bx - (out ? -inward : inward) * 2, y: y + 3.5, class: "fringe-name", "text-anchor": "middle" }, g).textContent = name;
    } else {
      const at = portalName(zone, { x, y, inward, w, gap, name, side, berth: !!berthId });
      el("text", { x: at.tx, y: at.ty, class: "fringe-name", "text-anchor": at.anchor }, g).textContent = name;
      parts.boxes.push(at.box);
    }
    if (berthId) this.berth(berthId, bx + inward * (w / 2 + BERTH.w / 2 + 10), side < 0 ? y - 14 : y + 14, layers, parts);
    if (exitId) {
      const hit = el("rect", { x: bx - w / 2 - 4, y: y - h / 2 - 5, width: w + 8, height: h + 10, class: "hit", "data-hit": `exit:${exitId}` }, layers.hits);
      hit.addEventListener("click", (ev) => this.on.exit?.(exitId, ev));
      parts.exits.set(exitId, { g, hit });
    }
  }

  /** Redraw the state of everything in the zone on show. */
  update(sim) {
    if (!this.parts) return;
    this.strip?.update(sim);
    const p = this.parts;
    const white = carried(this.net, sim, this.zone);
    for (const [tc, lines] of p.tcs) {
      const t = sim.tcs.get(tc);
      const occupied = t.trains.size > 0 || t.failed;
      const set = t.lockedBy && (!this.ownRoutes.has(t.lockedBy) || white.has(t.lockedBy));
      // A circuit that shows occupied with no train on it has failed, and
      // looks it: red like a train, but broken.
      const failed = t.failed && t.trains.size === 0;
      const cls = `tc${occupied ? " occupied" : set ? " set" : ""}${failed ? " failed" : ""}${t.blocked || t.mending ? " blocked" : ""}${t.wanted ? " wanted" : ""}${this.shown === `tc:${tc}` ? " shown" : ""}`;
      for (const line of lines) if (line.getAttribute("class") !== cls) line.setAttribute("class", cls);
    }
    for (const [id, part] of p.points) {
      const s = sim.points.get(id);
      const moving = s.moving > 0;
      const gapN = moving || s.lie === "R", gapR = moving || s.lie === "N";
      part.legs.normal?.setAttribute("visibility", gapN ? "hidden" : "visible");
      part.legs.reverse?.setAttribute("visibility", gapR ? "hidden" : "visible");
      const locked = sim.pointLock(id) !== null;
      // Pointed at by its own id, or by the number both ends of a crossover share.
      const shown = this.shown === `points:${id}` || this.shown === `points:${id.replace(/[AB]$/, "")}`;
      part.label.setAttribute("class", `point-num${s.failed ? " failed" : ""}${moving ? " moving" : ""}${locked ? " locked" : ""}${shown ? " shown" : ""}`);
    }
    for (const [id, part] of p.signals) {
      const state = sim.signals.get(id);
      const aspect = sim.aspect(id);
      const off = aspect !== "red";
      const route = sim.routeFrom(id);
      let cls = `signal kind-${this.net.signals.get(id).kind}${off ? ` off ${aspect}` : " on"}`;
      if (state.reminder) cls += " reminder";
      if (state.failed) cls += " failed";
      if (state.authorised) cls += " authorised";
      if (route && route.cancelAt !== null) cls += " cancelling";
      if (this.selected === id) cls += " selected";
      if (this.shown === `signal:${id}`) cls += " shown";
      if (part.g.getAttribute("class") !== cls) part.g.setAttribute("class", cls);
    }
    // The platform says what the train in it is doing: white while it
    // loads, yellow flashing once it is ready to start, until it goes.
    for (const [tc, part] of p.platforms) {
      let state = null;
      for (const id of sim.tcs.get(tc).trains) {
        const t = sim.trains.get(id);
        const st = t ? sim.platformState(t) : null;
        if (st) { state = st; break; }
      }
      for (const name of ["loading", "trts"]) {
        const on = state === (name === "trts" ? "ready" : name);
        part.box.classList.toggle(name, on);
        part.text.classList.toggle(name, on);
      }
      // The platform the picked train is booked into, while its card is open.
      part.box.classList.toggle("wanted", tc === this.wanted);
    }
    for (const [id, part] of p.lcs) {
      const cls = `lc ${sim.lcs.get(id)?.barriers ?? "up"}${this.shown === `lc:${id}` ? " shown" : ""}`;
      if (part.g.getAttribute("class") !== cls) part.g.setAttribute("class", cls);
    }
    for (const [id, part] of p.exits) part.g?.classList.toggle("shown", this.shown === `exit:${id}`);
    const owners = new Map();
    for (const t of sim.trains.values()) if (t.berth) owners.set(t.berth, t);
    for (const [id, part] of p.berths) {
      const text = sim.berths.get(id) ?? "";
      if (part.text.textContent !== text) part.text.textContent = text;
      const cls = `berth${text ? " full" : ""}${id === this.picked ? " picked" : ""}${this.shown === `berth:${id}` ? " shown" : ""}`;
      if (part.g.getAttribute("class") !== cls) part.g.setAttribute("class", cls);
      const owner = text ? owners.get(id) : null;
      const words = owner ? (this.on.describe?.(owner) ?? text) : text;
      if (part.title.textContent !== words) part.title.textContent = words;
    }
  }

  /**
   * Pick out the berth of the train whose timetable is open in the side
   * panel, and the platform it is booked into on this desk, or neither.
   */
  pick(berthId, tc = null) {
    this.picked = berthId;
    this.wanted = tc;
  }

  /** Mark the signal chosen as the start of a route, or none. */
  select(signalId) {
    this.selected = signalId;
  }

  /** Where something on the board is, in board units: "signal:MB1", "lc:MB", "berth:MB2", "points:801", an exit's arrow box, "exit:WI-U", or a circuit, "tc:SC.DM7B". */
  spotAt(key) {
    const p = this.parts;
    const colon = key?.indexOf(":") ?? -1;
    if (!p || colon < 0) return null;
    const kind = key.slice(0, colon), id = key.slice(colon + 1);
    if (kind === "tc") {
      const lines = p.tcs.get(id);
      if (!lines?.length) return null;
      const xs = lines.flatMap((l) => [Number(l.getAttribute("x1")), Number(l.getAttribute("x2"))]);
      const ys = lines.flatMap((l) => [Number(l.getAttribute("y1")), Number(l.getAttribute("y2"))]);
      return { x: (Math.min(...xs) + Math.max(...xs)) / 2, y: (Math.min(...ys) + Math.max(...ys)) / 2 };
    }
    if (kind === "points") {
      // A crossover is named by the number on both its ends, 801 for 801A and 801B: the board goes to its A end.
      const label = (p.points.get(id) ?? p.points.get(`${id}A`))?.label;
      return label ? { x: Number(label.getAttribute("x")), y: Number(label.getAttribute("y")) } : null;
    }
    if (kind === "exit") {
      const hit = p.exits.get(id)?.hit;
      return hit ? { x: Number(hit.getAttribute("x")) + Number(hit.getAttribute("width")) / 2, y: Number(hit.getAttribute("y")) + Number(hit.getAttribute("height")) / 2 } : null;
    }
    const part = { signal: p.signals, berth: p.berths, lc: p.lcs }[kind]?.get(id);
    return part ? { x: part.x, y: part.y } : null;
  }

  /** Move the board to something on it, the way `spotAt()` names it, if it is not on screen already; it moves no further than it has to. */
  bringIn(key) {
    const spot = this.spotAt(key);
    if (!spot || !this.pan) return;
    const v = this.view;
    const x = spot.x > v.x + 40 && spot.x < v.x + v.w - 40 ? v.x : spot.x - v.w / 2;
    const y = spot.y > v.y + 20 && spot.y < v.y + v.h - 20 ? v.y : spot.y - v.h / 2;
    if (x !== v.x || y !== v.y) this.aim({ x, y, zoom: this.cam.zoom });
  }

  /** Point at one thing on the board, for the pupil or from an alarm, the way `spotAt()` names it, or at nothing. */
  spotlight(key) {
    this.shown = key;
  }

  /** The screen position of a berth, for the interpose box. */
  berthAt(id) {
    const part = this.parts?.berths.get(id);
    const m = part && this.svg?.getScreenCTM();
    if (!m) return null;
    return { x: m.a * part.x + m.e, y: m.d * part.y + m.f, w: BERTH.w * m.a, h: BERTH.h * m.d };
  }
}

/** Whether a view, { x, y, w, h }, shows any of a box [x1, y1, x2, y2]. */
function meets(view, box) {
  return view.x < box[2] && view.x + view.w > box[0] && view.y < box[3] && view.y + view.h > box[1];
}

/**
 * The arrows for a view of the board: none while any of the drawing is in
 * it, and otherwise a staggered lattice over the screen, each arrow turned to
 * the nearest point of the drawing. The lattice is pinned to the board rather
 * than to the screen, so it slides under a drag and the view is seen to move
 * when there is nothing else to see.
 * @param view { x, y, w, h } the part of the board on screen, in board units
 * @param drawing [x1, y1, x2, y2] the drawing, in board units
 * @param screen { width, height } in pixels
 * @returns [{ x, y, angle }] where each arrow is centred on the screen, in pixels, and where it points, in degrees clockwise from east
 */
export function beyond(view, drawing, screen) {
  if (meets(view, drawing)) return [];
  const s = screen.width / view.w;
  const left = (drawing[0] - view.x) * s, right = (drawing[2] - view.x) * s;
  const top = (drawing[1] - view.y) * s, bottom = (drawing[3] - view.y) * s;
  const { across, down, length } = FIELD;
  const ox = mod(-view.x * s, across), oy = mod(-view.y * s, 2 * down);
  const arrows = [];
  for (let row = -1; oy + row * down < screen.height + length; row++) {
    const y = oy + row * down;
    if (y < -length) continue;
    for (let x = ox - across + (mod(row, 2) ? across / 2 : 0); x < screen.width + length; x += across) {
      if (x < -length) continue;
      const tx = clamp(x, left, right), ty = clamp(y, top, bottom);
      // One off the edge of the screen can sit over the drawing, with nowhere to point.
      if (tx === x && ty === y) continue;
      arrows.push({ x, y, angle: (Math.atan2(ty - y, tx - x) * 180) / Math.PI });
    }
  }
  return arrows;
}

/** One arrow of the field as path data: a shaft and a square head, turned to its angle. */
function arrowPath({ x, y, angle }) {
  const { length, head } = FIELD;
  const r = (angle * Math.PI) / 180, c = Math.cos(r), s = Math.sin(r);
  const p = (u, v) => `${(x + u * c - v * s).toFixed(1)} ${(y + u * s + v * c).toFixed(1)}`;
  const tip = length / 2;
  return `M${p(-tip, 0)}L${p(tip - 2, 0)}M${p(tip - head, -head)}L${p(tip, 0)}L${p(tip - head, head)}`;
}

/** A view kept within reach of the drawing: never more than WANDER views of nothing between its edge and the nearest of it. */
export function settle(view, drawing) {
  return {
    ...view,
    x: clamp(view.x, drawing[0] - view.w * (1 + WANDER), drawing[2] + view.w * WANDER),
    y: clamp(view.y, drawing[1] - view.h * (1 + WANDER), drawing[3] + view.h * WANDER),
  };
}

/**
 * The view that shows the whole of a drawing [x1, y1, x2, y2] on a screen of
 * { width, height } pixels, where `base` pixels make a unit at a zoom of 1:
 * as large as it goes with `FIT_MARGIN` round it, centred, and never past
 * the zoom's limits, so a drawing too long to fit is still centred.
 */
export function fitted(drawing, screen, base) {
  const [x1, y1, x2, y2] = drawing;
  const s = Math.min((screen.width - 2 * FIT_MARGIN) / (x2 - x1), (screen.height - 2 * FIT_MARGIN) / (y2 - y1));
  const zoom = clamp(s / base, ZOOM.least, ZOOM.most);
  const w = screen.width / (base * zoom), h = screen.height / (base * zoom);
  return { x: (x1 + x2 - w) / 2, y: (y1 + y2 - h) / 2, w, h, zoom };
}

/**
 * Where a click on the strip under the board takes the view: centred on the
 * point, but along each way held on the band where the view is narrower than
 * it, and moved no further than brings all of it in where the view is wider,
 * so the strip never leaves the board looking at nothing.
 */
export function toward(view, point, band) {
  const along = (at, size, want, lo, hi) =>
    size >= hi - lo ? clamp(at, hi - size, lo) : clamp(want - size / 2, lo, hi - size);
  return { ...view, x: along(view.x, view.w, point[0], band[0], band[2]), y: along(view.y, view.h, point[1], band[1], band[3]) };
}

/** The part of a band [x1, y1, x2, y2] a view shows, as fractions of the band, { left, top, width, height }, or null when it shows none of it. */
export function framed(view, band) {
  const [x1, y1, x2, y2] = band;
  const left = Math.max(view.x, x1), right = Math.min(view.x + view.w, x2);
  const top = Math.max(view.y, y1), bottom = Math.min(view.y + view.h, y2);
  if (right <= left || bottom <= top) return null;
  return { left: (left - x1) / (x2 - x1), top: (top - y1) / (y2 - y1), width: (right - left) / (x2 - x1), height: (bottom - top) / (y2 - y1) };
}

function clamp(value, least, most) {
  return Math.min(Math.max(value, least), most);
}

/** The remainder that is never negative, for a lattice that runs both ways from nought. */
function mod(value, step) {
  return ((value % step) + step) % step;
}

/** Whether two points are one node. */
function near(a, b) {
  return Math.abs(a[0] - b[0]) < 0.01 && Math.abs(a[1] - b[1]) < 0.01;
}

/** Where two strokes cross between their ends, or null: never at a node they share, which is a junction. */
export function crossingOf(s, t) {
  const [ax, ay] = s.a, [bx, by] = s.b, [cx, cy] = t.a, [dx, dy] = t.b;
  const den = (bx - ax) * (dy - cy) - (by - ay) * (dx - cx);
  if (Math.abs(den) < 1e-9) return null;
  const u = ((cx - ax) * (dy - cy) - (cy - ay) * (dx - cx)) / den;
  const v = ((cx - ax) * (by - ay) - (cy - ay) * (bx - ax)) / den;
  const inside = (f) => f > 0.001 && f < 0.999;
  return inside(u) && inside(v) ? [ax + (bx - ax) * u, ay + (by - ay) * u] : null;
}

/**
 * Which way the board lies from a fringe along x, +1 east and -1 west, read
 * off the line that runs to it rather than off which half of the board it
 * is in: Calhoun's four fringes are partway across Lovell Field's board,
 * with its line to the west of them and the airport to the east.
 */
export function fringeInward(net, f, zone) {
  const at = [f.x, f.y];
  const line = net.strokes.find((st) => st.zone === f.zone && !st.hidden && (near(st.a, at) || near(st.b, at)));
  return inwardAt(at, line ? (near(line.a, at) ? line.b : line.a) : null, zone);
}

/**
 * Where a portal's name is written, how it is anchored, and the room it
 * takes. A way on or off a line that ends partway across the board has the
 * open board beyond it, where the name reads on from the line's end, level
 * with the line, rather than back along it over the signals that stand by
 * the line, or between two lines, stacked on the next line's name:
 * Calhoun's four lines end partway across Lovell Field's board. At the
 * board's edge the name stacks beyond the berth, away from the line, where
 * the signals beside the boundary cannot sit on top of it, or keeps by the
 * line where there is no berth. `side` is the berth's side, -1 above, and
 * `gap` how far in the box stands (`markerGap()`).
 */
export function portalName(zone, { x, y, inward, w, gap, name, side, berth }) {
  const onward = partway(zone, x);
  const bx = x + inward * (w / 2 + gap);
  const tx = onward ? x - inward * 4 : bx + inward * (w / 2 + 10);
  const ty = onward ? y + 4 : nameY(y, side, berth);
  const ahead = (onward ? -inward : inward) > 0, nw = name.length * NAME_W;
  return { tx, ty, anchor: ahead ? "start" : "end", box: [ahead ? tx : tx - nw, ty - 8, ahead ? tx + nw : tx, ty + 3], onward };
}

/** Whether a line's end at `x` is partway across a zone's board rather than at its edge. */
function partway(zone, x) {
  return x > 1 && x < zone.width - 1;
}

/**
 * How far in from a line's end a portal's box of width `w` stands: six,
 * or less where a signal's post stands just inside it, so the post keeps
 * clear of the box, down to two, so the line still runs on past the box
 * as it does past every other.
 */
export function markerGap(net, zone, { x, y, inward, w }) {
  let gap = 6;
  for (const sig of net.signals.values()) {
    if (sig.zone !== zone.id || Math.abs(sig.y - y) > 1) continue;
    const reach = (sig.x - x) * inward;
    if (reach > 0) gap = Math.min(gap, Math.max(2, reach - w - 6));
  }
  return gap;
}

/**
 * Which way the board lies from a line's end, 1 for east and -1 for west:
 * back along the line, `from` being its other end, so a line that leaves
 * partway across the board is marked the way it runs. Without a line, from
 * whichever edge the end is nearer.
 */
function inwardAt(end, from, zone) {
  const back = from ? Math.sign(from[0] - end[0]) : 0;
  return back || (end[0] < zone.width / 2 ? 1 : -1);
}

/** The baseline of a portal's name: beyond the berth when it has one, else close by the line. */
function nameY(y, side, berth) {
  if (berth) return side < 0 ? y - 29 : y + 33;
  return side < 0 ? y - 10 : y + 16;
}

/** Whether two boxes, each [x1, y1, x2, y2], share any area. */
function overlaps(a, b) {
  return a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3];
}

/**
 * The automatics' routes drawn white, as part of a road a train has been
 * given. The route an automatic keeps for itself is how it clears, not a
 * road anybody set, so with nothing coming the line past one is grey. But
 * past an automatic there is only one way to go: a route set from a signal
 * on the desk carries its white on through every automatic ahead that is
 * off, as far as the next signal somebody works, and so does the block a
 * train is running in, so the road ahead of the train stays shown once the
 * route behind it has released.
 */
export function carried(net, sim, zoneId) {
  const white = new Set();
  for (const r of sim.routes.values()) {
    const entry = net.signals.get(r.def.entry);
    if (entry.zone !== zoneId || r.cancelAt !== null) continue;
    if (entry.kind === "auto") {
      if (!r.entered) continue;
      white.add(r.id);
    }
    let exit = r.def.exit;
    while (exit.kind === "signal" && net.signals.get(exit.id).kind === "auto" && sim.proceed(exit.id)) {
      const next = sim.routeFrom(exit.id);
      if (!next || white.has(next.id)) break;
      white.add(next.id);
      exit = next.def.exit;
    }
  }
  return white;
}

/**
 * Where a signal's post runs and its head sits, the line at the post's foot.
 * A controlled signal's post stands up from the line and turns to run the
 * way the train goes, with the head at the end of the arm. An automatic is a
 * pin: a smaller head straight up on its post, no arm, so the signals a
 * signaller works stand out from the ones that work themselves.
 */
export function signalShape(sig) {
  const { dx, dy } = sig;
  const lx = dy, ly = -dx;
  const foot = [sig.x + lx * 2.5, sig.y + ly * 2.5];
  const knee = [sig.x + lx * POST, sig.y + ly * POST];
  if (sig.kind === "auto") return { stem: [foot, knee], knee, head: [knee[0] + lx * AUTO_R, knee[1] + ly * AUTO_R], r: AUTO_R };
  const arm = [knee[0] + dx * ARM, knee[1] + dy * ARM];
  return { stem: [foot, knee, arm], knee, head: [arm[0] + dx * SIGNAL_R, arm[1] + dy * SIGNAL_R], r: SIGNAL_R };
}

/**
 * A signal's number: where it is written, beyond the head, running from the
 * post the way the signal reads, how it is anchored, where its arrow is
 * (`ax`), and the room the two take, [x1, y1, x2, y2]. The arrow is on the
 * approach side of the post, the number on the other. A number that would
 * sit on a line, as a shunt signal's does at the foot of a ladder, where the
 * next diagonal runs down past it, moves back along the line, arrow and all,
 * until it is clear (`onLine`, asked of the number's own box).
 * @param {((box: number[]) => boolean) | null} [onLine]
 */
export function signalLabel(sig, onLine = null) {
  const { dx } = sig;
  const ly = -dx;
  const { knee } = signalShape(sig);
  const ty = knee[1] + ly * 10 + (ly > 0 ? 7 : 0);
  const anchor = dx > 0.3 ? "start" : dx < -0.3 ? "end" : "middle";
  const tw = sig.id.length * ID_W;
  let tx = 0, shift = 0;
  for (shift of [0, 6, 10, 14]) {
    tx = knee[0] + dx * (4 - shift);
    const own = anchor === "start" ? [tx, ty - 8, tx + tw, ty + 1] : anchor === "end" ? [tx - tw, ty - 8, tx, ty + 1] : [tx - tw / 2, ty - 8, tx + tw / 2, ty + 1];
    if (!onLine || !onLine(own)) break;
  }
  const ax = knee[0] - dx * (4 + shift);
  const box = anchor === "start" ? [Math.min(tx - 12, ax - 4), ty - 8, tx + tw + 1, ty + 1]
    : anchor === "end" ? [tx - tw - 1, ty - 8, Math.max(tx + 8, ax + 4), ty + 1]
      : [tx - tw / 2 - 6, ty - 8, tx + tw / 2 + 6, ty + 1];
  return { tx, ty, anchor, box, ax };
}

/**
 * Where a point's number takes a click: its own box, grown to the 24 across
 * that every target on the board has at least.
 * @param {number[]} box
 */
export function pointTarget(box) {
  const [x1, y1, x2, y2] = box;
  const hw = Math.max(12, (x2 - x1) / 2), hh = Math.max(12, (y2 - y1) / 2), mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
  return [mx - hw, my - hh, mx + hw, my + hh];
}

/** Whether a box [x1, y1, x2, y2] sits on one of a zone's lines, or on the outline of one of its sheds. */
export function onZoneLine(zone, r) {
  return zone.strokes.some((s) => !s.hidden && segmentHitsRect(s.a, s.b, r)) || shedEdges(zone).some(([a, b]) => segmentHitsRect(a, b, r));
}

/** The four sides of each of a zone's sheds, as lines from corner to corner. */
function shedEdges(zone) {
  return (zone.sheds ?? []).flatMap(({ x1, y1, x2, y2 }) => [[[x1, y1], [x2, y1]], [[x2, y1], [x2, y2]], [[x2, y2], [x1, y2]], [[x1, y2], [x1, y1]]]);
}

/** The room an automatic's second lamp takes, lit for a double yellow just beyond its head. */
function lampBox(sig) {
  const { head: [hx, hy], r } = signalShape(sig);
  const x = hx + sig.dx * (2 * r + 2.5), y = hy + sig.dy * (2 * r + 2.5);
  return [x - r, y - r, x + r, y + r];
}

/**
 * Where a set of points has its number: over the points, on the side away
 * from the reverse leg, or where that runs into something, stepped along
 * the line a little at a time, either way, until it is clear. `clash`
 * counts what a box [x1, y1, x2, y2] runs into; it is asked for the digits
 * themselves with a hair of room round them, so two names that touch read
 * as touching. `box` is the room the number keeps from what is placed
 * after it. Where no step is clear it keeps the one with least in the way.
 */
export function pointLabelSpot(p, rfar, clash) {
  const side = rfar[1] < p.y ? 1 : -1;
  const y = p.y + side * 15 + (side > 0 ? 4 : 0);
  let best = null;
  for (const step of [0, 8, -8, 14, -14, 20, -20, 26, -26]) {
    const x = p.x + step;
    const box = [x - 11, y - 9, x + 11, y + 3];
    const count = clash([x - 12, y - 9, x + 12, y + 1.5]);
    if (!best || count < best.count) best = { x, y, box, count };
    if (!count) break;
  }
  return best;
}

/** What a name's box [x1, y1, x2, y2] runs into on a zone's board: its lines, and the `taken` boxes. */
export function labelClashes(zone, taken, r) {
  let count = 0;
  for (const s of zone.strokes) if (!s.hidden && segmentHitsRect(s.a, s.b, r)) count++;
  for (const b of taken) if (overlaps(r, b)) count++;
  return count;
}

/**
 * Where a signal's berth goes: behind the signal on its own side of the
 * line, as close as it will go without sitting on anything already drawn.
 * Track above all: a berth over a line reads as a block of line that is not
 * there. It steps back along the line until it is clear, and where it never
 * is, it takes the spot with least close to it, and of those the one with
 * least under it. `clash` counts what a box [x1, y1, x2, y2] would sit on.
 */
export function berthSpot(sig, zone, clash) {
  const { dx, dy } = sig;
  const lx = dy, ly = -dx;
  let best = null;
  // Where the usual spot has something under it, two closer in are tried
  // before stepping back: between two signals a hundred units apart, or in
  // a shed, whose outline a berth sits inside or out of but not across.
  for (const back of [46, 40, 34, 58, 70, 82, 94, 106, 118]) {
    const x = clamp(sig.x - dx * back + lx * 26, BERTH.w / 2 + 4, zone.width - BERTH.w / 2 - 4);
    const y = clamp(sig.y - dy * back + ly * 26, BERTH.h / 2 + 4, zone.height - BERTH.h / 2 - 4);
    const box = [x - BERTH.w / 2, y - BERTH.h / 2, x + BERTH.w / 2, y + BERTH.h / 2];
    // Asked with a little room round it, so a berth is seen to be clear of a line, not just off it.
    const count = clash([box[0] - 3, box[1] - 3, box[2] + 3, box[3] + 3]);
    // Of spots each close to something, the one sitting on least.
    const on = count ? clash(box) : 0;
    if (!best || count < best.count || (count === best.count && on < best.on)) best = { x, y, box, count, on };
    if (!count) break;
  }
  return best;
}

/** Whether the line from `a` to `b` crosses the box [x1, y1, x2, y2]. */
export function segmentHitsRect(a, b, [x1, y1, x2, y2]) {
  let t0 = 0, t1 = 1;
  const dx = b[0] - a[0], dy = b[1] - a[1];
  for (const [p, q] of [[-dx, a[0] - x1], [dx, x2 - a[0]], [-dy, a[1] - y1], [dy, y2 - a[1]]]) {
    if (p === 0) { if (q < 0) return false; continue; }
    const r = q / p;
    if (p < 0) { if (r > t1) return false; if (r > t0) t0 = r; }
    else { if (r < t0) return false; if (r < t1) t1 = r; }
  }
  return t0 <= t1;
}

/** Which side of a platform line its face is drawn: -1 above, 1 below. */
function platformSide(zone, stroke) {
  const y = stroke.a[1];
  const x1 = Math.min(stroke.a[0], stroke.b[0]), x2 = Math.max(stroke.a[0], stroke.b[0]);
  // How much of the platform each other line runs beside, by its height.
  const beside = new Map();
  for (const s of zone.strokes) {
    if (s.hidden || s.a[1] !== s.b[1] || s.a[1] === y) continue;
    const over = Math.min(Math.max(s.a[0], s.b[0]), x2) - Math.max(Math.min(s.a[0], s.b[0]), x1);
    if (over > 0) beside.set(s.a[1], (beside.get(s.a[1]) ?? 0) + over);
  }
  // Away from the nearest, and of two as near, from the one beside more of
  // it: a line that only just reaches the platform's end is not its pair.
  let pair = null;
  for (const [ly, over] of beside) {
    const d = Math.abs(ly - y);
    if (!pair || d < pair.d || (d === pair.d && over > pair.over)) pair = { d, over, ly };
  }
  return pair ? (pair.ly > y ? -1 : 1) : -1;
}

export { tcName };
