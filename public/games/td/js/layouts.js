// Twenty hand-made routes, each on a board of its own size, listed from the
// easiest to hold to the hardest: the order the same simple player, on
// normal and on hard, held each one longest. #Pain comes last whatever. Waypoints are cell
// centres and every segment runs along a row or a column; every cell the
// route passes through is closed to building. The first and last waypoints
// sit just off the board, which is where the doorways stand.
//
// `cols` and `rows` are the board in cells. A small board leaves few places
// to build and little road to cover; a large one spreads a defence thin.
//
// A map with more than one way in or out gives `routes`, a list of waypoint
// lists, instead of `waypoints`. Each is walked from its own entrance to its
// own exit, and routes may share road: two that start at the same door and
// part company make a fork. Cubes are sent down the routes in turn.

/** Fallback size for anything that asks before a map is chosen. */
export const COLS = 16;
export const ROWS = 12;

export const MAPS = [
  {
    // Once "knot", a crossing loop too like the crook.
    id: "spiral",
    name: "The spiral",
    note: "Wound inward ring by ring, then one straight way out across its own turns",
    cols: 11,
    rows: 11,
    waypoints: [[-1, 1], [9, 1], [9, 9], [1, 9], [1, 3], [7, 3], [7, 7], [3, 7], [3, 5], [5, 5], [5, 11]],
  },
  {
    id: "crook",
    name: "The crook",
    note: "A short road that doubles back under itself",
    cols: 13,
    rows: 10,
    waypoints: [[-1, 2], [8, 2], [8, 7], [3, 7], [3, 4], [13, 4]],
  },
  {
    // Once "rampart", a crossing loop too like the crook.
    id: "comb",
    name: "The comb",
    note: "Four lanes packed one cell apart, so a tower between two reaches both",
    cols: 14,
    rows: 9,
    waypoints: [[-1, 1], [12, 1], [12, 3], [1, 3], [1, 5], [12, 5], [12, 7], [-1, 7]],
  },
  {
    id: "hook",
    name: "The hook",
    note: "Down, round, and back across itself to leave by the bottom",
    cols: 14,
    rows: 14,
    waypoints: [[3, -1], [3, 10], [11, 10], [11, 4], [7, 4], [7, 14]],
  },
  {
    id: "crossroads",
    name: "Crossroads",
    note: "Two long straights that cut across each other",
    cols: 16,
    rows: 12,
    waypoints: [[-1, 6], [8, 6], [8, 1], [3, 1], [3, 10], [13, 10], [13, 6], [16, 6]],
  },
  {
    id: "gauntlet",
    name: "The gauntlet",
    note: "A climb down a board only nine cells wide",
    cols: 9,
    rows: 16,
    waypoints: [[4, -1], [4, 3], [1, 3], [1, 7], [7, 7], [7, 11], [2, 11], [2, 16]],
  },
  {
    id: "ringroad",
    name: "The ring road",
    note: "All the way round the edge, and out again beside the way in",
    cols: 15,
    rows: 14,
    waypoints: [[-1, 2], [13, 2], [13, 11], [2, 11], [2, 5], [-1, 5]],
  },
  {
    id: "horseshoe",
    name: "The horseshoe",
    note: "In and out of the same edge, with the turn at the far end",
    cols: 14,
    rows: 12,
    waypoints: [[-1, 2], [10, 2], [10, 9], [-1, 9]],
  },
  {
    id: "switchback",
    name: "The switchback",
    note: "Three long lanes back and forth across a wide board",
    cols: 20,
    rows: 11,
    waypoints: [[-1, 1], [18, 1], [18, 5], [1, 5], [1, 9], [20, 9]],
  },
  {
    id: "fork",
    name: "The fork",
    note: "One way in that splits in two, each branch to a door of its own",
    cols: 16,
    rows: 12,
    routes: [
      [[-1, 6], [6, 6], [6, 2], [16, 2]],
      [[-1, 6], [6, 6], [6, 9], [11, 9], [11, 12]],
    ],
  },
  {
    id: "staircase",
    name: "The staircase",
    note: "Steps across the board, corner after corner",
    cols: 18,
    rows: 14,
    waypoints: [[-1, 1], [3, 1], [3, 4], [7, 4], [7, 7], [11, 7], [11, 10], [15, 10], [15, 13], [18, 13]],
  },
  {
    id: "bottleneck",
    name: "The bottleneck",
    note: "Two ways in squeezed into one stretch, then parting for two ways out",
    cols: 17,
    rows: 13,
    routes: [
      [[-1, 2], [5, 2], [5, 6], [11, 6], [11, 2], [17, 2]],
      [[-1, 10], [5, 10], [5, 6], [11, 6], [11, 10], [17, 10]],
    ],
  },
  {
    id: "trident",
    name: "The trident",
    note: "One way in that splits three ways, a door for each",
    cols: 16,
    rows: 15,
    routes: [
      [[-1, 7], [5, 7], [5, 2], [16, 2]],
      [[-1, 7], [16, 7]],
      [[-1, 7], [5, 7], [5, 12], [16, 12]],
    ],
  },
  {
    id: "sprint",
    name: "The sprint",
    note: "A short dash from corner to corner of a small board",
    cols: 10,
    rows: 10,
    waypoints: [[-1, 8], [3, 8], [3, 3], [7, 3], [7, -1]],
  },
  {
    id: "confluence",
    name: "The confluence",
    note: "Two doors in on opposite sides, meeting in the middle and leaving as one",
    cols: 15,
    rows: 13,
    routes: [
      [[-1, 2], [4, 2], [4, 6], [7, 6], [7, 13]],
      [[15, 3], [10, 3], [10, 6], [7, 6], [7, 13]],
    ],
  },
  {
    id: "cross",
    name: "The cross",
    note: "Two straight roads through one crossing, and a door at every edge",
    cols: 15,
    rows: 15,
    routes: [
      [[-1, 7], [15, 7]],
      [[7, -1], [7, 15]],
    ],
  },
  {
    // Left exactly as it is. It is a test of the kit rather than of the
    // board: forty-four cells on a lane, every one of them within the last
    // boss's heat, and no room to stand a mint or a prism the default rack
    // does not bring on hard. A kit built round snipers and beacons holds it
    // on every difficulty; the default rack holds it on easy and normal and,
    // on hard, however far it is taken, does not.
    id: "straight",
    name: "The straight",
    note: "One lane, straight across, with a single row to build on either side",
    cols: 22,
    rows: 3,
    waypoints: [[-1, 1], [22, 1]],
  },
  {
    id: "delta",
    name: "The delta",
    note: "Three ways in that meet at one crossing and leave as one",
    cols: 15,
    rows: 15,
    routes: [
      [[-1, 7], [15, 7]],
      [[7, -1], [7, 7], [15, 7]],
      [[7, 15], [7, 7], [15, 7]],
    ],
  },
  {
    id: "twins",
    name: "The twins",
    note: "Two roads side by side, running opposite ways",
    cols: 18,
    rows: 9,
    routes: [
      [[-1, 2], [18, 2]],
      [[18, 6], [-1, 6]],
    ],
  },
  {
    // The last route, and meant to hurt. Four roads each cut a corner, in by
    // one edge and straight out by the next, so a cube is on the board for
    // moments. Every cell beside a road is a monolith, which hides the road
    // from anything behind it and costs the most to clear, and the open
    // ground is out in the middle, beyond most reach. Five cells inside each
    // elbow are left clear: the only ground with a view of a road, and every
    // tower on it stands in the cubes' faces on both arms at once.
    //
    // The arms were three cells and the board twelve, and nothing could
    // finish it: with every cell built and every tower maxed, the four roads
    // leaked from wave thirteen to the end, and a real purse died on wave
    // four. At five cells a road is still over in a dozen seconds, but that
    // is long enough for mortars lobbed from the middle and stones rolled
    // back down the arms to finish what the elbows start. The board grew
    // with the arms: two elbows nearer than four cells leave every cell
    // between them beside a road, and the middle would be solid monolith.
    // As it is, a mortar on the centre cells reaches all four elbows.
    id: "pain",
    name: "#Pain",
    note: "Four roads that cut the corners in a few steps, walled in by monoliths but for five cells inside each elbow, far from anywhere else to build",
    cols: 16,
    rows: 16,
    walled: true,
    propShare: 0.14,
    routes: [
      [[-1, 5], [5, 5], [5, -1]],
      [[10, -1], [10, 5], [16, 5]],
      [[16, 10], [10, 10], [10, 16]],
      [[5, 16], [5, 10], [-1, 10]],
    ],
    // The five cells inside each elbow, never walled and never propped: the
    // one in the crook, and two along each arm.
    open: [
      [4, 4], [3, 4], [2, 4], [4, 3], [4, 2],
      [11, 4], [12, 4], [13, 4], [11, 3], [11, 2],
      [11, 11], [12, 11], [13, 11], [11, 12], [11, 13],
      [4, 11], [3, 11], [2, 11], [4, 12], [4, 13],
    ],
  },
];

