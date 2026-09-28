// The railway: eight zones of a regional network, written as strokes of track
// with coordinates in each zone's own screen space. A stroke is one straight
// piece of line between two nodes; strokes that share a coordinate share a
// node, and a `link` joins a node on one zone's edge to a node on another's.
// Every stroke belongs to a track circuit (`tc`), which is what the
// interlocking locks and what lights up on the screen; a crossing shares one
// circuit between the strokes that cross.
//
// Directions: east is to the right and north is up. Trains keep left, so a
// train heading east is on the upper line of a pair and its signals are
// drawn above the line; a train heading west is on the lower line with its
// signals drawn below. Wauhatchie is the up direction, so the upper line of
// the main is the Down Main and the lower the Up Main.
//
// The long runs between stations are cut into blocks of three or four
// hundred metres, as on a commuter line, by automatic signals
// (`kind: "auto"`), which clear themselves whenever the block ahead is free
// and are never worked from a desk. Each block is its own circuit, so a
// train can follow another into a section as soon as it has cleared the
// first block. No plain block is over 650 m and no section through points
// or over a road over 800 m, bar the single line into Cleveland. The runs are drawn to scale, two metres a unit (see
// `STRETCH` at the end), so the boards are wider than these coordinates
// say and the blocks are real lengths on the screen; the stations keep the
// shape they are written in.

/** Metres per screen unit unless a stroke says otherwise. */
export const SCALE = 2;

/** Line speeds in metres a second. */
export const SPEED = {
  high: 56,      // 125 mph, the fast lines of the high-speed line
  main: 40,      // 90 mph
  branch: 27,    // 60 mph
  platform: 18,  // 40 mph
  junction: 11,  // 25 mph through a reversed point
  loop: 11,
  siding: 7,     // 15 mph
};

/**
 * The runs of plain line drawn to scale. An interval [from, to] in a zone's
 * written coordinates is so many metres of line, and is drawn at two metres
 * a unit, `SCALE`, however narrow it was written; everything beyond it
 * moves along, and the stations keep their shape. A stroke under a stretch
 * with no `len` of its own takes its length from the drawing, which is what
 * makes the blocks along it real; one with its own `len`, the goods loop or
 * a siding, is drawn off scale on purpose. No interval covers a diagonal,
 * which would be drawn out flat: every diagonal is written as far across as
 * it drops, so all of them are drawn at 45 degrees, and where a loop or a
 * junction sits inside a run the interval is cut in two round it, with the
 * run's metres shared between the halves.
 */
export const STRETCH = {
  WS: [[90, 380, 1200], [1180, 1600, 2500]],
  WH: [[0, 140, 900], [260, 820, 2760], [1180, 1600, 2040]],
  RS: [[0, 140, 900], [530, 730, 1220], [800, 890, 550], [1330, 1600, 1800]],
  CT: [[1280, 1320, 820], [1440, 1600, 700]],
  ER: [[370, 400, 640], [870, 1005, 1070], [1450, 1600, 900]],
  TH: [[0, 90, 400], [90, 300, 900], [660, 1010, 1400], [1090, 1200, 440], [1200, 1380, 754], [1460, 1600, 586]],
  CL: [[0, 90, 1500], [260, 300, 700]],
  SC: [[90, 200, 400], [1010, 1600, 2400]],
};

/** How many metres one written unit of a zone is at x: its stretch's, or two. */
function metresPerUnit(zoneId, x) {
  for (const [from, to, metres] of STRETCH[zoneId] ?? []) if (x >= from && x < to) return metres / (to - from);
  return SCALE;
}

/**
 * Where a run is cut into blocks: the written x of each cut, so many metres
 * along the plain line from x1 towards x2 through the zone's stretches,
 * west to east. Blocks are cut by the metres a driver runs, not by how
 * wide they are drawn, so a run that crosses into a stretch still has
 * blocks of one length.
 */
function cuts(zoneId, x1, x2, metresList) {
  const dir = Math.sign(x2 - x1);
  const edges = (STRETCH[zoneId] ?? []).flatMap(([a, b]) => [a, b]);
  const at = (metres) => {
    let x = x1, left = metres;
    while (left > 1e-6 && x !== x2) {
      const ahead = edges.filter((e) => (e - x) * dir > 1e-9 && (x2 - e) * dir > 1e-9);
      const next = ahead.length ? (dir > 0 ? Math.min(...ahead) : Math.max(...ahead)) : x2;
      const rate = metresPerUnit(zoneId, (x + next) / 2);
      const span = Math.abs(next - x) * rate;
      if (span >= left) return Math.round((x + dir * (left / rate)) * 10) / 10;
      left -= span;
      x = next;
    }
    return x;
  };
  return metresList.map(at).sort((a, b) => a - b);
}

/** A horizontal stroke from x1 to x2 at y. */
function H(tc, x1, x2, y, opts = {}) {
  return { tc, a: [x1, y], b: [x2, y], ...opts };
}
/**
 * A diagonal stroke between two corners: a crossover or a junction's leg,
 * a hundred metres long unless it says otherwise, however far across it is
 * drawn, since every diagonal is drawn at the same angle.
 */
function D(tc, x1, y1, x2, y2, opts = {}) {
  return { tc, a: [x1, y1], b: [x2, y2], len: 100, ...opts };
}
/**
 * A point at `node`. `toe` is the far end of the stroke a train faces the
 * blades from; `reverse` the far end of the diverging stroke. The third
 * stroke at the node is the normal one. `gang` names the crossover this
 * point moves with.
 */
function P(id, node, toe, reverse, gang = null) {
  return { id, node, toe, reverse, gang };
}
/** A signal standing at `node`, read by trains arriving from `from`: a main signal, a shunt, or an automatic (`kind: "auto"`) that clears itself. */
function S(id, node, from, opts = {}) {
  return { id, node, from, kind: "main", ...opts };
}
/** A crossing: two straight-through pairs of strokes meeting at one node. */
function X(node, pairA, pairB) {
  return { node, pairs: [pairA, pairB] };
}

/**
 * A run of plain line cut into blocks: one stroke for each block between
 * x1 and x2, the circuit's name lettered A, B, C on, and an automatic
 * signal at each boundary between them, named from `ids` in the direction
 * the trains run. The strokes carry no `len`: once the run is stretched to
 * scale (see `STRETCH`) their length is what is drawn, two metres a unit.
 * The run is cut evenly as written unless `cutAt` gives the cuts, west to
 * east, which `cuts()` works out from the metres wanted.
 */
function run(tc, x1, x2, y, opts, ids, cutAt = null) {
  const n = ids.length + 1;
  const at = (i) => (i === 0 ? x1 : i === n ? x2 : cutAt ? cutAt[i - 1] : Math.round(x1 + ((x2 - x1) * i) / n));
  const strokes = [], signals = [];
  for (let i = 0; i < n; i++) strokes.push(H(`${tc}${String.fromCharCode(65 + i)}`, at(i), at(i + 1), y, opts));
  const east = opts.dir !== "W";
  ids.forEach((id, k) => {
    const i = east ? k + 1 : n - 1 - k;
    signals.push(S(id, [at(i), y], [east ? at(i - 1) : at(i + 1), y], { kind: "auto" }));
  });
  return { strokes, signals, at };
}

// The runs, one constant each, so a zone can spread the strokes into its
// track and the automatics into its signals.
const WS_DM2 = run("WS.DM2", 90, 380, 220, { dir: "E" }, ["WS33", "WS35", "WS37"]);
const WS_DM7 = run("WS.DM7", 1180, 1600, 220, { dir: "E" }, ["WS9", "WS11", "WS13", "WS15", "WS17", "WS29"]);
const WS_UM7 = run("WS.UM7", 1180, 1600, 300, { dir: "W" }, ["WS8", "WS10", "WS12", "WS14", "WS16", "WS26"]);
const WS_UM2 = run("WS.UM2", 90, 380, 300, { dir: "W" }, ["WS18", "WS20", "WS24"]);
const WH_DM3 = run("WH.DM3", 260, 840, 220, { dir: "E" }, ["WH9", "WH11", "WH13", "WH15", "WH17"]);
const WH_UM3 = run("WH.UM3", 320, 820, 300, { dir: "W" }, ["WH20", "WH22", "WH24", "WH26", "WH28"]);
// The last block is short, so the next desk's first signal is within reach of it.
const WH_DM5 = run("WH.DM5", 1100, 1600, 220, { dir: "E" }, ["WH19", "WH21", "WH23", "WH25", "WH29"], cuts("WH", 1100, 1600, [400, 800, 1200, 1600, 2000]));
// The first block in from Riverside is short, for the same reason.
const WH_UM7 = run("WH.UM7", 1230, 1600, 300, { dir: "W" }, ["WH12", "WH14", "WH16", "WH36"], cuts("WH", 1600, 1230, [250, 637, 1024, 1410]));
const WH_UM1 = run("WH.UM1", 0, 140, 300, { dir: "W" }, ["WH30", "WH32", "WH34"]);
const RS_DM6 = run("RS.DM6", 460, 890, 220, { dir: "E" }, ["RS15", "RS17", "RS21", "RS23"], cuts("RS", 460, 890, [410, 820, 1230, 1640]));
// The first block past the yard's points is short, so the section from RS6 over them is not.
const RS_UM5 = run("RS.UM5", 520, 800, 300, { dir: "W" }, ["RS22", "RS24", "RS28"], cuts("RS", 800, 520, [110, 533, 957]));
const RS_UM1 = run("RS.UM1", 0, 140, 300, { dir: "W" }, ["RS30", "RS32", "RS34"]);
const RS_DM10 = run("RS.DM10", 1330, 1600, 220, { dir: "E" }, ["RS25", "RS27", "RS29"]);
const RS_UM10 = run("RS.UM10", 1400, 1600, 300, { dir: "W" }, ["RS14", "RS16"]);
const CT_DM11 = run("CT.DM11", 1280, 1320, 220, { dir: "E" }, ["CT23"]);
// From Lovell Field Junction to East Ridge, in blocks of about three
// hundred and fifty metres down and two hundred up, where the junction's
// signal stands a full overlap back from the diamond.
const ER_DM2 = run("ER.DM2", 170, 400, 220, { dir: "E" }, ["ER15", "ER17"], cuts("ER", 170, 400, [350, 700]));
const ER_UM1 = run("ER.UM1", 360, 400, 300, { dir: "W" }, ["ER10", "ER12"], cuts("ER", 400, 360, [220, 440]));
// The first block past the plant siding is shorter, so the section from ER7
// over its points is not long. Short of Ringgold are the crossovers, and
// the runs stop at them: the down one at ER11, which stands where the last
// automatic did, 160 m back from 511, and the up one at 511, with ER14 a
// block back from it, so that from Ringgold to ER14 is one section, ER4's,
// and a train worked over the Up Main between the crossovers meets no
// automatic, which would hold the line for itself.
const ER11_X = cuts("ER", 800, 1005, [1050])[0];
const ER_DM6 = run("ER.DM6", 800, ER11_X, 220, { dir: "E" }, ["ER19", "ER21"], cuts("ER", 800, ER11_X, [300, 700]));
const ER_UM3 = run("ER.UM3", 800, 1085, 300, { dir: "W" }, ["ER14", "ER16", "ER22"], cuts("ER", 1085, 800, [270, 637, 1003]));
const TH_DM2 = run("TH.DM2", 90, 300, 220, { dir: "E" }, ["TH5"]);
const TH_UM5 = run("TH.UM5", 90, 300, 300, { dir: "W" }, ["TH20"]);
// Blocks of four hundred metres from the road to Dalton, through the tunnel.
const TH_DM4 = run("TH.DM4", 660, 1200, 220, { dir: "E" }, ["TH7", "TH9", "TH11", "TH19"], cuts("TH", 660, 1200, [400, 800, 1200, 1600]));
const TH_DM5 = run("TH.DM5", 1200, 1600, 220, { dir: "E" }, ["TH13", "TH15", "TH23"], cuts("TH", 1200, 1600, [400, 800, 1200]));
const TH_UM2 = run("TH.UM2", 1080, 1460, 300, { dir: "W" }, ["TH14", "TH16", "TH18"]);
const CL_DB1 = run("CL.DB1", 0, 90, 220, { speed: SPEED.branch, dir: "E" }, ["CL5", "CL17", "CL19"]);
const CL_UB1 = run("CL.UB1", 0, 90, 280, { speed: SPEED.branch, dir: "W" }, ["CL14", "CL18", "CL20"]);
// The runs reach to just short of Collegedale's points, so the loop's own signals stand at its throat.
// Ooltewah to the TMD's junction and on to Collegedale, in blocks of three
// to four hundred metres. The run from the junction to Collegedale is
// written long, at the plain scale, with the depot laid out beneath it.
const CL_DB3 = run("CL.DB3", 260, 300, 220, { speed: SPEED.branch, dir: "E" }, ["CL13"], cuts("CL", 260, 300, [350]));
const CL_DB4 = run("CL.DBJ", 360, 976, 220, { speed: SPEED.branch, dir: "E" }, ["CL37", "CL39", "CL41"], cuts("CL", 360, 976, [300, 600, 900]));
const CL_UB4 = run("CL.UBJ", 690, 962, 280, { speed: SPEED.branch, dir: "W" }, ["CL26"], cuts("CL", 962, 690, [272]));
// A short first block, so a train off either platform has only the points and one block to clear.
const SC_DM7 = run("SC.DM7", 1010, 1600, 220, { dir: "E" }, ["MB9", "MB11", "MB13", "MB15", "MB17"], cuts("SC", 1010, 1600, [300, 700, 1100, 1500, 1900]));
const SC_UM2 = run("SC.UM2", 1010, 1500, 300, { dir: "W" }, ["MB10", "MB12", "MB14", "MB16"]);
// The two lines of the high-speed line in from Lovell Field Junction, in
// blocks of under five hundred metres; the first is short, since the line
// has already run from the junction to the boundary.
const LF_DF1 = run("LF.DF1", 0, 640, 160, { dir: "E", speed: SPEED.high }, ["LF31", "LF33", "LF35"], cuts("LF", 0, 640, [200, 600, 1000]));
const LF_UF1 = run("LF.UF1", 0, 680, 240, { dir: "W", speed: SPEED.high }, ["LF32", "LF34", "LF36", "LF38"], cuts("LF", 680, 0, [150, 450, 750, 1050]));
// The airport branch from the parkway out to the airport, in blocks of six
// hundred metres down and five hundred up, where the first block out of the
// airport is short so every road's way out reaches the first automatic.
const LF_BD = run("LF.BD", 2120, 3320, 400, { dir: "E", speed: SPEED.branch }, ["LF43", "LF45", "LF47"], cuts("LF", 2120, 3320, [600, 1200, 1800]));
const LF_BU = run("LF.BU", 2120, 3320, 480, { dir: "W", speed: SPEED.branch }, ["LF50", "LF52", "LF54", "LF56", "LF58"], cuts("LF", 3320, 2120, [150, 650, 1150, 1650, 2150]));
// The Down Slow, the Down Fast and the Up Fast out to Calhoun and in from
// it, each with an automatic four hundred metres in from the edge, abreast,
// east of the flyover: without them the block to or from the edge is a
// kilometre. The Up Slow's LF18 stands at the parkway's junction, close
// enough in already.
const LF_DS5 = run("LF.DS5", 1520, 1960, 80, { dir: "E" }, ["LF29"], cuts("LF", 1520, 1960, [480]));
const LF_DF9 = run("LF.DF9", 1480, 1960, 160, { dir: "E", speed: SPEED.high }, ["LF39"], cuts("LF", 1480, 1960, [560]));
const LF_UF9 = run("LF.UF9", 1460, 1960, 240, { dir: "W", speed: SPEED.high }, ["LF30"], cuts("LF", 1960, 1460, [400]));

