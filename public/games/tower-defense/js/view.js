import * as THREE from "../../vendor/three.module.min.js";
import { COLS, ROWS, sizeOf } from "./layouts.js";
import { TOWERS, MAX_TIER, statsFor } from "./resources.js";
import { ENEMIES, MUTATIONS, chargeAt, specFor } from "./schedule.js";
import { pointAt } from "./route.js";

/** The colour a charger runs toward as it speeds up. */
const HOT = new THREE.Color("#f3f2f2");

const C = {
  ground: "#1b1918", groundEdge: "#24211f", route: "#3a3635", routeEdge: "#2e2b2a",
  ink: "#151312", white: "#f3f2f2", accent: "#ff563c", grid: "#262322",
};

/**
 * What a mutation looks like on the road. Every mutated cube wears a shell in
 * its colour; this says how that shell behaves and what the cube leaves behind
 * it. rate is motes a second, and the rest is how they fly.
 */
const MUT_LOOK = {
  molten: { rate: 20, up: 1.1, out: 0.35, gravity: -2.2, life: 0.5, size: 0.055, fade: "#4a4646", pulse: 2.5 },
  charged: { rate: 16, up: 1.6, out: 0.8, gravity: 6, life: 0.28, size: 0.04, pulse: 14 },
  rime: { rate: 9, up: -0.2, out: 0.3, gravity: 1.2, life: 0.9, size: 0.045, pulse: 1.2 },
  gilded: { rate: 7, up: 0.5, out: 0.25, gravity: 5, life: 0.5, size: 0.045, pulse: 1.8 },
  chrome: { rate: 5, up: 0.3, out: 0.2, gravity: 3, life: 0.4, size: 0.04, pulse: 1 },
  neon: { rate: 26, up: 0.2, out: 0.15, gravity: 0, life: 0.55, size: 0.05, fade: "#1b1918", pulse: 6 },
  void: { rate: 14, up: 0.9, out: 0.4, gravity: -0.9, life: 0.7, size: 0.05, fade: "#1b1918", pulse: 2 },
  blight: { rate: 12, up: 0.6, out: 0.45, gravity: -0.4, life: 0.8, size: 0.045, fade: "#3a3635", pulse: 1.6 },
  glass: { rate: 8, up: 0.4, out: 0.5, gravity: 7, life: 0.45, size: 0.035, pulse: 3 },
  overgrown: { rate: 10, up: 0.7, out: 0.5, gravity: 4, life: 0.6, size: 0.07, pulse: 1.1 },
  ascendant: { rate: 36, up: 1.7, out: 0.7, gravity: -2.6, life: 0.65, size: 0.075, fade: "#4a1f10", pulse: 4 },
};

/**
 * What a tar pit's tar looks like for the upgrades it has bought. The road is
 * dark grey, so tar that is simply black is a shadow at best; what makes a
 * puddle read is a lighter edge round a dark middle and a wet glint on top.
 * Thicker tar (a) widens every puddle and firms up its edge; Corrosive (b)
 * turns the whole spill a sour green so the two paths tell apart at a glance.
 */
function tarLook(a, b) {
  const acid = b > 0;
  return {
    acid,
    edge: acid ? "#8aa63a" : "#7a5a42",
    fill: acid ? "#1a2412" : "#17110e",
    pool: acid ? "#2f421a" : "#33261d",
    glint: acid ? "#dcf27a" : "#e2b884",
    drip: acid ? "#9ab63a" : "#6a4d38",
    radius: Math.min(0.48, 0.36 + a * 0.03),
    edgeOpacity: Math.min(1, 0.66 + a * 0.07),
  };
}

/**
 * The outline of a spill: every covered cell is a soft bump in a scalar
 * field, wobbled by its seed so no two match, and the outline is where the
 * field crosses `iso`. Bumps that overlap merge, so neighbouring puddles run
 * together with a neck between them rather than sitting apart. The field is
 * zero off the road, so the spill ends at the kerb. Returns closed loops of
 * [x, z] points, traced with marching squares over a fine grid.
 */
function spillOutline(cells, onRoad, iso) {
  const step = 0.045, pad = 0.5;
  let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
  for (const c of cells) {
    const reach = c.size * 2 + pad;
    x0 = Math.min(x0, c.x - reach); x1 = Math.max(x1, c.x + reach);
    z0 = Math.min(z0, c.z - reach); z1 = Math.max(z1, c.z + reach);
  }
  const nx = Math.ceil((x1 - x0) / step), nz = Math.ceil((z1 - z0) / step);
  // Necks: a run of field along the line between any two cells next to each
  // other, so neighbouring puddles always join rather than only when their
  // bumps happen to reach. As wide as the smaller of the two allows.
  const necks = [];
  for (let i = 0; i < cells.length; i++) {
    for (let j = i + 1; j < cells.length; j++) {
      const a = cells[i], b = cells[j];
      if (Math.hypot(a.x - b.x, a.z - b.z) > 1.5) continue;
      necks.push({ a, b, r: Math.min(a.size, b.size) * 0.75 * Math.min(a.cover, b.cover), seed: a.seed + b.seed });
    }
  }
  const bump = (q) => (q < 1 ? (1 - q * q) * (1 - q * q) : 0);
  const field = (x, z) => {
    if (!onRoad(x, z)) return 0;
    let sum = 0;
    for (const c of cells) {
      const dx = x - c.x, dz = z - c.z, dist = Math.hypot(dx, dz);
      // A blob alone crosses iso 0.5 at 0.54 of its radius, so the radius is
      // sized up to make the puddle on the road the size asked for.
      const wob = 0.86 + 0.1 * Math.sin(Math.atan2(dz, dx) * 3 + c.seed) + 0.05 * Math.sin(Math.atan2(dz, dx) * 7 + c.seed * 2.3);
      sum += bump(dist / ((c.size / 0.54) * c.cover * wob));
    }
    for (const n of necks) {
      const ax = n.b.x - n.a.x, az = n.b.z - n.a.z, len2 = ax * ax + az * az;
      const t = Math.max(0, Math.min(1, ((x - n.a.x) * ax + (z - n.a.z) * az) / len2));
      const dist = Math.hypot(x - (n.a.x + ax * t), z - (n.a.z + az * t));
      const wob = 0.9 + 0.1 * Math.sin(t * 9 + n.seed);
      sum += bump(dist / (n.r / 0.54 * wob));
    }
    return sum;
  };
  const w = nx + 1;
  const v = new Float32Array(w * (nz + 1));
  for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) v[j * w + i] = field(x0 + i * step, z0 + j * step);
  // Which edges of a grid square the outline crosses, by which corners are
  // inside: a (top left), b (top right), c (bottom right), d (bottom left).
  const CASES = [[], [["L", "B"]], [["B", "R"]], [["L", "R"]], [["T", "R"]], [["T", "L"], ["B", "R"]], [["T", "B"]], [["T", "L"]], [["T", "L"]], [["T", "B"]], [["T", "R"], ["B", "L"]], [["T", "R"]], [["L", "R"]], [["B", "R"]], [["L", "B"]], []];
  const segs = [];
  const at = (i, j) => v[j * w + i];
  const lerp = (pa, pb, va, vb) => { const t = (iso - va) / (vb - va); return [pa[0] + (pb[0] - pa[0]) * t, pa[1] + (pb[1] - pa[1]) * t]; };
  for (let j = 0; j < nz; j++) {
    for (let i = 0; i < nx; i++) {
      const va = at(i, j), vb = at(i + 1, j), vc = at(i + 1, j + 1), vd = at(i, j + 1);
      const idx = (va > iso ? 8 : 0) | (vb > iso ? 4 : 0) | (vc > iso ? 2 : 0) | (vd > iso ? 1 : 0);
      if (!CASES[idx].length) continue;
      const px = x0 + i * step, pz = z0 + j * step;
      // Every crossing is worked out from the same two nodes in the same
      // order whichever square asks, so shared points match exactly.
      const on = {
        T: () => lerp([px, pz], [px + step, pz], va, vb),
        B: () => lerp([px, pz + step], [px + step, pz + step], vd, vc),
        L: () => lerp([px, pz], [px, pz + step], va, vd),
        R: () => lerp([px + step, pz], [px + step, pz + step], vb, vc),
      };
      for (const [e1, e2] of CASES[idx]) segs.push([on[e1](), on[e2]()]);
    }
  }
  // Join the segments end to end into loops.
  const key = (p) => Math.round(p[0] * 1e4) + "," + Math.round(p[1] * 1e4);
  const ends = new Map();
  segs.forEach((s, n) => { for (const p of s) { const k = key(p); if (!ends.has(k)) ends.set(k, []); ends.get(k).push(n); } });
  const used = new Uint8Array(segs.length);
  const loops = [];
  for (let n = 0; n < segs.length; n++) {
    if (used[n]) continue;
    used[n] = 1;
    const loop = [segs[n][0], segs[n][1]];
    let k = key(segs[n][1]);
    for (let guard = 0; guard < segs.length; guard++) {
      const next = (ends.get(k) || []).find((m) => !used[m]);
      if (next === undefined) break;
      used[next] = 1;
      const s = segs[next];
      const p = key(s[0]) === k ? s[1] : s[0];
      loop.push(p);
      k = key(p);
      if (k === key(loop[0])) break;
    }
    if (loop.length >= 4) loops.push(loop);
  }
  return loops;
}

/**
 * A lodestone's field, drawn on the road it pulls on: rings of light that
 * slide in toward the point everything is dragged to, brightest there, and
 * a soft well at that point that breathes. Drawn additively, so it lights
 * the road rather than painting it.
 */
const FIELD_VERT = `
  varying vec3 vPos;
  void main() { vPos = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;
/**
 * A suppressor's field, lying on the ground round it: a dull disc with a
 * firmer rim, and slow bands drifting in toward the middle, as if the air in
 * it were being pressed flat. Drawn additively and faintly, so it greys the
 * ground rather than lighting it.
 */
const HUSH_FRAG = `
  uniform float time; uniform float range; uniform vec3 colour;
  varying vec3 vPos;
  void main() {
    float d = length(vPos.xz);
    float k = d / range;
    float rim = smoothstep(0.9, 0.985, k) * (1.0 - smoothstep(0.985, 1.0, k));
    float bands = pow(0.5 + 0.5 * sin(d * 7.0 + time * 1.4), 6.0) * (1.0 - k) * 0.35;
    float base = 0.06 * (1.0 - k * 0.5);
    float a = rim * 0.55 + bands + base;
    gl_FragColor = vec4(colour * a, a);
  }
`;
const FIELD_FRAG = `
  uniform float time; uniform vec2 anchor; uniform float range; uniform vec3 colour;
  varying vec3 vPos;
  void main() {
    vec2 p = vPos.xz - anchor;
    float d = length(p);
    // Strong at the anchor, gone at the edge of the reach.
    float fade = 1.0 - smoothstep(range * 0.25, range, d);
    // Crests moving inward: the phase grows with distance, so each crest
    // is at a smaller radius a moment later.
    float wave = pow(0.5 + 0.5 * sin(d * 12.0 + time * 6.0), 5.0);
    // Faint spokes turning the other way, so the field has some grain.
    float ang = atan(p.y, p.x);
    float spoke = pow(0.5 + 0.5 * sin(ang * 9.0 - time * 1.5), 8.0) * 0.18 * fade;
    float well = exp(-d * d * 10.0) * (0.75 + 0.25 * sin(time * 3.0));
    float a = wave * 0.85 * fade + spoke + well * 1.0;
    vec3 c = mix(colour, vec3(1.0), well * 0.6 + wave * fade * 0.2);
    gl_FragColor = vec4(c * a, a);
  }