/** The board size of a map, for anything holding one. */
export function sizeOf(map) {
  return { cols: map.cols || COLS, rows: map.rows || ROWS };
}

/** Every route on a map, as waypoint lists: one, unless it lists several. */
export function routesOf(map) {
  return map.routes || [map.waypoints];
}

/** The set of "c,r" keys the routes occupy, for build checks. */
export function routeCells(map) {
  const { cols, rows } = sizeOf(map);
  const cells = new Set();
  for (const pts of routesOf(map)) for (let i = 0; i < pts.length - 1; i++) {
    const [c0, r0] = pts[i], [c1, r1] = pts[i + 1];
    const dc = Math.sign(c1 - c0), dr = Math.sign(r1 - r0);
    let c = c0, r = r0;
    while (true) {
      if (c >= 0 && c < cols && r >= 0 && r < rows) cells.add(c + "," + r);
      if (c === c1 && r === r1) break;
      c += dc; r += dr;
    }
  }
  return cells;
}

// ---- Props -------------------------------------------------------------
// What stands on the ground before anyone builds: groves of trees, crystals,
// old pillars, monoliths and heaps of stone. A prop closes its cell to
// building until it is paid to be cleared, and one beside the road, where a
// tower does the most, costs half again. Each map's props come from its own
// seed, so a route looks the same every time it is played.