/** The ends of the single line into Cleveland: the place at each, and the signal a train off the line meets there. */
const SINGLE = [{ at: "CD", from: "CL10" }, { at: "CL", from: "CL11" }];

export const ZONES = [
  {
    id: "WS",
    name: "Whiteside",
    note: "The first desk from the west: Slygo Road on the level, Whiteside's two platforms, and a pair of crossovers beyond them, so a train can be worked over the other line past a failure. Everything from Nashville comes in here.",
    width: 1600,
    height: 560,
    strokes: [
      // Down Main from the Bridgeport fringe: the road, platform 1, the
      // crossovers, and the run to Tiftonia.
      H("WS.BDD", -400, 0, 220, { hidden: true, len: 1500, dir: "E" }),
      H("WS.DM1", 0, 90, 220, { len: 400, dir: "E" }),
      ...WS_DM2.strokes,
      H("WS.LCD", 380, 460, 220, { len: 120, dir: "E" }),
      H("WS.DM3", 460, 620, 220, { len: 300, dir: "E" }),
      H("WS.P1", 620, 820, 220, { len: 200, speed: SPEED.platform, platform: ["WS", "1"], dir: "E" }),
      H("WS.DM4", 820, 900, 220, { dir: "E" }),
      H("WS.DM5", 900, 1110, 220, { len: 200, dir: "E" }),
      H("WS.DM6", 1110, 1180, 220, { dir: "E" }),
      ...WS_DM7.strokes,
      // Up Main, the mirror of it.
      H("WS.BDU", -400, 0, 300, { hidden: true, len: 1500, dir: "W" }),
      H("WS.UM1", 0, 90, 300, { len: 400, dir: "W" }),
      ...WS_UM2.strokes,
      H("WS.LCU", 380, 460, 300, { len: 120, dir: "W" }),
      H("WS.UM3", 460, 620, 300, { len: 300, dir: "W" }),
      H("WS.P2", 620, 820, 300, { len: 200, speed: SPEED.platform, platform: ["WS", "2"], dir: "W" }),
      H("WS.UM4", 820, 980, 300, { len: 160, dir: "W" }),
      H("WS.UM5", 980, 1005, 300),
      H("WS.UM5A", 1005, 1030, 300),
      H("WS.UM6", 1030, 1180, 300, { len: 200, dir: "W" }),
      ...WS_UM7.strokes,
      // The crossovers: 603 takes a down train across to the Up Main and
      // 605 brings it back, with a signal between them the right way, so a
      // down train can be worked over the other line past a failure.
      D("WS.603", 900, 220, 980, 300, { speed: SPEED.junction, dir: "E" }),
      D("WS.605", 1030, 300, 1110, 220, { speed: SPEED.junction, dir: "E" }),
    ],
    crossings: [],
    // Slygo Road crosses both lines on the level west of the station.
    lcs: [{ id: "WS", name: "Slygo Road", x: 420, tcs: ["WS.LCD", "WS.LCU"], top: 180, bottom: 340 }],
    points: [
      P("603A", [900, 220], [820, 220], [980, 300], "603"),
      P("603B", [980, 300], [1005, 300], [900, 220], "603"),
      P("605A", [1030, 300], [1005, 300], [1110, 220], "605"),
      P("605B", [1110, 220], [1180, 220], [1030, 300], "605"),
    ],
    signals: [
      S("WS31", [90, 220], [0, 220], { kind: "auto" }),
      S("WS1", [380, 220], [WS_DM2.at(3), 220]),
      S("WS3", [820, 220], [620, 220]),
      S("WS7", [1005, 300], [980, 300]),
      S("WS5", [1180, 220], [1110, 220]),
      S("WS2", [1180, 300], [WS_UM7.at(1), 300]),
      S("WS4", [620, 300], [820, 300]),
      S("WS6", [90, 300], [WS_UM2.at(1), 300]),
      ...WS_DM2.signals,
      ...WS_DM7.signals,
      ...WS_UM7.signals,
      ...WS_UM2.signals,
    ],
    fringes: [
      { id: "BD-D", name: "Bridgeport", node: [0, 220], from: [-400, 220], out: false },
      { id: "BD-U", name: "Bridgeport", node: [0, 300], from: [90, 300], out: true },
    ],
    links: [
      { node: [1600, 220], zone: "WH", at: [0, 220] },
      { node: [1600, 300], zone: "WH", at: [0, 300] },
    ],
    labels: [
      { text: "WHITESIDE", x: 720, y: 40, kind: "station", anchor: "middle" },
      { text: "TO BRIDGEPORT", x: 20, y: 470, kind: "edge" },
      { text: "TO WAUHATCHIE", x: 1580, y: 470, kind: "edge", anchor: "end" },
    ],
  },
  {
    id: "WH",
    name: "Wauhatchie",
    note: "Tiftonia, then Wauhatchie with its up loop, where a stopping train waits to be overtaken, and in the rush hour for the extra behind the express too.",
    width: 1600,
    height: 560,
    strokes: [
      // Down Main from the Whiteside boundary: Tiftonia, then Wauhatchie's
      // platform 1 and the long run to Lookout Valley.
      H("WH.DM1", 0, 30, 220, { dir: "E" }),
      H("WH.DM1A", 30, 70, 220, { dir: "E" }),
      H("WH.DM2", 70, 140, 220, { dir: "E" }),
      H("WH.TP1", 140, 260, 220, { len: 160, speed: SPEED.platform, platform: ["TF", "1"], dir: "E" }),
      ...WH_DM3.strokes,
      H("WH.DM4", 840, 900, 220, { dir: "E" }),
      H("WH.P1", 900, 1100, 220, { len: 200, speed: SPEED.platform, platform: ["WH", "1"], dir: "E" }),
      ...WH_DM5.strokes,
      // Up Main: platform 2 on the main and platform 3 in the loop beside
      // it, so a stopping train can be put aside for the express.
      ...WH_UM1.strokes,
      H("WH.TP2", 140, 260, 300, { len: 160, speed: SPEED.platform, platform: ["TF", "2"], dir: "W" }),
      H("WH.UM2", 260, 320, 300, { dir: "W" }),
      ...WH_UM3.strokes,
      H("WH.UM4", 820, 900, 300, { dir: "W" }),
      H("WH.P2", 900, 1100, 300, { len: 200, speed: SPEED.platform, platform: ["WH", "2"], dir: "W" }),
      H("WH.UM5", 1100, 1180, 300, { dir: "W" }),
      H("WH.UM6", 1180, 1230, 300, { dir: "W" }),
      ...WH_UM7.strokes,
      D("WH.411", 1180, 300, 1100, 380, { speed: SPEED.junction, dir: "W" }),
      H("WH.P3", 900, 1100, 380, { len: 200, speed: SPEED.platform, platform: ["WH", "3"], dir: "W" }),
      D("WH.413", 900, 380, 820, 300, { speed: SPEED.junction, dir: "W" }),
    ],
    crossings: [],
    lcs: [],
    points: [
      P("411", [1180, 300], [1230, 300], [1100, 380]),
      P("413", [820, 300], [WH_UM3.at(5), 300], [900, 380]),
    ],
    signals: [
      S("WH27", [30, 220], [0, 220], { kind: "auto" }),
      S("WH1", [70, 220], [30, 220]),
      S("WH3", [260, 220], [140, 220]),
      S("WH5", [840, 220], [WH_DM3.at(5), 220]),
      S("WH7", [1100, 220], [900, 220]),
      S("WH2", [1230, 300], [WH_UM7.at(1), 300]),
      S("WH4", [900, 300], [1100, 300]),
      S("WH6", [900, 380], [1100, 380]),
      S("WH8", [320, 300], [WH_UM3.at(1), 300]),
      ...WH_DM3.signals,
      ...WH_DM5.signals,
      ...WH_UM3.signals,
      ...WH_UM7.signals,
      ...WH_UM1.signals,
      S("WH10", [140, 300], [260, 300]),
    ],
    fringes: [],
    links: [
      { node: [0, 220], zone: "WS", at: [1600, 220] },
      { node: [0, 300], zone: "WS", at: [1600, 300] },
      { node: [1600, 220], zone: "RS", at: [0, 220] },
      { node: [1600, 300], zone: "RS", at: [0, 300] },
    ],
    labels: [
      { text: "TIFTONIA", x: 200, y: 40, kind: "station", anchor: "middle" },
      { text: "WAUHATCHIE", x: 1000, y: 40, kind: "station", anchor: "middle" },
      { text: "UP LOOP", x: 1000, y: 440, kind: "note", anchor: "middle" },
      { text: "TO WHITESIDE", x: 20, y: 470, kind: "edge" },
      { text: "TO CHATTANOOGA", x: 1580, y: 470, kind: "edge", anchor: "end" },
    ],
  },
  {
    id: "RS",
    name: "Riverside",
    note: "Lookout Valley and its road crossing, the yard with the goods loop and reception line, then St Elmo. Freight to put aside and expresses to keep out of its way.",
    width: 1600,
    height: 560,
    strokes: [
      // Down Main, from the Wauhatchie fringe to the Chattanooga boundary:
      // Lookout Valley, the crossing, the loop, St Elmo.
      H("RS.DM1", 0, 66, 220, { dir: "E" }),
      H("RS.DM2", 66, 140, 220, { dir: "E" }),
      H("RS.LP1", 140, 260, 220, { len: 160, speed: SPEED.platform, platform: ["LV", "1"], dir: "E" }),
      H("RS.LCD", 260, 340, 220, { len: 120, dir: "E" }),
      H("RS.DM4", 340, 400, 220, { len: 400, dir: "E" }),
      H("RS.DM5", 400, 460, 220, { len: 200, dir: "E" }),
      ...RS_DM6.strokes,
      H("RS.DM6X", 890, 970, 220, { len: 150, dir: "E" }),
      H("RS.DM7", 970, 1070, 220, { len: 200, dir: "E" }),
      H("RS.DM8", 1070, 1130, 220, { dir: "E" }),
      H("RS.DM9", 1130, 1180, 220, { len: 450, dir: "E" }),
      H("RS.SP1", 1180, 1330, 220, { len: 200, speed: SPEED.platform, platform: ["SE", "1"], dir: "E" }),
      ...RS_DM10.strokes,
      // Up Main.
      ...RS_UM1.strokes,
      H("RS.LP2", 140, 260, 300, { len: 160, speed: SPEED.platform, platform: ["LV", "2"], dir: "W" }),
      H("RS.LCU", 260, 340, 300, { len: 120, dir: "W" }),
      H("RS.UM3", 340, 380, 300, { dir: "W" }),
      H("RS.UM4", 380, 490, 300, { len: 300, dir: "W" }),
      H("RS.UM5X", 490, 520, 300, { len: 150, dir: "W" }),
      ...RS_UM5.strokes,
      // A yard departure runs east along the Up Main here, wrong road, with
      // a signal of its own halfway so the move is two sections, not one.
      H("RS.UM6", 800, 845, 300),
      H("RS.UM6A", 845, 890, 300),
      H("RS.UM7", 890, 960, 300, { dir: "W" }),
      H("RS.UM8", 960, 1150, 300, { len: 450, dir: "W" }),
      H("RS.SP2", 1150, 1330, 300, { len: 200, speed: SPEED.platform, platform: ["SE", "2"], dir: "W" }),
      H("RS.UM9", 1330, 1365, 300, { dir: "W" }),
      H("RS.UM9A", 1365, 1400, 300, { dir: "W" }),
      ...RS_UM10.strokes,
      // The Down Goods Loop, where a slow train is put aside.
      D("RS.201", 460, 220, 530, 150, { len: 200, dir: "E" }),
      H("RS.DGL", 530, 1000, 150, { len: 800, speed: SPEED.loop, waypoint: ["RS", "loop"], dir: "E" }),
      D("RS.203", 1000, 150, 1070, 220, { dir: "E" }),
      // The reception line for the yard, off the Up Main, open at both ends.
      D("RS.205", 800, 300, 730, 370),
      H("RS.YR", 420, 680, 370, { len: 600, speed: SPEED.siding, platform: ["RS", "yard"] }),
      H("RS.YR2", 680, 730, 370, { len: 100, speed: SPEED.siding }),
      D("RS.211", 420, 370, 490, 300, { dir: "E" }),
      // The crossover a yard departure uses to reach the Down Main.
      D("RS.209", 890, 300, 970, 220, { dir: "E" }),
    ],
    crossings: [],
    // Cummings Highway crosses both lines on the level just east of the
    // halt, each line over the road on its own circuit. The signaller lowers
    // the barriers; the signals either side will not clear until they are down.
    lcs: [{ id: "LV", name: "Cummings Highway", x: 322, tcs: ["RS.LCD", "RS.LCU"], top: 180, bottom: 340 }],
    points: [
      P("201", [460, 220], [400, 220], [530, 150]),
      P("203", [1070, 220], [1130, 220], [1000, 150]),
      P("205", [800, 300], [845, 300], [730, 370]),
      P("211", [490, 300], [380, 300], [420, 370]),
      P("209A", [890, 300], [845, 300], [970, 220], "209"),
      P("209B", [970, 220], [1070, 220], [890, 300], "209"),
    ],
    signals: [
      S("RS1", [66, 220], [0, 220]),
      S("RS26", [1365, 300], [1400, 300], { kind: "auto" }),
      S("RS33", [845, 300], [800, 300]),
      S("RS3", [260, 220], [140, 220]),
      S("RS5", [400, 220], [340, 220]),
      S("RS7", [1130, 220], [1070, 220]),
      S("RS9", [1000, 150], [530, 150]),
      S("RS11", [1330, 220], [1180, 220]),
      S("RS13", [680, 370], [420, 370]),
      S("RS19", [890, 220], [RS_DM6.at(4), 220]),
      S("RS2", [1400, 300], [RS_UM10.at(1), 300]),
      S("RS18", [520, 300], [RS_UM5.at(1), 300]),
      ...RS_DM6.signals,
      ...RS_DM10.signals,
      ...RS_UM5.signals,
      ...RS_UM10.signals,
      ...RS_UM1.signals,
      S("RS4", [1150, 300], [1330, 300]),
      S("RS6", [960, 300], [1150, 300]),
      S("RS8", [380, 300], [490, 300]),
      S("RS10", [140, 300], [260, 300]),
      S("RS12", [420, 370], [680, 370]),
    ],
    fringes: [],
    links: [
      { node: [0, 220], zone: "WH", at: [1600, 220] },
      { node: [0, 300], zone: "WH", at: [1600, 300] },
      { node: [1600, 220], zone: "CT", at: [0, 220] },
      { node: [1600, 300], zone: "CT", at: [0, 300] },
    ],
    labels: [
      { text: "LOOKOUT VALLEY", x: 240, y: 40, kind: "station", anchor: "middle" },
      { text: "RIVERSIDE", x: 640, y: 470, kind: "station" },
      { text: "ST ELMO", x: 1255, y: 40, kind: "station", anchor: "middle" },
      { text: "TO WAUHATCHIE", x: 20, y: 470, kind: "edge" },
      { text: "TO CHATTANOOGA", x: 1580, y: 470, kind: "edge", anchor: "end" },
      { text: "YARD", x: 560, y: 430, kind: "note" },
      { text: "GOODS LOOP", x: 765, y: 135, kind: "note", anchor: "middle" },
    ],
  },
  {
    id: "CT",
    name: "Chattanooga",
    note: "The terminal with its carriage siding, the flat junction, then Brainerd out past the diamond. Every train passes through it and half of them stop.",
    width: 1600,
    height: 560,
    strokes: [
      // Down Main, west to east. The platform lines are P1 above and P2 on
      // the main itself; P3 is the Up Main and P4 below it.
      H("CT.DM1", 0, 100, 220, { dir: "E" }),
      H("CT.DM2", 100, 180, 220),
      H("CT.DM3", 180, 200, 220),
      H("CT.DM4", 200, 240, 220),
      H("CT.DM5", 240, 430, 220, { len: 200 }),
      H("CT.P2", 430, 660, 220, { len: 240, speed: SPEED.platform, platform: ["CT", "2"] }),
      H("CT.DM6", 660, 850, 220, { len: 150 }),
      H("CT.DM7", 850, 880, 220),
      H("CT.DM8", 880, 1070, 220, { len: 150, dir: "E" }),
      H("CT.DM9", 1070, 1100, 220, { dir: "E" }),
      H("CT.DM10", 1100, 1160, 220, { len: 150, dir: "E" }),
      H("CT.DIA", 1160, 1200, 220, { dir: "E" }),
      H("CT.DIA", 1200, 1240, 220, { dir: "E" }),
      // The first block runs back to the diamond on the plain scale, so the
      // Up Branch comes down to it at the same angle as every other diagonal.
      H("CT.DM11A", 1240, 1280, 220, { dir: "E" }),
      ...CT_DM11.strokes,
      H("CT.BP1", 1320, 1440, 220, { len: 180, speed: SPEED.platform, platform: ["BR", "1"], dir: "E" }),
      H("CT.DM12", 1440, 1520, 220, { dir: "E" }),
      H("CT.DM12A", 1520, 1600, 220, { dir: "E" }),
      // Up Main, drawn west to east; up trains run along it westward.
      H("CT.UM1", 40, 100, 300, { dir: "W" }),
      H("CT.UM1A", 0, 40, 300, { dir: "W" }),
      H("CT.UM2", 100, 320, 300, { len: 250, dir: "W" }),
      H("CT.UM3", 320, 350, 300),
      H("CT.UM4", 350, 430, 300),
      H("CT.P3", 430, 660, 300, { len: 240, speed: SPEED.platform, platform: ["CT", "3"] }),
      H("CT.UM5", 660, 800, 300, { len: 120 }),
      H("CT.UM6", 800, 960, 300, { len: 150 }),
      H("CT.UM7", 960, 990, 300),
      H("CT.UM8", 990, 1070, 300, { len: 150, dir: "W" }),
      H("CT.UM9", 1070, 1120, 300, { dir: "W" }),
      H("CT.UM10", 1120, 1220, 300, { dir: "W" }),
      H("CT.UM10A", 1220, 1288, 300, { dir: "W" }),
      H("CT.UM10B", 1288, 1304, 300, { dir: "W" }),
      H("CT.UM10C", 1304, 1320, 300, { dir: "W" }),
      H("CT.BP2", 1320, 1440, 300, { len: 180, speed: SPEED.platform, platform: ["BR", "2"], dir: "W" }),
      H("CT.UM11", 1440, 1500, 300, { dir: "W" }),
      H("CT.UM12", 1500, 1600, 300, { dir: "W" }),
      // Platform 1 and its connections at either end.
      D("CT.101", 200, 220, 280, 140),
      H("CT.P1A", 280, 430, 140),
      H("CT.P1", 430, 660, 140, { len: 240, speed: SPEED.platform, platform: ["CT", "1"] }),
      H("CT.P1B", 660, 740, 140),
      H("CT.P1C", 740, 770, 140),
      D("CT.123", 770, 140, 850, 220),
      // The carriage siding, straight on from platform 1's east end: stock
      // done with off platform 1 or the bay runs in without crossing a
      // running line, one train at a time, and comes out the same way past
      // the shunt signal. Anything more goes to the TMD on the branch.
      H("CT.S1A", 770, 840, 140, { speed: SPEED.siding }),
      H("CT.S1", 840, 1000, 140, { len: 250, speed: SPEED.siding, platform: ["CT", "S1"] }),
      // The bay, platform 5, open to the east.
      H("CT.P5", 430, 660, 80, { len: 180, speed: SPEED.siding, platform: ["CT", "5"] }),
      H("CT.P5A", 660, 680, 80),
      D("CT.121", 680, 80, 740, 140),
      // Platform 4 and its connections.
      D("CT.105", 350, 300, 430, 380),
      H("CT.P4", 430, 660, 380, { len: 240, speed: SPEED.platform, platform: ["CT", "4"] }),
      H("CT.P4A", 660, 720, 380),
      D("CT.125", 720, 380, 800, 300),
      // The west crossovers: 107 takes up trains off the down side, 103
      // takes down trains across to the up side.
      D("CT.107", 180, 220, 100, 300, { dir: "W" }),
      D("CT.103", 240, 220, 320, 300, { dir: "E" }),
      // The east crossovers: 129 brings up trains across to platforms 1 and
      // 2, 127 lets down trains leave platforms 3 and 4.
      D("CT.129", 880, 220, 960, 300, { dir: "W" }),
      D("CT.127", 990, 300, 1070, 220, { dir: "E" }),
      // The branch to Cleveland: the Down Branch climbs away off the Down
      // Main; the Up Branch comes down across it on the flat, over a diamond
      // that is one circuit with the main it crosses.
      D("CT.131", 1100, 220, 1240, 80, { speed: SPEED.junction, dir: "E" }),
      // The branch's first signal stands on the straight, clear of the corner.
      H("CT.131", 1240, 1260, 80, { len: 40, speed: SPEED.branch, dir: "E" }),
      H("CT.DBA", 1260, 1400, 80, { len: 370, speed: SPEED.branch, dir: "E" }),
      H("CT.DBB", 1400, 1500, 80, { len: 245, speed: SPEED.branch, dir: "E" }),
      H("CT.DBC", 1500, 1600, 80, { len: 245, speed: SPEED.branch, dir: "E" }),
      H("CT.UB2", 1280, 1380, 140, { len: 120, speed: SPEED.branch, dir: "W" }),
      H("CT.UB", 1380, 1550, 140, { len: 464, speed: SPEED.branch, dir: "W" }),
      H("CT.UBA", 1550, 1600, 140, { len: 136, speed: SPEED.branch, dir: "W" }),
      D("CT.DIA", 1280, 140, 1200, 220, { speed: SPEED.junction, dir: "W" }),
      D("CT.DIA", 1200, 220, 1120, 300, { speed: SPEED.junction, dir: "W" }),
    ],
    crossings: [X([1200, 220], [[1160, 220], [1240, 220]], [[1280, 140], [1120, 300]])],
    lcs: [],
    points: [
      P("107A", [180, 220], [200, 220], [100, 300], "107"),
      P("107B", [100, 300], [40, 300], [180, 220], "107"),
      P("101", [200, 220], [180, 220], [280, 140]),
      P("103A", [240, 220], [200, 220], [320, 300], "103"),
      P("103B", [320, 300], [350, 300], [240, 220], "103"),
      P("105", [350, 300], [320, 300], [430, 380]),
      P("121", [740, 140], [770, 140], [680, 80]),
      P("119", [770, 140], [740, 140], [840, 140]),
      P("123", [850, 220], [880, 220], [770, 140]),
      P("125", [800, 300], [960, 300], [720, 380]),
      P("129A", [880, 220], [850, 220], [960, 300], "129"),
      P("129B", [960, 300], [990, 300], [880, 220], "129"),
      P("127A", [990, 300], [960, 300], [1070, 220], "127"),
      P("127B", [1070, 220], [1100, 220], [990, 300], "127"),
      P("131", [1100, 220], [1070, 220], [1240, 80]),
      P("133", [1120, 300], [1070, 300], [1200, 220]),
    ],
    signals: [
      S("CT1", [100, 220], [0, 220]),
      S("CT10", [430, 140], [660, 140]),
      S("CT8", [430, 220], [660, 220]),
      S("CT4", [430, 300], [660, 300]),
      S("CT6", [430, 380], [660, 380]),
      S("CT19", [660, 80], [430, 80]),
      S("CT11", [660, 140], [430, 140]),
      S("CT12", [840, 140], [1000, 140], { kind: "shunt" }),
      S("CT13", [660, 220], [430, 220]),
      S("CT15", [660, 300], [430, 300]),
      S("CT17", [660, 380], [430, 380]),
      S("CT21", [1440, 220], [1320, 220]),
      S("CT25", [1400, 80], [1260, 80], { kind: "auto" }),
      S("CT26", [1070, 300], [1120, 300]),
      S("CT28", [1320, 300], [1440, 300]),
      ...CT_DM11.signals,
      S("CT24", [1500, 300], [1600, 300]),
      S("CT22", [1380, 140], [1550, 140]),
      S("CT27", [1240, 220], [1200, 220], { kind: "auto" }),
      S("CT29", [1520, 220], [1440, 220], { kind: "auto" }),
      S("CT30", [1220, 300], [1288, 300]),
      S("CT32", [1288, 300], [1304, 300], { kind: "auto" }),
      S("CT34", [1304, 300], [1320, 300], { kind: "auto" }),
      S("CT31", [1260, 80], [1240, 80], { kind: "auto" }),
      S("CT33", [1500, 80], [1400, 80], { kind: "auto" }),
      S("CT36", [1550, 140], [1600, 140], { kind: "auto" }),
      S("CT38", [40, 300], [100, 300], { kind: "auto" }),
    ],
    fringes: [],
    links: [
      { node: [0, 220], zone: "RS", at: [1600, 220] },
      { node: [0, 300], zone: "RS", at: [1600, 300] },
      { node: [1600, 80], zone: "CL", at: [0, 220] },
      { node: [1600, 140], zone: "CL", at: [0, 280] },
      { node: [1600, 220], zone: "ER", at: [0, 220] },
      { node: [1600, 300], zone: "ER", at: [0, 300] },
    ],
    labels: [
      { text: "CHATTANOOGA", x: 545, y: 40, kind: "station" },
      { text: "CARRIAGE SIDING", x: 920, y: 112, kind: "note", anchor: "middle" },
      { text: "BRAINERD", x: 1380, y: 400, kind: "station", anchor: "middle" },
      { text: "TO WHITESIDE", x: 20, y: 470, kind: "edge" },
      { text: "TO EAST RIDGE", x: 1580, y: 470, kind: "edge", anchor: "end" },
      { text: "TO CLEVELAND", x: 1580, y: 50, kind: "edge", anchor: "end" },
    ],
  },
  {
    id: "LF",
    name: "Lovell Field",
    note: "The high-speed line opens out to four at Lovell Field, and past it the airport branch climbs over the other lines on a flyover, calls at the parkway, and runs out to a terminal of four platforms with its air cargo roads.",
    width: 4000,
    height: 740,
    strokes: [
      // The Down Fast, in from the junction: the Down Slow opens out of it
      // at 911 for the platform, and the fast line runs on past the station
      // at 125 mph, under the flyover, to Calhoun.
      ...LF_DF1.strokes,
      H("LF.DF2", 640, 680, 160, { speed: SPEED.high, dir: "E" }),
      H("LF.DF3", 680, 900, 160, { speed: SPEED.high, dir: "E" }),
      H("LF.DF4", 900, 960, 160, { speed: SPEED.high, dir: "E" }),
      H("LF.DF5", 960, 1160, 160, { speed: SPEED.high, waypoint: ["LF", "fast"], dir: "E" }),
      H("LF.DF6", 1160, 1300, 160, { speed: SPEED.high, dir: "E" }),
      H("LF.DF8", 1300, 1480, 160, { speed: SPEED.high, dir: "E" }),
      ...LF_DF9.strokes,
      H("LF.CADF", 1960, 2360, 160, { hidden: true, len: 1500, dir: "E" }),
      // The Down Slow, out of the Down Fast at 911: platform 1, 915 back
      // across to the fast line, the airport junction at 927, and on to
      // Calhoun.
      D("LF.911", 680, 160, 760, 80, { speed: SPEED.branch, dir: "E" }),
      H("LF.DS1", 760, 960, 80, { len: 320, dir: "E" }),
      H("LF.P1", 960, 1160, 80, { len: 240, speed: SPEED.platform, platform: ["LF", "1"], dir: "E" }),
      H("LF.DS2", 1160, 1220, 80, { dir: "E" }),
      H("LF.DS3", 1220, 1480, 80, { dir: "E" }),
      H("LF.DS4", 1480, 1520, 80, { dir: "E" }),
      ...LF_DS5.strokes,
      H("LF.CADS", 1960, 2360, 80, { hidden: true, len: 1500, dir: "E" }),
      // The Up Fast, Calhoun to the junction.
      H("LF.CAUF", 1960, 2360, 240, { hidden: true, len: 1500, dir: "W" }),
      ...LF_UF9.strokes,
      H("LF.UF8", 1360, 1460, 240, { speed: SPEED.high, dir: "W" }),
      H("LF.UF7", 1300, 1360, 240, { speed: SPEED.high, dir: "W" }),
      H("LF.UF6", 1160, 1300, 240, { speed: SPEED.high, dir: "W" }),
      H("LF.UF5", 960, 1160, 240, { speed: SPEED.high, waypoint: ["LF", "fast"], dir: "W" }),
      H("LF.UF4", 800, 960, 240, { speed: SPEED.high, dir: "W" }),
      H("LF.UF3", 680, 800, 240, { speed: SPEED.high, dir: "W" }),
      ...LF_UF1.strokes,
      // The Up Slow from Calhoun: under the flyover, the up airport line in
      // at 929, 925 and 917 from and to the Up Fast, platform 2, and into
      // the Up Fast at 913, where the four lines close back to two.
      H("LF.CAUS", 1960, 2360, 320, { hidden: true, len: 1500, dir: "W" }),
      H("LF.US6", 1700, 1960, 320, { dir: "W" }),
      H("LF.US5", 1600, 1700, 320, { dir: "W" }),
      H("LF.US4", 1480, 1600, 320, { dir: "W" }),
      H("LF.US3", 1440, 1480, 320, { dir: "W" }),
      H("LF.US2", 1220, 1440, 320, { len: 300, dir: "W" }),
      H("LF.US1", 1160, 1220, 320, { dir: "W" }),
      H("LF.P2", 960, 1160, 320, { len: 240, speed: SPEED.platform, platform: ["LF", "2"], dir: "W" }),
      H("LF.US0", 760, 960, 320, { dir: "W" }),
      D("LF.913", 760, 320, 680, 240, { speed: SPEED.branch, dir: "W" }),
      // The crossovers past the station, each the way the trains run: off
      // the slow line and back on to the fast, off the fast on to the slow
      // to call, and back to the fast to get by what stands there.
      D("LF.915", 1220, 80, 1300, 160, { speed: SPEED.branch, dir: "E" }),
      D("LF.917", 1300, 240, 1220, 320, { speed: SPEED.branch, dir: "W" }),
      D("LF.925", 1440, 320, 1360, 240, { speed: SPEED.branch, dir: "W" }),
      // The airport branch, double. The down airport line leaves the Down
      // Slow at 927 and climbs over the other three on a flyover
      // (`flyover`, drawn over a gap in each), so a train for the airport
      // crosses nothing on the flat; the up airport line comes down beside
      // it and into the Up Slow at 929, trailing. At the foot of the
      // flyover is Lovell Field Parkway, a platform each way, and then two
      // and a half kilometres of plain double line to the airport, in
      // blocks of five and six hundred metres.
      D("LF.AD1", 1520, 80, 1840, 400, { len: 450, speed: SPEED.branch, dir: "E", flyover: true }),
      H("LF.AD2", 1840, 1920, 400, { speed: SPEED.branch, dir: "E" }),
      H("LF.PK1", 1920, 2120, 400, { len: 200, speed: SPEED.platform, platform: ["PK", "1"], dir: "E" }),
      ...LF_BD.strokes,
      H("LF.AD3", 3320, 3360, 400, { speed: SPEED.platform, dir: "E" }),
      D("LF.AU1", 1600, 320, 1760, 480, { len: 200, speed: SPEED.branch, dir: "W" }),
      H("LF.AU2", 1760, 1920, 480, { speed: SPEED.branch, dir: "W" }),
      H("LF.PK2", 1920, 2120, 480, { len: 200, speed: SPEED.platform, platform: ["PK", "2"], dir: "W" }),
      ...LF_BU.strokes,
      H("LF.AU3", 3320, 3360, 480, { speed: SPEED.platform, dir: "W" }),
      // The airport's throat: a scissors crossover, 931 and 933 over one
      // diamond, so a train in on the down line can reach any road and one
      // leaving any road can go out on the up line, and two moves that do
      // not cross can be made at once; then a ladder down to platforms 3
      // and 4, and up off platform 1's road to the two cargo roads.
      H("LF.AD4", 3360, 3440, 400, { speed: SPEED.platform }),
      H("LF.AU4", 3360, 3440, 480, { speed: SPEED.platform, dir: "W" }),
      D("LF.SX", 3360, 480, 3400, 440, { len: 50 }),
      D("LF.SX", 3400, 440, 3440, 400, { len: 50 }),
      D("LF.SX", 3360, 400, 3400, 440, { len: 50 }),
      D("LF.SX", 3400, 440, 3440, 480, { len: 50 }),
      H("LF.AP1A", 3440, 3480, 400, { speed: SPEED.platform }),
      H("LF.AP1B", 3480, 3560, 400, { speed: SPEED.platform }),
      H("LF.AP1", 3560, 3920, 400, { len: 250, speed: SPEED.platform, platform: ["AP", "1"] }),
      H("LF.AU5", 3440, 3480, 480, { speed: SPEED.platform }),
      H("LF.AP2A", 3480, 3560, 480, { speed: SPEED.platform }),
      H("LF.AP2", 3560, 3920, 480, { len: 250, speed: SPEED.platform, platform: ["AP", "2"] }),
      D("LF.935", 3480, 480, 3560, 560, { len: 60, speed: SPEED.platform }),
      H("LF.AP3A", 3560, 3640, 560, { speed: SPEED.platform }),
      H("LF.AP3", 3640, 3920, 560, { len: 250, speed: SPEED.platform, platform: ["AP", "3"] }),
      D("LF.937", 3560, 560, 3640, 640, { len: 60, speed: SPEED.platform }),
      H("LF.AP4A", 3640, 3720, 640, { speed: SPEED.platform }),
      H("LF.AP4", 3720, 3920, 640, { len: 250, speed: SPEED.platform, platform: ["AP", "4"] }),
      // The air cargo roads, long enough for a freight, on the other side
      // of the throat from the platforms: in off platform 1's road, out by
      // a shunt signal and over the scissors.
      D("LF.939", 3480, 400, 3560, 320, { len: 60, speed: SPEED.siding }),
      H("LF.AC1A", 3560, 3640, 320, { speed: SPEED.siding }),
      H("LF.AC1", 3640, 3920, 320, { len: 450, speed: SPEED.siding, platform: ["AC", "C1"] }),
      D("LF.941", 3560, 320, 3640, 240, { len: 60, speed: SPEED.siding }),
      H("LF.AC2A", 3640, 3720, 240, { speed: SPEED.siding }),
      H("LF.AC2", 3720, 3920, 240, { len: 450, speed: SPEED.siding, platform: ["AC", "C2"] }),
    ],
    crossings: [X([3400, 440], [[3360, 480], [3440, 400]], [[3360, 400], [3440, 480]])],
    lcs: [],
    points: [
      P("911", [680, 160], [640, 160], [760, 80]),
      P("913", [680, 240], [LF_UF1.at(4), 240], [760, 320]),
      P("915A", [1220, 80], [1160, 80], [1300, 160], "915"),
      P("915B", [1300, 160], [1480, 160], [1220, 80], "915"),
      P("917A", [1300, 240], [1360, 240], [1220, 320], "917"),
      P("917B", [1220, 320], [1160, 320], [1300, 240], "917"),
      P("925A", [1440, 320], [1480, 320], [1360, 240], "925"),
      P("925B", [1360, 240], [1300, 240], [1440, 320], "925"),
      P("927", [1520, 80], [1480, 80], [1840, 400]),
      P("929", [1600, 320], [1480, 320], [1760, 480]),
      P("931A", [3360, 480], [3320, 480], [3400, 440], "931"),
      P("931B", [3440, 400], [3480, 400], [3400, 440], "931"),
      P("933A", [3360, 400], [3320, 400], [3400, 440], "933"),
      P("933B", [3440, 480], [3480, 480], [3400, 440], "933"),
      P("935", [3480, 480], [3440, 480], [3560, 560]),
      P("937", [3560, 560], [3480, 480], [3640, 640]),
      P("939", [3480, 400], [3440, 400], [3560, 320]),
      P("941", [3560, 320], [3480, 400], [3640, 240]),
    ],
    signals: [
      S("LF5", [1160, 80], [960, 80]),
      // The airport junction's signal, worked from the desk: on along the
      // Down Slow, or over the flyover.
      S("LF27", [1480, 80], [1220, 80]),
      S("LF7", [640, 160], [LF_DF1.at(3), 160]),
      S("LF37", [960, 160], [900, 160], { kind: "auto" }),
      S("LF9", [1160, 160], [960, 160]),
      S("LF41", [1480, 160], [1300, 160], { kind: "auto" }),
      S("LF10", [1460, 240], [LF_UF9.at(1), 240]),
      S("LF40", [1160, 240], [1300, 240], { kind: "auto" }),
      S("LF42", [960, 240], [1160, 240], { kind: "auto" }),
      S("LF12", [800, 240], [960, 240]),
      S("LF18", [1700, 320], [1960, 320]),
      S("LF16", [1480, 320], [1600, 320]),
      S("LF14", [960, 320], [1160, 320]),
      // The parkway: in at LF21 and out at LF23 on the down line, out at
      // LF20 on the up, an overlap back from 929.
      S("LF21", [1920, 400], [1840, 400]),
      S("LF23", [2120, 400], [1920, 400]),
      S("LF20", [1920, 480], [2120, 480]),
      // The airport: in at LF49, a starter off each platform and a shunt
      // signal off each cargo road, all out to LF50, the up line's first
      // automatic.
      S("LF49", [3320, 400], [LF_BD.at(3), 400]),
      S("LF22", [3560, 400], [3920, 400]),
      S("LF24", [3560, 480], [3920, 480]),
      S("LF26", [3640, 560], [3920, 560]),
      S("LF28", [3720, 640], [3920, 640]),
      S("LF44", [3640, 320], [3920, 320], { kind: "shunt" }),
      S("LF46", [3720, 240], [3920, 240], { kind: "shunt" }),
      ...LF_BD.signals,
      ...LF_BU.signals,
      ...LF_DF1.signals,
      ...LF_UF1.signals,
      ...LF_DS5.signals,
      ...LF_DF9.signals,
      ...LF_UF9.signals,
    ],
    // A fringe for each line at Calhoun, named for the line, so a train
    // comes on and goes off on the line it is booked on. The four lines
    // leave the board partway across it, above the airport.
    fringes: [
      { id: "CA-DS", name: "Calhoun", line: "Down Slow", node: [1960, 80], from: [LF_DS5.at(1), 80], out: true },
      { id: "CA-DF", name: "Calhoun", line: "Down Fast", node: [1960, 160], from: [LF_DF9.at(1), 160], out: true },
      { id: "CA-UF", name: "Calhoun", line: "Up Fast", node: [1960, 240], from: [2360, 240], out: false },
      { id: "CA-US", name: "Calhoun", line: "Up Slow", node: [1960, 320], from: [2360, 320], out: false },
    ],
    links: [
      { node: [0, 160], zone: "ER", at: [380, 380] },
      { node: [0, 240], zone: "ER", at: [380, 460] },
    ],
    labels: [
      { text: "LOVELL FIELD", x: 1060, y: 40, kind: "station", anchor: "middle" },
      { text: "FAST LINES", x: 1060, y: 205, kind: "note", anchor: "middle" },
      { text: "LOVELL FIELD PARKWAY", x: 2020, y: 570, kind: "station", anchor: "middle" },
      { text: "LOVELL FIELD AIRPORT", x: 3670, y: 705, kind: "station", anchor: "middle" },
      { text: "AIR CARGO", x: 3780, y: 205, kind: "note", anchor: "middle" },
      { text: "TO CHATTANOOGA", x: 20, y: 400, kind: "edge" },
    ],
  },
  {
    id: "ER",
    name: "East Ridge",
    note: "Lovell Field Junction, where the high-speed line leaves the main on the flat, then East Ridge, the plant siding at Enterprise South where a freight reverses, a pair of crossovers so a down train can be worked over the other line past a failure, then Ringgold and the Nashville Street crossing before the Tunnel Hill boundary.",
    width: 1600,
    height: 560,
    strokes: [
      // Down Main from the Chattanooga boundary: Lovell Field Junction, where
      // the Down High Speed leaves at 507 and crosses the Up Main on the
      // flat, over a diamond that is one circuit with the Up Main it
      // crosses; East Ridge's platform 1, the junction for the plant siding,
      // Ringgold, the road, and on to Tunnel Hill.
      H("ER.DM1", 0, 90, 220, { dir: "E" }),
      H("ER.DM1A", 90, 170, 220, { dir: "E" }),
      ...ER_DM2.strokes,
      H("ER.EP1", 400, 620, 220, { len: 220, speed: SPEED.platform, platform: ["ER", "1"], dir: "E" }),
      H("ER.DM3", 620, 700, 220, { dir: "E" }),
      H("ER.DM4", 700, 760, 220),
      H("ER.DM5", 760, 800, 220),
      ...ER_DM6.strokes,
      // ER11, then the crossovers: 511 takes a down train across to the Up
      // Main and 513 brings it back, with ER29 between them the right way,
      // so it can be worked over the other line past a failure and still
      // call at Ringgold's platform 1.
      H("ER.DM7", ER11_X, 1005, 220, { dir: "E" }),
      H("ER.DM7A", 1005, 1215, 220, { dir: "E" }),
      H("ER.DM7B", 1215, 1230, 220, { dir: "E" }),
      H("ER.RP1", 1230, 1350, 220, { len: 160, speed: SPEED.platform, platform: ["RG", "1"], dir: "E" }),
      H("ER.LCD", 1350, 1450, 220, { len: 120, dir: "E" }),
      H("ER.DM8", 1450, 1500, 220, { dir: "E" }),
      H("ER.DM8A", 1500, 1550, 220, { dir: "E" }),
      H("ER.DM8B", 1550, 1600, 220, { dir: "E" }),
      // Up Main, over the diamond and then past 509, where the Up High
      // Speed comes in. ER26 stands 180 m back from the diamond, a full
      // overlap, so a train stopped at it is well clear of the crossing.
      H("ER.UM1Y", 0, 45, 300, { dir: "W" }),
      H("ER.UM1X", 45, 140, 300, { dir: "W" }),
      H("ER.UM1W", 140, 230, 300, { dir: "W" }),
      H("ER.DIA", 230, 250, 300, { dir: "W" }),
      H("ER.DIA", 250, 270, 300, { dir: "W" }),
      H("ER.UM1V", 270, 360, 300, { dir: "W" }),
      ...ER_UM1.strokes,
      H("ER.EP2", 400, 620, 300, { len: 220, speed: SPEED.platform, platform: ["ER", "2"], dir: "W" }),
      H("ER.UM2", 620, 680, 300, { dir: "W" }),
      H("ER.UM2A", 680, 750, 300, { dir: "W" }),
      H("ER.UM3X", 750, 800, 300, { dir: "W" }),
      ...ER_UM3.strokes,
      H("ER.UM3E", 1085, 1110, 300),
      H("ER.UM3F", 1110, 1135, 300),
      H("ER.UM3Y", 1135, 1230, 300, { dir: "W" }),
      H("ER.RP2", 1230, 1350, 300, { len: 160, speed: SPEED.platform, platform: ["RG", "2"], dir: "W" }),
      H("ER.LCU", 1350, 1450, 300, { len: 120, dir: "W" }),
      H("ER.UM4", 1450, 1467, 300, { dir: "W" }),
      H("ER.UM5B", 1467, 1500, 300, { dir: "W" }),
      H("ER.UM5A", 1500, 1550, 300, { dir: "W" }),
      H("ER.UM5", 1550, 1600, 300, { dir: "W" }),
      // The plant siding leaves the Down Main facing east; a train comes
      // back out of it westward and crosses to the Up Main at 503. Its road
      // is named, not numbered: a numbered road is a platform, drawn with a
      // face and stood in, and a freight with nothing more to do here is
      // shunted into the works, as one into the yard is.
      D("ER.503", 760, 220, 680, 300, { speed: SPEED.junction, dir: "W" }),
      D("ER.505", 800, 220, 870, 150, { len: 200, speed: SPEED.junction }),
      H("ER.ESA", 870, 906.8, 150, { len: 120, speed: SPEED.siding }),
      H("ER.ES", 906.8, 1028.6, 150, { len: 600, speed: SPEED.siding, platform: ["ES", "siding"] }),
      // The crossovers short of Ringgold, trailing out of the stretch so they
      // are drawn at the angle of every other diagonal.
      D("ER.511", 1005, 220, 1085, 300, { speed: SPEED.junction, dir: "E" }),
      D("ER.513", 1135, 300, 1215, 220, { speed: SPEED.junction, dir: "E" }),
      // The high-speed line to and from Lovell Field. Its two lines keep the
      // main's spacing through the junction: 509 stands back from 507 by as
      // much as puts the two legs as far apart across as the lines they
      // join, and the diamond is halfway down the Down High Speed's leg.
      // Both lines leave the board a short way past the junction, each stub
      // the run on to the boundary. ER28 stands on the straight, clear of
      // the corner and 200 m back from 509.
      D("ER.DIA", 170, 220, 250, 300, { speed: SPEED.branch, dir: "E" }),
      D("ER.DIA", 250, 300, 330, 380, { speed: SPEED.branch, dir: "E" }),
      H("ER.DH", 330, 380, 380, { len: 230, dir: "E" }),
      H("ER.UH", 330, 380, 460, { len: 230, dir: "W" }),
      H("ER.UHJ", 300, 330, 460, { len: 60, speed: SPEED.branch, dir: "W" }),
      D("ER.UHJ", 300, 460, 140, 300, { len: 140, speed: SPEED.branch, dir: "W" }),
    ],
    crossings: [X([250, 300], [[230, 300], [270, 300]], [[170, 220], [330, 380]])],
    // Nashville Street crosses both lines at Ringgold's east end.
    lcs: [{ id: "RG", name: "Nashville Street", x: 1420, tcs: ["ER.LCD", "ER.LCU"], top: 180, bottom: 340 }],
    points: [
      P("503A", [760, 220], [800, 220], [680, 300], "503"),
      P("503B", [680, 300], [620, 300], [760, 220], "503"),
      P("505", [800, 220], [760, 220], [870, 150]),
      P("511A", [1005, 220], [ER11_X, 220], [1085, 300], "511"),
      P("511B", [1085, 300], [1110, 300], [1005, 220], "511"),
      P("513A", [1135, 300], [1110, 300], [1215, 220], "513"),
      P("513B", [1215, 220], [1230, 220], [1135, 300], "513"),
      P("507", [170, 220], [90, 220], [250, 300]),
      P("509", [140, 300], [45, 300], [300, 460]),
    ],
    signals: [
      S("ER1", [90, 220], [0, 220]),
      S("ER7", [620, 220], [400, 220]),
      S("ER11", [ER11_X, 220], [ER_DM6.at(2), 220]),
      S("ER29", [1110, 300], [1085, 300]),
      S("ER13", [1350, 220], [1230, 220]),
      S("ER9", [906.8, 150], [1028.6, 150], { kind: "shunt" }),
      S("ER2", [1467, 300], [1500, 300]),
      S("ER18", [1550, 300], [1600, 300], { kind: "auto" }),
      S("ER20", [1500, 300], [1550, 300], { kind: "auto" }),
      S("ER23", [1500, 220], [1450, 220], { kind: "auto" }),
      S("ER25", [1550, 220], [1500, 220], { kind: "auto" }),
      S("ER24", [45, 300], [140, 300], { kind: "auto" }),
      S("ER26", [360, 300], [ER_UM1.at(1), 300]),
      S("ER28", [330, 460], [380, 460]),
      S("ER4", [1230, 300], [1350, 300]),
      S("ER6", [750, 300], [800, 300]),
      S("ER8", [400, 300], [620, 300]),
      ...ER_DM2.signals,
      ...ER_DM6.signals,
      ...ER_UM1.signals,
      ...ER_UM3.signals,
    ],
    fringes: [],
    links: [
      { node: [0, 220], zone: "CT", at: [1600, 220] },
      { node: [0, 300], zone: "CT", at: [1600, 300] },
      { node: [380, 380], zone: "LF", at: [0, 160] },
      { node: [380, 460], zone: "LF", at: [0, 240] },
      { node: [1600, 220], zone: "TH", at: [0, 220] },
      { node: [1600, 300], zone: "TH", at: [0, 300] },
    ],
    labels: [
      { text: "EAST RIDGE", x: 510, y: 40, kind: "station", anchor: "middle" },
      { text: "RINGGOLD", x: 1290, y: 40, kind: "station", anchor: "middle" },
      { text: "ENTERPRISE SOUTH", x: 958.9, y: 112, kind: "note", anchor: "middle" },
      { text: "LOVELL FIELD JUNCTION", x: 250, y: 150, kind: "note", anchor: "middle" },
      { text: "TO CHATTANOOGA", x: 20, y: 530, kind: "edge" },
      { text: "TO TUNNEL HILL", x: 1580, y: 470, kind: "edge", anchor: "end" },
    ],
  },
  {
    id: "TH",
    name: "Tunnel Hill",
    note: "The last desk before Georgia: Tunnel Hill's two platforms, Clisby Austin Road on the level, the tunnel under Chetoogeta Mountain, and the up loop before the Dalton edge, where a late coal train is put aside for the semi-fast behind it.",
    width: 1600,
    height: 560,
    strokes: [
      // Down Main from the East Ridge boundary: platform 1, the road, the
      // tunnel, and away to Dalton.
      H("TH.DM1", 0, 45, 220, { dir: "E" }),
      H("TH.DM1A", 45, 90, 220, { dir: "E" }),
      ...TH_DM2.strokes,
      H("TH.P1", 300, 500, 220, { len: 200, speed: SPEED.platform, platform: ["TH", "1"], dir: "E" }),
      H("TH.DM3", 500, 580, 220, { dir: "E" }),
      H("TH.LCD", 580, 660, 220, { len: 120, dir: "E" }),
      ...TH_DM4.strokes,
      ...TH_DM5.strokes,
      H("TH.DLD", 1600, 2000, 220, { hidden: true, len: 1500, dir: "E" }),
      // Up Main from the Dalton fringe, with the loop beside it beyond the
      // tunnel, so a freight can be put aside for what is behind it.
      H("TH.DLU", 1600, 2000, 300, { hidden: true, len: 1500, dir: "W" }),
      H("TH.UM1", 1520, 1600, 300, { dir: "W" }),
      H("TH.UM1A", 1460, 1520, 300, { dir: "W" }),
      ...TH_UM2.strokes,
      H("TH.UM2X", 1010, 1080, 300, { dir: "W" }),
      // Through the tunnel in blocks, and a signal of the desk's own just
      // short of the road, so the crossing is not protected from a mile off.
      H("TH.UM3", 660, 700, 300, { dir: "W" }),
      H("TH.UM3A", 700, 810, 300, { dir: "W" }),
      H("TH.UM3B", 810, 910, 300, { dir: "W" }),
      H("TH.UM3C", 910, 1010, 300, { dir: "W" }),
      H("TH.LCU", 580, 660, 300, { len: 120, dir: "W" }),
      H("TH.UM4", 500, 580, 300, { dir: "W" }),
      H("TH.P2", 300, 500, 300, { len: 200, speed: SPEED.platform, platform: ["TH", "2"], dir: "W" }),
      ...TH_UM5.strokes,
      H("TH.UM6", 45, 90, 300, { dir: "W" }),
      H("TH.UM6A", 0, 45, 300, { dir: "W" }),
      D("TH.703", 1380, 380, 1460, 300, { speed: SPEED.junction, dir: "W" }),
      H("TH.UGL", 1090, 1380, 380, { len: 600, speed: SPEED.loop, waypoint: ["TH", "loop"], dir: "W" }),
      D("TH.701", 1010, 300, 1090, 380, { speed: SPEED.junction, dir: "W" }),
    ],
    crossings: [],
    // Clisby Austin Road crosses both lines between the station and the tunnel.
    lcs: [{ id: "TH", name: "Clisby Austin Road", x: 620, tcs: ["TH.LCD", "TH.LCU"], top: 180, bottom: 340 }],
    points: [
      P("703", [1460, 300], [1520, 300], [1380, 380]),
      P("701", [1010, 300], [910, 300], [1090, 380]),
    ],
    signals: [
      S("TH17", [45, 220], [0, 220], { kind: "auto" }),
      S("TH1", [90, 220], [45, 220]),
      S("TH21", [1200, 220], [TH_DM4.at(4), 220], { kind: "auto" }),
      S("TH22", [90, 300], [TH_UM5.at(1), 300], { kind: "auto" }),
      S("TH24", [45, 300], [90, 300], { kind: "auto" }),
      S("TH26", [700, 300], [810, 300]),
      S("TH28", [810, 300], [910, 300], { kind: "auto" }),
      S("TH30", [910, 300], [1010, 300], { kind: "auto" }),
      S("TH3", [500, 220], [300, 220]),
      S("TH2", [1520, 300], [1600, 300]),
      S("TH4", [1090, 380], [1380, 380]),
      S("TH6", [1080, 300], [TH_UM2.at(1), 300]),
      S("TH8", [300, 300], [500, 300]),
      ...TH_DM2.signals,
      ...TH_DM4.signals,
      ...TH_DM5.signals,
      ...TH_UM2.signals,
      ...TH_UM5.signals,
    ],
    fringes: [
      { id: "DL-D", name: "Dalton", node: [1600, 220], from: [TH_DM5.at(3), 220], out: true },
      { id: "DL-U", name: "Dalton", node: [1600, 300], from: [2000, 300], out: false },
    ],
    links: [
      { node: [0, 220], zone: "ER", at: [1600, 220] },
      { node: [0, 300], zone: "ER", at: [1600, 300] },
    ],
    labels: [
      { text: "TUNNEL HILL", x: 400, y: 40, kind: "station", anchor: "middle" },
      { text: "CHETOOGETA TUNNEL", x: 850, y: 112, kind: "note", anchor: "middle" },
      { text: "UP LOOP", x: 1240, y: 440, kind: "note", anchor: "middle" },
      { text: "TO EAST RIDGE", x: 20, y: 470, kind: "edge" },
      { text: "TO DALTON", x: 1580, y: 470, kind: "edge", anchor: "end" },
    ],
  },
  {
    id: "CL",
    name: "Cleveland",
    note: "Ooltewah, the TMD out in the country, then Collegedale's loop where trains cross, then a single line into the terminus with its depot and neck. Every arrival forms a departure.",
    width: 2240,
    height: 600,
    strokes: [
      // The branch arrives double: Down Branch above, Up Branch below.
      // Ooltewah's two platforms, then Collegedale with a crossover each
      // way, then the two lines fold into one for the run to Cleveland.
      ...CL_DB1.strokes,
      H("CL.DB2", 90, 140, 220, { len: 200, speed: SPEED.branch, dir: "E" }),
      H("CL.OP1", 140, 260, 220, { len: 160, speed: SPEED.platform, platform: ["OO", "1"], dir: "E" }),
      ...CL_DB3.strokes,
      // Ooltewah TMD's junction, out in the country between Ooltewah and
      // Collegedale, a double junction as a branch's is: the arrival line
      // leaves the Down Branch at 327, facing a train from Chattanooga, and
      // crosses the Up Branch on the flat, over a diamond that is one
      // circuit with the Up Branch it crosses; the departure line comes in
      // on the Up Branch at 343, past the diamond, so a train leaving
      // crosses nothing. CL43 gives the road on along the branch or into
      // the depot; CL44 stands a full overlap back from 343.
      H("CL.DB3K", 300, 360, 220, { speed: SPEED.branch, dir: "E" }),
      ...CL_DB4.strokes,
      H("CL.DB3X", 976, 980, 220, { speed: SPEED.branch, dir: "E" }),
      H("CL.DB4", 980, 1130, 220, { len: 300, speed: SPEED.branch }),
      H("CL.DB5", 1130, 1200, 220, { speed: SPEED.platform }),
      H("CL.CP1", 1200, 1340, 220, { len: 180, speed: SPEED.platform, platform: ["CD", "1"] }),
      H("CL.DB6", 1340, 1430, 220, { speed: SPEED.platform }),
      ...CL_UB1.strokes,
      H("CL.UB1X", 90, 140, 280, { len: 200, speed: SPEED.branch, dir: "W" }),
      H("CL.OP2", 140, 260, 280, { len: 160, speed: SPEED.platform, platform: ["OO", "2"], dir: "W" }),
      H("CL.UB2", 260, 265, 280, { len: 100, speed: SPEED.branch, dir: "W" }),
      H("CL.UB3", 265, 300, 280, { speed: SPEED.branch, dir: "W" }),
      H("CL.UBM", 300, 400, 280, { speed: SPEED.branch, dir: "W" }),
      H("CL.DIA", 400, 420, 280, { speed: SPEED.branch, dir: "W" }),
      H("CL.DIA", 420, 440, 280, { speed: SPEED.branch, dir: "W" }),
      H("CL.UBK", 440, 560, 280, { speed: SPEED.branch, dir: "W" }),
      H("CL.UBL", 560, 690, 280, { speed: SPEED.branch, dir: "W" }),
      ...CL_UB4.strokes,
      H("CL.UB3X", 962, 1040, 280, { len: 200, speed: SPEED.branch, dir: "W" }),
      H("CL.UB4", 1040, 1070, 280, { speed: SPEED.branch }),
      H("CL.UB5", 1070, 1200, 280, { len: 300, speed: SPEED.platform }),
      H("CL.CP2", 1200, 1340, 280, { len: 180, speed: SPEED.platform, platform: ["CD", "2"] }),
      H("CL.UB6", 1340, 1430, 280, { speed: SPEED.platform }),
      // Ooltewah TMD, the county's traction maintenance depot, with the
      // room a depot wants. In off the diamond to CL45 on the arrival line,
      // long enough to hold a train clear of the Up Branch; out from CL46
      // on the lead, up the departure line to 343. Then a ladder down to
      // four long roads, the fuel road on top and two through the shed,
      // each with a shunt signal to leave it by. One train to a road, and a
      // train done with stays where it is put.
      D("CL.DIA", 360, 220, 420, 280, { len: 80, speed: SPEED.junction, dir: "E" }),
      D("CL.DIA", 420, 280, 480, 340, { len: 80, speed: SPEED.junction, dir: "E" }),
      H("CL.TA", 480, 540, 340, { len: 230, speed: SPEED.siding, dir: "E" }),
      H("CL.TB", 540, 620, 340, { len: 40, speed: SPEED.siding, dir: "E" }),
      D("CL.TD", 560, 280, 620, 340, { len: 80, speed: SPEED.junction, dir: "W" }),
      H("CL.351", 620, 660, 340, { speed: SPEED.siding }),
      H("CL.TL", 660, 740, 340, { len: 60, speed: SPEED.siding }),
      H("CL.345", 740, 800, 340, { len: 40, speed: SPEED.siding }),
      H("CL.TM1", 800, 1100, 340, { len: 250, speed: SPEED.siding, platform: ["TM", "R1"] }),
      D("CL.345", 740, 340, 800, 400, { len: 60, speed: SPEED.siding }),
      H("CL.347", 800, 860, 400, { len: 40, speed: SPEED.siding }),
      H("CL.TM2", 860, 1100, 400, { len: 250, speed: SPEED.siding, platform: ["TM", "R2"] }),
      D("CL.347", 800, 400, 860, 460, { len: 60, speed: SPEED.siding }),
      H("CL.349", 860, 920, 460, { len: 40, speed: SPEED.siding }),
      H("CL.TM3", 920, 1100, 460, { len: 250, speed: SPEED.siding, platform: ["TM", "R3"] }),
      D("CL.349", 860, 460, 920, 520, { len: 60, speed: SPEED.siding }),
      H("CL.349", 920, 980, 520, { len: 40, speed: SPEED.siding }),
      H("CL.TM4", 980, 1100, 520, { len: 250, speed: SPEED.siding, platform: ["TM", "R4"] }),
      D("CL.323", 980, 220, 1040, 280, { len: 170, dir: "E" }),
      D("CL.325", 1070, 280, 1130, 220, { len: 170, dir: "W" }),
      // The two lines become one at 321, and the single line runs to the
      // terminus throat. Anything on it is on it alone.
      D("CL.321", 1430, 220, 1460, 250),
      D("CL.321", 1430, 280, 1460, 250),
      // The single line, from 321 to the terminus throat: one train at a
      // time, either way, so the loop at Collegedale and the platforms at
      // Cleveland are where trains cross (`single` says which signal lets
      // a train off the line into each).
      H("CL.SL0", 1460, 1510, 250, { speed: SPEED.branch, single: SINGLE }),
      H("CL.SL", 1510, 1610, 250, { len: 2600, speed: SPEED.branch, single: SINGLE }),
      H("CL.SL2", 1610, 1660, 250, { len: 200, speed: SPEED.platform, single: SINGLE }),
      H("CL.LD1", 1660, 1680, 250, { speed: SPEED.platform, single: SINGLE }),
      H("CL.LD2", 1680, 1720, 250, { speed: SPEED.platform, single: SINGLE }),
      H("CL.LD3", 1720, 1800, 250, { speed: SPEED.platform }),
      // The neck, up off the lead and back towards Collegedale, where a
      // train reverses between a siding and a platform.
      D("CL.329", 1610, 250, 1450, 90, { speed: SPEED.siding }),
      H("CL.NK", 1340, 1450, 90, { len: 250, speed: SPEED.siding, platform: ["CL", "neck"] }),
      // The terminus: a ladder up to platforms 1 and 2, a ladder down to
      // 3, 4, 5 and the carriage sidings.
      D("CL.331", 1800, 250, 1860, 190, { speed: SPEED.platform }),
      H("CL.LD4", 1800, 1860, 250, { speed: SPEED.platform }),
      H("CL.P2A", 1860, 1930, 190, { speed: SPEED.platform }),
      H("CL.P2", 1930, 2180, 190, { len: 250, speed: SPEED.platform, platform: ["CL", "2"] }),
      D("CL.333", 1860, 190, 1920, 130, { speed: SPEED.platform }),
      H("CL.P1A", 1920, 1980, 130, { speed: SPEED.platform }),
      H("CL.P1", 1980, 2180, 130, { len: 250, speed: SPEED.platform, platform: ["CL", "1"] }),
      H("CL.P3A", 1860, 1940, 250, { speed: SPEED.platform }),
      H("CL.P3", 1940, 2180, 250, { len: 250, speed: SPEED.platform, platform: ["CL", "3"] }),
      D("CL.335", 1860, 250, 1920, 310, { speed: SPEED.platform }),
      H("CL.P4A", 1920, 2000, 310, { speed: SPEED.platform }),
      H("CL.P4", 2000, 2180, 310, { len: 250, speed: SPEED.platform, platform: ["CL", "4"] }),
      D("CL.337", 1920, 310, 1980, 370, { speed: SPEED.platform }),
      H("CL.P5A", 1980, 2060, 370, { speed: SPEED.platform }),
      H("CL.P5", 2060, 2180, 370, { len: 250, speed: SPEED.platform, platform: ["CL", "5"] }),
      D("CL.339", 1980, 370, 2040, 430, { speed: SPEED.siding }),
      H("CL.S1A", 2040, 2120, 430, { speed: SPEED.siding }),
      H("CL.S1", 2120, 2180, 430, { len: 250, speed: SPEED.siding, platform: ["CL", "S1"] }),
      D("CL.341", 2040, 430, 2100, 490, { speed: SPEED.siding }),
      H("CL.S2", 2100, 2180, 490, { len: 250, speed: SPEED.siding, platform: ["CL", "S2"] }),
    ],
    crossings: [X([420, 280], [[400, 280], [440, 280]], [[360, 220], [480, 340]])],
    lcs: [],
    // A depot's shed, drawn over the roads that run through it.
    sheds: [
      { x1: 980, y1: 388, x2: 1099, y2: 472, name: "SHED" },
      { x1: 2126, y1: 418, x2: 2181, y2: 502, name: "SHED" },
    ],
    points: [
      P("327", [360, 220], [300, 220], [420, 280]),
      P("343", [560, 280], [440, 280], [620, 340]),
      P("351", [620, 340], [660, 340], [560, 280]),
      P("345", [740, 340], [660, 340], [800, 400]),
      P("347", [800, 400], [740, 340], [860, 460]),
      P("349", [860, 460], [800, 400], [920, 520]),
      P("323A", [980, 220], [976, 220], [1040, 280], "323"),
      P("323B", [1040, 280], [1070, 280], [980, 220], "323"),
      P("325A", [1130, 220], [1200, 220], [1070, 280], "325"),
      P("325B", [1070, 280], [1040, 280], [1130, 220], "325"),
      P("321", [1460, 250], [1510, 250], [1430, 280]),
      P("329", [1610, 250], [1660, 250], [1450, 90]),
      P("331", [1800, 250], [1720, 250], [1860, 190]),
      P("333", [1860, 190], [1800, 250], [1920, 130]),
      P("335", [1860, 250], [1800, 250], [1920, 310]),
      P("337", [1920, 310], [1860, 250], [1980, 370]),
      P("339", [1980, 370], [1920, 310], [2040, 430]),
      P("341", [2040, 430], [1980, 370], [2100, 490]),
    ],
    signals: [
      S("CL1", [90, 220], [CL_DB1.at(3), 220]),
      S("CL3", [260, 220], [140, 220]),
      S("CL43", [300, 220], [CL_DB3.at(1), 220]),
      S("CL44", [690, 280], [CL_UB4.at(1), 280]),
      // The depot: in at CL45, out at CL46, and a shunt signal off every road.
      S("CL45", [540, 340], [480, 340]),
      S("CL46", [660, 340], [740, 340]),
      S("CL48", [800, 340], [1100, 340], { kind: "shunt" }),
      S("CL50", [860, 400], [1100, 400], { kind: "shunt" }),
      S("CL52", [920, 460], [1100, 460], { kind: "shunt" }),
      S("CL54", [980, 520], [1100, 520], { kind: "shunt" }),
      S("CL24", [300, 280], [400, 280], { kind: "auto" }),
      S("CL15", [976, 220], [CL_DB4.at(3), 220]),
      S("CL16", [962, 280], [1040, 280], { kind: "auto" }),
      S("CL7", [1340, 220], [1200, 220]),
      S("CL9", [1340, 280], [1200, 280]),
      S("CL11", [1720, 250], [1680, 250]),
      S("CL2", [265, 280], [300, 280]),
      S("CL4", [140, 280], [260, 280]),
      ...CL_DB1.signals,
      ...CL_DB3.signals,
      ...CL_DB4.signals,
      ...CL_UB1.signals,
      ...CL_UB4.signals,
      S("CL6", [1200, 220], [1340, 220]),
      S("CL8", [1200, 280], [1340, 280]),
      S("CL10", [1510, 250], [1610, 250]),
      S("CL12", [1680, 250], [1720, 250]),
      S("CL21", [1980, 130], [2180, 130]),
      S("CL23", [1930, 190], [2180, 190]),
      S("CL25", [1940, 250], [2180, 250]),
      S("CL27", [2000, 310], [2180, 310]),
      S("CL29", [2060, 370], [2180, 370]),
      S("CL31", [2120, 430], [2180, 430], { kind: "shunt" }),
      S("CL33", [2100, 490], [2180, 490], { kind: "shunt" }),
      S("CL35", [1450, 90], [1340, 90], { kind: "shunt" }),
    ],
    fringes: [],
    links: [
      { node: [0, 220], zone: "CT", at: [1600, 80] },
      { node: [0, 280], zone: "CT", at: [1600, 140] },
    ],
    labels: [
      { text: "OOLTEWAH", x: 200, y: 40, kind: "station", anchor: "middle" },
      { text: "COLLEGEDALE", x: 1270, y: 40, kind: "station", anchor: "middle" },
      { text: "CLEVELAND", x: 2060, y: 40, kind: "station", anchor: "middle" },
      { text: "TO CHATTANOOGA", x: 20, y: 540, kind: "edge" },
      { text: "CLEVELAND DEPOT", x: 2180, y: 545, kind: "note", anchor: "end" },
      { text: "OOLTEWAH TMD", x: 920, y: 575, kind: "note", anchor: "middle" },
    ],
  },
];