`;

/** The colour a boulder darkens toward as it wears. */
const WORN_STONE = new THREE.Color("#5a5147");
/** The grey a cube in a suppressor's field goes. */
const HUSHED = new THREE.Color("#8a8f99");
/** The door cubes come in by; the one they leave by is the accent. */
const DOOR_IN = "#d7d3d3";
/**
 * The pulse that runs the roads before the first wave: a short run of arrows,
 * how far apart they are and how fast they go in cells, and the rest between
 * one pulse and the next in seconds.
 */
const ARROW_COUNT = 3, ARROW_GAP = 0.5, ARROW_SPEED = 5.5, ARROW_REST = 0.7;
const ARROW_FROM = new THREE.Color(DOOR_IN), ARROW_TO = new THREE.Color("#ff563c");
/** A small seeded random source, for anything drawn the same every time. */
function mulberry(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/** The rim of a Chasm's black hole. */
const HOLE_RIM = "#9a6bff";
/** The green a poisoned cube turns. */
const VENOM = new THREE.Color("#7fb32a");

/** Closed loops of [x, z] points, as shapes lying flat once turned face up. */
function loopShapes(loops) {
  return loops.map((loop) => {
    const shape = new THREE.Shape();
    // A shape turned -90 degrees about x puts its y along -z.
    loop.forEach(([x, z], i) => (i ? shape.lineTo(x, -z) : shape.moveTo(x, -z)));
    shape.closePath();
    return shape;
  });
}

/** How tall a tower body is for a total of `tier` upgrades bought. */
const towerHeight = (tier) => 0.55 + Math.min(tier, 8) * 0.1;

/** Where a tower's shots leave it, matching the models in towerMesh. */
export function muzzleHeight(kind, tier) {
  const h = towerHeight(tier);
  if (kind === "bolt") return 0.12 + h;
  if (kind === "cannon") return 0.12 + h * 0.7 + 0.08;
  if (kind === "burst") return 0.12 + h + 0.2;
  if (kind === "frost") return 0.12 + h * 0.5;
  if (kind === "mint") return 0.12 + 0.45; // the collector; nothing fires from it
  if (kind === "beacon") return 0.12 + h + 0.2; // the dish; nothing fires from it
  if (kind === "tar") return 0.3;               // the surface; nothing fires from it
  if (kind === "lodestone") return 0.12 + h * 0.7 + 0.3; // the stone; nothing fires from it
  if (kind === "urn") return 0.12 + 0.1 + 0.58 * (1.12 + tier * 0.03); // the mouth, where the souls go in
  if (kind === "boulder") return 0.12 + 0.55; // the top of the chute; nothing fires from it
  if (kind === "suppressor") return 0.12 + h * 0.7 + 0.25; // the damper; nothing fires from it
  if (kind === "rift") return 0.12 + 0.62; // the heart of the tear; nothing fires from it
  if (kind === "sapper") return 0.12 + h * 0.55 + 0.1;
  if (kind === "venom") return 0.12 + h * 0.5 + 0.12;
  if (kind === "siege") return 0.12 + h * 0.45 + 0.12;
  if (kind === "arc") return 0.12 + h + 0.2;
  if (kind === "mortar") return 0.79; // the mouth of the tilted tube
  if (kind === "flame") return 0.12 + h * 0.6;
  if (kind === "prism") return 0.12 + h + 0.35;
  return 0.12 + h + 0.4; // sniper
}

/**
 * The 3D view: an isometric camera over a slab of ground with the route
 * cut into it, towers as solid shapes, enemies as blocks and spheres. It
 * reads the simulation each frame and keeps its own meshes in step by id.
 * The camera orbits and zooms; picking goes through the ground plane.
 */
export class Scene {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color("#151312");
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200);
    this.yaw = Math.PI / 4;      // orbit angle
    this.zoom = 1;
    this.target = new THREE.Vector3(0, 0, 0);
    this.raycaster = new THREE.Raycaster();
    this.groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this.pointer = new THREE.Vector2();

    this.scene.add(new THREE.AmbientLight("#ffffff", 0.55));
    const sun = new THREE.DirectionalLight("#fff4ef", 1.15);
    sun.position.set(-9, 16, 7);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const s = 13;
    sun.shadow.camera.left = -s; sun.shadow.camera.right = s;
    sun.shadow.camera.top = s; sun.shadow.camera.bottom = -s;
    sun.shadow.camera.near = 1; sun.shadow.camera.far = 60;
    sun.shadow.bias = -0.0008;
    this.scene.add(sun);
    const fill = new THREE.DirectionalLight("#ffd9cf", 0.2);
    fill.position.set(8, 6, -8);
    this.scene.add(fill);

    // The board is re-centred for each map, since every map has its own size.
    this.cols = COLS;
    this.rows = ROWS;
    this.board = new THREE.Group();
    this.board.position.set(-this.cols / 2, 0, -this.rows / 2);
    this.scene.add(this.board);
    this.world = null;           // group for the current map
    this.towerMeshes = new Map();
    this.enemyMeshes = new Map();
    this.shotMeshes = [];
    this.flashMeshes = [];
    this.ghost = null;
    this.ring = null;
    this.selectBox = null;
    this.chevrons = [];
    this.portals = [];
    this.dropAt = 0;
    this.lastFrame = 0;
    // One pool of small cubes serves death bursts and flame spray.
    this.particles = [];
    this.pool = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial(), 1200);
    this.pool.count = 0;
    this.pool.frustumCulled = false;
    this.board.add(this.pool);
    this.dropOutAt = 0;
    this.dropThen = null;
    // The framing a map was fitted at, and whether the camera will take input.
    this.baseZoom = 1;
    this.locked = false;

    this.geo = {
      shot: new THREE.SphereGeometry(0.07, 8, 6),
      bigShot: new THREE.SphereGeometry(0.12, 8, 6),
      // Shallow, because three of these stack front to back in one track.
      bar: new THREE.BoxGeometry(1, 0.06, 0.03),
    };
    this.mat = {
      shot: {}, bar: new THREE.MeshBasicMaterial({ color: C.ink }), barFill: new THREE.MeshBasicMaterial({ color: C.accent, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -4 }),
      barShield: new THREE.MeshBasicMaterial({ color: "#dceaf7", polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -8 }),
    };
    for (const kind of Object.keys(TOWERS)) this.mat.shot[kind] = new THREE.MeshBasicMaterial({ color: TOWERS[kind].colour });
  }

  fit() {
    const w = this.canvas.clientWidth || 800, h = this.canvas.clientHeight || 600;
    this.renderer.setSize(w, h, false);
    this.aspect = w / h;
    // Re-fit the board to the new shape of the window, keeping however far
    // the player had leaned in.
    const ratio = this.baseZoom ? this.zoom / this.baseZoom : 1;
    this.fitBoard(this.cols, this.rows);
    this.zoom = this.baseZoom * ratio;
    this.updateCamera();
  }

  updateCamera() {
    const view = 7.2 / (this.zoom * (this.zoomAside || 1));
    // The board sits a little left of centre to leave room for the shop.
    const h = this.canvas.clientHeight || 600;
    const shift = ((this.canvas.clientWidth > 900 ? 80 : 0) + (this.panPx || 0)) / h * 2 * view;
    this.camera.left = -view * this.aspect + shift; this.camera.right = view * this.aspect + shift;
    this.camera.top = view; this.camera.bottom = -view;
    const d = 30;
    this.camera.position.set(this.target.x + Math.cos(this.yaw) * d, 26, this.target.z + Math.sin(this.yaw) * d);
    this.camera.lookAt(this.target);
    this.camera.updateProjectionMatrix();
  }
  orbit(delta) { if (this.locked) return; this.turnAt = 0; this.yaw += delta; this.updateCamera(); }
  /**
   * Quarter turns keep the corner-on view; free orbit is for the drag. The
   * turn sweeps round over a moment instead of cutting, and a second press
   * before it lands adds a quarter to where it was headed.
   */
  snap(steps) {
    if (this.locked) return;
    const from = this.turnAt ? this.turnTo : this.yaw;
    this.turnFrom = this.yaw;
    this.turnTo = Math.round((from - Math.PI / 4) / (Math.PI / 2)) * (Math.PI / 2) + Math.PI / 4 + steps * (Math.PI / 2);
    this.turnAt = performance.now();
  }
  /**
   * Drive the pan from held keys: `right` and `up` are the speed wanted, in
   * view heights a second. The camera eases up to it and coasts down again
   * when let go, the way a hand on a mouse starts and stops, rather than
   * moving at full speed from the first frame.
   */
  steer(right, up, dt) {
    const v = this.panVel || (this.panVel = { x: 0, y: 0 });
    const k = 1 - Math.exp(-dt * 9);
    v.x += (right - v.x) * k;
    v.y += (up - v.y) * k;
    if (!right && !up && Math.abs(v.x) < 0.002 && Math.abs(v.y) < 0.002) { v.x = 0; v.y = 0; return; }
    this.panBy(v.x * dt, v.y * dt);
  }
  /** Stop any turn or glide in flight, for a jump straight to a framing. */
  settle() { this.turnAt = 0; if (this.panVel) this.panVel.x = this.panVel.y = 0; }
  zoomBy(factor) {
    if (this.locked) return;
    // Zoom is bounded around whatever framing this map was fitted at, so a
    // small board and a large one both allow the same amount of leaning in.
    this.zoom = Math.min(this.baseZoom * 2.4, Math.max(this.baseZoom * 0.6, this.zoom * factor));
    this.updateCamera();
  }
  /**
   * Slide the camera over the ground, in screen directions whatever the turn:
   * `right` and `up` are in view heights, so a step covers the same share of
   * the screen at any zoom. Up is stretched by the camera's tilt, which
   * squashes depth, so both directions move as fast on screen. The middle of
   * the view stays over the board.
   */
  panBy(right, up) {
    if (this.locked) return;
    const view = 7.2 / (this.zoom * (this.zoomAside || 1));
    const tilt = 26 / Math.hypot(26, 30); // matches the camera's height and distance
    const across = right * view, along = (up * view) / tilt;
    const x = this.target.x + Math.sin(this.yaw) * across - Math.cos(this.yaw) * along;
    const z = this.target.z - Math.cos(this.yaw) * across - Math.sin(this.yaw) * along;
    this.target.set(Math.max(-this.cols / 2, Math.min(this.cols / 2, x)), 0, Math.max(-this.rows / 2, Math.min(this.rows / 2, z)));
    this.updateCamera();
  }
  reset() { if (this.locked) return; this.settle(); this.yaw = Math.PI / 4; this.zoom = this.baseZoom; this.target.set(0, 0, 0); this.updateCamera(); }
  /**
   * Fit the whole board into a strip of the window, from `left` to `right`
   * in CSS pixels, easing over. Measured from the board's own corners at its
   * fitted size, so a long thin route and a small square one both fill the
   * strip without running out of it. The slide is kept in pixels by the
   * camera whatever the zoom, so the middle lands where it is sent.
   */
  frameIn(left, right) {
    const w = this.canvas.clientWidth || 900, h = this.canvas.clientHeight || 600;
    const keepZoom = this.zoom, keepPan = this.panPx || 0, keepAside = this.zoomAside || 1, keepYaw = this.yaw;
    // The whole board is being shown, so any panning the run did is let go.
    this.target.set(0, 0, 0);
    this.yaw = Math.PI / 4; this.zoom = this.baseZoom; this.panPx = 0; this.zoomAside = 1; this.updateCamera();
    const v = new THREE.Vector3();
    let minX = 1, maxX = -1, minY = 1, maxY = -1;
    for (const [x, z] of [[0, 0], [this.cols, 0], [0, this.rows], [this.cols, this.rows]]) {
      v.set(x - this.cols / 2, 0, z - this.rows / 2).project(this.camera);
      minX = Math.min(minX, v.x); maxX = Math.max(maxX, v.x); minY = Math.min(minY, v.y); maxY = Math.max(maxY, v.y);
    }
    this.zoom = keepZoom; this.panPx = keepPan; this.zoomAside = keepAside; this.yaw = keepYaw; this.updateCamera();
    const widthPx = Math.max(1, (maxX - minX) / 2 * w), heightPx = Math.max(1, (maxY - minY) / 2 * h);
    const zoom = Math.min(1.25, ((right - left) * 0.9) / widthPx, (h * 0.84) / heightPx);
    const shop = w > 900 ? 80 : 0; // the lean the camera always gives the board
    this.panTo(Math.round(w / 2 - shop - (left + right) / 2), zoom);
  }
  /** Back to the standard corner-on framing whatever the lock, for the route chooser. */
  frame() { this.settle(); this.yaw = Math.PI / 4; if (this.baseZoom) this.zoom = this.baseZoom; this.target.set(0, 0, 0); this.updateCamera(); }

  /** Hold the camera still: the route chooser shows every map from the same angle. */
  lock(on) { this.locked = !!on; }

  /**
   * Slide the board across the view by that many pixels, to clear a side of
   * the screen for a panel. The board eases over rather than jumping.
   */
  slideBy(px) { this.panTo(px, this.zoomAsideWant || 1); }

  /**
   * Start the board moving to a slide and a size, over a fixed stretch of
   * time. Timed rather than a per-frame fraction of what is left: a fraction
   * is a different curve at every frame rate, so one slow frame changed the
   * shape of the move and it read as a stumble. This runs on the clock, so a
   * dropped frame costs a frame and nothing else, and it starts and stops
   * gently instead of lurching off at full speed.
   */
  panTo(px, zoom) {
    if (px === (this.panWant || 0) && zoom === (this.zoomAsideWant || 1)) return;
    this.panFrom = this.panPx || 0;
    this.zoomAsideFrom = this.zoomAside || 1;
    this.panWant = px;
    this.zoomAsideWant = zoom;
    // Timed from the first frame it is actually drawn on, not from the moment
    // it was asked for: the asking often comes with a panel to build, and the
    // move should not spend its first third waiting behind that work.
    this.panGo = true;
  }

  /**
   * Set the board aside: shrunk to fit the left `fraction` of the view and
   * centred in it, easing over. Zero puts it back where it was. Sized from
   * the board's own corners, so a route twenty cells wide and one nine wide
   * both end up filling the space they are given.
   */
  aside(fraction) {
    if (!fraction) { this.panTo(0, 1); return; }
    const w = this.canvas.clientWidth || 900;
    // Its width on screen at the fitted zoom with no slide, in pixels.
    const keepZoom = this.zoom, keepPan = this.panPx || 0, keepAside = this.zoomAside || 1;
    this.zoom = this.baseZoom; this.panPx = 0; this.zoomAside = 1; this.updateCamera();
    const v = new THREE.Vector3();
    let minX = 1, maxX = -1;
    for (const [x, z] of [[0, 0], [this.cols, 0], [0, this.rows], [this.cols, this.rows]]) {
      v.set(x - this.cols / 2, 0, z - this.rows / 2).project(this.camera);
      minX = Math.min(minX, v.x); maxX = Math.max(maxX, v.x);
    }
    this.zoom = keepZoom; this.panPx = keepPan; this.zoomAside = keepAside; this.updateCamera();
    const extentPx = (maxX - minX) / 2 * w;
    // With no slide the board's centre sits at the middle of the screen, less
    // the room already left for the shop; the frustum moves right by what it
    // takes to put that centre in the middle of the left part.
    const base = w > 900 ? 80 : 0;
    this.panTo(Math.round(w / 2 - fraction * w / 2 - base), Math.min(1, fraction * w * 0.88 / Math.max(1, extentPx)));
  }

  /**
   * Frame a board of this size: the standard corner-on angle, zoomed so the
   * whole board sits inside the viewport with a margin. Orthographic scale is
   * linear, so measuring the corners once at zoom 1 gives the right zoom.
   */
  fitBoard(cols, rows, margin = 0.84) {
    this.cols = cols;
    this.rows = rows;
    this.board.position.x = -cols / 2;
    this.board.position.z = -rows / 2;
    this.yaw = Math.PI / 4;
    this.zoom = 1;
    this.updateCamera();
    const v = new THREE.Vector3();
    let extent = 0;
    for (const [x, z] of [[0, 0], [cols, 0], [0, rows], [cols, rows]]) {
      v.set(x - cols / 2, 0, z - rows / 2).project(this.camera);
      extent = Math.max(extent, Math.abs(v.x), Math.abs(v.y));
    }
    this.baseZoom = extent > 0 ? Math.min(3, Math.max(0.25, margin / extent)) : 1;
    this.zoom = this.baseZoom;
    this.updateCamera();
  }

  /** The board cell under a client point, via the ground plane. */
  cellAt(px, py) {
    const rect = this.canvas.getBoundingClientRect();
    this.pointer.set(((px - rect.left) / rect.width) * 2 - 1, -((py - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hit = new THREE.Vector3();
    if (!this.raycaster.ray.intersectPlane(this.groundPlane, hit)) return null;
    const c = Math.floor(hit.x + this.cols / 2), r = Math.floor(hit.z + this.rows / 2);
    return c >= 0 && c < this.cols && r >= 0 && r < this.rows ? { c, r } : null;
  }

  /**
   * What a tower does to the road it covers, laid on the road itself so it
   * can be seen without selecting anything: a tar pit spreads tar over every
   * road cell it mires, and a lodestone marks the stretch it pulls on with a
   * ring where it pulls everything to. Built with the tower's model and
   * thrown away with it, so a tower that is sold or upgraded takes its
   * markings with it.
   */
  roadWork(t, stats, simulation) {
    const work = new THREE.Group();
    const spread = stats.mire || stats.pull;
    if (!spread) return work;
    const tar = !!stats.mire;
    const cx = t.c + 0.5, cy = t.r + 0.5;
    // Every cell of road inside its reach. Cells, not a circle, so the spill
    // sits on the road squarely and never over the ground beside it. The road
    // tiles stand 0.12 high, so everything here sits just above that.
    const look = tar ? tarLook(t.tiers[0], t.tiers[1]) : null;
    const quads = [];
    const edgeMat = tar ? new THREE.MeshBasicMaterial({ color: look.edge, transparent: true, opacity: look.edgeOpacity, depthWrite: false }) : null;
    // Wet, not polished: a dull sheen, and a glint on a pool that is there if
    // you look rather than a spot of light on every cell.
    const fillMat = tar ? new THREE.MeshPhongMaterial({ color: look.fill, specular: "#2a2a2a", shininess: 30, transparent: true }) : null;
    const poolMat = tar ? new THREE.MeshPhongMaterial({ color: look.pool, specular: "#3a3a3a", shininess: 45, transparent: true }) : null;
    const glintMat = tar ? new THREE.MeshBasicMaterial({ color: look.glint, transparent: true, opacity: 0.16, depthWrite: false }) : null;
    const cells = [];
    for (const cell of simulation.blocked) {
      const [c, r] = cell.split(",").map(Number);
      if (Math.hypot(c + 0.5 - cx, r + 0.5 - cy) > spread.range) continue;
      const x = c + 0.5 - cx, z = r + 0.5 - cy;
      if (!tar) { quads.push([x, z]); continue; }
      // A puddle per cell, all of them joined into one spill below. The
      // spill itself is built in rebuildSpill; here each cell gets a thicker
      // pool off centre with a glint on it, and some spatter round about.
      // All of it shares one spot, by identity, so a gob landing on the cell
      // spreads all of it together. It starts at nothing and is spread by
      // the gobs the pit throws, so the tar is seen to arrive.
      const spot = { x: c + 0.5, z: r + 0.5 };
      // Seeded by the cell, so every puddle has its own shape, size, lean and
      // spatter, and the same one comes back the same after a reload.
      const seed = c * 1.7 + r * 2.9;
      const rnd = (k) => { const v = Math.sin(seed * 12.9898 + k * 78.233) * 43758.5453; return v - Math.floor(v); };
      const size = look.radius * (0.82 + rnd(1) * 0.3);
      const lean = { x: (rnd(3) - 0.5) * 0.16, z: (rnd(4) - 0.5) * 0.16 };
      // Pools lie where the tar happened to gather, not one to a cell in a
      // row: none, one or two in a cell, pushed well off centre along the run
      // of the road, which the spill fills, and only a little across it,
      // which it does not.
      const road = simulation.blocked;
      const run = {
        x: road.has((c - 1) + "," + r) || road.has((c + 1) + "," + r) ? 0.75 : 0.22,
        z: road.has(c + "," + (r - 1)) || road.has(c + "," + (r + 1)) ? 0.75 : 0.22,
      };
      const parts = [];
      const count = rnd(12) < 0.22 ? 0 : rnd(13) < 0.4 ? 2 : 1;
      let ox = lean.x, oz = lean.z;
      for (let j = 0; j < count; j++) {
        const px = lean.x + (rnd(14 + j * 3) - 0.5) * run.x, pz = lean.z + (rnd(15 + j * 3) - 0.5) * run.z;
        const pr = size * (0.18 + rnd(16 + j * 3) * 0.3);
        const pool = new THREE.Mesh(new THREE.CircleGeometry(pr, 16), poolMat);
        pool.position.set(x + px, 0.137, z + pz);
        const glint = new THREE.Mesh(new THREE.CircleGeometry(pr * 0.3, 10), glintMat);
        glint.position.set(x + px - pr * 0.35, 0.14, z + pz - pr * 0.3);
        parts.push(pool, glint);
        if (j === 0) { ox = px; oz = pz; }
      }
      // Spatter: a few small drops flung past the edge of most puddles.
      const drops = Math.floor(rnd(9) * 4);
      for (let k = 0; k < drops; k++) {
        const ang = rnd(10 + k) * Math.PI * 2, dist = size * (1.15 + rnd(20 + k) * 0.35);
        const dr = 0.03 + rnd(30 + k) * 0.05;
        const dx = Math.min(0.47, Math.max(-0.47, lean.x + Math.cos(ang) * dist));
        const dz = Math.min(0.47, Math.max(-0.47, lean.z + Math.sin(ang) * dist));
        const dropEdge = new THREE.Mesh(new THREE.CircleGeometry(dr * 1.3, 8), edgeMat);
        const drop = new THREE.Mesh(new THREE.CircleGeometry(dr, 8), fillMat);
        dropEdge.position.set(x + dx, 0.131, z + dz);
        drop.position.set(x + dx, 0.134, z + dz);
        parts.push(dropEdge, drop);
      }
      // Corrosive tar works: slow bubbles stand on the pool.
      for (let k = 0; k < t.tiers[1]; k++) {
        const ang = k * 2.1 + seed, rad = size * (0.15 + (k % 2) * 0.15);
        const bubble = new THREE.Mesh(new THREE.SphereGeometry(0.03 + (k % 2) * 0.012, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2), poolMat);
        bubble.position.set(x + ox + Math.cos(ang) * rad, 0.137, z + oz + Math.sin(ang) * rad);
        parts.push(bubble);
      }
      for (const part of parts) {
        if (part.geometry.type !== "SphereGeometry") part.rotation.x = -Math.PI / 2;
        part.raycast = () => {};
        part.scale.set(0.01, 0.01, 0.01);
        part.userData.spot = spot;
        work.add(part);
      }
      const marker = new THREE.Object3D();
      marker.scale.set(0.01, 0.01, 0.01);
      marker.userData.spot = spot;
      work.add(marker);
      cells.push({ x: x + lean.x, z: z + lean.z, size, seed, spot, cover: 0 });
      work.userData.spots = work.userData.spots || [];
      work.userData.spots.push(marker);
    }
    if (tar) {
      // The spill: one outline for every cell together, and a lighter, wider
      // one under it for the edge. Their shapes are rebuilt as the tar lands.
      const edge = new THREE.Mesh(new THREE.BufferGeometry(), edgeMat);
      const fill = new THREE.Mesh(new THREE.BufferGeometry(), fillMat);
      edge.position.y = 0.131; fill.position.y = 0.134;
      for (const part of [edge, fill]) { part.rotation.x = -Math.PI / 2; part.raycast = () => {}; work.add(part); }
      const road = simulation.blocked;
      work.userData.spill = { edge, fill, cells, onRoad: (x, z) => road.has(Math.floor(x + cx) + "," + Math.floor(z + cy)) };
      this.rebuildSpill(work);
    }
    if (tar) work.userData.look = look;
    if (tar) work.userData.tarred = true;
    // A lodestone drags everything to one point on the road: its field is
    // one flat mesh over every road cell it reaches, lit by the shader from
    // that point outward. Built as raw quads in the tower's own frame so the
    // shader can measure from the anchor directly.
    if (!tar && quads.length) {
      const anchor = t.anchorAt || { x: cx, y: cy };
      const pos = [];
      // Above every part of a tar spill, whose glint tops out at 0.14: a pit
      // and a lodestone often cover the same stretch of road, and the light
      // is the field's whole point, so it goes over the tar rather than under
      // it. Still well under the cubes, which walk from 0.12 up.
      const y = 0.145;
      for (const [x, z] of quads) {
        const h = 0.5;
        pos.push(x - h, y, z - h, x + h, y, z - h, x + h, y, z + h, x - h, y, z - h, x + h, y, z + h, x - h, y, z + h);
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
      const field = new THREE.Mesh(geo, new THREE.ShaderMaterial({
        vertexShader: FIELD_VERT, fragmentShader: FIELD_FRAG,
        uniforms: { time: { value: 0 }, anchor: { value: new THREE.Vector2(anchor.x - cx, anchor.y - cy) }, range: { value: spread.range }, colour: { value: new THREE.Color(TOWERS[t.kind].colour) } },
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      }));
      field.raycast = () => {};
      work.add(field);
      work.userData.field = field;
    }
    return work;
  }

  /**
   * Retrace a spill from how far each of its cells is covered. Cheap enough
   * to do on every landing, which is the only time it changes.
   */
  rebuildSpill(work) {
    const s = work.userData.spill;
    if (!s) return;
    const live = s.cells.filter((c) => c.cover > 0);
    for (const [mesh, iso] of [[s.fill, 0.5], [s.edge, 0.3]]) {
      mesh.geometry.dispose();
      const shapes = live.length ? loopShapes(spillOutline(live, s.onRoad, iso)) : [];
      mesh.geometry = shapes.length ? new THREE.ShapeGeometry(shapes) : new THREE.BufferGeometry();
    }
  }

  /**
   * A tar pit at work: it bubbles in its basin, and every so often throws a
   * gob out over the road. The gob is a pooled mote given the exact velocity
   * to land on the cell it is aimed at, and the landing is booked for when it
   * gets there, so the splat happens where and when the gob arrives rather
   * than being faked at the moment of throwing.
   */
  tarWork(t, work, dt) {
    const spots = work.userData.spots;
    if (!spots || !spots.length) return;
    const look = work.userData.look;
    const cx = t.c + 0.5, cz = t.r + 0.5;
    // Bubbling: blobs swelling out of the basin and falling back into it.
    work.userData.bubble = (work.userData.bubble || 0) + dt * 7;
    while (work.userData.bubble >= 1) {
      work.userData.bubble -= 1;
      const a = Math.random() * Math.PI * 2, r = Math.random() * 0.22;
      this.particle({
        x: cx + Math.cos(a) * r, y: 0.3, z: cz + Math.sin(a) * r,
        vx: Math.cos(a) * 0.2, vy: 0.7 + Math.random() * 0.7, vz: Math.sin(a) * 0.2,
        life: 0.42, size: 0.045 + Math.random() * 0.04, gravity: 9,
        colour: look.drip, colour2: look.fill,
      });
    }
    // Throwing: one gob at a time, at whichever cell is least covered.
    work.userData.spit = (work.userData.spit || 0.4) - dt;
    if (work.userData.spit > 0) return;
    // Aim at whichever cell has least on it, so the spill spreads evenly and
    // the road is covered in a few seconds. Once it is all covered the pit
    // keeps throwing, but idly: the splats are then only for the look of it.
    let aim = spots[0];
    for (const s of spots) if (s.scale.x < aim.scale.x) aim = s;
    const full = aim.scale.x >= 1;
    work.userData.spit = full ? 1.2 + Math.random() * 0.8 : 0.28 + Math.random() * 0.16;
    // While spreading, a gob lands on the middle of the cell it is filling.
    // Once the spill is whole it lands anywhere on it: any cell, and any
    // point within that cell's puddle, so the splats wander over the tar.
    let tx = aim.userData.spot.x, tz = aim.userData.spot.z;
    const spill = work.userData.spill;
    if (full && spill) {
      aim = spots[Math.floor(Math.random() * spots.length)];
      const cell = spill.cells.find((c) => c.spot === aim.userData.spot);
      const a = Math.random() * Math.PI * 2, r = Math.random() * cell.size * 0.7;
      tx = cx + cell.x + Math.cos(a) * r;
      tz = cz + cell.z + Math.sin(a) * r;
    }
    const flight = 0.52;
    const g = 12;
    const dx = tx - cx, dz = tz - cz, dy = 0.14 - 0.32;
    this.particle({
      x: cx, y: 0.32, z: cz,
      vx: dx / flight, vy: (dy + 0.5 * g * flight * flight) / flight, vz: dz / flight,
      // Gone the instant it lands: the splat takes over from there.
      life: flight, size: 0.12, gravity: g, freeFlight: true,
      colour: look.drip, colour2: look.fill,
    });
    (this.tarDue = this.tarDue || []).push({ left: flight, x: tx, z: tz, part: aim, work });
  }

  /** The gobs that have landed since the last frame: each one spreads and splats. */
  tarLandings() {
    if (!this.tarDue || !this.tarDue.length) return;
    const still = [];
    for (const due of this.tarDue) {
      due.left -= this.dt;
      if (due.left > 0) { still.push(due); continue; }
      // Spread: the puddle takes a big step toward full size, so the first
      // gob makes a puddle you can see and the second finishes it.
      for (const part of due.work.children) {
        if (!part.userData.spot || part.userData.spot !== due.part.userData.spot) continue;
        const to = Math.min(1, part.scale.x + 0.6);
        part.scale.set(to, to, to);
      }
      const cell = due.work.userData.spill && due.work.userData.spill.cells.find((c) => c.spot === due.part.userData.spot);
      if (cell) { cell.cover = Math.min(1, cell.cover + 0.6); this.rebuildSpill(due.work); }
      // Splat: a ring that races out over the road, and low, flat droplets
      // thrown out from where it hit, in the tar's lighter edge colour so
      // they show against the road.
      const look = due.work.userData.look || tarLook(0, 0);
      this.shockRing(due.x, due.z, 0.5, look.edge);
      for (let i = 0; i < 14; i++) {
        const a = Math.random() * Math.PI * 2, sp = 0.6 + Math.random() * 1.3;
        this.particle({
          x: due.x, y: 0.16, z: due.z, vx: Math.cos(a) * sp, vy: 0.6 + Math.random() * 0.9, vz: Math.sin(a) * sp,
          life: 0.35 + Math.random() * 0.25, size: 0.05 + Math.random() * 0.045, gravity: 14,
          colour: i % 3 ? look.drip : look.glint, colour2: look.fill,
        });
      }
    }
    this.tarDue = still;
  }

  /**
   * The id of the enemy under a client point, or null. Only the cube itself
   * answers: its health bar and the light around a mutated one are not part
   * of what can be clicked.
   */
  enemyAt(px, py) {
    if (!this.enemyMeshes.size) return null;
    const rect = this.canvas.getBoundingClientRect();
    this.pointer.set(((px - rect.left) / rect.width) * 2 - 1, -((py - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    for (const hit of this.raycaster.intersectObjects([...this.enemyMeshes.values()], true)) {
      let o = hit.object;
      while (o && o.userData.eid === undefined) o = o.parent;
      if (o && o.visible) return o.userData.eid;
    }
    return null;
  }

  /**
   * The id of the tower whose model is under a client point, or null. A tall
   * tower stands well clear of the cell it occupies, so picking one by the
   * ground under the pointer meant aiming at its feet and missing the thing
   * itself.
   */
  towerAt(px, py) {
    if (!this.towerMeshes.size) return null;
    const rect = this.canvas.getBoundingClientRect();
    this.pointer.set(((px - rect.left) / rect.width) * 2 - 1, -((py - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    for (const hit of this.raycaster.intersectObjects([...this.towerMeshes.values()], true)) {
      let o = hit.object;
      while (o && o.userData.tid === undefined) o = o.parent;
      if (o && o.visible) return o.userData.tid;
    }
    return null;
  }

  /** Where a point on the board (cell units, height h) lands on the canvas, in CSS pixels. */
  project(x, z, h) {
    const v = new THREE.Vector3(x, h, z);
    this.board.localToWorld(v);
    v.project(this.camera);
    const rect = this.canvas.getBoundingClientRect();
    return { x: rect.left + (v.x + 1) / 2 * rect.width, y: rect.top + (1 - v.y) / 2 * rect.height };
  }

  // ---- The map ---------------------------------------------------------
  buildWorld(simulation) {
    if (this.world) this.board.remove(this.world);
    for (const m of this.towerMeshes.values()) this.board.remove(m);
    for (const m of this.enemyMeshes.values()) this.board.remove(m);
    this.tarDue = [];
    for (const m of this.mineMeshes || []) this.board.remove(m);
    this.mineMeshes = [];
    this.towerMeshes.clear(); this.enemyMeshes.clear(); this.particles = [];
    this.world = new THREE.Group();
    const { cols, rows } = sizeOf(simulation.map);
    // Ground slab with a bevelled darker rim below.
    const slab = new THREE.Mesh(new THREE.BoxGeometry(cols, 0.6, rows), new THREE.MeshLambertMaterial({ color: C.ground }));
    slab.position.set(cols / 2, -0.3, rows / 2);
    slab.receiveShadow = true;
    this.world.add(slab);
    const rim = new THREE.Mesh(new THREE.BoxGeometry(cols + 0.6, 0.35, rows + 0.6), new THREE.MeshLambertMaterial({ color: C.groundEdge }));
    rim.position.set(cols / 2, -0.75, rows / 2);
    this.world.add(rim);
    // Grid lines as thin dark strips.
    const lineMat = new THREE.MeshBasicMaterial({ color: C.grid });
    for (let c = 1; c < cols; c++) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.01, rows), lineMat); l.position.set(c, 0.005, rows / 2); this.world.add(l); }
    for (let r = 1; r < rows; r++) { const l = new THREE.Mesh(new THREE.BoxGeometry(cols, 0.01, 0.02), lineMat); l.position.set(cols / 2, 0.005, r); this.world.add(l); }
    // Route cells sunk slightly and lighter, with a kerb.
    const routeMat = new THREE.MeshLambertMaterial({ color: C.route });
    const kerbMat = new THREE.MeshLambertMaterial({ color: C.routeEdge });
    this.blocked = simulation.blocked;
    for (const key of simulation.blocked) {
      const [c, r] = key.split(",").map(Number);
      const tile = new THREE.Mesh(new THREE.BoxGeometry(1, 0.12, 1), routeMat);
      tile.position.set(c + 0.5, 0.06, r + 0.5);
      tile.receiveShadow = true;
      this.world.add(tile);
      const kerb = new THREE.Mesh(new THREE.BoxGeometry(1.04, 0.04, 1.04), kerbMat);
      kerb.position.set(c + 0.5, 0.02, r + 0.5);
      this.world.add(kerb);
    }
    // The props: each its own little group on its cell, turned and nudged a
    // touch so a grove does not stand in ranks.
    this.propMeshes = new Map();
    this.propRun = null;
    for (const [key, prop] of simulation.props) {
      const [c, r] = key.split(",").map(Number);
      const rand = mulberry(c * 73856093 ^ r * 19349663 ^ prop.kind.length);
      const m = this.propMesh(prop.kind, prop.glow, rand);
      m.position.set(c + 0.5 + (rand() - 0.5) * 0.1, 0, r + 0.5 + (rand() - 0.5) * 0.1);
      if (prop.kind !== "pillar") m.rotation.y = rand() * Math.PI * 2;
      m.userData.glow = prop.glow;
      m.userData.phase = rand() * Math.PI * 2;
      this.world.add(m);
      this.propMeshes.set(key, m);
    }
    // Doorways where each road enters and leaves the board. Routes that come
    // in or go out at the same place share one door.
    const dirAt = (a, b) => { const dx = b.x - a.x, dz = b.y - a.y, l = Math.hypot(dx, dz) || 1; return { x: dx / l, z: dz / l }; };
    const edgePoint = (p, dir) => {
      // Slide p along dir until it sits on the board boundary.
      let x = p.x, z = p.y;
      for (let k = 0; k < 400 && (x < 0 || x > cols || z < 0 || z > rows); k++) { x += dir.x * 0.1; z += dir.z * 0.1; }
      return { x: Math.min(cols, Math.max(0, x)), z: Math.min(rows, Math.max(0, z)) };
    };
    const ends = [], doorAt = new Map();
    const doorFor = (at, dir, label) => {
      const key = label + ":" + at.x.toFixed(2) + "," + at.z.toFixed(2);
      if (!doorAt.has(key)) {
        doorAt.set(key, ends.length);
        ends.push(label === "IN"
          ? { at, dir, colour: DOOR_IN, glow: "#eae7e7", label }
          : { at, dir, colour: C.accent, glow: "#ff9783", label });
      }
      return doorAt.get(key);
    };
    // For each route: its two doors, and where along it each stands, so a
    // cube takes shape past the first and fades before the second.
    this.routeDoors = simulation.routes.map((route) => {
      const pts = route.path.points;
      const inDir = dirAt(pts[0], pts[1]);
      const outDir = dirAt(pts[pts.length - 2], pts[pts.length - 1]);
      const inAt = edgePoint(pts[0], inDir);
      const outAt = edgePoint(pts[pts.length - 1], { x: -outDir.x, z: -outDir.z });
      return {
        inDoor: doorFor(inAt, inDir, "IN"),
        outDoor: doorFor(outAt, outDir, "OUT"),
        doorIn: Math.hypot(inAt.x - pts[0].x, inAt.z - pts[0].y),
        doorOut: route.path.total - Math.hypot(pts[pts.length - 1].x - outAt.x, pts[pts.length - 1].y - outAt.z),
      };
    });
    this.chevrons = [];
    this.portals = [];
    this.doorLabels = [];
    // The door frames as solid boxes for falling cubes to bump into.
    this.doorBoxes = ends.map((end) => ({ cx: end.at.x, cz: end.at.z, hx: end.dir.x ? 0.14 : 0.72, hz: end.dir.z ? 0.14 : 0.72, top: 1.62 }));
    for (const end of ends) {
      const yaw = -Math.atan2(end.dir.z, end.dir.x);
      // The door: two posts, a lintel, a cap, and a soft curtain inside.
      const door = new THREE.Group();
      const frameMat = new THREE.MeshLambertMaterial({ color: end.colour });
      for (const side of [-0.55, 0.55]) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.18, 1.5, 0.18), frameMat);
        post.position.set(0, 0.75, side); post.castShadow = true; door.add(post);
      }
      const lintel = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.18, 1.28), frameMat);
      lintel.position.set(0, 1.5, 0); lintel.castShadow = true; door.add(lintel);
      const cap = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.1, 1.5), frameMat);
      cap.position.set(0, 1.62, 0); door.add(cap);
      // The portal: a soft curtain and two slowly turning rings inside the
      // frame, which pulse as something comes through.
      const curtain = new THREE.Mesh(new THREE.PlaneGeometry(0.94, 1.36), new THREE.MeshBasicMaterial({ color: end.glow, transparent: true, opacity: 0.18, side: THREE.DoubleSide, depthWrite: false }));
      curtain.rotation.y = Math.PI / 2; curtain.position.set(0, 0.82, 0); door.add(curtain);
      const ringA = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.035, 8, 40), new THREE.MeshBasicMaterial({ color: end.glow, transparent: true, opacity: 0.7 }));
      const ringB = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.03, 8, 40), new THREE.MeshBasicMaterial({ color: end.colour, transparent: true, opacity: 0.7 }));
      ringA.rotation.y = ringB.rotation.y = Math.PI / 2;
      ringA.position.set(0, 0.82, 0); ringB.position.set(0, 0.82, 0);
      door.add(ringA, ringB);
      this.portals.push({ curtain, ringA, ringB, pulse: 0 });
      const label = this.labelSprite(end.label, end.colour);
      label.position.set(0, 2.05, 0); door.add(label);
      this.doorLabels.push(label);
      door.position.set(end.at.x, 0.12, end.at.z);
      door.rotation.y = yaw;
      this.world.add(door);
    }
    // A pulse of a few arrows that runs each road from its way in to its way
    // out, shading from the door it left toward the one it is making for,
    // until the first wave starts. Every road pulses on the same beat, so
    // roads that share a door run together until they part.
    const arrow = new THREE.Shape();
    arrow.moveTo(-0.18, -0.3); arrow.lineTo(0.12, 0); arrow.lineTo(-0.18, 0.3); arrow.lineTo(-0.02, 0); arrow.closePath();
    const arrowGeo = new THREE.ShapeGeometry(arrow);
    this.walkers = [];
    this.routeDoors.forEach((doors, ri) => {
      for (let k = 0; k < ARROW_COUNT; k++) {
        const mesh = new THREE.Mesh(arrowGeo, new THREE.MeshBasicMaterial({ color: DOOR_IN, transparent: true, opacity: 0, depthWrite: false }));
        mesh.rotation.x = -Math.PI / 2;
        mesh.raycast = () => {};
        this.world.add(mesh);
        this.walkers.push({ mesh, route: ri, behind: k });
      }
    });
    // Keeping the pulses together where roads share ground: roads out of one
    // door set off together, so they run as one until they part; roads into
    // one door are held back by how much shorter they are, so they reach the
    // shared stretch at the same moment and run it as one.
    const lengths = this.routeDoors.map((doors) => doors.doorOut - doors.doorIn);
    this.pulseLongest = Math.max(...lengths);
    const oneWayIn = new Set(this.routeDoors.map((doors) => doors.inDoor)).size === 1;
    this.routeDoors.forEach((doors, i) => { doors.lag = oneWayIn ? 0 : this.pulseLongest - lengths[i]; });
    this.pulseEvery = this.pulseLongest / ARROW_SPEED + ARROW_REST;
    // Range ring and ghost live in the world group too.
    this.ring = new THREE.Mesh(new THREE.RingGeometry(0.96, 1, 64), new THREE.MeshBasicMaterial({ color: C.accent, transparent: true, opacity: 0.6, side: THREE.DoubleSide }));
    this.ring.rotation.x = -Math.PI / 2; this.ring.position.y = 0.14; this.ring.visible = false;
    this.ringFill = new THREE.Mesh(new THREE.CircleGeometry(1, 64), new THREE.MeshBasicMaterial({ color: C.accent, transparent: true, opacity: 0.07 }));
    this.ringFill.rotation.x = -Math.PI / 2; this.ringFill.position.y = 0.13; this.ringFill.visible = false;
    this.world.add(this.ring, this.ringFill);
    this.board.add(this.world);
    this.target.set(0, 0, 0);
    this.updateCamera();
  }

  /**
   * A prop in the board's own look: dark faceted shapes lit by the sun, with
   * lines and cores of neon in the map's glow. `rand` keeps each one different
   * and the same every time the map is built.
   */
  propMesh(kind, glow, rand) {
    const g = new THREE.Group();
    if (!this.propMats) {
      this.propMats = {
        bark: new THREE.MeshLambertMaterial({ color: "#302b28", flatShading: true }),
        leaf: new THREE.MeshLambertMaterial({ color: "#2a2624", flatShading: true }),
        stone: new THREE.MeshLambertMaterial({ color: "#3d3937", flatShading: true }),
        slab: new THREE.MeshLambertMaterial({ color: "#1f1c1b", flatShading: true }),
        rock: new THREE.MeshLambertMaterial({ color: "#48423f", flatShading: true }),
      };
      this.glowMats = new Map();
    }
    const M = this.propMats;
    const mat = (name, make) => { if (!this.glowMats.has(name)) this.glowMats.set(name, make()); return this.glowMats.get(name); };
    const lit = mat("lit" + glow, () => new THREE.MeshBasicMaterial({ color: glow }));
    const lines = mat("line" + glow, () => new THREE.LineBasicMaterial({ color: glow, transparent: true, opacity: 0.85 }));
    const shard = mat("shard" + glow, () => new THREE.MeshLambertMaterial({ color: new THREE.Color(glow).multiplyScalar(0.35), emissive: glow, emissiveIntensity: 0.75, flatShading: true }));
    const halo = mat("halo" + glow, () => new THREE.MeshBasicMaterial({ color: glow, transparent: true, opacity: 0.12, depthWrite: false, blending: THREE.AdditiveBlending }));
    const solid = (geo, m, y) => { const mesh = new THREE.Mesh(geo, m); mesh.position.y = y; mesh.castShadow = true; mesh.receiveShadow = true; g.add(mesh); return mesh; };
    // Neon traced along a shape's hard edges.
    const edged = (mesh) => { mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry, 20), lines)); return mesh; };
    const pool = (radius) => { const d = new THREE.Mesh(new THREE.CircleGeometry(radius, 24), halo); d.rotation.x = -Math.PI / 2; d.position.y = 0.012; g.add(d); };

    if (kind === "tree") {
      const h = 0.16 + rand() * 0.14;
      solid(new THREE.CylinderGeometry(0.03, 0.05, h, 5), M.bark, h / 2);
      if (rand() < 0.6) {
        // Stacked cones, narrowing to a point.
        let y = h, radius = 0.28 + rand() * 0.08;
        for (let i = 0, n = 2 + (rand() < 0.4 ? 1 : 0); i < n; i++) {
          const cone = edged(solid(new THREE.ConeGeometry(radius, 0.36, 6), M.leaf, y + 0.18));
          cone.rotation.y = rand() * Math.PI;
          y += 0.2; radius *= 0.72;
        }
        if (rand() < 0.35) solid(new THREE.OctahedronGeometry(0.035, 0), lit, y + 0.2);
      } else {
        // A faceted ball on a stalk.
        const orb = edged(solid(new THREE.IcosahedronGeometry(0.22 + rand() * 0.07, 0), M.leaf, h + 0.2));
        orb.scale.y = 1.1 + rand() * 0.2;
      }
    } else if (kind === "crystal") {
      // A cluster of long shards leaning out from one root, glowing from inside.
      pool(0.36);
      for (let i = 0, n = 3 + Math.floor(rand() * 2); i < n; i++) {
        const tall = 0.35 + rand() * 0.4;
        const s = solid(new THREE.OctahedronGeometry(0.09, 0), shard, tall * 0.5);
        s.scale.set(1, tall / 0.18, 1);
        const a = rand() * Math.PI * 2, lean = i === 0 ? 0 : 0.25 + rand() * 0.3;
        s.position.x = Math.cos(a) * (i === 0 ? 0 : 0.1);
        s.position.z = Math.sin(a) * (i === 0 ? 0 : 0.1);
        s.rotation.set(Math.sin(a) * lean, 0, -Math.cos(a) * lean);
      }
      g.userData.pulse = shard;
    } else if (kind === "pillar") {
      // A hex column on a plinth with a band of neon; now and then broken off.
      const broken = rand() < 0.35;
      const h = broken ? 0.35 + rand() * 0.2 : 0.8 + rand() * 0.25;
      solid(new THREE.BoxGeometry(0.44, 0.08, 0.44), M.stone, 0.04);
      edged(solid(new THREE.CylinderGeometry(0.14, 0.16, h, 6), M.stone, 0.08 + h / 2));
      solid(new THREE.CylinderGeometry(0.168, 0.168, 0.035, 6), lit, 0.08 + h * 0.62);
      if (broken) {
        const chunk = solid(new THREE.CylinderGeometry(0.13, 0.14, 0.18, 6), M.stone, 0.06);
        chunk.position.set(0.24, 0.07, 0.12);
        chunk.rotation.set(0, rand(), Math.PI / 2);
      } else {
        edged(solid(new THREE.BoxGeometry(0.4, 0.07, 0.4), M.stone, 0.08 + h + 0.035));
      }
    } else if (kind === "monolith") {
      // A tall dark slab with one line of neon run down its face.
      pool(0.34);
      const h = 1 + rand() * 0.45;
      const slab = new THREE.Group();
      const body = solid(new THREE.BoxGeometry(0.34, h, 0.12), M.slab, h / 2);
      edged(body);
      g.remove(body); slab.add(body);
      const seam = new THREE.Mesh(new THREE.BoxGeometry(0.03, h * 0.78, 0.126), lit);
      seam.position.y = h * 0.48;
      slab.add(seam);
      slab.rotation.z = (rand() - 0.5) * 0.14;
      g.add(slab);
    } else {
      // A heap of rocks, one shard among them still lit.
      for (let i = 0, n = 2 + Math.floor(rand() * 2); i < n; i++) {
        const size = 0.09 + rand() * 0.08;
        const rock = solid(new THREE.IcosahedronGeometry(size, 0), M.rock, size * 0.6);
        rock.position.x = (rand() - 0.5) * 0.36;
        rock.position.z = (rand() - 0.5) * 0.36;
        rock.scale.y = 0.7;
        rock.rotation.set(rand() * 3, rand() * 3, rand() * 3);
      }
      const s = solid(new THREE.OctahedronGeometry(0.05, 0), shard, 0.06);
      s.scale.y = 2.2;
      s.rotation.z = 0.4;
    }
    return g;
  }

  /**
   * Props stand still, crystals breathe, and the one picked sways a little.
   * One that has just been cleared crumbles away; a new run on the same board
   * puts every prop back without any of that.
   */
  syncProps(simulation, view) {
    if (!this.propMeshes) return;
    const fresh = this.propRun !== simulation;
    this.propRun = simulation;
    const now = performance.now() / 1000;
    const pulsed = new Set();
    for (const [key, m] of this.propMeshes) {
      const u = m.userData;
      if (simulation.props.has(key)) {
        m.visible = true; u.fellAt = 0;
        const picked = view && view.prop === key;
        m.scale.setScalar(picked ? 1.06 + Math.sin(now * 6) * 0.03 : 1);
        if (u.pulse && !pulsed.has(u.pulse)) { pulsed.add(u.pulse); u.pulse.emissiveIntensity = 0.65 + Math.sin(now * 1.7) * 0.2; }
        continue;
      }
      if (!m.visible) continue;
      if (fresh) { m.visible = false; continue; }
      if (!u.fellAt) { u.fellAt = now; this.fellProp(m); }
      const k = Math.max(0, 1 - (now - u.fellAt) / 0.35);
      m.scale.set(k, k * k, k); // squashing down as it goes
      if (k <= 0) m.visible = false;
    }
  }

  /** A prop cleared: chips of it thrown up, sparks of its glow, and a ring. */
  fellProp(m) {
    const p = m.position;
    for (let i = 0; i < 24; i++) {
      const a = Math.random() * Math.PI * 2, sp = 0.6 + Math.random() * 1.8;
      this.particle({
        x: p.x + Math.cos(a) * 0.15, y: 0.15 + Math.random() * 0.5, z: p.z + Math.sin(a) * 0.15,
        vx: Math.cos(a) * sp, vy: 1 + Math.random() * 2.4, vz: Math.sin(a) * sp,
        life: 0.45 + Math.random() * 0.35, size: 0.035 + Math.random() * 0.05, gravity: 9,
        colour: i % 3 === 0 ? m.userData.glow : "#4a4442",
      });
    }
    this.shockRing(p.x, p.z, 0.6, m.userData.glow);
  }

  /** Start the slide-in: the board rises from below over most of a second. */
  /** Put the board away at once, with no animation: nothing is being shown. */
  hideBoard() {
    this.dropAt = 0;
    this.dropOutAt = 0;
    this.dropThen = null;
    this.board.position.y = -22;
  }

  dropIn() { this.dropAt = performance.now(); this.dropOutAt = 0; this.board.position.y = -22; }
  /** Sink the board out of view, then run `then` (which should dropIn). */
  dropOut(then) {
    if (!this.world || this.board.position.y < -21) { then(); return; }
    this.dropOutAt = performance.now();
    this.dropFrom = this.board.position.y;
    this.dropThen = then;
    this.dropAt = 0;
  }

  /**
   * A turntable: one tower drawn live into a canvas of its own and turning
   * slowly. Built once for a canvas and then fed a kind at a time, so the
   * screen where a run's towers are chosen can show the thing itself rather
   * than a picture of it.
   */
  showcase(canvas) {
    if (this.show && this.show.canvas === canvas) return;
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    const rig = new THREE.Scene();
    rig.add(new THREE.AmbientLight("#ffffff", 0.72));
    const sun = new THREE.DirectionalLight("#fff4ef", 1.35); sun.position.set(-4, 8, 5); rig.add(sun);
    const fill = new THREE.DirectionalLight("#ffd9cf", 0.32); fill.position.set(5, 3, -5); rig.add(fill);
    // A warm rim from behind, so the edges of the model catch the light.
    const rim = new THREE.DirectionalLight("#ff9783", 0.75); rim.position.set(3, 4, -6); rig.add(rim);
    // The table it stands on: a dark disc with two rings that turn the other
    // way to the tower.
    const disc = new THREE.Mesh(new THREE.CircleGeometry(0.88, 56), new THREE.MeshLambertMaterial({ color: "#1c1918" }));
    disc.rotation.x = -Math.PI / 2; disc.position.y = -0.004; rig.add(disc);
    const rings = [];
    for (const [r, opacity] of [[0.56, 0.6], [0.78, 0.28]]) {
      const ring = new THREE.Mesh(new THREE.RingGeometry(r - 0.014, r, 72), new THREE.MeshBasicMaterial({ color: C.accent, transparent: true, opacity, side: THREE.DoubleSide, depthWrite: false }));
      ring.rotation.x = -Math.PI / 2; ring.position.y = 0.004; rig.add(ring); rings.push(ring);
    }
    // A few ticks round the outer ring, so its turning can be seen.
    // The ring lies flat, so in its own space the plane is XY and its
    // children turn with it about z.
    for (let k = 0; k < 12; k++) {
      const tick = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.012, 0.004), new THREE.MeshBasicMaterial({ color: C.accent, transparent: true, opacity: 0.5 }));
      const a = (k / 12) * Math.PI * 2;
      tick.position.set(Math.cos(a) * 0.84, Math.sin(a) * 0.84, 0);
      tick.rotation.z = a;
      rings[1].add(tick);
    }
    const camera = new THREE.OrthographicCamera(-1, 1, 1.45, -0.55, 0.1, 60);
    camera.position.set(6, 5.2, 6);
    camera.lookAt(0, 0.5, 0);
    this.show = { canvas, renderer, rig, camera, rings, mesh: null, kind: null, spin: -Math.PI / 5, pop: 0, w: 0, h: 0 };
    // Should the context go anyway, the next tower put on the table builds a
    // fresh one rather than drawing into a dead canvas.
    canvas.addEventListener("webglcontextlost", (e) => { e.preventDefault(); if (this.show && this.show.canvas === canvas) { this.show.renderer.dispose(); this.show = null; } });
  }

  /** Put a tower on the turntable, or clear it with a null kind. */
  showcaseSet(kind, tiers = [0, 0]) {
    const show = this.show;
    if (!show) return;
    if (show.kind === kind && show.mesh) return;
    if (show.mesh) show.rig.remove(show.mesh);
    show.kind = kind || null;
    show.mesh = kind && TOWERS[kind] ? this.towerMesh(kind, tiers, false) : null;
    if (show.mesh) { show.rig.add(show.mesh); show.pop = 1; }
    if (show.canvas) show.canvas.style.visibility = show.mesh ? "visible" : "hidden";
  }

  /** Draw the turntable. Called every frame while the panel is up. */
  drawShowcase(dt) {
    const show = this.show;
    if (!show || !show.mesh) return;
    const w = show.canvas.clientWidth || 220, h = show.canvas.clientHeight || 220;
    if (show.w !== w || show.h !== h) {
      show.renderer.setSize(w, h, false);
      show.w = w; show.h = h;
      // Framed so the tallest tower fills the height with a little air, and
      // the table it stands on is in the picture rather than cut off below.
      const half = 0.78, aspect = w / Math.max(1, h);
      show.camera.left = -half * aspect; show.camera.right = half * aspect;
      show.camera.top = half * 1.7; show.camera.bottom = -half * 0.95;
      show.camera.updateProjectionMatrix();
    }
    show.spin += dt * 0.45;
    show.mesh.rotation.y = show.spin;
    // Settling onto the table: a quick swell up to size, then still.
    show.pop = Math.max(0, show.pop - dt * 6);
    const k = 1 - show.pop * show.pop * 0.22;
    show.mesh.scale.setScalar(k);
    show.rings[0].rotation.z = -show.spin * 0.5;
    show.rings[1].rotation.z = show.spin * 0.3;
    show.renderer.render(show.rig, show.camera);
  }

  /** A small picture of a tower at its first tier (or, with `enemy`, an enemy type), as a data URL. */
  thumbnail(kind, size = 112, enemy = false, mut = null) {
    // Pictures are kept: the rack, the shop and the slots ask for the same
    // few dozen over and over, and each render used to build a whole WebGL
    // context and drop it. Dropping does not free a context; the browser
    // allows only so many alive, and past that it evicts the oldest, which
    // was the turntable, which then drew nothing at all.
    const key = kind + "|" + size + "|" + (enemy ? "e" : "t") + "|" + (mut || "");
    if (!this.thumbCache) this.thumbCache = new Map();
    const kept = this.thumbCache.get(key);
    if (kept) return kept;
    if (!this.thumbs) {
      const renderer = new THREE.WebGLRenderer({ canvas: document.createElement("canvas"), antialias: true, alpha: true, preserveDrawingBuffer: true });
      renderer.setPixelRatio(1);
      const scene = new THREE.Scene();
      scene.add(new THREE.AmbientLight("#ffffff", 0.7));
      const sun = new THREE.DirectionalLight("#fff4ef", 1.3); sun.position.set(-4, 8, 5); scene.add(sun);
      const fill = new THREE.DirectionalLight("#ffd9cf", 0.3); fill.position.set(5, 3, -5); scene.add(fill);
      const camera = new THREE.OrthographicCamera(-0.58, 0.58, 0.78, -0.38, 0.1, 50);
      camera.position.set(6, 5.2, 6); camera.lookAt(0, 0.4, 0);
      this.thumbs = { renderer, scene, camera };
    }
    const { renderer, scene, camera } = this.thumbs;
    renderer.setSize(size, size, false);
    // Enemies are framed by their own size, so a colossus fills the picture and a swarm cube stays small.
    const frame = enemy ? Math.max(0.55, specFor(kind, mut).size * 2.4) : 0.58;
    camera.left = -frame; camera.right = frame; camera.top = frame * 1.35; camera.bottom = -frame * 0.65;
    camera.updateProjectionMatrix();
    const m = enemy ? this.enemyMesh(kind, mut) : this.towerMesh(kind, [0, 0], false);
    if (enemy) { m.rotation.y = -Math.PI / 5; if (m.userData.shield) m.userData.shield.visible = true; }
    else m.userData.pivot.rotation.y = -Math.PI / 5;
    scene.add(m);
    renderer.render(scene, camera);
    scene.remove(m);
    const url = renderer.domElement.toDataURL();
    this.thumbCache.set(key, url);
    return url;
  }
  /**
   * Kept for the callers that used to ask for the rig to be torn down after a
   * batch. The one rig now lives as long as the page does, which is one
   * context rather than one per batch, so there is nothing to drop.
   */
  dropThumbnails() {}

  /** A small text label that always faces the camera. */
  labelSprite(text, colour) {
    const c = document.createElement("canvas");
    c.width = 128; c.height = 64;
    const g = c.getContext("2d");
    g.font = "800 40px Archivo, system-ui, sans-serif";
    g.textAlign = "center"; g.textBaseline = "middle";
    g.fillStyle = colour; g.fillText(text, 64, 34);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
    sprite.scale.set(1.2, 0.6, 1);
    return sprite;
  }

  // ---- Towers ------------------------------------------------------------
  towerMesh(kind, tiers, ghost, power = 0) {
    const spec = TOWERS[kind];
    const tier = tiers[0] + tiers[1];
    const g = new THREE.Group();
    const mat = new THREE.MeshLambertMaterial({ color: spec.colour, transparent: ghost, opacity: ghost ? 0.5 : 1 });
    const dark = new THREE.MeshLambertMaterial({ color: C.ink, transparent: ghost, opacity: ghost ? 0.5 : 1 });
    const grey = new THREE.MeshLambertMaterial({ color: "#3a3635", transparent: ghost, opacity: ghost ? 0.5 : 1 });
    const add = (mesh, y, parent = g) => { mesh.position.y = y; mesh.castShadow = !ghost; parent.add(mesh); return mesh; };
    // A round plinth under every tower; the turret head turns toward the target.
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.44, 0.12, 24), dark), 0.06);
    const pivot = new THREE.Group();
    g.add(pivot);
    g.userData.pivot = pivot;
    const h = towerHeight(tier);
    // Each path changes the model as it is bought: `a` is the first path's
    // tier, `b` the second's.
    const [a, b] = tiers;
    const accent = new THREE.MeshBasicMaterial({ color: spec.colour, transparent: ghost, opacity: ghost ? 0.5 : 1 });
    const barrelAt = (parent, y, x, len, r1, r2, material = dark, z = 0) => {
      const m = add(new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, len, 10), material), y, parent);
      m.rotation.z = -Math.PI / 2; m.position.x = x; m.position.z = z;
      return m;
    };
    if (kind === "bolt") {
      // A slim column with a small head. Marksman lengthens and thickens the
      // barrel and adds a scope; Rapid adds barrels.
      add(new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.22, h, 16), mat), 0.12 + h / 2);
      add(new THREE.Mesh(new THREE.SphereGeometry(0.2 + b * 0.015, 16, 12), mat), 0.12 + h, pivot);
      const len = 0.5 + a * 0.12, r = 0.04 + (a >= 3 ? 0.02 : 0);
      const barrels = statsFor(kind, tiers).guns || 1;
      g.userData.guns = [];
      for (let k = 0; k < barrels; k++) {
        const ang = (k / barrels) * Math.PI * 2;
        const gun = k === 0 ? pivot : new THREE.Group();
        if (k > 0) g.add(gun);
        g.userData.guns.push(gun);
        barrelAt(gun, 0.12 + h + (barrels > 1 ? Math.cos(ang) * 0.07 : 0), 0.05 + len / 2, len, r, r + 0.01, dark, barrels > 1 ? Math.sin(ang) * 0.07 : 0);
      }
      if (a >= 4) { const scope = barrelAt(pivot, 0.12 + h + 0.13, 0.25, 0.22, 0.035, 0.035, grey); scope.position.y = 0.12 + h + 0.12; }
    } else if (kind === "cannon") {
      // A wide drum with a dome. Heavy shells widen drum and barrel and add a
      // muzzle brake; Gunnery adds a recoil block and, at the top, a twin barrel.
      // The drum stays within its plinth however heavy the shells get, so it
      // never sits over the marks around its foot.
      add(new THREE.Mesh(new THREE.CylinderGeometry(0.32 + a * 0.015, 0.36 + a * 0.015, h * 0.7, 24), mat), 0.12 + h * 0.35);
      add(new THREE.Mesh(new THREE.SphereGeometry(0.26 + a * 0.01, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2), mat), 0.12 + h * 0.7, pivot);
      const by = 0.12 + h * 0.7 + 0.08, br = 0.09 + a * 0.015;
      const twin = (statsFor(kind, tiers).guns || 1) > 1;
      g.userData.guns = [];
      (twin ? [-0.1, 0.1] : [0]).forEach((z, k) => {
        const gun = k === 0 ? pivot : new THREE.Group();
        if (k > 0) g.add(gun);
        g.userData.guns.push(gun);
        barrelAt(gun, by, 0.32, 0.55, br, br + 0.02, dark, z);
        const muzzle = add(new THREE.Mesh(new THREE.TorusGeometry(br + 0.02 + (a >= 2 ? 0.02 : 0), 0.025 + (a >= 2 ? 0.01 : 0), 6, 16), grey), by, gun);
        muzzle.rotation.y = Math.PI / 2; muzzle.position.x = 0.595; muzzle.position.z = z; // flush with the barrel end
      });
      if (b >= 2) barrelAt(pivot, by, -0.12, 0.2, 0.13, 0.13, grey);
    } else if (kind === "burst") {
      // A crystal on a post. Wider blast grows the gem and its ring and adds a
      // second ring; Faster cycle adds small satellite gems.
      add(new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, h, 10), dark), 0.12 + h / 2);
      const gem = add(new THREE.Mesh(new THREE.OctahedronGeometry(0.3 + a * 0.05), mat), 0.12 + h + 0.2, pivot);
      gem.rotation.y = Math.PI / 4;
      add(new THREE.Mesh(new THREE.TorusGeometry(0.36 + a * 0.05, 0.035, 8, 32), grey), 0.12 + h + 0.2, pivot).rotation.x = Math.PI / 2;
      if (a >= 3) add(new THREE.Mesh(new THREE.TorusGeometry(0.5 + a * 0.03, 0.025, 8, 32), grey), 0.12 + h + 0.05, pivot).rotation.x = Math.PI / 2;
      const sats = b >= 4 ? 4 : b >= 2 ? 2 : 0;
      for (let k = 0; k < sats; k++) { const ang = (k / sats) * Math.PI * 2 + Math.PI / 4; const sat = add(new THREE.Mesh(new THREE.OctahedronGeometry(0.09), mat), 0.12 + h + 0.2, pivot); sat.position.set(Math.cos(ang) * 0.45, sat.position.y, Math.sin(ang) * 0.45); }
    } else if (kind === "frost") {
      // A tapered spire of ice with a collar. Deep freeze raises the spire and
      // grows ice shards at its foot; Wide chill widens the collar and adds rings.
      add(new THREE.Mesh(new THREE.CylinderGeometry(0.22 + b * 0.03, 0.3 + b * 0.03, h * 0.5, 6), grey), 0.12 + h * 0.25);
      const spireH = h * 0.9 + 0.3 + a * 0.1;
      add(new THREE.Mesh(new THREE.ConeGeometry(0.24 + a * 0.01, spireH, 6), mat), 0.12 + h * 0.5 + spireH / 2);
      add(new THREE.Mesh(new THREE.TorusGeometry(0.28 + b * 0.03, 0.03, 6, 6), dark), 0.12 + h * 0.5, pivot).rotation.x = Math.PI / 2;
      if (b >= 2) add(new THREE.Mesh(new THREE.TorusGeometry(0.42 + b * 0.03, 0.025, 6, 6), mat), 0.12 + h * 0.25, pivot).rotation.x = Math.PI / 2;
      const shards = a >= 3 ? 6 : a >= 1 ? 3 : 0;
      for (let k = 0; k < shards; k++) { const ang = (k / shards) * Math.PI * 2; const sh = add(new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.28 + a * 0.04, 5), mat), 0.12 + 0.14 + a * 0.02); sh.position.set(Math.cos(ang) * 0.3, sh.position.y, Math.sin(ang) * 0.3); sh.rotation.z = -Math.cos(ang) * 0.3; sh.rotation.x = Math.sin(ang) * 0.3; }
    } else if (kind === "mint") {
      // A crystal farm: a dark bed cut into a grid with small green crystals
      // grown on it, feeding a collector post in the middle. Bigger yield
      // grows the crop, adds to it and tips it gold; Dividends raises the post
      // and hangs collection rings round it. Nothing here turns or fires.
      const gold = new THREE.MeshBasicMaterial({ color: "#ffd98a", transparent: ghost, opacity: ghost ? 0.5 : 1 });
      const crop = new THREE.MeshLambertMaterial({ color: spec.colour, emissive: "#1d4a32", transparent: ghost, opacity: ghost ? 0.5 : 1 });
      add(new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.07, 0.68), grey), 0.155);
      for (const at of [-0.17, 0.17]) {
        add(new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.02, 0.03), dark), 0.19).position.z = at;
        add(new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.02, 0.66), dark), 0.19).position.x = at;
      }
      // The crop: four crystals to begin with, eight once the seams run deep.
      const spots = [[-0.19, -0.19], [0.19, -0.19], [-0.19, 0.19], [0.19, 0.19]];
      if (a >= 2) spots.push([0, -0.22], [0, 0.22], [-0.22, 0], [0.22, 0]);
      const r = 0.07 + a * 0.014;
      for (const [x, z] of spots) {
        const stem = add(new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.024, 0.07, 6), dark), 0.225);
        stem.position.set(x, stem.position.y, z);
        const shard = add(new THREE.Mesh(new THREE.OctahedronGeometry(r), crop), 0.26 + r);
        shard.position.set(x, shard.position.y, z);
        shard.rotation.y = Math.PI / 4;
        // Ripe, once the yield is doubled: a gold point on every crystal.
        if (a >= 4) {
          const tip = add(new THREE.Mesh(new THREE.OctahedronGeometry(r * 0.42), gold), 0.26 + r * 2.1);
          tip.position.set(x, tip.position.y, z);
        }
      }
      // The collector in the middle, and the rings that draw the crop in.
      const ph = 0.3 + b * 0.06;
      add(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.075, ph, 8), dark), 0.19 + ph / 2);
      add(new THREE.Mesh(new THREE.OctahedronGeometry(0.095 + b * 0.012), b >= 2 ? gold : crop), 0.19 + ph + 0.085);
      if (b >= 1) {
        const ring = add(new THREE.Mesh(new THREE.TorusGeometry(0.29, 0.017, 6, 24), accent), 0.19 + ph * 0.62);
        ring.rotation.x = Math.PI / 2;
      }
      if (b >= 3) {
        const ring = add(new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.014, 6, 20), accent), 0.19 + ph * 0.88);
        ring.rotation.x = Math.PI / 2;
      }
    } else if (kind === "beacon") {
      // A mast with rings of signal hanging round it and a dish on top.
      // Amplifier widens the rings and the dish; Metronome stacks more of them.
      const mast = h + 0.2;
      add(new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.17, mast, 10), grey), 0.12 + mast / 2);
      for (let k = 0; k < 1 + Math.min(2, b); k++) {
        const ring = add(new THREE.Mesh(new THREE.TorusGeometry(0.19 + a * 0.032 - k * 0.035, 0.019, 6, 20), accent), 0.12 + mast * (0.42 + k * 0.19));
        ring.rotation.x = Math.PI / 2;
      }
      add(new THREE.Mesh(new THREE.SphereGeometry(0.1 + a * 0.012, 14, 10), mat), 0.12 + mast);
      if (a >= 3) {
        const dish = add(new THREE.Mesh(new THREE.ConeGeometry(0.17, 0.13, 12, 1, true), mat), 0.12 + mast + 0.11);
        dish.rotation.x = Math.PI;
      }
    } else if (kind === "tar") {
      // A basin sunk into the ground: a dark bowl with a lip of packed earth
      // round it and the tar a flat black sheen just under the lip. Thicker
      // tar widens it; Corrosive brings slow bubbles up through it.
      const rim = Math.min(0.42, 0.3 + a * 0.03);
      const look = tarLook(a, b);
      const tar = new THREE.MeshPhongMaterial({ color: look.fill, specular: look.glint, shininess: 90, transparent: ghost, opacity: ghost ? 0.5 : 1 });
      add(new THREE.Mesh(new THREE.CylinderGeometry(rim - 0.01, rim, 0.15, 28), dark), 0.195);
      add(new THREE.Mesh(new THREE.TorusGeometry(rim - 0.035, 0.032, 8, 32), mat), 0.272).rotation.x = Math.PI / 2;
      add(new THREE.Mesh(new THREE.CircleGeometry(rim - 0.04, 40), tar), 0.262).rotation.x = -Math.PI / 2;
      for (let k = 0; k < b * 2; k++) {
        const ang = (k / Math.max(1, b * 2)) * Math.PI * 2 + k * 0.9;
        const r = (rim - 0.14) * (0.3 + (k % 3) * 0.3);
        const bubble = add(new THREE.Mesh(new THREE.SphereGeometry(0.03 + (k % 2) * 0.015, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2), tar), 0.262);
        bubble.position.set(Math.cos(ang) * r, bubble.position.y, Math.sin(ang) * r);
      }
    } else if (kind === "sapper") {
      // A squat carrier with a hopper of mines on its back and a short, wide
      // tube angled up at the front to lob them. Heavier charges fattens the
      // tube and the mines; Deep pockets fills the hopper and adds a second.
      const top = 0.12 + h * 0.45;
      add(new THREE.Mesh(new THREE.BoxGeometry(0.52, h * 0.45, 0.46), mat), 0.12 + h * 0.225);
      add(new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.05, 0.5), dark), top);
      const hoppers = b >= 2 ? [-0.14, 0.14] : [0];
      for (const z of hoppers) {
        const tall = 0.24 + b * 0.02;
        const hopper = add(new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.095, tall, 12), grey), top + tall / 2);
        hopper.position.set(-0.16, hopper.position.y, z);
        // Mines stacked in it, the top ones showing above the rim.
        for (let q = 0; q < 2 + Math.min(2, b); q++) {
          const m = add(new THREE.Mesh(new THREE.CylinderGeometry(0.075 + a * 0.005, 0.075 + a * 0.005, 0.035, 10), dark), top + tall - 0.06 + q * 0.04);
          m.position.set(-0.16, m.position.y, z);
        }
      }
      // The tube, tilted up, turning with the aim; the mine in its mouth is the pip.
      const tilt = 0.7, tr = 0.085 + a * 0.012;
      const tube = add(new THREE.Mesh(new THREE.CylinderGeometry(tr, tr * 0.85, 0.34, 12), dark), top + 0.1, pivot);
      tube.rotation.z = -Math.PI / 2 + tilt;
      tube.position.x = 0.14;
      const mouth = add(new THREE.Mesh(new THREE.SphereGeometry(0.022, 6, 5), accent), 0, pivot);
      mouth.position.set(0.14 + Math.cos(tilt) * 0.17, top + 0.1 + Math.sin(tilt) * 0.17, 0);
    } else if (kind === "rift") {
      // Two dark standing stones leaning in, and between them a tear held
      // open: a ring of pale light round a black heart, with a slower ring
      // turning the other way outside it. It fills back to full as the next
      // tear comes due. Deeper rift raises the stones and adds a ring; Unstable
      // sets splinters of light circling the tear.
      const stone = new THREE.MeshPhongMaterial({ color: "#2b2d36", specular: "#4a5566", shininess: 20, flatShading: true, transparent: ghost, opacity: ghost ? 0.5 : 1 });
      const glow = (colour, opacity) => new THREE.MeshBasicMaterial({ color: colour, transparent: true, opacity: ghost ? opacity * 0.5 : opacity, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
      const tall = 0.62 + Math.min(2, a) * 0.08;
      for (const side of [-1, 1]) {
        const pillar = add(new THREE.Mesh(new THREE.BoxGeometry(0.12, tall, 0.14), stone), 0.12 + tall / 2);
        pillar.position.z = side * 0.3;
        pillar.rotation.x = side * 0.12; // leaning in toward the tear
        const cap = add(new THREE.Mesh(new THREE.OctahedronGeometry(0.06, 0), glow(spec.colour, 0.9)), 0.12 + tall + 0.02);
        cap.position.z = side * 0.26;
      }
      const heartY = 0.12 + 0.62;
      const portal = new THREE.Group();
      portal.position.y = heartY;
      // The heart stops short of the ring's inner edge rather than running
      // under it: overlapping in one plane, the two flickered through each
      // other. It is drawn first and writes no depth, so the rings lie on it.
      const heart = new THREE.Mesh(new THREE.CircleGeometry(0.225, 36), new THREE.MeshBasicMaterial({ color: "#05060a", transparent: true, opacity: ghost ? 0.4 : 0.92, side: THREE.DoubleSide, depthWrite: false }));
      heart.renderOrder = 1;
      const inner = new THREE.Mesh(new THREE.RingGeometry(0.228, 0.29, 48), glow(spec.colour, 0.9));
      const outer = new THREE.Mesh(new THREE.RingGeometry(0.32, 0.345, 48), glow("#c9f4ff", 0.6));
      const rings = [inner, outer];
      if (a >= 2) rings.push(new THREE.Mesh(new THREE.RingGeometry(0.38, 0.395, 48), glow(spec.colour, 0.45)));
      for (const ring of rings) ring.renderOrder = 2;
      // Faces the camera, turned each frame, so it reads as a tear from any side.
      for (const part of [heart, ...rings]) { part.raycast = () => {}; portal.add(part); }
      portal.scale.set(1, 1.35, 1); // taller than it is wide, a tear rather than a hole
      g.add(portal);
      const splinters = [];
      for (let i = 0; i < Math.min(3, b); i++) {
        const sp = new THREE.Mesh(new THREE.TetrahedronGeometry(0.04, 0), glow("#c9f4ff", 0.9));
        sp.userData.phase = (i / 3) * Math.PI * 2;
        g.add(sp);
        splinters.push(sp);
      }
      g.userData.rift = { portal, rings, heart, splinters, heartY };
    } else if (kind === "suppressor") {
      // A squat hexagonal pylon with three fins, a slow damper coil turning
      // over a dull core. Wider field stacks more coils; Unmasking sets a lens
      // on top that looks about.
      const body = new THREE.MeshPhongMaterial({ color: "#4b5160", specular: "#2a2e36", shininess: 12, flatShading: true, transparent: ghost, opacity: ghost ? 0.5 : 1 });
      const post = h * 0.7;
      add(new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.3, post, 6), body), 0.12 + post / 2);
      for (let i = 0; i < 3; i++) {
        const fin = add(new THREE.Mesh(new THREE.BoxGeometry(0.05, post * 0.8, 0.18), mat), 0.12 + post * 0.4);
        const ang = (i / 3) * Math.PI * 2;
        fin.position.set(Math.cos(ang) * 0.26, fin.position.y, Math.sin(ang) * 0.26);
        fin.rotation.y = -ang;
      }
      const top = 0.12 + post;
      const core = add(new THREE.Mesh(new THREE.OctahedronGeometry(0.1, 0), new THREE.MeshBasicMaterial({ color: "#c9d3e6", transparent: true, opacity: ghost ? 0.4 : 0.85 })), top + 0.18);
      const coils = [];
      for (let i = 0; i < 1 + Math.min(2, a); i++) {
        // A broken ring: three arcs with gaps between, so its turn is visible.
        const coil = new THREE.Group();
        coil.position.y = top + 0.1 + i * 0.1;
        for (let k = 0; k < 3; k++) {
          const arc = new THREE.Mesh(new THREE.TorusGeometry(0.2 + i * 0.03, 0.02, 4, 12, Math.PI * 0.5), mat);
          arc.rotation.set(Math.PI / 2, 0, (k / 3) * Math.PI * 2);
          arc.castShadow = !ghost;
          coil.add(arc);
        }
        g.add(coil);
        coils.push(coil);
      }
      let lens = null;
      if (b >= 1) {
        lens = add(new THREE.Mesh(new THREE.SphereGeometry(0.07 + b * 0.008, 12, 10), new THREE.MeshPhongMaterial({ color: "#e9eef8", specular: "#ffffff", shininess: 80, transparent: ghost, opacity: ghost ? 0.5 : 1 })), top + 0.42, pivot);
        const pupil = new THREE.Mesh(new THREE.CircleGeometry(0.035, 12), new THREE.MeshBasicMaterial({ color: "#1b1918" }));
        pupil.position.x = 0.07 + b * 0.008 + 0.001;
        pupil.rotation.y = Math.PI / 2;
        lens.add(pupil);
      }
      g.userData.suppressor = { core, coils, lens, top };
    } else if (kind === "boulder") {
      // A quarry chute. A block of stone at the back carries the top of a
      // curved stone trough that sweeps down toward the road on timber props,
      // and the next boulder waits in the top of it behind a wooden gate, hung
      // from a hoist frame. Heavier stone makes the boulder bigger and bands
      // the trough with iron; the quarry heaps spare stones behind.
      const stone = new THREE.MeshPhongMaterial({ color: "#6f6558", specular: "#2a2622", shininess: 8, flatShading: true, transparent: ghost, opacity: ghost ? 0.5 : 1 });
      const pale = new THREE.MeshPhongMaterial({ color: spec.colour, specular: "#3a342c", shininess: 10, flatShading: true, side: THREE.DoubleSide, transparent: ghost, opacity: ghost ? 0.5 : 1 });
      const wood = new THREE.MeshLambertMaterial({ color: "#6b4a2f", transparent: ghost, opacity: ghost ? 0.5 : 1 });
      const iron = new THREE.MeshPhongMaterial({ color: "#3a3635", specular: "#8a8480", shininess: 30, side: THREE.DoubleSide, transparent: ghost, opacity: ghost ? 0.5 : 1 });
      const R = 0.12 + Math.min(4, a) * 0.006; // the trough's radius
      // The trough's line, from its top beside the platform down to its lip:
      // steep to begin with, then levelling off, and always clear of the
      // plinth under it. It bowed upward once, and its low end sank into the
      // plinth.
      const p0 = { x: -0.14, y: 0.55 }, p1 = { x: 0.1, y: 0.28 }, p2 = { x: 0.42, y: 0.28 };
      const curve = (t) => ({
        x: (1 - t) * (1 - t) * p0.x + 2 * (1 - t) * t * p1.x + t * t * p2.x,
        y: (1 - t) * (1 - t) * p0.y + 2 * (1 - t) * t * p1.y + t * t * p2.y,
      });
      // The platform under its top.
      // Set back behind the top of the trough, not under it.
      add(new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.28, 0.4), stone), 0.12 + 0.14, pivot).position.x = -0.37;
      const cap = add(new THREE.Mesh(new THREE.BoxGeometry(0.21, 0.04, 0.44), pale), 0.12 + 0.3, pivot);
      cap.position.x = -0.37;
      // The trough itself: short open half-pipes laid end to end along the
      // line, each turned so its axis follows the slope and its open side
      // faces up.
      // One surface swept along the curve, not straight pieces laid end to
      // end: those opened a wedge at every join on the outside of the bend.
      // At each step along it a half circle is laid across the line, turned
      // to the slope there, open side up.
      const sweep = (t0, t1, radius, steps) => {
        const across = 12, pos = [], idx = [];
        for (let i = 0; i <= steps; i++) {
          const t = t0 + (t1 - t0) * (i / steps);
          const at = curve(t), ahead = curve(Math.min(1, t + 0.001)), behind = curve(Math.max(0, t - 0.001));
          let tx = ahead.x - behind.x, ty = ahead.y - behind.y;
          const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;
          const nx = ty, ny = -tx; // square to the slope, pointing down into the trough
          for (let j = 0; j <= across; j++) {
            const th = (j / across) * Math.PI;
            const side = Math.cos(th) * radius, down = Math.sin(th) * radius;
            pos.push(at.x + nx * down, at.y + ny * down, side);
          }
        }
        for (let i = 0; i < steps; i++) for (let j = 0; j < across; j++) {
          const k = i * (across + 1) + j;
          idx.push(k, k + across + 1, k + 1, k + 1, k + across + 1, k + across + 2);
        }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
        geo.setIndex(idx);
        geo.computeVertexNormals();
        return geo;
      };
      add(new THREE.Mesh(sweep(0, 1, R, 24), pale), 0, pivot);
      // A rounded rim along both edges, so the trough has some thickness.
      for (const z of [-R, R]) {
        const pts = [];
        for (let i = 0; i <= 16; i++) { const at = curve(i / 16); pts.push(new THREE.Vector3(at.x, at.y, z)); }
        add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.018, 6, false), stone), 0, pivot);
      }
      // Iron bands round it, from Heavier stone's second tier: short sweeps
      // just outside the trough, so they follow its bend too.
      if (a >= 2) {
        for (const t of a >= 4 ? [0.3, 0.55, 0.8] : [0.35, 0.75]) {
          add(new THREE.Mesh(sweep(t - 0.02, t + 0.02, R + 0.012, 2), iron), 0, pivot);
        }
      }
      // A lip at the bottom where it meets the road.
      const lip = curve(1);
      const lipBar = add(new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.04, R * 2 + 0.04), stone), lip.y - R * 0.7, pivot);
      lipBar.position.x = lip.x;
      // Timber props under the drop.
      for (const t of [0.55, 0.8]) {
        const at = curve(t), hgt = Math.max(0.02, at.y - R - 0.12);
        for (const z of [-R * 0.7, R * 0.7]) {
          const prop = add(new THREE.Mesh(new THREE.BoxGeometry(0.035, hgt, 0.035), wood), 0.12 + hgt / 2, pivot);
          prop.position.set(at.x, prop.position.y, z);
        }
      }
      // The gate: a wooden bar across the trough just in front of the boulder.
      const gateAt = curve(0.24);
      const gate = add(new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.12, R * 2 + 0.06), wood), gateAt.y + 0.02, pivot);
      gate.position.x = gateAt.x;
      // The hoist: two posts and a beam over the top of the trough, a rope down.
      for (const z of [-0.23, 0.23]) {
        const post = add(new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.76, 0.04), wood), 0.12 + 0.38, pivot);
        post.position.set(p0.x, post.position.y, z);
      }
      const beam = add(new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.52), wood), 0.12 + 0.78, pivot);
      beam.position.x = p0.x;
      // The boulder waiting at the top.
      const r = 0.14 + a * 0.012;
      const rock = add(new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), stone), p0.y - R + r + 0.01, pivot);
      rock.position.x = p0.x;
      const rope = add(new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 1, 5), wood), 0.6, pivot);
      rope.position.x = p0.x;
      // Spare stones heaped behind, from the Quarry's third tier.
      for (let i = 0; i < Math.max(0, b - 2); i++) {
        const spare = add(new THREE.Mesh(new THREE.IcosahedronGeometry(0.085, 0), stone), 0.2, pivot);
        spare.position.set(-0.37, 0.12 + 0.36, -0.12 + i * 0.24); // on the platform
      }
      g.userData.quarry = { rock, rest: rock.position.y, r, rope, top: 0.12 + 0.78 };
    } else if (kind === "urn") {
      // A funerary urn of dark stone on a stepped pedestal, runes cut round
      // its belly, and a ghost flame standing in its mouth. Soulfire brightens
      // the flame and cuts more bands of runes; Wailing sets stones circling
      // it, and Banshee a ring of pale light over the flame.
      const stone = new THREE.MeshPhongMaterial({ color: "#2a2531", specular: "#5b4f7a", shininess: 18, flatShading: true, transparent: ghost, opacity: ghost ? 0.5 : 1 });
      const glow = (colour, opacity) => new THREE.MeshBasicMaterial({ color: colour, transparent: true, opacity: ghost ? opacity * 0.5 : opacity, depthWrite: false, blending: THREE.AdditiveBlending });
      add(new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.34, 0.06, 8), grey), 0.15);
      add(new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.28, 0.05, 8), stone), 0.2);
      // The body, turned from a profile: foot, waist, full belly, shoulder, neck, lip.
      const k = 1.12 + tier * 0.03;
      const profile = [[0, 0], [0.15, 0], [0.17, 0.03], [0.11, 0.08], [0.23, 0.18], [0.28, 0.28], [0.26, 0.37], [0.18, 0.45], [0.12, 0.5], [0.13, 0.54], [0.18, 0.58], [0.15, 0.6], [0, 0.6]];
      const body = add(new THREE.Mesh(new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r * k, y * k)), 14), stone), 0.22);
      body.scale.set(1, 1, 1);
      // Handles: two stone loops on the shoulders.
      for (const side of [-1, 1]) {
        const handle = add(new THREE.Mesh(new THREE.TorusGeometry(0.075 * k, 0.018, 6, 12, Math.PI), stone), 0.22 + 0.4 * k);
        handle.position.x = side * 0.25 * k;
        // The half-ring is turned a quarter about the view axis so its arc
        // bulges out from the body on its own side; flipping it round as well
        // turned the left one back into the urn.
        handle.rotation.set(0, 0, -side * Math.PI / 2);
      }
      // Bands of runes: a glowing ring round the belly with cut marks along it.
      const runes = [];
      const bands = 1 + Math.min(2, a);
      for (let i = 0; i < bands; i++) {
        const y = 0.22 + (0.28 - i * 0.09) * k, r = [0.281, 0.262, 0.215][i] * k;
        const ring = add(new THREE.Mesh(new THREE.TorusGeometry(r, 0.008, 4, 36), glow(spec.colour, 0.55)), y);
        ring.rotation.x = Math.PI / 2;
        runes.push(ring);
        for (let j = 0; j < 8; j++) {
          const ang = (j / 8) * Math.PI * 2 + i * 0.4;
          const mark = add(new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.045, 0.012), glow("#c9f7e2", 0.7)), y + (j % 2 ? 0.018 : -0.018));
          mark.position.x = Math.cos(ang) * (r + 0.004); mark.position.z = Math.sin(ang) * (r + 0.004);
          mark.rotation.y = -ang;
          runes.push(mark);
        }
      }
      // The mouth glows from inside.
      const mouthY = 0.22 + 0.58 * k;
      const mouth = add(new THREE.Mesh(new THREE.CircleGeometry(0.16 * k, 18), glow("#b9f5dc", 0.8)), mouthY);
      mouth.rotation.x = -Math.PI / 2;
      // The ghost flame: nested teardrop tongues, violet outside, a strong
      // ghost green inside, near white at the core, and a few smaller licks
      // leaning off round the edge. Additive, so they brighten where they
      // cross, and each flickers on its own in animateUrn.
      const flame = new THREE.Group();
      flame.position.y = mouthY - 0.02;
      const drop = (r, hgt) => new THREE.LatheGeometry(
        [[0, 0], [0.55, 0.06], [0.9, 0.24], [0.95, 0.4], [0.7, 0.62], [0.36, 0.84], [0.1, 0.97], [0, 1]].map(([x, y]) => new THREE.Vector2(x * r, y * hgt)), 14);
      const tongues = [[0.15, 0.5, "#8f7bff", 0.45, 0, 0], [0.11, 0.42, "#5dffb6", 0.55, 0, 0], [0.06, 0.28, "#eafff5", 0.9, 0, 0]];
      for (let i = 0; i < 3; i++) {
        const ang = (i / 3) * Math.PI * 2;
        tongues.push([0.05, 0.24, "#5dffb6", 0.45, Math.cos(ang) * 0.08, Math.sin(ang) * 0.08]);
      }
      tongues.forEach(([r, hgt, colour, op, ox, oz], i) => {
        const tongue = new THREE.Mesh(drop(r * k, hgt * k), glow(colour, op));
        tongue.position.set(ox, 0, oz);
        if (ox || oz) tongue.rotation.set(oz * 3, 0, -ox * 3); // the licks lean outward
        tongue.userData = { base: op, phase: i * 1.7 };
        tongue.raycast = () => {};
        flame.add(tongue);
      });
      g.add(flame);
      // Wailing stones circle it, one a tier.
      const stones = [];
      for (let i = 0; i < Math.min(3, b); i++) {
        const shard = add(new THREE.Mesh(new THREE.OctahedronGeometry(0.045, 0), stone), mouthY);
        shard.userData.phase = (i / 3) * Math.PI * 2;
        const halo = new THREE.Mesh(new THREE.OctahedronGeometry(0.06, 0), glow(spec.colour, 0.3));
        shard.add(halo);
        stones.push(shard);
      }
      // Requiem sets a second, smaller flame of light floating over the first;
      // Banshee a pale ring turning above it.
      let crown = null;
      if (b >= 4) {
        crown = add(new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.012, 4, 40), glow("#effff8", 0.6)), mouthY + 0.5);
        crown.rotation.x = Math.PI / 2;
      }
      let echo = null;
      if (a >= 4) {
        echo = add(new THREE.Mesh(new THREE.OctahedronGeometry(0.07, 0), glow("#effff8", 0.8)), mouthY + 0.62);
      }
      for (const part of [mouth, ...runes]) part.raycast = () => {};
      g.userData.urn = { flame, runes, mouth, stones, crown, echo, mouthY, bands };
    } else if (kind === "lodestone") {
      // A dark stone hanging over a cradle of rings. Stronger pull widens the
      // rings and darkens the stone; Crush adds bands that bite inward.
      const post = h * 0.7;
      add(new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.16, post, 10), grey), 0.12 + post / 2);
      const stone = add(new THREE.Mesh(new THREE.SphereGeometry(0.2 + a * 0.02, 16, 12), new THREE.MeshLambertMaterial({ color: "#1a1718", emissive: spec.colour, emissiveIntensity: 0.25 + a * 0.08, transparent: ghost, opacity: ghost ? 0.5 : 1 })), 0.12 + post + 0.3);
      g.userData.stone = stone;
      // Each ring hangs in a pivot of its own, so it can turn about the
      // stone while keeping its tilt.
      g.userData.rings = [];
      for (let k = 0; k < 2 + Math.min(1, b); k++) {
        const spin = new THREE.Group();
        spin.position.y = 0.12 + post + 0.3;
        spin.rotation.y = k * 0.7;
        g.add(spin);
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.3 + a * 0.035 + k * 0.08, 0.018 + (b >= 3 ? 0.012 : 0), 6, 24), b >= 1 && k === 1 ? dark : accent);
        ring.rotation.x = Math.PI / 2 + (k - 1) * 0.35;
        ring.castShadow = !ghost;
        spin.add(ring);
        g.userData.rings.push(spin);
      }
    } else if (kind === "venom") {
      // A squat drum with a round tank on top and a short wide nozzle.
      // Stronger toxin swells the tank; Contagion stands flasks round its foot.
      add(new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.31, h * 0.5, 16), grey), 0.12 + h * 0.25);
      add(new THREE.Mesh(new THREE.SphereGeometry(0.18 + a * 0.022, 16, 12), mat), 0.12 + h * 0.5 + 0.14, pivot);
      barrelAt(pivot, 0.12 + h * 0.5 + 0.12, 0.3, 0.34, 0.05, 0.08, dark);
      for (let k = 0; k < Math.min(3, b); k++) {
        const ang = -0.7 + k * 0.7;
        const flask = add(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.065, 0.15, 8), accent), 0.195);
        flask.position.set(Math.cos(ang) * 0.3, flask.position.y, Math.sin(ang) * 0.3);
      }
    } else if (kind === "siege") {
      // A trebuchet: a low chassis, two legs meeting at an axle, and a long
      // arm over it tilted skyward with a counterweight hung off its short
      // end. Heavier charge thickens the arm and the weight; Faster winch adds
      // the winding drum and a crank behind.
      const axle = 0.12 + h * 0.6;
      add(new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.1, 0.4), dark), 0.17);
      for (const z of [-0.15, 0.15]) {
        const leg = add(new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, axle - 0.17, 8), grey), 0.17 + (axle - 0.17) / 2, pivot);
        leg.position.z = z;
      }
      add(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.42, 8), dark), axle, pivot).rotation.x = Math.PI / 2;
      const tilt = 0.55, len = 0.9 + a * 0.06, r = 0.04 + a * 0.008;
      const arm = add(new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.8, len, 8), mat), axle, pivot);
      arm.rotation.z = -Math.PI / 2 + tilt;
      // The axle sits three tenths along the arm: the long end forward and
      // up, the short end back and down with the weight on it.
      const off = len * 0.2;
      arm.position.set(Math.cos(tilt) * off, axle + Math.sin(tilt) * off, 0);
      const cup = add(new THREE.Mesh(new THREE.SphereGeometry(0.06 + a * 0.01, 8, 6), dark), 0, pivot);
      cup.position.set(Math.cos(tilt) * (off + len / 2), axle + Math.sin(tilt) * (off + len / 2), 0);
      const wt = 0.16 + a * 0.025;
      const weight = add(new THREE.Mesh(new THREE.BoxGeometry(wt, wt * 1.2, wt), dark), 0, pivot);
      weight.position.set(Math.cos(tilt) * (off - len / 2), axle + Math.sin(tilt) * (off - len / 2) - wt * 0.45, 0);
      if (b >= 1) { const drum = add(new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.32, 10), grey), 0.3, pivot); drum.rotation.x = Math.PI / 2; drum.position.x = -0.22; }
      if (b >= 3) { const crank = add(new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.014, 6, 14), accent), 0.3, pivot); crank.position.set(-0.22, 0.3, 0.21); }
    } else if (kind === "arc") {
      // A coil: rings up a post, a charged sphere on top. Reach adds rings and
      // height; Voltage grows the sphere and caps it.
      add(new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.3, 0.2, 16), grey), 0.22);
      const post = h + a * 0.08;
      add(new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, post, 10), dark), 0.12 + post / 2);
      const rings = 3 + a;
      for (let k = 0; k < rings; k++) add(new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.035, 8, 24), mat), 0.32 + k * (post - 0.25) / (rings - 0.5)).rotation.x = Math.PI / 2;
      add(new THREE.Mesh(new THREE.SphereGeometry(0.16 + b * 0.03, 16, 12), accent), 0.12 + post + 0.2);
      if (b >= 3) add(new THREE.Mesh(new THREE.TorusGeometry(0.2 + b * 0.03, 0.03, 6, 24), grey), 0.12 + post + 0.2).rotation.x = Math.PI / 2;
    } else if (kind === "mortar") {
      // A squat base with a wide tube tilted skyward. Payload widens base and
      // tube and bands it; Targeting adds a sight and, at the top, a second tube.
      // Likewise the base: it grew past the plinth and swallowed the marks.
      add(new THREE.Mesh(new THREE.CylinderGeometry(0.3 + a * 0.02, 0.34 + a * 0.02, 0.3, 24), mat), 0.27);
      const tilt = 0.95, tr = 0.15 + a * 0.02;
      const twin = (statsFor(kind, tiers).guns || 1) > 1;
      g.userData.guns = [];
      (twin ? [-0.17, 0.17] : [0]).forEach((z, k) => {
        const gun = k === 0 ? pivot : new THREE.Group();
        if (k > 0) g.add(gun);
        g.userData.guns.push(gun);
        const tube = add(new THREE.Mesh(new THREE.CylinderGeometry(tr, tr - 0.02, 0.6, 14), dark), 0.55, gun);
        tube.rotation.z = -Math.PI / 2 + tilt; tube.position.x = 0.14; tube.position.z = z;
        // The lip and the band ride on the tube itself, so they take its tilt
        // rather than guessing at it: placed by trig and turned about two axes
        // they came out lying flat, ajar at the mouth.
        add(new THREE.Mesh(new THREE.TorusGeometry(tr, 0.03 + (a >= 4 ? 0.015 : 0), 6, 16), grey), 0.3, tube).rotation.x = Math.PI / 2;
        if (a >= 3) add(new THREE.Mesh(new THREE.TorusGeometry(tr + 0.005, 0.02, 6, 16), accent), 0, tube).rotation.x = Math.PI / 2;
      });
      if (b >= 1) { const sight = add(new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.3 + b * 0.05, 6), grey), 0.42 + (0.3 + b * 0.05) / 2, pivot); sight.position.x = -0.22; }
      if (b >= 3) { const dish = add(new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.015, 6, 16), accent), 0.42 + 0.3 + b * 0.05, pivot); dish.position.x = -0.22; dish.rotation.x = Math.PI / 2; }
    } else if (kind === "flame") {
      // A squat fuel drum with a flared nozzle. Heat grows the drum and adds a
      // second tank; Spread widens the nozzle and, at the top, adds nozzles all round.
      add(new THREE.Mesh(new THREE.CylinderGeometry(0.3 + a * 0.03, 0.32 + a * 0.03, h * 0.6, 20), mat), 0.12 + h * 0.3);
      add(new THREE.Mesh(new THREE.TorusGeometry(0.31 + a * 0.03, 0.03, 6, 20), dark), 0.12 + h * 0.3).rotation.x = Math.PI / 2;
      if (a >= 3) { const tank = add(new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, h * 0.5, 12), grey), 0.12 + h * 0.3); tank.position.set(-0.3, tank.position.y, 0.22); }
      const nozzles = b >= 4 ? 3 : 1;
      for (let k = 0; k < nozzles; k++) {
        const arm = new THREE.Group(); arm.rotation.y = (k / nozzles) * Math.PI * 2; pivot.add(arm);
        barrelAt(arm, 0.12 + h * 0.6, 0.3, 0.42, 0.11 + b * 0.025, 0.06 + b * 0.01);
        const pilot = add(new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), accent), 0.12 + h * 0.6, arm);
        pilot.position.x = 0.52;
      }
    } else if (kind === "prism") {
      // A slim pedestal with a crystal floating above it, ringed by shards for
      // the towers it has absorbed. Radiance grows the crystal and rings it;
      // Refraction hangs satellite crystals around it. Animated in syncTowers.
      add(new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.22, h * 0.8, 12), grey), 0.12 + h * 0.4);
      add(new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.035, 8, 24), dark), 0.12 + h * 0.8).rotation.x = Math.PI / 2;
      // Big enough to read as the thing a run is built toward, small enough
      // to stay inside its own cell and off the marks around its foot.
      const crystal = add(new THREE.Mesh(new THREE.OctahedronGeometry(0.19 + a * 0.017 + Math.min(1, power / 9000) * 0.1), new THREE.MeshLambertMaterial({ color: spec.colour, emissive: "#7a3f31", transparent: ghost, opacity: ghost ? 0.5 : 1 })), 0.12 + h + 0.35);
      crystal.scale.y = 1.5;
      g.userData.crystal = crystal;
      g.userData.emitters = [crystal];
      g.userData.shards = [];
      if (a >= 3) add(new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.025, 6, 32), accent), 0.12 + h + 0.35).rotation.x = Math.PI / 2;
      const sats = b >= 4 ? 5 : b >= 2 ? 3 : b >= 1 ? 2 : 0;
      for (let k = 0; k < sats; k++) { const ang = (k / sats) * Math.PI * 2; const sat = add(new THREE.Mesh(new THREE.OctahedronGeometry(0.08), accent), 0.12 + h + 0.35 + Math.sin(ang * 2) * 0.1); sat.position.set(Math.cos(ang) * 0.36, sat.position.y, Math.sin(ang) * 0.36); sat.scale.y = 1.4; }
      const shards = Math.min(12, Math.round(power / 800));
      for (let k = 0; k < shards; k++) {
        const sh = add(new THREE.Mesh(new THREE.OctahedronGeometry(0.07), new THREE.MeshBasicMaterial({ color: k % 2 ? "#ffd8cc" : C.accent })), 0.12 + h + 0.35);
        sh.userData.phase = (k / shards) * Math.PI * 2;
        g.userData.shards.push(sh);
      }
    } else {
      // Sniper: a tall mast with a long thin barrel. Calibre thickens and
      // lengthens it and adds a brake; Trigger adds a scope and a magazine.
      add(new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.12, h + 0.4, 10), grey), 0.12 + (h + 0.4) / 2);
      add(new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.16 + b * 0.02, 16), mat), 0.12 + h + 0.4, pivot);
      const len = 0.85 + a * 0.1, r = 0.03 + a * 0.012;
      barrelAt(pivot, 0.12 + h + 0.4, 0.05 + len / 2, len, r, r + 0.005);
      // The brake sits proud of the muzzle rather than flush with it: ending
      // on the same plane as the barrel put two faces in the same place and
      // the two flickered against each other.
      if (a >= 3) { const brake = add(new THREE.Mesh(new THREE.CylinderGeometry(r + 0.03, r + 0.03, 0.1, 8), grey), 0.12 + h + 0.4, pivot); brake.rotation.z = -Math.PI / 2; brake.position.x = len + 0.06; }
      if (b >= 2) { const scope = barrelAt(pivot, 0.12 + h + 0.4 + 0.1, 0.2, 0.22, 0.03, 0.03, grey); scope.position.y = 0.12 + h + 0.4 + 0.1; }
      // The magazine hangs clear below the head and out past its rim, for the
      // same reason: sitting exactly on it had the two surfaces grazing.
      if (b >= 4) { const mag = add(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.16, 8), dark), 0.12 + h + 0.4 - 0.17, pivot); mag.position.x = 0.17; }
    }
    // Pips round the plinth: the first path's along the front, the second's along the side.
    // The tier pips ring the foot of the tower, out at the edge of its cell
    // where the widest body cannot cover them, and the two paths sit on
    // opposite sides so no angle of the view can hide both at once.
    for (const [p, colour, mid] of [[0, "#8f8b8b", Math.PI * 0.75], [1, "#d7d3d3", -Math.PI * 0.25]]) {
      for (let k = 0; k < tiers[p]; k++) {
        const pip = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), new THREE.MeshBasicMaterial({ color: colour }));
        const ang = mid + (k - (tiers[p] - 1) / 2) * 0.31;
        pip.position.set(Math.cos(ang) * 0.45, 0.14, Math.sin(ang) * 0.45);
        pip.userData.pip = true;
        g.add(pip);
      }
    }
    return g;
  }

  syncTowers(simulation, view) {
    const seen = new Set();
    for (const t of simulation.towers) {
      seen.add(t.id);
      let m = this.towerMeshes.get(t.id);
      const stats = simulation.stats(t);
      // A lodestone works out where on the road it pulls to on its first tick,
      // so its markings are keyed on that as well as on what it has bought.
      const key = t.tiers.join() + ":" + Math.round((t.power || 0) / 700) + ":" + (t.anchor === undefined ? "-" : t.anchor.toFixed(1));
      if (!m || m.userData.key !== key) {
        if (m) this.board.remove(m);
        m = this.towerMesh(t.kind, t.tiers, false, t.power || 0);
        m.userData.key = key;
        m.userData.tid = t.id; // what towerAt hands back
        m.position.set(t.c + 0.5, 0, t.r + 0.5);
        if (stats.mire || stats.pull) m.add(this.roadWork(t, stats, simulation));
        if (stats.hush) {
          // The field, a disc of it lying over the ground round the tower.
          const disc = new THREE.Mesh(new THREE.CircleGeometry(stats.range, 56).rotateX(-Math.PI / 2), new THREE.ShaderMaterial({
            vertexShader: FIELD_VERT, fragmentShader: HUSH_FRAG,
            uniforms: { time: { value: 0 }, range: { value: stats.range }, colour: { value: new THREE.Color(TOWERS.suppressor.colour) } },
            transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
          }));
          disc.position.y = 0.14;
          disc.raycast = () => {};
          const holder = new THREE.Group();
          holder.add(disc);
          holder.userData.field = disc;
          m.add(holder);
        }
        this.board.add(m);
        this.towerMeshes.set(t.id, m);
      }
      m.userData.pivot.rotation.y = -t.aim;
      // A tar pit is never still: it bubbles and keeps throwing tar out.
      // A knocked-out tower's work goes quiet until it comes round. Tar already
      // on the road stays there and keeps working, but the pit stops bubbling
      // and throwing more; a lodestone's field goes out altogether.
      const down = t.stunned > 0;
      for (const child of m.children) {
        if (child.userData.tarred && !down) this.tarWork(t, child, this.dt);
        if (child.userData.field) child.userData.field.visible = !down;
      }
      // Every barrel turns on its own when the tower has more than one gun.
      if (m.userData.guns && t.guns) m.userData.guns.forEach((gun, i) => { if (t.guns[i]) gun.rotation.y = -t.guns[i].aim; });
      if (m.userData.crystal) this.animatePrism(m, t);
      if (m.userData.stone) this.animateLodestone(m, t);
      if (m.userData.urn) this.animateUrn(m, t, stats);
      if (m.userData.rift) {
        // The tear swells back open as the next one comes due, and spins.
        const u = m.userData.rift, now = performance.now() / 1000;
        const every = Math.max(8, stats.rift.every);
        const due = t.riftClock === undefined ? 1 : 1 - Math.max(0, Math.min(1, t.riftClock / every));
        const down = t.stunned > 0;
        const open = down ? 0.25 : 0.35 + due * 0.65;
        u.portal.scale.set(open, open * 1.35, open);
        u.portal.rotation.y = -this.yaw + Math.PI / 2;
        u.rings[0].rotation.z = now * 1.5;
        u.rings[1].rotation.z = -now * 0.8;
        if (u.rings[2]) u.rings[2].rotation.z = now * 0.5;
        u.rings.forEach((ring) => { ring.material.opacity = (down ? 0.15 : 0.35 + due * 0.55); });
        u.splinters.forEach((sp, i) => {
          const a = now * 2.2 + sp.userData.phase;
          sp.position.set(Math.sin(a * 0.5) * 0.08, u.heartY + Math.sin(a) * 0.32, Math.cos(a) * 0.32);
          sp.rotation.set(a, a * 1.4, 0);
        });
        // When it is ready, motes are drawn in toward it.
        if (due >= 1 && !down) {
          u.mote = (u.mote || 0) + this.dt * 10;
          while (u.mote >= 1) {
            u.mote -= 1;
            const a = Math.random() * Math.PI * 2, r = 0.5 + Math.random() * 0.3;
            const hx = t.c + 0.5, hz = t.r + 0.5, hy = u.heartY;
            this.particle({ x: hx + Math.cos(a) * r, y: hy + (Math.random() - 0.5) * 0.4, z: hz + Math.sin(a) * r, vx: 0, vy: 0, vz: 0, life: 1.2, size: 0.025 + Math.random() * 0.02, gravity: 0, colour: "#c9f4ff", colour2: TOWERS.rift.colour, home: () => ({ x: hx, y: hy, z: hz }), homeSpeed: 1.2, swirl: 1.2 });
          }
        }
      }
      if (m.userData.suppressor) {
        const u = m.userData.suppressor, now = performance.now() / 1000, down = t.stunned > 0;
        u.coils.forEach((coil, i) => { if (!down) coil.rotation.y += this.dt * (0.6 + i * 0.3) * (i % 2 ? -1 : 1); });
        u.core.rotation.y = now * 0.8;
        u.core.material.opacity = down ? 0.2 : 0.6 + 0.25 * Math.sin(now * 2 + t.id);
        // The lens looks about, lingering.
        if (u.lens && !down) m.userData.pivot.rotation.y = Math.sin(now * 0.5 + t.id) * 1.6;
        for (const child of m.children) if (child.userData.field && child.userData.field.material.uniforms.range) child.userData.field.material.uniforms.time.value = now;
      }
      if (m.userData.quarry) {
        // The next boulder rises into place at the top of the chute as the
        // wait for it runs down, and rocks a little when it is ready to go.
        const q = m.userData.quarry;
        const every = Math.max(1.5, stats.boulder.every);
        const ready = t.boulderClock === undefined ? 1 : 1 - Math.max(0, Math.min(1, t.boulderClock / every));
        const k = Math.min(1, ready * 1.25);
        q.rock.scale.setScalar(Math.max(0.01, k));
        // Lowered in on the rope as the wait runs down, then rocking at the gate.
        q.rock.position.y = q.rest + (1 - k) * 0.25 + (k >= 1 ? Math.abs(Math.sin(performance.now() / 180 + t.id)) * 0.012 : 0);
        const ropeLow = q.rock.position.y + q.r * k;
        q.rope.scale.y = Math.max(0.01, q.top - ropeLow);
        q.rope.position.y = (q.top + ropeLow) / 2;
      }
      // Knocked out: an orange warning mark blinks above it and static crackles off it.
      if (t.stunned > 0) {
        if (!m.userData.down) {
          const mark = this.labelSprite("!", C.accent);
          mark.scale.set(0.75, 0.75, 1);
          mark.position.set(0, towerHeight(t.tiers[0] + t.tiers[1]) + 0.85, 0);
          m.add(mark); m.userData.down = mark;
        }
        m.userData.down.visible = Math.floor(performance.now() / 220) % 2 === 0;
        m.userData.zap = (m.userData.zap || 0) + this.dt * 10;
        while (m.userData.zap >= 1) {
          m.userData.zap -= 1;
          const a = Math.random() * Math.PI * 2;
          this.particle({ x: t.c + 0.5 + Math.cos(a) * 0.3, y: 0.2 + Math.random() * towerHeight(t.tiers[0] + t.tiers[1]), z: t.r + 0.5 + Math.sin(a) * 0.3, vx: Math.cos(a) * 0.6, vy: 0.3 + Math.random() * 0.6, vz: Math.sin(a) * 0.6, life: 0.2 + Math.random() * 0.15, size: 0.03 + Math.random() * 0.03, gravity: 3, colour: Math.random() < 0.5 ? C.accent : "#bab6b6" });
        }
      } else if (m.userData.down) m.userData.down.visible = false;
    }
    for (const [id, m] of this.towerMeshes) if (!seen.has(id)) { this.board.remove(m); this.towerMeshes.delete(id); }
    // Gobs whose patch has gone with its tower land on nothing.
    if (this.tarDue) this.tarDue = this.tarDue.filter((due) => due.work.parent);
    this.tarLandings();

    // Ghost while placing.
    const wantGhost = view.placing && view.hover ? view.placing : null;
    if (this.ghost && this.ghost.userData.kind !== wantGhost) { this.board.remove(this.ghost); this.ghost = null; }
    if (wantGhost && !this.ghost) { this.ghost = this.towerMesh(wantGhost, [0, 0], true); this.ghost.userData.kind = wantGhost; this.board.add(this.ghost); }
    if (this.ghost) {
      this.ghost.position.set(view.hover.c + 0.5, 0, view.hover.r + 0.5);
      const ok = simulation.canBuild(view.hover.c, view.hover.r);
      this.ghost.traverse((o) => { if (o.material && o.material.color && o !== this.ghost) o.material.opacity = ok ? 0.55 : 0.2; });
    }
    // Range ring for the ghost or the selected tower. A tower that works on
    // the road, tar or a lodestone's pull, keeps its reach inside what it
    // does rather than as a range, and also lights the road cells it covers.
    const reachOf = (s) => (s.mire ? s.mire.range : s.pull ? s.pull.range : s.range);
    const ghostStats = wantGhost ? TOWERS[wantGhost].base : null;
    const selStats = view.selected ? simulation.stats(view.selected) : null;
    // A tower that has to see what it aims at shows the ground it can see:
    // its reach, with the shadows props throw cut out of it.
    const aims = (s) => !!(s.damage || s.rift) && !s.lobs && !s.mire && !s.pull;
    let ringFor = wantGhost && view.hover ? { c: view.hover.c, r: view.hover.r, range: reachOf(ghostStats), ok: simulation.canBuild(view.hover.c, view.hover.r), road: !!(ghostStats.mire || ghostStats.pull), sight: aims(ghostStats) }
      : view.selected ? { c: view.selected.c, r: view.selected.r, range: reachOf(selStats), ok: true, road: !!(selStats.mire || selStats.pull), sight: aims(selStats) } : null;
    if (ringFor && !isFinite(ringFor.range) && !ringFor.sight) ringFor = null; // the whole map: no ring to draw
    this.showRoadReach(ringFor && ringFor.road ? ringFor : null, simulation);
    this.showSight(ringFor && ringFor.sight ? ringFor : null, simulation);
    if (ringFor && ringFor.sight) ringFor = null;
    this.ring.visible = this.ringFill.visible = !!ringFor;
    if (ringFor) {
      this.ring.position.set(ringFor.c + 0.5, 0.14, ringFor.r + 0.5);
      this.ringFill.position.set(ringFor.c + 0.5, 0.13, ringFor.r + 0.5);
      this.ring.scale.set(ringFor.range, ringFor.range, 1);
      this.ringFill.scale.set(ringFor.range, ringFor.range, 1);
      // Somewhere a tower can go is the ordinary case, so it wears the quiet
      // colour; the accent is kept for the cell refusing it, which is the only
      // one worth looking at.
      this.ring.material.color.set(ringFor.ok ? C.white : C.accent);
      this.ringFill.material.color.set(ringFor.ok ? C.white : C.accent);
    }
    // Selection outline.
    if (this.selectBox && (!view.selected || this.selectBox.userData.id !== view.selected.id)) { this.board.remove(this.selectBox); this.selectBox = null; }
    if (view.selected && !this.selectBox) {
      const edges = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(0.98, 0.1, 0.98)), new THREE.LineBasicMaterial({ color: C.white }));
      edges.position.set(view.selected.c + 0.5, 0.05, view.selected.r + 0.5);
      edges.userData.id = view.selected.id;
      this.board.add(edges);
      this.selectBox = edges;
    }
  }

  /**
   * The ground a tower can see, drawn in place of its range ring: a fan out
   * to the end of each ray the simulation casts, filled faintly and edged.
   * Rebuilt only when the cell, reach, verdict or props change. `at` null
   * hides it.
   */
  showSight(at, simulation) {
    if (!this.sightFill) {
      this.sightFill = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({ color: C.accent, transparent: true, opacity: 0.08, depthWrite: false, side: THREE.DoubleSide }));
      this.sightEdge = new THREE.LineLoop(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: C.accent, transparent: true, opacity: 0.7 }));
      for (const m of [this.sightFill, this.sightEdge]) { m.raycast = () => {}; this.board.add(m); }
    }
    const key = at ? [at.c, at.r, at.range, at.ok, simulation.propsVersion, simulation.map.id].join(",") : "";
    this.sightFill.visible = this.sightEdge.visible = !!at;
    if (!at || key === this.sightKey) return;
    this.sightKey = key;
    const pts = simulation.sightShape(at.c, at.r, at.range);
    const cx = at.c + 0.5, cz = at.r + 0.5;
    const fan = [cx, 0.13, cz], edge = [];
    for (const p of pts) { fan.push(p.x, 0.13, p.y); edge.push(p.x, 0.14, p.y); }
    const index = [];
    for (let k = 1; k <= pts.length; k++) index.push(0, k, k === pts.length ? 1 : k + 1);
    this.sightFill.geometry.dispose();
    this.sightFill.geometry = new THREE.BufferGeometry();
    this.sightFill.geometry.setAttribute("position", new THREE.Float32BufferAttribute(fan, 3));
    this.sightFill.geometry.setIndex(index);
    this.sightEdge.geometry.dispose();
    this.sightEdge.geometry = new THREE.BufferGeometry();
    this.sightEdge.geometry.setAttribute("position", new THREE.Float32BufferAttribute(edge, 3));
    const colour = at.ok ? C.white : C.accent;
    this.sightFill.material.color.set(colour);
    this.sightEdge.material.color.set(colour);
  }

  /**
   * Light the road cells a tar pit or lodestone would work on from a cell:
   * every road cell whose middle is within its reach, the same rule its tar
   * is laid by. Pooled tiles, redrawn only when the cell, reach or verdict
   * changes. `at` null hides them.
   */
  showRoadReach(at, simulation) {
    if (!this.reachTiles) this.reachTiles = [];
    const key = at ? at.c + "," + at.r + "," + at.range + "," + at.ok : "";
    if (key === this.reachKey) return;
    this.reachKey = key;
    const cells = [];
    if (at) {
      for (const cell of simulation.blocked) {
        const [c, r] = cell.split(",").map(Number);
        if (Math.hypot(c + 0.5 - (at.c + 0.5), r + 0.5 - (at.r + 0.5)) <= at.range) cells.push([c, r]);
      }
    }
    while (this.reachTiles.length < cells.length) {
      const tile = new THREE.Group();
      const fill = new THREE.Mesh(new THREE.PlaneGeometry(0.94, 0.94), new THREE.MeshBasicMaterial({ color: C.accent, transparent: true, opacity: 0.22, depthWrite: false }));
      fill.rotation.x = -Math.PI / 2;
      const edge = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.PlaneGeometry(0.94, 0.94)), new THREE.LineBasicMaterial({ color: C.accent, transparent: true, opacity: 0.85 }));
      edge.rotation.x = -Math.PI / 2;
      for (const part of [fill, edge]) part.raycast = () => {};
      tile.add(fill, edge);
      tile.userData = { fill, edge };
      this.board.add(tile);
      this.reachTiles.push(tile);
    }
    this.reachTiles.forEach((tile, i) => {
      const cell = cells[i];
      tile.visible = !!cell;
      if (!cell) return;
      tile.position.set(cell[0] + 0.5, 0.15, cell[1] + 0.5);
      const colour = at.ok ? C.white : C.accent;
      tile.userData.fill.material.color.set(colour);
      tile.userData.edge.material.color.set(colour);
    });
  }

  // ---- Enemies, shots, flashes ----------------------------------------------
  enemyMesh(type, mut) {
    const spec = specFor(type, mut);
    const look = MUT_LOOK[mut];
    const g = new THREE.Group();
    // A mutated cube is lit from inside in its own colour, so it reads at a
    // glance against a board of grey ones.
    const mat = new THREE.MeshLambertMaterial({ color: spec.colour, emissive: mut ? spec.colour : "#000000", emissiveIntensity: mut ? 0.45 : 0 });
    const body = new THREE.Group();
    const s = spec.size;
    // A cube of the type's size; the heavier types wear a dark band.
    const w = s * 1.7;
    const cube = new THREE.Mesh(new THREE.BoxGeometry(w, w, w), mat);
    cube.position.y = w / 2; cube.castShadow = true; body.add(cube);
    const dark = new THREE.MeshLambertMaterial({ color: "#3a3635" });
    const heavy = ["armoured", "boss", "tank", "juggernaut", "titan", "warden", "regen", "necromancer", "colossus", "hydra", "aegis", "revenant", "devourer", "brood", "courser", "geode"].includes(type);
    if (heavy) {
      // Dark bands: one for the armoured, two for the tank and up, three for the colossus.
      const bands = type === "armoured" || type === "boss" || type === "warden" || type === "regen" || type === "courser" || type === "geode" ? [0.5] : type === "colossus" || type === "devourer" ? [0.22, 0.5, 0.78] : [0.3, 0.7];
      for (const at of bands) { const band = new THREE.Mesh(new THREE.BoxGeometry(w * 1.04, w * 0.16, w * 1.04), dark); band.position.y = w * at; body.add(band); }
    }
    if (type === "boss" || type === "titan" || type === "colossus" || type === "devourer") {
      // A smaller cube riding on top; the big ones' are bigger and banded too.
      const k = type === "devourer" ? 0.76 : type === "colossus" ? 0.7 : type === "titan" ? 0.62 : 0.5;
      const cap = new THREE.Mesh(new THREE.BoxGeometry(w * k, w * k, w * k), type === "titan" ? mat : dark);
      cap.position.y = w + w * k / 2; cap.castShadow = true; body.add(cap);
      if (type === "titan" || type === "colossus" || type === "devourer") { const band = new THREE.Mesh(new THREE.BoxGeometry(w * k * 1.04, w * 0.12, w * k * 1.04), dark); band.position.y = w + w * k / 2; body.add(band); }
    }
    if (type === "necromancer") {
      // A tall dark cowl on top, and a pale cube held out front like a lantern.
      const cowl = new THREE.Mesh(new THREE.BoxGeometry(w * 0.55, w * 0.6, w * 0.55), dark); cowl.position.y = w + w * 0.3; body.add(cowl);
      const lantern = new THREE.Mesh(new THREE.BoxGeometry(w * 0.22, w * 0.22, w * 0.22), new THREE.MeshBasicMaterial({ color: "#e6e2e2" })); lantern.position.set(w * 0.7, w * 0.75, 0); body.add(lantern);
    }
    if (type === "bomber") {
      // A dark fuse cube on top.
      const fuse = new THREE.Mesh(new THREE.BoxGeometry(w * 0.25, w * 0.4, w * 0.25), dark); fuse.position.y = w + w * 0.2; body.add(fuse);
    }
    if (type === "charger") {
      // A dark wedge across the front.
      const nose = new THREE.Mesh(new THREE.BoxGeometry(w * 0.2, w * 0.6, w * 1.04), dark); nose.position.set(w * 0.5, w * 0.5, 0); body.add(nose);
    }
    if (type === "warden") {
      // A ring on the ground marking what it guards.
      const ring = new THREE.Mesh(new THREE.RingGeometry(ENEMIES.warden.guard - 0.06, ENEMIES.warden.guard, 40), new THREE.MeshBasicMaterial({ color: "#8f8b8b", transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false }));
      ring.rotation.x = -Math.PI / 2; ring.position.y = 0.13; body.add(ring);
    }
    if (type === "regen") {
      // A light seam along the top.
      const seam = new THREE.Mesh(new THREE.BoxGeometry(w * 1.04, w * 0.08, w * 0.16), new THREE.MeshLambertMaterial({ color: "#e6e2e2" })); seam.position.y = w; body.add(seam);
    }
    let shield = null;
    if (type === "shield" || type === "juggernaut" || type === "colossus" || type === "aegis" || type === "devourer") {
      // A translucent shell that vanishes once the shield is burned off.
      shield = new THREE.Mesh(new THREE.BoxGeometry(w * 1.35, w * 1.35, w * 1.35), new THREE.MeshLambertMaterial({ color: "#f3f2f2", transparent: true, opacity: 0.28, depthWrite: false }));
      shield.position.y = w / 2; body.add(shield);
    }
    if (type === "medic") {
      // A dark cross on top.
      for (const [sx, sz] of [[0.6, 0.18], [0.18, 0.6]]) { const bar = new THREE.Mesh(new THREE.BoxGeometry(w * sx, w * 0.1, w * sz), dark); bar.position.y = w + w * 0.05; body.add(bar); }
    }
    if (type === "splitter" || type === "hydra" || type === "brood") {
      // Seams where it will come apart: one for the splitter, a cross for the
      // hydra, and a cross with a seam across the top for the broodmother,
      // which comes apart into things that come apart again.
      const seam = new THREE.Mesh(new THREE.BoxGeometry(w * 0.08, w * 1.03, w * 1.03), dark);
      seam.position.y = w / 2; body.add(seam);
      if (type === "hydra" || type === "brood") { const cross = new THREE.Mesh(new THREE.BoxGeometry(w * 1.03, w * 1.03, w * 0.08), dark); cross.position.y = w / 2; body.add(cross); }
      if (type === "brood") {
        const lid = new THREE.Mesh(new THREE.BoxGeometry(w * 1.05, w * 0.1, w * 0.3), dark);
        lid.position.y = w; body.add(lid);
        // Three pale cells on the lid, one for each hydra waiting inside.
        for (let k = 0; k < 3; k++) {
          const egg = new THREE.Mesh(new THREE.BoxGeometry(w * 0.16, w * 0.16, w * 0.16), new THREE.MeshLambertMaterial({ color: "#c9c5c5" }));
          egg.position.set((k - 1) * w * 0.3, w + w * 0.1, 0); body.add(egg);
        }
      }
    }
    if (type === "blink") {
      // A pale fin swept back off its top, like something already half gone.
      const fin = new THREE.Mesh(new THREE.BoxGeometry(w * 0.7, w * 0.1, w * 0.16), new THREE.MeshLambertMaterial({ color: "#f3f2f2" }));
      fin.position.set(-w * 0.25, w + w * 0.06, 0); fin.rotation.z = 0.35; body.add(fin);
    }
    if (type === "aegis") {
      // A ring on the ground marking what it shields, and a pale crown.
      const ring = new THREE.Mesh(new THREE.RingGeometry(ENEMIES.aegis.aegis.range - 0.07, ENEMIES.aegis.aegis.range, 40), new THREE.MeshBasicMaterial({ color: "#d7d3d3", transparent: true, opacity: 0.3, side: THREE.DoubleSide, depthWrite: false }));
      ring.rotation.x = -Math.PI / 2; ring.position.y = 0.13; body.add(ring);
      const crown = new THREE.Mesh(new THREE.TorusGeometry(w * 0.5, w * 0.07, 6, 16), new THREE.MeshLambertMaterial({ color: "#e6e2e2" }));
      crown.rotation.x = Math.PI / 2; crown.position.y = w + w * 0.1; body.add(crown);
    }
    if (type === "revenant") {
      // A pale core showing through a gap in the shell: the part that gets up again.
      const core = new THREE.Mesh(new THREE.BoxGeometry(w * 0.45, w * 0.45, w * 1.1), new THREE.MeshBasicMaterial({ color: "#ffb199" }));
      core.position.y = w / 2; body.add(core);
    }
    if (spec.phase) { mat.transparent = true; mat.depthWrite = true; }
    if (spec.hidden) { mat.transparent = true; mat.opacity = 0.38; }
    // The mutation itself: a loose shell of light around the cube, a ring of
    // it on the ground, and for the big ones a second shell further out.
    let aura = null;
    if (mut) {
      aura = new THREE.Group();
      const shell = new THREE.Mesh(new THREE.BoxGeometry(w * 1.22, w * 1.22, w * 1.22), new THREE.MeshBasicMaterial({ color: spec.glow || spec.colour, transparent: true, opacity: 0.18, depthWrite: false }));
      shell.position.y = w / 2;
      const wire = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(w * 1.34, w * 1.34, w * 1.34)), new THREE.LineBasicMaterial({ color: spec.glow || spec.colour, transparent: true, opacity: 0.35, depthWrite: false }));
      wire.position.y = w / 2;
      const ring = new THREE.Mesh(new THREE.RingGeometry(w * 0.72, w * 0.86, 24), new THREE.MeshBasicMaterial({ color: spec.colour, transparent: true, opacity: 0.4, side: THREE.DoubleSide, depthWrite: false }));
      ring.rotation.x = -Math.PI / 2; ring.position.y = 0.13;
      aura.add(shell, wire, ring);
      aura.userData = { shell, wire, ring, pulse: (look && look.pulse) || 2 };
      for (const part of [shell, wire, ring]) part.raycast = () => {};
      body.add(aura);
    }
    g.add(body);
    // The health bar and its fills share a pivot that turns to face the camera.
    // The shell sits in the same track, in front of the health: it empties
    // first and uncovers the health underneath, so one bar tells both.
    const hud = new THREE.Group();
    const bar = new THREE.Mesh(this.geo.bar, this.mat.bar);
    const fill = new THREE.Mesh(this.geo.bar, this.mat.barFill);
    const shell = new THREE.Mesh(this.geo.bar, this.mat.barShield);
    bar.scale.x = fill.scale.x = shell.scale.x = s * 2;
    // All three in the same place, so the shell lies over the health in one
    // track. The depth buffer is told which comes first by an offset on the
    // fill and shell materials, not by moving them apart: moved apart, the
    // camera looking down saw them as separate bars stacked on each other.
    shell.visible = false;
    hud.position.y = w * (type === "boss" || type === "titan" || type === "colossus" || type === "devourer" ? 1.8 : type === "necromancer" ? 1.7 : type === "bomber" || type === "aegis" || type === "brood" ? 1.35 : 1) + 0.2;
    hud.add(bar, fill, shell);
    for (const part of [bar, fill, shell]) part.raycast = () => {};
    hud.visible = false;
    g.add(hud);
    // A cube knocked silly wears a ring of stars over it, the way a cartoon
    // does it. The ring hangs off the group rather than the body, so it keeps
    // level while the cube underneath is reeling about.
    const dizzy = new THREE.Group();
    dizzy.position.y = w * 1.02;
    const starMat = new THREE.MeshBasicMaterial({ color: "#ffd98a" });
    for (let i = 0; i < 5; i++) {
      const star = new THREE.Mesh(new THREE.BoxGeometry(w * 0.15, w * 0.15, w * 0.15), starMat);
      const a = (i / 5) * Math.PI * 2;
      star.position.set(Math.cos(a) * w * 0.62, 0, Math.sin(a) * w * 0.62);
      star.raycast = () => {};
      dizzy.add(star);
    }
    dizzy.visible = false;
    g.add(dizzy);
    g.userData = { body, hud, bar, fill, shell, dizzy, lift: w * 0.12, shield, spec, mat, aura, look, legs: [], last: null, stride: 0 };
    return g;
  }

  syncEnemies(simulation, view) {
    const seen = new Set();
    const now = performance.now() / 1000;
    // The cube being watched stands in the same white outline a selected
    // tower does, so the two read as one idea.
    const watched = view && view.watching && !view.watching.dead ? view.watching : null;
    if (!this.watchBox) {
      this.watchBox = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(0.9, 0.1, 0.9)), new THREE.LineBasicMaterial({ color: C.white, transparent: true, opacity: 0.8 }));
      this.watchBox.raycast = () => {};
      this.board.add(this.watchBox);
    }
    this.watchBox.visible = !!watched;
    if (watched) {
      this.watchBox.position.set(watched.x, 0.05, watched.y);
      const k = watched.spec.size * 2.6;
      this.watchBox.scale.set(k, 1, k);
    }
    for (const e of simulation.enemies) {
      seen.add(e.id);
      let m = this.enemyMeshes.get(e.id);
      if (!m) { m = this.enemyMesh(e.type, e.mut); m.userData.eid = e.id; this.board.add(m); this.enemyMeshes.set(e.id, m); }
      const d = m.userData;
      // Face the way it is moving.
      if (d.last) {
        const dx = e.x - d.last.x, dz = e.y - d.last.y;
        if (Math.abs(dx) + Math.abs(dz) > 1e-4) m.rotation.y = -Math.atan2(dz, dx);
        d.stride += Math.hypot(dx, dz) * 9;
      }
      d.last = { x: e.x, y: e.y };
      m.position.set(e.x, 0, e.y);
      // A walk: the body bobs and the feet alternate.
      const bob = Math.abs(Math.sin(d.stride)) * 0.03;
      d.body.position.y = bob;
      // Knocked silly: the cube itself holds still, lost, and the ring of
      // stars over it is what says so.
      if (e.dazed > 0) {
        d.dizzy.visible = !e.immune;
        d.dizzy.rotation.y = now * 6;
        d.dizzy.children.forEach((star, i) => {
          star.position.y = Math.sin(now * 7 + i * 1.3) * d.lift;
          star.rotation.set(now * 5, now * 4, 0);
        });
      } else if (d.dizzy.visible) {
        d.dizzy.visible = false;
      }
      d.legs.forEach((leg, i) => { leg.position.y = leg.userData.y0 + Math.max(0, Math.sin(d.stride + i * Math.PI)) * 0.08; });
      // Taking shape out of the first portal, fading into the last.
      const doors = this.routeDoors[e.route || 0];
      const entering = Math.min(1, Math.max(0, (e.distance - doors.doorIn + 0.1) / 0.9));
      const leaving = Math.min(1, Math.max(0, (doors.doorOut - e.distance + 0.1) / 0.9));
      const k = Math.min(entering, leaving);
      m.visible = k > 0.02;
      m.scale.setScalar(0.2 + 0.8 * k);
      if (entering < 1 && this.portals[doors.inDoor]) this.portals[doors.inDoor].pulse = 1;
      if (leaving < 1 && this.portals[doors.outDoor]) this.portals[doors.outDoor].pulse = 1;
      // The most shell this cube has ever carried sets the scale, since an
      // aegis can wrap one that started with none.
      d.peak = Math.max(d.peak || e.maxShield || 0, e.shield);
      const hurt = e.hp < e.maxHp || (d.peak > 0 && e.shield < d.peak);
      d.hud.visible = hurt && k >= 1;
      if (hurt) {
        const track = d.spec.size * 2;
        const frac = Math.max(0, e.hp / e.maxHp);
        d.fill.scale.x = track * frac;
        d.fill.position.x = -track * (1 - frac) / 2;
        // The shell rides the same track, ahead of the health.
        const shell = d.peak > 0 ? Math.max(0, Math.min(1, e.shield / d.peak)) : 0;
        d.shell.visible = shell > 0;
        if (shell > 0) {
          d.shell.scale.x = track * shell;
          d.shell.position.x = -track * (1 - shell) / 2;
        }
        d.hud.rotation.y = -this.yaw + Math.PI / 2 - m.rotation.y;
      }
      if (d.shield) d.shield.visible = e.shield > 0;
      if (d.spec.phase) d.mat.opacity = e.phased ? 0.2 : d.spec.hidden && !e.revealed ? 0.38 : 1;
      else if (d.spec.hidden) d.mat.opacity = e.revealed ? 0.9 : 0.38;
      // A necromancer trails dark motes while it walks.
      if (d.spec.raise && k >= 1) {
        d.emit = (d.emit || 0) + this.dt * 14;
        while (d.emit >= 1) { d.emit -= 1; this.particle({ x: e.x + (Math.random() - 0.5) * 0.5, y: 0.1 + Math.random() * 0.3, z: e.y + (Math.random() - 0.5) * 0.5, vx: 0, vy: 0.3 + Math.random() * 0.4, vz: 0, life: 0.8 + Math.random() * 0.5, size: 0.03 + Math.random() * 0.03, gravity: -0.2, colour: Math.random() < 0.5 ? "#3a3635" : "#6a6666" }); }
      }
      // A charger pales as it picks up speed, evenly, rather than flicking
      // white the moment it passes half health.
      d.mat.color.set(e.slow > 0 || e.stunLeft > 0 ? "#d7d3d3" : e.burn > 0 ? "#e8785c" : d.spec.colour);
      // In a suppressor's field it greys over, whatever else is on it, and a
      // mutation's own glow is damped along with it, or it would still shine.
      if (e.hush > 0) d.mat.color.lerp(HUSHED, 0.65);
      if (d.spec.mutation) d.mat.emissiveIntensity = e.hush > 0 ? 0.06 : 0.45;
      // Poisoned: a sickly green that throbs, under whatever frost or fire
      // is doing to it. The throb is what says it is still working.
      if (e.venom > 0 && !e.slow && !e.burn) d.mat.color.lerp(VENOM, 0.55 + 0.25 * Math.sin(now * 5 + e.id));
      if (d.spec.charge && !e.slow && !e.burn && !(e.venom > 0)) {
        const ramp = chargeAt(d.spec, e.hp / e.maxHp) - 1;
        d.mat.color.lerp(HOT, Math.min(1, ramp / Math.max(0.001, d.spec.charge - 1)));
      }
      // The shell breathes, turns the other way to the cube, and dies away
      // while the cube is phased out.
      if (d.aura) {
        const u = d.aura.userData;
        const beat = 0.5 + 0.5 * Math.sin(now * u.pulse + e.id);
        u.shell.material.opacity = (e.phased ? 0.05 : 0.12) + beat * 0.14;
        u.wire.material.opacity = (e.phased ? 0.06 : 0.2) + beat * 0.28;
        u.ring.material.opacity = 0.2 + beat * 0.3;
        u.ring.scale.setScalar(0.9 + beat * 0.2);
        d.aura.rotation.y = -now * 0.6;
        // Silenced, a mutation's light goes dull.
        if (e.hush > 0) { u.shell.material.opacity *= 0.3; u.wire.material.opacity *= 0.3; u.ring.material.opacity *= 0.3; }
      }
      // Wading through tar: it drags strings of it up off its feet and they
      // fall back, so the slow can be seen on the cube and not only felt.
      if (e.mired > 0 && k >= 1 && !e.phased) {
        const look = tarLook(0, e.miredAcid ? 1 : 0);
        const w = d.spec.size * 1.7;
        d.tarTrail = (d.tarTrail || 0) + this.dt * (14 + d.spec.size * 12);
        while (d.tarTrail >= 1) {
          d.tarTrail -= 1;
          const a = Math.random() * Math.PI * 2, out = 0.4 + Math.random() * 0.9;
          this.particle({
            x: e.x + Math.cos(a) * w * 0.5, y: 0.14 + Math.random() * w * 0.4, z: e.y + Math.sin(a) * w * 0.5,
            vx: Math.cos(a) * out, vy: 0.9 + Math.random() * 1.1, vz: Math.sin(a) * out,
            life: 0.4 + Math.random() * 0.25, size: 0.055 + Math.random() * 0.055, gravity: 9,
            colour: Math.random() < 0.3 ? look.glint : look.drip, colour2: look.fill,
          });
        }
      }
      // Held by a lodestone: motes stream off it toward the stone.
      if (e.held > 0 && e.heldBy && k >= 1) {
        d.tether = (d.tether || 0) + this.dt * 12;
        while (d.tether >= 1) {
          d.tether -= 1;
          const dx = e.heldBy.x - e.x, dz = e.heldBy.y - e.y, len = Math.hypot(dx, dz) || 1;
          this.particle({ x: e.x, y: 0.2 + Math.random() * 0.3, z: e.y, vx: (dx / len) * 2.2, vy: 0.6, vz: (dz / len) * 2.2, life: Math.min(0.9, len / 2.2), size: 0.035, gravity: 0, colour: TOWERS.lodestone.colour, colour2: "#f3f2f2" });
        }
      }
      // What it leaves behind: embers, sparks, frost, motes of its own colour.
      if (d.look && k >= 1 && !e.phased) {
        // Trails give way to the fighting: the busier the pool, the less each
        // cube leaves behind, so a crowded wave still shows its hits.
        const room = Math.max(0, 1 - this.particles.length / this.pool.instanceMatrix.count);
        d.trail = (d.trail || 0) + this.dt * d.look.rate * (0.7 + d.spec.size) * room;
        const w2 = d.spec.size * 1.7;
        while (d.trail >= 1) {
          d.trail -= 1;
          const a = Math.random() * Math.PI * 2;
          this.particle({
            x: e.x + (Math.random() - 0.5) * w2, y: w2 * (0.15 + Math.random() * 0.9), z: e.y + (Math.random() - 0.5) * w2,
            vx: Math.cos(a) * d.look.out, vy: d.look.up * (0.6 + Math.random() * 0.8), vz: Math.sin(a) * d.look.out,
            life: d.look.life * (0.7 + Math.random() * 0.6), size: d.look.size * (0.7 + Math.random() * 0.7),
            gravity: d.look.gravity, colour: Math.random() < 0.5 ? d.spec.colour : d.spec.glow || d.spec.colour,
            colour2: d.look.fade,
          });
        }
      }
      // Alight: small flames lick up off it.
      // Poisoned: green drips run off it and beads rise from it.
      if (e.venom > 0 && k >= 1 && !e.phased) {
        d.ooze = (d.ooze || 0) + this.dt * 9 * (0.6 + d.spec.size * 2);
        const w = d.spec.size * 1.7;
        while (d.ooze >= 1) {
          d.ooze -= 1;
          const up = Math.random() < 0.4;
          this.particle({
            x: e.x + (Math.random() - 0.5) * w, y: w * (up ? 0.9 : 0.3 + Math.random() * 0.6), z: e.y + (Math.random() - 0.5) * w,
            vx: (Math.random() - 0.5) * 0.25, vy: up ? 0.5 + Math.random() * 0.4 : -0.1, vz: (Math.random() - 0.5) * 0.25,
            life: 0.45 + Math.random() * 0.35, size: 0.035 + Math.random() * 0.04, gravity: up ? -0.8 : 5,
            colour: Math.random() < 0.5 ? TOWERS.venom.colour : "#d7ef6a", colour2: "#3d5a12",
          });
        }
      }
      if (e.burn > 0 && k >= 1) {
        d.emit = (d.emit || 0) + this.dt * 22 * (0.6 + d.spec.size * 2);
        const w = d.spec.size * 1.7;
        while (d.emit >= 1) {
          d.emit -= 1;
          const hot = Math.random();
          this.particle({
            x: e.x + (Math.random() - 0.5) * w, y: w * (0.3 + Math.random() * 0.8), z: e.y + (Math.random() - 0.5) * w,
            vx: (Math.random() - 0.5) * 0.3, vy: 0.9 + Math.random() * 0.7, vz: (Math.random() - 0.5) * 0.3,
            life: 0.4 + Math.random() * 0.3, size: 0.045 + Math.random() * 0.055, gravity: -2,
            colour: hot > 0.6 ? "#fff1e6" : hot > 0.25 ? "#ffb199" : TOWERS.flame.colour,
            colour2: "#4a4646",
          });
        }
      }
    }
    for (const [id, m] of this.enemyMeshes) if (!seen.has(id)) { this.board.remove(m); this.enemyMeshes.delete(id); }
    // Portals turn slowly and flare when something passes.
    for (const portal of this.portals) {
      portal.ringA.rotation.x = now * 0.8; portal.ringB.rotation.x = -now * 1.3;
      portal.ringB.rotation.z = now * 0.5;
      portal.pulse = Math.max(0, portal.pulse - 0.04);
      portal.curtain.material.opacity = 0.16 + 0.06 * Math.sin(now * 2) + portal.pulse * 0.35;
      portal.ringA.material.opacity = 0.55 + portal.pulse * 0.45;
    }
  }

  // ---- Particles --------------------------------------------------------
  /** Add one small cube to the pool. */
  particle(p) {
    if (this.particles.length >= this.pool.instanceMatrix.count) this.particles.shift();
    p.max = p.life;
    p.colour = new THREE.Color(p.colour);
    if (p.colour2) p.colour2 = new THREE.Color(p.colour2);
    p.spin = Math.random() * Math.PI;
    this.particles.push(p);
  }

  /** An enemy comes apart: a burst of cubes in its colour that scatter and settle. */
  burst(e) {
    const spec = e.spec || ENEMIES[e.type];
    const w = spec.size * 1.7;
    const n = 10 + Math.round(spec.size * 30);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, sp = 1.2 + Math.random() * 2.4;
      this.particle({
        x: e.x + (Math.random() - 0.5) * w, y: w / 2 + (Math.random() - 0.5) * w, z: e.y + (Math.random() - 0.5) * w,
        vx: Math.cos(a) * sp, vy: 1.5 + Math.random() * 3, vz: Math.sin(a) * sp,
        life: 0.9 + Math.random() * 0.6, size: w * (0.18 + Math.random() * 0.2), gravity: 12, colour: spec.colour,
        colour2: spec.mutation ? spec.glow : undefined,
      });
    }
    // A mutated cube goes off brighter, in a ring of its own light.
    if (spec.mutation) {
      for (let i = 0; i < 14; i++) {
        const a = Math.random() * Math.PI * 2, sp = 2 + Math.random() * 3;
        this.particle({
          x: e.x, y: w * 0.5, z: e.y, vx: Math.cos(a) * sp, vy: 0.6 + Math.random() * 1.6, vz: Math.sin(a) * sp,
          life: 0.5 + Math.random() * 0.4, size: w * 0.16, gravity: 2, colour: spec.glow || spec.colour, colour2: spec.colour,
        });
      }
    }
  }

  /** The lodestone's stone hovers, its rings turn against each other, and its field ripples. */
  animateLodestone(m, t) {
    const now = performance.now() / 1000;
    const u = m.userData;
    if (u.stoneRest === undefined) u.stoneRest = u.stone.position.y;
    u.stone.position.y = u.stoneRest + Math.sin(now * 2.2 + t.id) * 0.03;
    u.stone.rotation.y = now * 0.6;
    // Down, its rings hang still.
    if (!(t.stunned > 0)) (u.rings || []).forEach((spin, i) => { spin.rotation.y += this.dt * (0.7 + i * 0.5) * (i % 2 ? -1 : 1); });
    for (const child of m.children) if (child.userData.field) child.userData.field.material.uniforms.time.value = now;
  }

  /**
   * The urn breathes with what it holds: the flame stands taller and the runes
   * brighten as it fills, flickering all the while, and wisps rise off it
   * faster the fuller it is. A necromancer feeding on it draws a thread of
   * souls away toward itself.
   */
  animateUrn(m, t, stats) {
    const now = performance.now() / 1000;
    const u = m.userData.urn;
    const hold = stats.urn.hold * (stats.urn.early ? 2 / 3 : 1);
    const fill = Math.min(1, (t.souls || 0) / Math.max(1, hold));
    // Eased toward the real fill, so a soul arriving swells it rather than jumps it.
    u.shown = (u.shown || 0) + (fill - (u.shown || 0)) * Math.min(1, this.dt * 5);
    const flick = 0.06 * Math.sin(now * 13 + t.id) + 0.04 * Math.sin(now * 23 + t.id * 2);
    u.flame.scale.set(0.8 + u.shown * 0.4 + flick, 0.35 + u.shown * 1.25 + flick * 2, 0.8 + u.shown * 0.4 - flick);
    u.flame.rotation.y = now * 1.8;
    u.flame.children.forEach((tongue) => {
      const lick = 1 + 0.12 * Math.sin(now * 9 + tongue.userData.phase + t.id);
      tongue.scale.set(1, lick, 1);
      tongue.material.opacity = tongue.userData.base * (0.55 + u.shown * 0.6);
    });
    const beat = 0.5 + 0.5 * Math.sin(now * 3 + t.id);
    for (const r of u.runes) r.material.opacity = 0.15 + u.shown * 0.7 + beat * 0.12 * u.shown;
    u.mouth.material.opacity = 0.35 + u.shown * 0.6;
    u.stones.forEach((s, i) => {
      const a = now * 1.4 + s.userData.phase;
      s.position.set(Math.cos(a) * 0.42, u.mouthY - 0.12 + Math.sin(a * 2 + i) * 0.08, Math.sin(a) * 0.42);
      s.rotation.set(a, a * 1.3, 0);
    });
    if (u.crown) { u.crown.rotation.z = now * 2; u.crown.material.opacity = 0.25 + u.shown * 0.6; }
    if (u.echo) { u.echo.rotation.y = now * 2.5; u.echo.position.y = u.mouthY + 0.62 + Math.sin(now * 2) * 0.05; u.echo.material.opacity = 0.3 + u.shown * 0.7; }
    // Wisps off the flame, more the fuller it is.
    const cx = t.c + 0.5, cz = t.r + 0.5, top = u.mouthY + 0.1;
    u.wisp = (u.wisp || 0) + this.dt * (2 + u.shown * 16);
    while (u.wisp >= 1) {
      u.wisp -= 1;
      const a = Math.random() * Math.PI * 2, r = Math.random() * 0.12;
      this.particle({
        x: cx + Math.cos(a) * r, y: top + Math.random() * 0.2, z: cz + Math.sin(a) * r,
        vx: Math.cos(a) * 0.15, vy: 0.5 + Math.random() * 0.6, vz: Math.sin(a) * 0.15,
        life: 0.7 + Math.random() * 0.6, size: 0.025 + Math.random() * 0.03, gravity: -0.35,
        colour: Math.random() < 0.5 ? "#eafff5" : "#5dffb6", colour2: "#8f7bff",
      });
    }
    // Being fed on: souls pulled out of the mouth toward the necromancer.
    const e = t.drainer;
    if (e && !e.dead) {
      u.drain = (u.drain || 0) + this.dt * 14;
      while (u.drain >= 1) {
        u.drain -= 1;
        this.particle({
          x: cx + (Math.random() - 0.5) * 0.1, y: top, z: cz + (Math.random() - 0.5) * 0.1,
          vx: (Math.random() - 0.5) * 0.6, vy: 1, vz: (Math.random() - 0.5) * 0.6,
          life: 2.5, size: 0.035 + Math.random() * 0.02, gravity: 0,
          colour: "#8a7fb0", colour2: "#2a2531",
          home: () => (e.dead ? null : { x: e.x, y: e.spec.size * 0.9, z: e.y }), homeSpeed: 3, swirl: 0.6,
        });
      }
    }
  }

  /**
   * The boulders on the road. Each rolls without slipping, turned about the
   * line across its path by the distance it covered over its radius, so it
   * looks planted rather than skating, and it throws dust behind it that
   * thickens with its pace.
   */
  syncBoulders(simulation) {
    if (!this.boulderMeshes) this.boulderMeshes = new Map();
    const seen = new Set();
    const stoneMat = this.boulderMat || (this.boulderMat = new THREE.MeshPhongMaterial({ color: TOWERS.boulder.colour, specular: "#3a342c", shininess: 10, flatShading: true }));
    const bandMat = this.boulderBand || (this.boulderBand = new THREE.MeshPhongMaterial({ color: "#5c534a", flatShading: true }));
    for (const b of simulation.boulders) {
      if (b.wait > 0) continue;
      seen.add(b.id);
      let m = this.boulderMeshes.get(b.id);
      const r = 0.2 + b.tier * 0.015;
      if (!m) {
        m = new THREE.Group();
        // Its own stone, so this one can darken as it wears without the rest.
        const rock = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), stoneMat.clone());
        rock.castShadow = true;
        // Carved bands, so the roll can be seen.
        for (const [rx, ry] of [[0, 0], [Math.PI / 2, 0.6]]) {
          const band = new THREE.Mesh(new THREE.TorusGeometry(r * 1.0, 0.018, 4, 18), bandMat);
          band.rotation.set(rx, ry, 0);
          rock.add(band);
        }
        // Cracks, laid on its surface up front and shown one by one as it
        // loses weight: each a jagged run of short dark strokes.
        const cracks = [];
        const crackMat = this.crackMat || (this.crackMat = new THREE.MeshBasicMaterial({ color: "#241f1b" }));
        // Spread evenly over the stone rather than thrown at random, which
        // could put nearly all of them round the back, and turned by a random
        // amount so no two boulders crack alike. They are revealed in an order
        // that jumps about the surface, so the first few are not bunched.
        const spin = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.random() * 6.3, Math.random() * 6.3, Math.random() * 6.3));
        const COUNT = 8, order = [0, 5, 2, 7, 3, 6, 1, 4];
        for (const i of order) {
          const y = 1 - (2 * (i + 0.5)) / COUNT, ring = Math.sqrt(1 - y * y), phi = i * 2.39996;
          const n = new THREE.Vector3(Math.cos(phi) * ring, y, Math.sin(phi) * ring).applyQuaternion(spin);
          const tan = new THREE.Vector3().crossVectors(n, new THREE.Vector3(0.3, 1, 0.2)).normalize();
          const bi = new THREE.Vector3().crossVectors(n, tan);
          const crack = new THREE.Group();
          // A jagged run across the face, and a shorter branch off its middle.
          const run = (from, along, side, steps, spread) => {
            let prev = null, mid = null;
            for (let k = 0; k <= steps; k++) {
              const s = (k - (from ? 0 : steps / 2)) * spread;
              const pt = (from ? from.clone() : n.clone()).addScaledVector(along, s).addScaledVector(side, (Math.random() - 0.5) * 0.18).normalize().multiplyScalar(r * 1.03);
              if (prev) {
                const dir = pt.clone().sub(prev), len = dir.length();
                const stroke = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, len * 1.15), crackMat);
                stroke.position.copy(prev).addScaledVector(dir, 0.5);
                stroke.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir.normalize());
                crack.add(stroke);
              }
              if (k === Math.floor(steps / 2)) mid = pt.clone().normalize();
              prev = pt;
            }
            return mid;
          };
          const mid = run(null, tan, bi, 4, 0.16);
          run(mid, bi, tan, 2, 0.14);
          crack.visible = false;
          rock.add(crack);
          cracks.push(crack);
        }
        m.add(rock);
        m.userData = { rock, r, last: null, cracks };
        this.board.add(m);
        this.boulderMeshes.set(b.id, m);
      }
      const u = m.userData;
      m.position.set(b.x, 0.12 + u.r, b.y);
      // As it wears down it cracks, a crack at a time.
      const worn = Math.max(0, Math.min(1, 1 - b.weight / (b.max || b.weight || 1)));
      u.cracks.forEach((crack, i) => { crack.visible = worn > (i + 0.5) / (u.cracks.length + 1); });
      if (u.worn !== worn) { u.worn = worn; u.rock.material.color.set(TOWERS.boulder.colour).lerp(WORN_STONE, worn * 0.55); }
      if (u.last) {
        const dx = b.x - u.last.x, dz = b.y - u.last.y, dist = Math.hypot(dx, dz);
        if (dist > 1e-5) {
          const axis = new THREE.Vector3(dz / dist, 0, -dx / dist);
          u.rock.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(axis, dist / u.r));
          // Dust kicked up behind, thicker the faster it goes.
          u.dust = (u.dust || 0) + dist * 9;
          while (u.dust >= 1) {
            u.dust -= 1;
            const a = Math.random() * Math.PI * 2;
            this.particle({
              x: b.x - (dx / dist) * u.r + Math.cos(a) * 0.12, y: 0.14, z: b.y - (dz / dist) * u.r + Math.sin(a) * 0.12,
              vx: -(dx / dist) * 0.4 + Math.cos(a) * 0.3, vy: 0.35 + Math.random() * 0.5, vz: -(dz / dist) * 0.4 + Math.sin(a) * 0.3,
              life: 0.5 + Math.random() * 0.4, size: 0.05 + Math.random() * 0.06, gravity: -0.3,
              colour: Math.random() < 0.5 ? "#8f8577" : "#6b6462", colour2: "#2e2b2a",
            });
          }
        }
      }
      u.last = { x: b.x, y: b.y };
    }
    for (const [id, m] of this.boulderMeshes) if (!seen.has(id)) { this.board.remove(m); this.boulderMeshes.delete(id); }
  }

  /**
   * A cube goes through a rift: a tear opens where it stood and sucks inward
   * as it closes, and another opens where it drops out, bursting outward.
   */
  rift(ev) {
    if (!ev.open) this.openTear(ev.from.x, ev.from.y, ev.from.h, false);
    this.openTear(ev.to.x, ev.to.y, ev.to.h, true);
    for (let i = 0; i < 18; i++) {
      const a = Math.random() * Math.PI * 2, r = 0.45 + Math.random() * 0.2;
      const at = { x: ev.from.x, y: ev.from.h, z: ev.from.y };
      this.particle({ x: at.x + Math.cos(a) * r, y: at.y + (Math.random() - 0.5) * 0.6, z: at.z + Math.sin(a) * r, vx: 0, vy: 0, vz: 0, life: 0.6, size: 0.03 + Math.random() * 0.03, gravity: 0, colour: "#c9f4ff", colour2: TOWERS.rift.colour, home: () => at, homeSpeed: 3, swirl: 1.4 });
    }
    for (let i = 0; i < 22; i++) {
      const a = Math.random() * Math.PI * 2, sp = 1 + Math.random() * 2;
      this.particle({ x: ev.to.x, y: ev.to.h, z: ev.to.y, vx: Math.cos(a) * sp, vy: (Math.random() - 0.3) * 2, vz: Math.sin(a) * sp, life: 0.4 + Math.random() * 0.3, size: 0.03 + Math.random() * 0.04, gravity: 0, colour: i % 2 ? "#c9f4ff" : TOWERS.rift.colour, colour2: "#05060a" });
    }
  }

  /** A cube going into a black hole: it comes apart into motes that spiral in. */
  swallow(ev) {
    const at = { x: ev.x, y: 0.45, z: ev.y };
    for (let i = 0; i < 16; i++) {
      const a = Math.random() * Math.PI * 2, r = Math.random() * ev.size;
      this.particle({ x: ev.x + Math.cos(a) * r, y: ev.h * (0.4 + Math.random() * 0.8), z: ev.y + Math.sin(a) * r, vx: 0, vy: 0, vz: 0, life: 0.5, size: 0.03 + Math.random() * 0.04, gravity: 0, colour: ev.colour, colour2: HOLE_RIM, home: () => at, homeSpeed: 4, swirl: 2 });
    }
  }

  /** A tear standing in the air: a black heart ringed with light, opening then closing. */
  openTear(x, z, h, out, hold = 0, hole = false) {
    if (!this.tears) this.tears = [];
    let tear = this.tears.find((q) => q.life <= 0);
    if (!tear) {
      const group = new THREE.Group();
      const heart = new THREE.Mesh(new THREE.CircleGeometry(0.245, 32), new THREE.MeshBasicMaterial({ color: "#05060a", transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false }));
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.248, 0.32, 40), new THREE.MeshBasicMaterial({ color: TOWERS.rift.colour, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
      heart.renderOrder = 1; ring.renderOrder = 2;
      for (const part of [heart, ring]) { part.raycast = () => {}; group.add(part); }
      this.board.add(group);
      tear = { group, heart, ring, life: 0 };
      this.tears.push(tear);
    }
    tear.life = 1;
    tear.hold = hold; // how long it stands fully open before it starts to close
    tear.out = out;
    // A black hole is bigger, rimmed in violet, and draws light into itself.
    tear.hole = hole;
    tear.ring.material.color.set(hole ? HOLE_RIM : TOWERS.rift.colour);
    tear.heart.material.color.set(hole ? "#000000" : "#05060a");
    tear.group.position.set(x, Math.max(0.3, h), z);
    tear.group.visible = true;
  }

  /** Tears open fast and close slower, always turned to face the camera. */
  syncTears() {
    if (!this.tears) return;
    for (const tear of this.tears) {
      if (tear.life <= 0) { tear.group.visible = false; continue; }
      if (tear.hold > 0 && tear.life <= 0.8) tear.hold -= this.dt; // standing open
      else tear.life -= this.dt * 1.8;
      const k = Math.max(0, tear.life);
      // Open over the first fifth, then close.
      const size = k > 0.8 ? (1 - k) / 0.2 : k / 0.8;
      tear.group.scale.set(size * (tear.hole ? 1.5 : 0.8), size * (tear.hole ? 1.9 : 1.5), 1);
      if (tear.hole && size > 0.6 && Math.random() < this.dt * 40) {
        // Motes drawn in from round about, spiralling down into it.
        const p = tear.group.position, a = Math.random() * Math.PI * 2, r = 0.7 + Math.random() * 0.5;
        const at = { x: p.x, y: p.y, z: p.z };
        this.particle({ x: p.x + Math.cos(a) * r, y: p.y + (Math.random() - 0.5) * 0.8, z: p.z + Math.sin(a) * r, vx: 0, vy: 0, vz: 0, life: 0.9, size: 0.02 + Math.random() * 0.03, gravity: 0, colour: Math.random() < 0.5 ? HOLE_RIM : "#e6dcff", colour2: "#05060a", home: () => at, homeSpeed: 2.2, swirl: 1.8 });
      }
      tear.group.rotation.y = -this.yaw + Math.PI / 2;
      tear.ring.material.opacity = 0.9 * Math.min(1, size * 1.5);
      tear.heart.material.opacity = 0.9 * size;
    }
  }

  /** A boulder runs into something: grit and chips thrown up where it hit. */
  crush(ev) {
    const n = ev.big ? 16 : 9;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, sp = 0.8 + Math.random() * (ev.big ? 2.6 : 1.8);
      this.particle({
        x: ev.x, y: 0.14 + Math.random() * ev.h, z: ev.y,
        vx: Math.cos(a) * sp, vy: 1 + Math.random() * 2, vz: Math.sin(a) * sp,
        life: 0.4 + Math.random() * 0.3, size: 0.04 + Math.random() * 0.05, gravity: 10,
        colour: Math.random() < 0.6 ? TOWERS.boulder.colour : "#6b6462",
      });
    }
    if (ev.big) this.shockRing(ev.x, ev.y, 0.7, TOWERS.boulder.colour);
  }

  /** A boulder swings round a corner: a spray of grit off the outside of the turn. */
  grind(ev) {
    for (let i = 0; i < 10; i++) {
      const a = Math.random() * Math.PI * 2, sp = 0.6 + Math.random() * 1.4;
      this.particle({ x: ev.x, y: 0.14, z: ev.y, vx: Math.cos(a) * sp, vy: 0.4 + Math.random() * 0.8, vz: Math.sin(a) * sp, life: 0.35 + Math.random() * 0.3, size: 0.035 + Math.random() * 0.04, gravity: 6, colour: "#8f8577" });
    }
  }

  /** A boulder breaks: it splits into rolling chunks and a cloud of dust. */
  rubble(ev) {
    // One crumbling at the end of a wave comes apart where it stands, in a
    // heap of chunks sliding down off it, rather than bursting outward.
    if (ev.crumble) {
      for (let i = 0; i < 30; i++) {
        const a = Math.random() * Math.PI * 2, r = Math.random() * 0.2, sp = 0.3 + Math.random() * 1.1;
        this.particle({
          x: ev.x + Math.cos(a) * r, y: 0.15 + Math.random() * 0.4, z: ev.y + Math.sin(a) * r,
          vx: Math.cos(a) * sp, vy: Math.random() * 1.2, vz: Math.sin(a) * sp,
          life: 0.8 + Math.random() * 0.6, size: 0.05 + Math.random() * 0.09, gravity: 9,
          colour: Math.random() < 0.6 ? TOWERS.boulder.colour : "#6f6558",
        });
      }
      for (let i = 0; i < 10; i++) {
        const a = Math.random() * Math.PI * 2;
        this.particle({ x: ev.x, y: 0.2, z: ev.y, vx: Math.cos(a) * 0.35, vy: 0.4 + Math.random() * 0.3, vz: Math.sin(a) * 0.35, life: 1 + Math.random() * 0.6, size: 0.1 + Math.random() * 0.08, gravity: -0.15, colour: "#8f8577", colour2: "#2e2b2a" });
      }
      return;
    }
    for (let i = 0; i < 22; i++) {
      const a = Math.random() * Math.PI * 2, sp = 1 + Math.random() * 2.8;
      this.particle({
        x: ev.x, y: 0.2 + Math.random() * 0.2, z: ev.y,
        vx: Math.cos(a) * sp, vy: 1.2 + Math.random() * 2.4, vz: Math.sin(a) * sp,
        life: 0.7 + Math.random() * 0.5, size: 0.07 + Math.random() * 0.1, gravity: 11,
        colour: Math.random() < 0.6 ? TOWERS.boulder.colour : "#6f6558",
      });
    }
    for (let i = 0; i < 14; i++) {
      const a = Math.random() * Math.PI * 2;
      this.particle({ x: ev.x + Math.cos(a) * 0.2, y: 0.18, z: ev.y + Math.sin(a) * 0.2, vx: Math.cos(a) * 0.5, vy: 0.5 + Math.random() * 0.4, vz: Math.sin(a) * 0.5, life: 0.9 + Math.random() * 0.6, size: 0.1 + Math.random() * 0.08, gravity: -0.2, colour: "#8f8577", colour2: "#2e2b2a" });
    }
    if (ev.burst) this.shockRing(ev.x, ev.y, ev.burst, TOWERS.boulder.colour);
  }

  /** A soul leaves a broken cube and spirals into the urn that claimed it. */
  soul(ev) {
    const to = { x: ev.to.x, y: muzzleHeight("urn", ev.to.tier) + 0.05, z: ev.to.y };
    const n = Math.min(14, 3 + ev.n * 2);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      this.particle({
        x: ev.x + Math.cos(a) * 0.1, y: ev.h * (0.5 + Math.random() * 0.6), z: ev.y + Math.sin(a) * 0.1,
        vx: Math.cos(a) * 0.8, vy: 1.2 + Math.random() * 1.2, vz: Math.sin(a) * 0.8,
        life: 3, size: 0.035 + Math.random() * 0.035, gravity: 0,
        colour: i % 3 ? "#5dffb6" : "#eafff5", colour2: "#b3a4ff",
        home: () => to, homeSpeed: 2.6 + Math.random() * 1.4, swirl: 0.9 + Math.random() * 0.5,
      });
    }
  }

  /** An urn lets go: the souls burst out of it in a rising spiral, over a ring on the ground. */
  wail(ev) {
    const top = muzzleHeight("urn", ev.tier);
    const n = Math.min(70, 24 + Math.round(ev.souls * 1.5));
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 6, sp = 1.2 + (i / n) * 2.5;
      this.particle({
        x: ev.x, y: top, z: ev.y,
        vx: Math.cos(a) * sp, vy: 1.5 + Math.random() * 2, vz: Math.sin(a) * sp,
        life: 0.6 + Math.random() * 0.5, size: 0.035 + Math.random() * 0.04, gravity: -0.5,
        colour: i % 2 ? "#eafff5" : "#5dffb6", colour2: "#8f7bff",
      });
    }
    this.shockRing(ev.x, ev.y, 1.4, TOWERS.urn.colour);
  }

  /**
   * The wails running out along the road: at each front, a ring of pale
   * light lying on the road and a spray of souls lifting off it, fading as
   * the wail runs out.
   */
  syncWails(simulation) {
    if (!this.wailRings) this.wailRings = [];
    const live = [];
    for (const w of simulation.wails) {
      if (w.front < 0) continue;
      const fade = 1 - w.front / w.span;
      w.origins.forEach((origin, ri) => {
        if (origin === null) return;
        const road = simulation.routes[ri].path;
        for (const dir of [-1, 1]) {
          const d = origin + dir * w.front;
          if (d < 0 || d > road.total) continue;
          live.push({ p: pointAt(road, d), fade });
        }
      });
    }
    while (this.wailRings.length < live.length) {
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.28, 0.46, 32), new THREE.MeshBasicMaterial({ color: "#5dffb6", transparent: true, opacity: 0.7, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
      ring.rotation.x = -Math.PI / 2;
      ring.raycast = () => {};
      this.board.add(ring);
      this.wailRings.push(ring);
    }
    this.wailRings.forEach((ring, i) => {
      const f = live[i];
      ring.visible = !!f;
      if (!f) return;
      ring.position.set(f.p.x, 0.16, f.p.y);
      ring.scale.setScalar(0.8 + (1 - f.fade) * 0.5);
      ring.material.opacity = 0.2 + f.fade * 0.6;
      const n = Math.round(this.dt * 70 * (0.3 + f.fade));
      for (let k = 0; k < n; k++) {
        const a = Math.random() * Math.PI * 2, r = Math.random() * 0.4;
        this.particle({
          x: f.p.x + Math.cos(a) * r, y: 0.16, z: f.p.y + Math.sin(a) * r,
          vx: Math.cos(a) * 0.3, vy: 1.4 + Math.random() * 1.6, vz: Math.sin(a) * 0.3,
          life: 0.45 + Math.random() * 0.3, size: 0.03 + Math.random() * 0.035, gravity: -0.8,
          colour: Math.random() < 0.5 ? "#eafff5" : "#5dffb6", colour2: "#8f7bff",
        });
      }
    });
  }

  animatePrism(m, t) {
    const now = performance.now() / 1000;
    const d = m.userData, base = muzzleHeight("prism", t.tiers[0] + t.tiers[1]);
    d.crystal.rotation.y = now * 1.2;
    d.crystal.position.y = base + Math.sin(now * 2) * 0.06;
    d.shards.forEach((sh) => { const a = now * 1.6 + sh.userData.phase; sh.position.set(Math.cos(a) * 0.5, d.crystal.position.y + Math.sin(a * 2) * 0.12, Math.sin(a) * 0.5); sh.rotation.y = a; sh.rotation.x = a * 0.7; });
    d.mote = (d.mote || 0) + this.dt * (3 + Math.min(40, (t.power || 0) / 120));
    while (d.mote >= 1) {
      d.mote -= 1;
      this.particle({ x: t.c + 0.5 + (Math.random() - 0.5) * 0.7, y: 0.2 + Math.random() * 0.5, z: t.r + 0.5 + (Math.random() - 0.5) * 0.7, vx: 0, vy: 0.35 + Math.random() * 0.45, vz: 0, life: 0.9 + Math.random() * 0.6, size: 0.03 + Math.random() * 0.03, gravity: -0.25, colour: Math.random() < 0.5 ? "#fff1ec" : "#ffd8cc" });
    }
  }

  /** A tower is absorbed: its cubes stream across to the prism. */
  absorb(ev) {
    const colour = TOWERS[ev.kind].colour;
    const dx = ev.to.x - ev.x, dz = ev.to.y - ev.y, len = Math.hypot(dx, dz) || 1;
    for (let i = 0; i < 30; i++) {
      const sp = 2 + Math.random() * 2.5, back = Math.random() * 0.5;
      this.particle({ x: ev.x + (Math.random() - 0.5) * 0.7 - (dx / len) * back, y: 0.15 + Math.random() * 0.9, z: ev.y + (Math.random() - 0.5) * 0.7 - (dz / len) * back, vx: (dx / len) * sp, vy: 0.5 + Math.random() * 0.9, vz: (dz / len) * sp, life: (len + back) / sp, size: 0.06 + Math.random() * 0.09, gravity: 0, colour });
    }
  }

  /** The prism takes the power in: a column of light rising off it and a ring on the ground. */
  consecrate(ev) {
    for (let i = 0; i < 70; i++) {
      const a = Math.random() * Math.PI * 2, r = Math.random() * 0.5;
      this.particle({ x: ev.x + Math.cos(a) * r, y: Math.random() * 0.4, z: ev.y + Math.sin(a) * r, vx: Math.cos(a) * 0.3, vy: 2 + Math.random() * 3, vz: Math.sin(a) * 0.3, life: 0.7 + Math.random() * 0.6, size: 0.05 + Math.random() * 0.07, gravity: -1, colour: Math.random() < 0.4 ? C.accent : Math.random() < 0.5 ? "#ffd8cc" : "#fff1ec" });
    }
    this.shockRing(ev.x, ev.y, 2.2, C.accent);
  }

  /** A necromancer raises something: a column of dark motes where the new cube appears. */
  raise(ev) {
    for (let i = 0; i < 26; i++) {
      const a = Math.random() * Math.PI * 2, r = Math.random() * 0.35;
      this.particle({ x: ev.x + Math.cos(a) * r, y: Math.random() * 0.2, z: ev.y + Math.sin(a) * r, vx: 0, vy: 1 + Math.random() * 1.6, vz: 0, life: 0.5 + Math.random() * 0.4, size: 0.04 + Math.random() * 0.05, gravity: -0.6, colour: Math.random() < 0.6 ? "#3a3635" : "#8f8b8b" });
    }
  }

  /** A blink jumps: a puff of pale motes left where it was. */
  blink(ev) {
    for (let i = 0; i < 18; i++) {
      const a = Math.random() * Math.PI * 2, sp = 0.5 + Math.random() * 1.2;
      this.particle({ x: ev.from.x, y: ev.h * (0.3 + Math.random()), z: ev.from.y, vx: Math.cos(a) * sp, vy: 0.3 + Math.random() * 0.6, vz: Math.sin(a) * sp, life: 0.3 + Math.random() * 0.25, size: 0.04 + Math.random() * 0.04, gravity: -0.4, colour: Math.random() < 0.5 ? "#f3f2f2" : "#c9c5c5" });
    }
  }

  /** A revenant gets back up: a low orange flare and a ring. */
  revive(ev) {
    for (let i = 0; i < 34; i++) {
      const a = Math.random() * Math.PI * 2, r = Math.random() * 0.3;
      this.particle({ x: ev.x + Math.cos(a) * r, y: 0.05, z: ev.y + Math.sin(a) * r, vx: Math.cos(a) * 0.5, vy: 1.4 + Math.random() * 1.8, vz: Math.sin(a) * 0.5, life: 0.5 + Math.random() * 0.4, size: 0.04 + Math.random() * 0.05, gravity: -0.8, colour: Math.random() < 0.5 ? C.accent : "#ffb199" });
    }
    this.shockRing(ev.x, ev.y, 1.1, C.accent);
  }

  /**
   * A mint pays out: coins thrown up off the crop in a fountain, high enough
   * to see from across the board, over a ring of light on the ground. The
   * bigger the payout the more of them, so a maxed mint is worth watching.
   */
  coins(ev) {
    const n = Math.min(64, 26 + Math.round((ev.gold || 0) / 6));
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, sp = 0.4 + Math.random() * 1.7;
      this.particle({
        x: ev.x + Math.cos(a) * 0.22, y: 0.42, z: ev.y + Math.sin(a) * 0.22,
        vx: Math.cos(a) * sp, vy: 2.6 + Math.random() * 2.4, vz: Math.sin(a) * sp,
        life: 1 + Math.random() * 0.7, size: 0.05 + Math.random() * 0.05, gravity: 7,
        colour: Math.random() < 0.45 ? "#ffd98a" : Math.random() < 0.6 ? "#e8d9c0" : "#fff1e6",
        colour2: "#a9762f",
      });
    }
    this.shockRing(ev.x, ev.y, 1.15, "#e8d9c0");
  }

  /** A cube that paid a mint its cut drops a few coins where it fell. */
  bounty(ev) {
    const n = Math.min(14, 5 + Math.round((ev.bonus || 0) / 3));
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, sp = 0.3 + Math.random() * 0.9;
      this.particle({
        x: ev.enemy.x, y: 0.3, z: ev.enemy.y,
        vx: Math.cos(a) * sp, vy: 1.7 + Math.random() * 1.3, vz: Math.sin(a) * sp,
        life: 0.55 + Math.random() * 0.35, size: 0.045 + Math.random() * 0.035, gravity: 6,
        colour: Math.random() < 0.5 ? "#ffd98a" : "#fff1e6", colour2: "#a9762f",
      });
    }
  }

  /** A bomber goes off: a grey shock ring and a scatter of sparks over the towers it knocked out. */
  emp(ev) {
    this.shockRing(ev.x, ev.y, ev.radius, "#bab6b6");
    for (let i = 0; i < 40; i++) {
      const a = Math.random() * Math.PI * 2, sp = 1.5 + Math.random() * 3;
      this.particle({ x: ev.x, y: 0.3 + Math.random() * 0.4, z: ev.y, vx: Math.cos(a) * sp, vy: 1 + Math.random() * 2, vz: Math.sin(a) * sp, life: 0.4 + Math.random() * 0.3, size: 0.04 + Math.random() * 0.04, gravity: 5, colour: Math.random() < 0.5 ? "#f3f2f2" : "#8f8b8b" });
    }
  }

  /** A puff at the muzzle as a shot leaves. */
  muzzle(ev) {
    const h = muzzleHeight(ev.kind, ev.tier);
    if (ev.kind === "cannon" || ev.kind === "mortar") {
      const ax = Math.cos(ev.aim), az = Math.sin(ev.aim), n = ev.kind === "mortar" ? 12 : 8;
      for (let i = 0; i < n; i++) {
        const spread = (Math.random() - 0.5) * 0.9, sp = 0.8 + Math.random() * 1.8;
        const dx = ax * Math.cos(spread) - az * Math.sin(spread), dz = ax * Math.sin(spread) + az * Math.cos(spread);
        this.particle({
          x: ev.x, y: h + (Math.random() - 0.5) * 0.1, z: ev.y,
          vx: dx * sp, vy: (ev.kind === "mortar" ? 1.6 : 0.4) + Math.random() * 1.2, vz: dz * sp,
          life: 0.35 + Math.random() * 0.3, size: 0.05 + Math.random() * 0.07, gravity: -0.6,
          colour: Math.random() < 0.35 ? "#ffb199" : Math.random() < 0.5 ? "#8f8b8b" : "#6b6462",
        });
      }
    } else if (ev.kind === "arc") {
      // The coil crackles.
      for (let i = 0; i < 6; i++) {
        const a = Math.random() * Math.PI * 2, sp = 0.6 + Math.random() * 1.2;
        this.particle({ x: ev.x, y: h + (Math.random() - 0.5) * 0.2, z: ev.y, vx: Math.cos(a) * sp, vy: 0.5 + Math.random() * 1.5, vz: Math.sin(a) * sp, life: 0.2 + Math.random() * 0.15, size: 0.04 + Math.random() * 0.04, gravity: 4, colour: Math.random() < 0.5 ? "#f3f2f2" : TOWERS.arc.colour });
      }
    }
  }

  /** What a landing shot throws up. */
  impact(ev) {
    const x = ev.x, z = ev.y, h = ev.h || 0.25;
    // Every other cube the blast reached is hit visibly too: a spray of
    // sparks in the tower's colour off each, so a blast that catches five
    // cubes is seen to catch five and not just the one it landed on.
    for (const p of ev.struck || []) {
      const colour = (TOWERS[ev.kind] && TOWERS[ev.kind].colour) || "#f3f2f2";
      for (let i = 0; i < 7; i++) {
        const a = Math.random() * Math.PI * 2, sp = 0.8 + Math.random() * 1.6;
        this.particle({ x: p.x, y: p.h * (0.4 + Math.random() * 0.8), z: p.y, vx: Math.cos(a) * sp, vy: 1 + Math.random() * 1.8, vz: Math.sin(a) * sp, life: 0.25 + Math.random() * 0.2, size: 0.04 + Math.random() * 0.04, gravity: 8, colour: Math.random() < 0.5 ? "#f3f2f2" : colour });
      }
    }
    const debris = (n, colours, speed, up, gravity, size, life) => {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2, sp = speed * (0.4 + Math.random() * 0.8);
        this.particle({ x: x + (Math.random() - 0.5) * 0.2, y: h * Math.random(), z: z + (Math.random() - 0.5) * 0.2, vx: Math.cos(a) * sp, vy: up * (0.5 + Math.random()), vz: Math.sin(a) * sp, life: life * (0.7 + Math.random() * 0.6), size: size * (0.6 + Math.random() * 0.8), gravity, colour: colours[Math.floor(Math.random() * colours.length)] });
      }
    };
    if (ev.kind === "cannon") {
      debris(10 + Math.round(ev.splash * 10), ["#6b6462", "#8f8b8b", "#ffb199"], 2.2 + ev.splash, 2.5, 9, 0.09, 0.6);
      if (ev.splash) this.shockRing(x, z, ev.splash, "#8f8b8b");
    } else if (ev.kind === "mortar") {
      // A shell landing: a dark dust cloud, embers, and a wide shock ring.
      debris(18 + Math.round(ev.splash * 8), ["#6b6462", "#4a4646", "#8f8b8b"], 1.6 + ev.splash * 0.6, 1.4, 1.2, 0.13, 0.9);
      debris(10, [TOWERS.mortar.colour, "#ffb199"], 3, 3.5, 10, 0.07, 0.6);
      this.shockRing(x, z, ev.splash, TOWERS.mortar.colour);
    } else if (ev.kind === "burst") {
      // A shockwave: light cubes flung outward to the blast radius, low and flat.
      const n = 14 + Math.round(ev.splash * 10);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + Math.random() * 0.3, sp = ev.splash * 4;
        this.particle({ x, y: 0.12 + Math.random() * 0.25, z, vx: Math.cos(a) * sp, vy: 0.3 + Math.random() * 0.5, vz: Math.sin(a) * sp, life: 0.28 + Math.random() * 0.12, size: 0.06 + Math.random() * 0.06, gravity: 2, colour: Math.random() < 0.6 ? TOWERS.burst.colour : "#f3f2f2" });
      }
      this.shockRing(x, z, ev.splash, TOWERS.burst.colour);
    } else if (ev.kind === "sniper") {
      debris(8, ["#f3f2f2", "#ffe9e3"], 2.5, 2, 10, 0.05, 0.4);
      if (ev.splash) this.shockRing(x, z, ev.splash, "#ffe9e3");
    } else if (ev.kind === "frost") {
      debris(6, ["#f3f2f2", "#d7d3d3"], 0.8, 0.8, 3, 0.05, 0.5);
      if (ev.splash) this.shockRing(x, z, ev.splash, "#d7d3d3");
    }
  }

  /** Sparks at every enemy a chain of lightning struck. */
  sparks(points) {
    for (const p of points) for (let i = 0; i < 7; i++) {
      const a = Math.random() * Math.PI * 2, sp = 0.8 + Math.random() * 2;
      this.particle({ x: p.x, y: p.h, z: p.y, vx: Math.cos(a) * sp, vy: 1 + Math.random() * 2.5, vz: Math.sin(a) * sp, life: 0.25 + Math.random() * 0.2, size: 0.04 + Math.random() * 0.04, gravity: 8, colour: Math.random() < 0.5 ? "#f3f2f2" : TOWERS.arc.colour });
    }
  }

  /** A shock ring on the ground that grows to the blast radius and fades. */
  shockRing(x, z, radius, colour) {
    if (!this.shockRings) this.shockRings = [];
    let r = this.shockRings.find((q) => q.life <= 0);
    if (!r) {
      const mesh = new THREE.Mesh(new THREE.RingGeometry(0.86, 1, 40), new THREE.MeshBasicMaterial({ color: colour, transparent: true, opacity: 0.7, side: THREE.DoubleSide, depthWrite: false }));
      mesh.rotation.x = -Math.PI / 2;
      this.board.add(mesh);
      r = { mesh, life: 0, radius: 1 };
      this.shockRings.push(r);
    }
    r.mesh.material.color.set(colour);
    r.mesh.position.set(x, 0.14, z);
    r.radius = Math.max(0.4, radius);
    r.life = 1;
    r.mesh.visible = true;
  }
  syncRings(dt) {
    if (!this.shockRings) return;
    for (const r of this.shockRings) {
      if (r.life <= 0) { r.mesh.visible = false; continue; }
      r.life -= dt * 4;
      const k = 1 - Math.max(0, r.life);
      const sc = 0.2 + r.radius * (1 - Math.pow(1 - k, 2));
      r.mesh.scale.set(sc, sc, 1);
      r.mesh.material.opacity = Math.max(0, r.life) * 0.7;
    }
  }

  /** Flame towers spray while they have a target. */
  spray(simulation, dt) {
    for (const t of simulation.towers) {
      if (!t.flame) continue;
      const s = simulation.stats(t);
      const half = Math.acos(Math.max(-1, Math.min(1, s.coneCos)));
      t.emit = (t.emit || 0) + dt * 190 * (0.6 + half / 1.5);
      const ax = Math.cos(t.aim), az = Math.sin(t.aim), h = muzzleHeight(t.kind, t.tiers[0] + t.tiers[1]);
      while (t.emit >= 1) {
        t.emit -= 1;
        // Tongues of flame: hottest and tightest at the nozzle, spreading and
        // cooling to smoke as they reach out.
        const lick = Math.random();
        const spread = (Math.random() - 0.5) * 2 * half * (0.35 + lick * 0.65);
        const sp = 2.2 + lick * 2.2;
        const dx = ax * Math.cos(spread) - az * Math.sin(spread), dz = ax * Math.sin(spread) + az * Math.cos(spread);
        const hot = Math.random();
        this.particle({
          x: t.c + 0.5 + ax * 0.5, y: h + (Math.random() - 0.5) * 0.12, z: t.r + 0.5 + az * 0.5,
          vx: dx * sp + (Math.random() - 0.5) * 0.5, vy: 0.5 + Math.random() * 1.1, vz: dz * sp + (Math.random() - 0.5) * 0.5,
          life: (s.range - 0.3) / sp, size: 0.05 + Math.random() * 0.08, gravity: -2.2,
          colour: hot > 0.62 ? "#fff1e6" : hot > 0.28 ? "#ffb199" : TOWERS.flame.colour,
          colour2: hot > 0.85 ? "#ff563c" : "#4a4646",
        });
      }
    }
  }

  /**
   * What a falling cube lands on: the road surface on route cells, the
   * ground elsewhere on the board, the rim just past its edge, and nothing
   * at all beyond that, so cubes drop off into the dark.
   */
  floorAt(x, z) {
    if (x >= 0 && x < this.cols && z >= 0 && z < this.rows) return this.blocked && this.blocked.has(Math.floor(x) + "," + Math.floor(z)) ? 0.12 : 0;
    if (x >= -0.3 && x < this.cols + 0.3 && z >= -0.3 && z < this.rows + 0.3) return -0.575;
    return -Infinity;
  }

  /**
   * Bump a falling cube out of a box it has entered: land on top if it came
   * from above, otherwise slide out of the nearest side and bounce.
   */
  bump(p, prevY, box) {
    const dx = p.x - box.cx, dz = p.z - box.cz;
    if (Math.abs(dx) >= box.hx || Math.abs(dz) >= box.hz || p.y >= box.top) return;
    if (prevY >= box.top) { p.y = box.top; p.vy = -p.vy * 0.35; p.vx *= 0.6; p.vz *= 0.6; return; }
    const penX = box.hx - Math.abs(dx), penZ = box.hz - Math.abs(dz);
    if (penX < penZ) { p.x = box.cx + Math.sign(dx || 1) * box.hx; p.vx = -p.vx * 0.4; }
    else { p.z = box.cz + Math.sign(dz || 1) * box.hz; p.vz = -p.vz * 0.4; }
  }

  /** Move every particle and write the pool. */
  syncParticles(dt, simulation) {
    const towerAt = new Map();
    if (simulation) for (const t of simulation.towers) towerAt.set(t.c + "," + t.r, t);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), pos = new THREE.Vector3(), axis = new THREE.Vector3(1, 1, 0).normalize();
    const fade = new THREE.Color();
    let n = 0;
    for (const p of this.particles) {
      p.life -= dt;
      if (p.life <= 0) continue;
      if (p.home) {
        // Steered toward wherever it is going, with a sideways swirl that
        // tightens as it closes, so it spirals in rather than flying straight.
        const at = p.home();
        if (!at) { p.home = null; p.life = Math.min(p.life, 0.3); }
        else {
          const dx = at.x - p.x, dy = at.y - p.y, dz = at.z - p.z;
          const dist = Math.hypot(dx, dy, dz) || 1;
          if (dist < 0.1) { p.life = 0; continue; }
          const sp = p.homeSpeed || 3, swirl = (p.swirl || 0) * Math.min(1, dist);
          const ux = dx / dist, uy = dy / dist, uz = dz / dist;
          const pull = Math.min(1, dt * 5);
          p.vx += (ux * sp - uz * sp * swirl - p.vx) * pull;
          p.vy += (uy * sp - p.vy) * pull;
          p.vz += (uz * sp + ux * sp * swirl - p.vz) * pull;
        }
      }
      p.vy -= p.gravity * dt;
      const prevY = p.y;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      if (p.gravity > 0 && !p.freeFlight) {
        const floor = this.floorAt(p.x, p.z);
        if (p.y < floor) { p.y = floor; p.vy = -p.vy * 0.35; p.vx *= 0.6; p.vz *= 0.6; }
        else if (p.y < -3) { p.life = 0; continue; }
        // Towers and door frames are solid.
        const t = towerAt.get(Math.floor(p.x) + "," + Math.floor(p.z));
        if (t) this.bump(p, prevY, { cx: t.c + 0.5, cz: t.r + 0.5, hx: 0.42, hz: 0.42, top: towerHeight(t.tiers[0] + t.tiers[1]) + 0.15 });
        if (this.doorBoxes) for (const box of this.doorBoxes) this.bump(p, prevY, box);
      }
      const k = p.life / p.max;
      // Full size for most of its life, then shrinking to nothing.
      const size = p.size * (p.gravity > 0 ? Math.min(1, k * 2.2) : (0.5 + 0.9 * (1 - k)) * Math.min(1, k * 3));
      q.setFromAxisAngle(axis, p.spin + (1 - k) * 4);
      m.compose(pos.set(p.x, p.y + size / 2, p.z), q, s.set(size, size, size));
      this.pool.setMatrixAt(n, m);
      // Fire cools as it rises: bright at the nozzle, smoke by the end.
      if (p.colour2) { fade.copy(p.colour).lerp(p.colour2, 1 - k); this.pool.setColorAt(n, fade); }
      else this.pool.setColorAt(n, p.colour);
      n++;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
    this.pool.count = n;
    this.pool.instanceMatrix.needsUpdate = true;
    if (this.pool.instanceColor) this.pool.instanceColor.needsUpdate = true;
  }

  /**
   * The mines lying on the road: a dark pad with a light on it that quickens
   * as it settles. One still in the air arcs over from the tower that threw it.
   */
  syncMines(simulation) {
    if (!this.mineMeshes) this.mineMeshes = [];
    const now = performance.now() / 1000;
    while (this.mineMeshes.length < simulation.mines.length) {
      const g = new THREE.Group();
      const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.2, 0.05, 12), new THREE.MeshLambertMaterial({ color: "#2e2a28" }));
      pad.position.y = 0.025;
      const light = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), new THREE.MeshBasicMaterial({ color: C.accent }));
      light.position.y = 0.07;
      for (const part of [pad, light]) part.raycast = () => {};
      g.add(pad, light);
      g.userData.light = light;
      this.board.add(g);
      this.mineMeshes.push(g);
    }
    for (let i = 0; i < this.mineMeshes.length; i++) {
      const g = this.mineMeshes[i], m = simulation.mines[i];
      g.visible = !!m;
      if (!m) continue;
      // Thrown: it arcs across from the tower and drops onto its spot.
      const k = m.fall > 0 ? 1 - Math.max(0, m.fall) / 0.45 : 1;
      const x = m.from.x + (m.x - m.from.x) * k, z = m.from.y + (m.y - m.from.y) * k;
      g.position.set(x, 0.12 + Math.sin(Math.PI * k) * 0.9 * (m.fall > 0 ? 1 : 0), z);
      g.scale.setScalar(m.splash / 0.9);
      // The light blinks slowly once it is armed, and is steady in the air.
      g.userData.light.material.opacity = 1;
      g.userData.light.visible = m.fall > 0 || Math.sin(now * 4 + m.id) > -0.4;
    }
  }

  /** A mine gone stale: a wisp of smoke and a few sparks, and nothing else. */
  mineDud(ev) {
    for (let i = 0; i < 8; i++) {
      const a = Math.random() * Math.PI * 2, sp = 0.15 + Math.random() * 0.3;
      this.particle({
        x: ev.x, y: 0.16, z: ev.y, vx: Math.cos(a) * sp, vy: 0.5 + Math.random() * 0.6, vz: Math.sin(a) * sp,
        life: 0.5 + Math.random() * 0.4, size: 0.04 + Math.random() * 0.05, gravity: -0.6,
        colour: i < 3 ? C.accent : "#6b6462", colour2: "#2e2a28",
      });
    }
  }

  /** A mine goes off: a flat, dirty blast where it was lying. */
  mineBlast(ev) {
    for (let i = 0; i < 22; i++) {
      const a = Math.random() * Math.PI * 2, sp = 1.6 + Math.random() * 3.4;
      this.particle({
        x: ev.x, y: 0.14, z: ev.y, vx: Math.cos(a) * sp, vy: 1.4 + Math.random() * 3.4, vz: Math.sin(a) * sp,
        life: 0.4 + Math.random() * 0.35, size: 0.05 + Math.random() * 0.06, gravity: 11,
        colour: Math.random() < 0.4 ? "#ffd8a8" : Math.random() < 0.6 ? TOWERS.sapper.colour : "#6b6462",
      });
    }
    this.shockRing(ev.x, ev.y, ev.splash, "#ffd8a8");
  }

  /** Beams: a stream of light shards from the prism's crystal to each target. */
  syncBeams(simulation) {
    if (!this.beamMeshes) this.beamMeshes = [];
    let n = 0;
    const lensAt = new THREE.Vector3();
    for (const t of simulation.towers) {
      if (!t.beams) continue;
      const mesh = this.towerMeshes.get(t.id);
      const lenses = mesh && mesh.userData.emitters;
      for (let k = 0; k < t.beams.length; k++) {
        const b = t.beams[k];
        if (b.target.dead) continue;
        const lens = lenses && (lenses[k] || lenses[0]);
        let from;
        if (lens) { lens.getWorldPosition(lensAt); from = this.board.worldToLocal(lensAt.clone()); }
        else { const aim = Math.atan2(b.target.y - (t.r + 0.5), b.target.x - (t.c + 0.5)); from = new THREE.Vector3(t.c + 0.5 + Math.cos(aim) * 0.37, muzzleHeight(t.kind, t.tiers[0] + t.tiers[1]), t.r + 0.5 + Math.sin(aim) * 0.37); }
        const to = new THREE.Vector3(b.target.x, ENEMIES[b.target.type].size * 0.85, b.target.y);
        const dir = to.clone().sub(from), len = dir.length();
        dir.normalize();
        if (t.kind === "prism") {
          // A stream of shards flying down the line, sparkling where it lands.
          b.emit = (b.emit || 0) + this.dt * (60 + b.heat * 40);
          while (b.emit >= 1) {
            b.emit -= 1;
            const sp = 9 + Math.random() * 2;
            this.particle({ x: from.x + (Math.random() - 0.5) * 0.1, y: from.y + (Math.random() - 0.5) * 0.1, z: from.z + (Math.random() - 0.5) * 0.1, vx: dir.x * sp + (Math.random() - 0.5) * 0.5, vy: dir.y * sp + (Math.random() - 0.5) * 0.5, vz: dir.z * sp + (Math.random() - 0.5) * 0.5, life: len / sp, size: 0.04 + Math.random() * 0.05 + b.heat * 0.03, gravity: 0, colour: Math.random() < 0.5 ? "#fff1ec" : Math.random() < 0.5 ? "#ffd8cc" : C.accent });
          }
          b.spark = (b.spark || 0) + this.dt * 18;
          while (b.spark >= 1) { b.spark -= 1; this.particle({ x: to.x, y: to.y, z: to.z, vx: (Math.random() - 0.5) * 2.2, vy: 0.6 + Math.random() * 1.6, vz: (Math.random() - 0.5) * 2.2, life: 0.22 + Math.random() * 0.1, size: 0.035 + Math.random() * 0.03, gravity: 6, colour: "#fff1ec" }); }
          continue;
        }
        let m = this.beamMeshes[n];
        if (!m) {
          m = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1, 6), new THREE.MeshBasicMaterial({ color: TOWERS.prism.colour, transparent: true, opacity: 0.8 }));
          this.board.add(m); this.beamMeshes.push(m);
        }
        m.position.copy(from).add(to).multiplyScalar(0.5);
        m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
        m.scale.set(1 + b.heat * 0.8, len, 1 + b.heat * 0.8);
        m.material.opacity = 0.55 + b.heat * 0.4;
        m.visible = true;
        n++;
      }
    }
    for (let i = n; i < this.beamMeshes.length; i++) this.beamMeshes[i].visible = false;
  }

  /**
   * Arc lightning: each chain is a jagged run of short solid bolts, a bright
   * white core inside a wider translucent glow, re-jittered every frame so
   * it crackles, fading as it goes.
   */
  syncArcs(view) {
    if (!this.boltPool) {
      this.boltPool = [];
      this.boltGeo = new THREE.CylinderGeometry(1, 1, 1, 6);
      this.boltCore = new THREE.MeshBasicMaterial({ color: "#f3f2f2", transparent: true });
      this.boltGlow = new THREE.MeshBasicMaterial({ color: TOWERS.arc.colour, transparent: true, depthWrite: false });
    }
    const up = new THREE.Vector3(0, 1, 0), a = new THREE.Vector3(), b = new THREE.Vector3(), dir = new THREE.Vector3();
    let n = 0;
    const segment = (from, to, radius, material, opacity) => {
      let m = this.boltPool[n];
      if (!m) { m = new THREE.Mesh(this.boltGeo, material); this.board.add(m); this.boltPool.push(m); }
      m.material = material;
      m.material.opacity = opacity;
      dir.copy(to).sub(from);
      const len = dir.length();
      m.position.copy(from).add(to).multiplyScalar(0.5);
      m.quaternion.setFromUnitVectors(up, dir.normalize());
      m.scale.set(radius, len, radius);
      m.visible = true;
      n++;
    };
    for (const arc of view.arcs) {
      const k = Math.max(0, arc.life);
      const flicker = 0.7 + Math.random() * 0.3;
      for (let i = 1; i < arc.points.length; i++) {
        const p = arc.points[i - 1], q = arc.points[i];
        // Four jittered joints between each pair of struck enemies.
        let prev = a.set(p.x, p.h, p.y).clone();
        for (const f of [0.25, 0.5, 0.75, 1]) {
          const jitter = f < 1 ? 0.22 : 0;
          const next = b.set(q.x * f + p.x * (1 - f) + (Math.random() - 0.5) * jitter, q.h * f + p.h * (1 - f) + Math.random() * jitter * 1.4, q.y * f + p.y * (1 - f) + (Math.random() - 0.5) * jitter).clone();
          segment(prev, next, 0.09, this.boltGlow, 0.35 * k * flicker);
          segment(prev, next, 0.03, this.boltCore, 0.95 * k * flicker);
          prev = next;
        }
      }
    }
    for (let i = n; i < this.boltPool.length; i++) this.boltPool[i].visible = false;
  }

  /** A shell: a dark finned round with a coloured nose, pointing along +z. */
  shellMesh(colour, scale = 1) {
    const g = new THREE.Group();
    const dark = new THREE.MeshLambertMaterial({ color: "#3a3635" });
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.11, 0.26, 4, 12), dark);
    body.rotation.x = Math.PI / 2; body.castShadow = true; g.add(body);
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.16, 12), new THREE.MeshLambertMaterial({ color: colour }));
    nose.rotation.x = Math.PI / 2; nose.position.z = 0.3; g.add(nose);
    for (let k = 0; k < 3; k++) {
      const fin = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.12, 0.14), dark);
      fin.position.set(0, 0, -0.2); fin.rotation.z = (k / 3) * Math.PI * 2;
      fin.geometry.translate(0, 0.12, 0);
      g.add(fin);
    }
    g.scale.setScalar(scale);
    return g;
  }

  syncShots(simulation) {
    const shells = { mortar: 0, cannon: 0 };
    if (!this.shellMeshes) this.shellMeshes = { mortar: [], cannon: [] };
    while (this.shotMeshes.length < simulation.shots.length) {
      const m = new THREE.Mesh(this.geo.shot, this.mat.shot.bolt);
      this.board.add(m); this.shotMeshes.push(m);
    }
    for (let i = 0; i < this.shotMeshes.length; i++) {
      const m = this.shotMeshes[i], s = simulation.shots[i];
      m.visible = !!s && s.kind !== "arc"; // lightning is drawn as a bolt, not a shot
      if (s) {
        // From muzzle height down to the target's middle as it closes in.
        const th = s.target.spec.size * 0.85;
        const dist = Math.hypot(s.tx - s.x, s.ty - s.y);
        let y = th + (muzzleHeight(s.kind, s.tier) - th) * Math.min(1, dist / 1.2);
        // Mortar shells lob in a high arc.
        if (s.kind === "mortar" && s.total) y += Math.sin(Math.PI * Math.min(1, Math.max(0, 1 - dist / s.total))) * 3.2;
        m.position.set(s.x, y, s.y); m.material = this.mat.shot[s.kind]; m.geometry = this.geo.shot;
        // Mortar and cannon rounds are proper shells that nose along their path.
        if (s.kind === "mortar" || s.kind === "cannon") {
          m.visible = false;
          const pool = this.shellMeshes[s.kind];
          let sh = pool[shells[s.kind]];
          if (!sh) { sh = this.shellMesh(TOWERS[s.kind].colour, s.kind === "cannon" ? 0.7 : 1); this.board.add(sh); pool.push(sh); }
          shells[s.kind]++;
          sh.visible = true;
          // Point the nose along the movement since last frame.
          if (s.last) {
            const dir = new THREE.Vector3(s.x - s.last.x, y - s.last.y, s.y - s.last.z);
            if (dir.lengthSq() > 1e-8) sh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir.normalize());
          }
          sh.position.set(s.x, y, s.y);
          s.last = { x: s.x, y, z: s.y };
        }
        // Shells leave a trail of smoke.
        if (s.kind === "cannon" || s.kind === "mortar") {
          s.trail = (s.trail || 0) + this.dt * (s.kind === "mortar" ? 40 : 28);
          while (s.trail >= 1) {
            s.trail -= 1;
            this.particle({ x: s.x + (Math.random() - 0.5) * 0.08, y: y + (Math.random() - 0.5) * 0.08, z: s.y + (Math.random() - 0.5) * 0.08, vx: (Math.random() - 0.5) * 0.3, vy: 0.2 + Math.random() * 0.3, vz: (Math.random() - 0.5) * 0.3, life: 0.3 + Math.random() * 0.25, size: 0.04 + Math.random() * 0.05, gravity: -0.4, colour: Math.random() < 0.3 ? "#ffb199" : "#8f8b8b" });
          }
        }
      }
    }
    for (const kind of ["mortar", "cannon"]) for (let i = shells[kind]; i < this.shellMeshes[kind].length; i++) this.shellMeshes[kind][i].visible = false;
  }

  syncFlashes(view) {
    while (this.flashMeshes.length < view.flashes.length) {
      const m = new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 32), new THREE.MeshBasicMaterial({ color: C.accent, transparent: true, opacity: 0.6, side: THREE.DoubleSide }));
      m.rotation.x = -Math.PI / 2;
      this.board.add(m); this.flashMeshes.push(m);
    }
    for (let i = 0; i < this.flashMeshes.length; i++) {
      const m = this.flashMeshes[i], f = view.flashes[i];
      m.visible = !!f;
      if (f) {
        const r = 0.15 + (1 - f.life) * (f.kind === "burst" ? 1.1 : 0.3);
        m.position.set(f.x, 0.16, f.y);
        m.scale.set(r, r, 1);
        m.material.opacity = Math.max(0, f.life) * 0.7;
        m.material.color.set(TOWERS[f.kind].colour);
      }
    }
  }

  /** Render a frame. `timeScale` is the sim speed (0 while paused) so effects keep pace with it. */
  draw(simulation, view, timeScale = 1) {
    if (!this.world || this.world.userData.map !== simulation.map.id) {
      this.buildWorld(simulation);
      this.world.userData.map = simulation.map.id;
      // Every map has its own size, so every map gets its own framing.
      const size = sizeOf(simulation.map);
      this.fitBoard(size.cols, size.rows);
    }
    // The IN and OUT marks and the walking arrows only until the first wave starts.
    const showArrows = simulation.wave === 0;
    for (const label of this.doorLabels || []) label.visible = showArrows;
    const clock = performance.now() / 1000;
    const head = (clock % (this.pulseEvery || 1)) * ARROW_SPEED;
    const drawn = [];
    for (const w of this.walkers || []) {
      const route = simulation.routes[w.route], doors = this.routeDoors[w.route];
      const len = doors.doorOut - doors.doorIn;
      const along = head - doors.lag - w.behind * ARROW_GAP;
      w.mesh.visible = showArrows && along >= 0 && along <= len;
      if (!w.mesh.visible) continue;
      const at = doors.doorIn + along;
      const p = pointAt(route.path, at), q = pointAt(route.path, at + 0.06);
      // On a stretch two roads share, their arrows land on each other: one is enough.
      if (drawn.some((o) => Math.abs(o.x - p.x) < 0.05 && Math.abs(o.y - p.y) < 0.05)) { w.mesh.visible = false; continue; }
      drawn.push(p);
      w.mesh.position.set(p.x, 0.135, p.y);
      if (q.x !== p.x || q.y !== p.y) w.mesh.rotation.z = -Math.atan2(q.y - p.y, q.x - p.x);
      // Coming up out of the way in and sinking into the way out, each arrow
      // fainter than the one ahead of it.
      w.mesh.material.opacity = (0.9 - w.behind * 0.25) * Math.max(0, Math.min(1, along / 0.6, (len - along) / 0.6));
      // Shaded by how far the pulse has run, the same on every road, so
      // roads running together are the same colour.
      w.mesh.material.color.lerpColors(ARROW_FROM, ARROW_TO, Math.min(1, head / this.pulseLongest));
    }
    // Sinking away before a swap: it gathers pace as it goes, the way a
    // dropped thing does, and takes long enough to be watched.
    if (this.dropOutAt) {
      const k = Math.min(1, (performance.now() - this.dropOutAt) / 520);
      this.board.position.y = this.dropFrom + (-22 - this.dropFrom) * k * k * k;
      if (k >= 1) { this.dropOutAt = 0; const then = this.dropThen; this.dropThen = null; if (then) then(); }
    }
    // The board slides up from below when a route is chosen.
    if (this.dropAt) {
      const k = Math.min(1, (performance.now() - this.dropAt) / 750);
      const ease = 1 - Math.pow(1 - k, 3);
      this.board.position.y = -22 * (1 - ease);
      if (k >= 1) this.dropAt = 0;
    }
    const now = performance.now();
    this.dt = (this.lastFrame ? Math.min(0.05, (now - this.lastFrame) / 1000) : 1 / 60) * timeScale;
    this.lastFrame = now;
    // Moving the board aside, or back again: its slide and its size together,
    // on the same curve and over the same stretch of time as the panel that
    // slides in beside it.
    // A quarter turn from Q or E, easing out so it leaves at speed and lands softly.
    if (this.turnAt) {
      const k = Math.min(1, (now - this.turnAt) / 340);
      this.yaw = this.turnFrom + (this.turnTo - this.turnFrom) * (1 - Math.pow(1 - k, 3));
      if (k >= 1) this.turnAt = 0;
      this.updateCamera();
    }
    if (this.panGo) { this.panGo = false; this.panAt = now; }
    if (this.panAt) {
      const k = Math.min(1, (now - this.panAt) / 620);
      const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(2 - 2 * k, 3) / 2;
      this.panPx = this.panFrom + ((this.panWant || 0) - this.panFrom) * e;
      this.zoomAside = this.zoomAsideFrom + ((this.zoomAsideWant || 1) - this.zoomAsideFrom) * e;
      if (k >= 1) this.panAt = 0;
      this.updateCamera();
    }
    this.syncTowers(simulation, view);
    this.syncEnemies(simulation, view);
    this.syncShots(simulation);
    this.syncMines(simulation);
    this.syncWails(simulation);
    this.syncBoulders(simulation);
    this.syncTears();
    this.syncProps(simulation, view);
    this.syncBeams(simulation);
    this.syncArcs(view);
    this.syncFlashes(view);
    if (simulation.phase === "wave") this.spray(simulation, this.dt);
    this.syncParticles(this.dt, simulation);
    this.syncRings(this.dt);
    this.renderer.render(this.scene, this.camera);
  }
}