/** The kinds of prop, what each is called and what clearing one costs. */
export const PROPS = {
  tree: { name: "Tree", cost: 40, blurb: "It grew here before the road did. Cut it down and the cell is free to build on." },
  stones: { name: "Stones", cost: 55, blurb: "A heap of stones, one of them still glowing. Clear them and the cell is yours." },
  pillar: { name: "Pillar", cost: 75, blurb: "Older than the road, and in the way of anything built after it." },
  crystal: { name: "Crystal", cost: 90, blurb: "Something bright, grown up out of the ground. It has to be broken out before a tower can stand here." },
  monolith: { name: "Monolith", cost: 120, blurb: "Nobody remembers putting it here. Nothing can be built on this cell until it is pulled down." },
};

/** The neon a map's props glow in, most of them, with the accent for the rest. */
const PROP_GLOWS = ["#4fd8ff", "#ff5f7e", "#49ff9a", "#9a6bff", "#ffc94a", "#8fe8ff"];
const ACCENT = "#ff563c";

function seeded(text) {
  let seed = 2166136261;
  for (let i = 0; i < text.length; i++) seed = Math.imul(seed ^ text.charCodeAt(i), 16777619);
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * The props standing on a map at the start of a run, as a Map of "c,r" to
 * { kind, cost, near, glow }. `near` says it stands beside the road.
 */
export function propsFor(map) {
  const { cols, rows } = sizeOf(map);
  const road = routeCells(map);
  const rand = seeded(map.id + ":props");
  const glow = PROP_GLOWS[Math.floor(rand() * PROP_GLOWS.length)];
  const free = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) if (!road.has(c + "," + r)) free.push([c, r]);
  const beside = (c, r) => {
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) if (road.has((c + dc) + "," + (r + dr))) return true;
    return false;
  };
  const out = new Map();
  let walls = 0;
  const want = Math.max(3, Math.round(free.length * (map.propShare || 0.11)));
  const put = (c, r, kind) => {
    const key = c + "," + r;
    if (c < 0 || r < 0 || c >= cols || r >= rows || road.has(key) || open.has(key) || out.has(key) || out.size >= want + walls + 2) return false;
    const near = beside(c, r);
    const cost = Math.round((PROPS[kind].cost * (near ? 1.5 : 1)) / 5) * 5;
    out.set(key, { kind, cost, near, glow: rand() < 0.72 ? glow : ACCENT });
    return true;
  };
  // Cells a map keeps clear whatever else stands: nothing is ever put on them.
  const open = new Set((map.open || []).map(([c, r]) => c + "," + r));
  // A walled map has a monolith on every cell beside its roads before anything else.
  if (map.walled) {
    for (const [c, r] of free) {
      if (!beside(c, r) || open.has(c + "," + r)) continue;
      const cost = Math.round((PROPS.monolith.cost * 1.5) / 5) * 5;
      out.set(c + "," + r, { kind: "monolith", cost, near: true, glow: rand() < 0.72 ? glow : ACCENT });
    }
  }
  walls = out.size;
  for (let guard = 0; out.size < want + walls && guard < 600; guard++) {
    const [c, r] = free[Math.floor(rand() * free.length)];
    // The cells beside the road are the ones worth paying for, so only some
    // of them are taken.
    if (beside(c, r) && rand() < (map.propShare ? 0.15 : 0.6)) continue;
    const roll = rand();
    if (roll < 0.46) {
      // A grove: a tree, and a few more round it.
      if (!put(c, r, "tree")) continue;
      for (let i = 0, n = 1 + Math.floor(rand() * 3); i < n; i++) put(c + Math.floor(rand() * 3) - 1, r + Math.floor(rand() * 3) - 1, "tree");
    } else if (roll < 0.62) {
      if (put(c, r, "crystal") && rand() < 0.4) put(c + (rand() < 0.5 ? 1 : -1), r, "crystal");
    } else if (roll < 0.78) {
      // Pillars stand in pairs, two cells apart along a row or a column.
      if (put(c, r, "pillar")) { if (rand() < 0.5) put(c + 2, r, "pillar"); else put(c, r + 2, "pillar"); }
    } else if (roll < 0.9) {
      put(c, r, "monolith");
    } else {
      put(c, r, "stones");
    }
  }
  return out;
}