/**
 * The signalling school's own desk, on the railway's diagram nowhere (the
 * school prints its own): a stretch of line that exists only in the
 * school's screens, with the things every desk has
 * once each. Williams Island off the west edge, Moccasin Road on the level,
 * Moccasin Bend's two platforms with a crossover each way, and a run of
 * automatics to Stringers Ridge off the east edge. Platform 1 is the down
 * platform; platform 2 is signalled both ways, so a down train can be put
 * in it over 801 and brought back to its own line over 803. Point numbers
 * are one series over the whole railway, so the school's are the 800s.
 */
ZONES.push({
  id: "SC",
  name: "Training",
  training: true,
  note: "The signalling school's own stretch of line: a road on the level, a station with two platforms and a crossover each way, and a run of automatics to the east. On the railway's diagram nowhere; the school prints its own.",
  width: 1600,
  height: 560,
  strokes: [
    H("SC.WID", -400, 0, 220, { hidden: true, len: 1500, dir: "E" }),
    H("SC.DM1", 0, 90, 220, { len: 400, dir: "E" }),
    H("SC.DM2", 90, 200, 220, { dir: "E" }),
    H("SC.LCD", 200, 280, 220, { len: 120, dir: "E" }),
    // The home signal stands on its own node, clear of the road behind it
    // and the points ahead, and a circuit ends at it like at any signal.
    H("SC.DM3", 280, 420, 220, { len: 150, dir: "E" }),
    H("SC.DM3X", 420, 460, 220, { dir: "E" }),
    H("SC.DM4", 460, 600, 220, { dir: "E" }),
    H("SC.P1", 600, 800, 220, { len: 200, speed: SPEED.platform, platform: ["MB", "1"], dir: "E" }),
    H("SC.DM5", 800, 870, 220, { dir: "E" }),
    H("SC.DM6", 870, 1010, 220, { len: 200, dir: "E" }),
    ...SC_DM7.strokes,
    H("SC.SRD", 1600, 2000, 220, { hidden: true, len: 1500, dir: "E" }),
    H("SC.SRU", 1600, 2000, 300, { hidden: true, len: 1500, dir: "W" }),
    H("SC.UM1", 1500, 1600, 300, { len: 400, dir: "W" }),
    ...SC_UM2.strokes,
    H("SC.UM3", 950, 1010, 300, { dir: "W" }),
    H("SC.UM4", 800, 950, 300, { len: 150 }),
    H("SC.P2", 600, 800, 300, { len: 200, speed: SPEED.platform, platform: ["MB", "2"] }),
    H("SC.UM5", 540, 600, 300),
    H("SC.UM6", 280, 540, 300, { len: 150, dir: "W" }),
    H("SC.LCU", 200, 280, 300, { len: 120, dir: "W" }),
    H("SC.UM7", 90, 200, 300, { dir: "W" }),
    H("SC.UM8", 0, 90, 300, { len: 400, dir: "W" }),
    H("SC.WIU", -400, 0, 300, { hidden: true, len: 1500, dir: "W" }),
    D("SC.801", 460, 220, 540, 300, { speed: SPEED.junction, dir: "E" }),
    D("SC.803", 870, 220, 950, 300, { speed: SPEED.junction, dir: "W" }),
  ],
  crossings: [],
  lcs: [{ id: "MB", name: "Moccasin Road", x: 240, tcs: ["SC.LCD", "SC.LCU"], top: 180, bottom: 340 }],
  points: [
    P("801A", [460, 220], [420, 220], [540, 300], "801"),
    P("801B", [540, 300], [600, 300], [460, 220], "801"),
    P("803A", [950, 300], [800, 300], [870, 220], "803"),
    P("803B", [870, 220], [1010, 220], [950, 300], "803"),
  ],
  signals: [
    S("MB1", [90, 220], [0, 220]),
    S("MB3", [420, 220], [280, 220]),
    S("MB5", [800, 220], [600, 220]),
    S("MB2", [1500, 300], [1600, 300]),
    S("MB4", [1010, 300], [SC_UM2.at(1), 300]),
    S("MB6", [600, 300], [800, 300]),
    S("MB7", [800, 300], [600, 300]),
    S("MB8", [90, 300], [200, 300]),
    ...SC_DM7.signals,
    ...SC_UM2.signals,
  ],
  fringes: [
    { id: "WI-D", name: "Williams Island", node: [0, 220], from: [-400, 220], out: false },
    { id: "WI-U", name: "Williams Island", node: [0, 300], from: [90, 300], out: true },
    { id: "SR-D", name: "Stringers Ridge", node: [1600, 220], from: [SC_DM7.at(5), 220], out: true },
    { id: "SR-U", name: "Stringers Ridge", node: [1600, 300], from: [2000, 300], out: false },
  ],
  links: [],
  labels: [
    { text: "MOCCASIN BEND", x: 700, y: 40, kind: "station", anchor: "middle" },
    { text: "TO WILLIAMS ISLAND", x: 20, y: 470, kind: "edge" },
    { text: "TO STRINGERS RIDGE", x: 1580, y: 470, kind: "edge", anchor: "end" },
    { text: "SIGNALLING SCHOOL", x: 700, y: 470, kind: "note", anchor: "middle" },
  ],
});

/** A written x in a zone, as the board draws it. */
export function mapX(zoneId, x) {
  let out = x;
  for (const [from, to, metres] of STRETCH[zoneId] ?? []) {
    if (x <= from) continue;
    const by = metres / SCALE / (to - from);
    out += (Math.min(x, to) - from) * (by - 1);
  }
  return out;
}

for (const z of ZONES) {
  const at = (xy) => [mapX(z.id, xy[0]), xy[1]];
  for (const s of z.strokes) {
    s.a = at(s.a);
    s.b = at(s.b);
  }
  for (const p of z.points) { p.node = at(p.node); p.toe = at(p.toe); p.reverse = at(p.reverse); }
  for (const sig of z.signals) { sig.node = at(sig.node); sig.from = at(sig.from); }
  for (const x of z.crossings ?? []) { x.node = at(x.node); x.pairs = x.pairs.map((pair) => pair.map(at)); }
  for (const lc of z.lcs ?? []) lc.x = mapX(z.id, lc.x);
  for (const f of z.fringes) { f.node = at(f.node); f.from = at(f.from); }
  for (const link of z.links) link.node = at(link.node);
  for (const l of z.labels) l.x = mapX(z.id, l.x);
  for (const b of z.sheds ?? []) { b.x1 = mapX(z.id, b.x1); b.x2 = mapX(z.id, b.x2); }
  z.width = mapX(z.id, z.width);
}
// A link names a node on the neighbour's board, in the neighbour's coordinates.
for (const z of ZONES) for (const link of z.links) link.at = [mapX(link.zone, link.at[0]), link.at[1]];

/** The stations a timetable can name, and how the timetable refers to them. */
export const PLACES = {
  BD: { name: "Bridgeport", fringe: true },
  WS: { name: "Whiteside" },
  TF: { name: "Tiftonia" },
  WH: { name: "Wauhatchie" },
  LV: { name: "Lookout Valley" },
  RS: { name: "Riverside" },
  SE: { name: "St Elmo" },
  CT: { name: "Chattanooga" },
  BR: { name: "Brainerd" },
  ER: { name: "East Ridge" },
  ES: { name: "Enterprise South" },
  RG: { name: "Ringgold" },
  LF: { name: "Lovell Field" },
  PK: { name: "Lovell Field Parkway" },
  AP: { name: "Lovell Field Airport" },
  AC: { name: "Airport cargo" },
  CA: { name: "Calhoun", fringe: true },
  TH: { name: "Tunnel Hill" },
  DL: { name: "Dalton", fringe: true },
  OO: { name: "Ooltewah" },
  CD: { name: "Collegedale" },
  CL: { name: "Cleveland" },
  TM: { name: "Ooltewah TMD" },
  // The training desk's own places, on no diagram.
  WI: { name: "Williams Island", fringe: true },
  MB: { name: "Moccasin Bend" },
  SR: { name: "Stringers Ridge", fringe: true },
};
