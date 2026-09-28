// The plan: what runs, when, and what goes wrong. Every number that balances
// the shift lives here rather than in the rules.

/**
 * What each class of train is: how long, how fast, how quick to get going
 * and to stop, how long it stands at a platform, how long it needs to turn
 * round, and what its late minutes weigh in the score. Speeds are metres a
 * second; the rest is metres and seconds. The class digit is the first
 * character of the headcode, and it is the order a signaller regulates in:
 * an express or a high-speed train late costs twice what a stopping train
 * does, and a freight, empty stock or a light engine half, so which goes
 * first at a junction matters.
 */
export const KINDS = {
  express: { digit: "1", name: "Express passenger", length: 160, vmax: 40, accel: 0.5, brake: 0.6, dwell: 60, turn: 480, weight: 2 },
  local: { digit: "2", name: "Stopping passenger", length: 80, vmax: 33, accel: 0.7, brake: 0.7, dwell: 40, turn: 360, weight: 1 },
  fast: { digit: "4", name: "Freight, 75 mph", length: 320, vmax: 33, accel: 0.2, brake: 0.35, dwell: 0, turn: 600, weight: 0.5 },
  freight: { digit: "6", name: "Freight, 60 mph", length: 400, vmax: 27, accel: 0.15, brake: 0.3, dwell: 0, turn: 600, weight: 0.5 },
  empty: { digit: "5", name: "Empty stock", length: 80, vmax: 33, accel: 0.6, brake: 0.6, dwell: 0, turn: 240, weight: 0.5 },
  loco: { digit: "0", name: "Light locomotive", length: 20, vmax: 33, accel: 0.6, brake: 0.8, dwell: 0, turn: 300, weight: 0.5 },
  treatment: { digit: "3", name: "Railhead treatment train", length: 90, vmax: 27, accel: 0.3, brake: 0.4, dwell: 0, turn: 600, weight: 1 },
  high: { digit: "9", name: "High-speed passenger", length: 200, vmax: 56, accel: 0.5, brake: 0.6, dwell: 90, turn: 480, weight: 2 },
};

/**
 * Who runs what. The county electrified the line and let five operators
 * onto it. A service names its operator by its kind unless it says
 * otherwise with `op`.
 */
export const OPERATORS = {
  ridgeline: { name: "Ridgeline", note: "The expresses between Nashville and Atlanta, calling only at the terminal." },
  valley: { name: "Valley Rail", note: "The county's own: the stopping trains, the semi-fasts that run on to Nashville and Atlanta, the Cleveland branch, the bay shuttle, and the empty stock that forms them." },
  lookout: { name: "Lookout Freight", note: "The coal into Riverside for NerGy's boilers, the through freights, the air cargo out to the airport, and the light engines between them." },
  peachline: { name: "Peachline", note: "The high-speed trains between Chattanooga and Atlanta, on the new line past the airport at Lovell Field." },
  lovell: { name: "Lovell Link", note: "The airport trains, out of the bay at Chattanooga to the terminal at Lovell Field Airport, calling at Brainerd, Lovell Field and the parkway." },
};

/**
 * What the letter in a headcode says: where the train is going, one letter
 * for each place a train can finish, and never which way or what kind,
 * since the class digit before it says what the train is (`KINDS`) and the
 * number after it which one. A train going off the railway is lettered for
 * where it goes on to: the town just past the edge, or the city past that.
 * The signalling school has its own two, one at each end of its line.
 */
export const DESTINATIONS = {
  A: "Atlanta, on past Dalton, or off the high-speed line at Calhoun",
  B: "Bridgeport, off the west end",
  C: "Cleveland, and its depot",
  D: "Dalton, off the east end",
  L: "Lovell Field Airport, and its cargo terminal",
  M: "the maintenance depot at Ooltewah",
  N: "Nashville, on past Bridgeport",
  P: "the plant at Enterprise South",
  R: "the yard at Riverside",
  T: "Chattanooga, the terminal, and its carriage siding",
};

/** The school's letters, for its two ends. */
export const SCHOOL_DESTINATIONS = {
  S: "Stringers Ridge, off the east end",
  W: "Williams Island, off the west end",
};

/** The operator each kind of train runs for, unless the service says otherwise. */
const OPERATOR_OF = { express: "ridgeline", local: "valley", empty: "valley", fast: "lookout", freight: "lookout", loco: "lookout", treatment: "lookout", high: "peachline" };

/**
 * Where a train comes onto the railway or leaves it, by place. The
 * high-speed line has four lines at Calhoun, so a train there is booked on
 * to and off it by line, fast or slow.
 */
const FRINGE = {
  BD: { in: "BD-D", out: "BD-U" }, DL: { in: "DL-U", out: "DL-D" },
  CA: { fast: { in: "CA-UF", out: "CA-DF" }, slow: { in: "CA-US", out: "CA-DS" } },
  WI: { in: "WI-D", out: "WI-U" }, SR: { in: "SR-U", out: "SR-D" },
};
/** The fringe for a leg: the place's own, or on the high-speed line the one for the line the leg names. */
const fringeOf = (at, line, way) => (FRINGE[at]?.[line] ?? FRINGE[at])?.[way] ?? null;

/**
 * Booked running time in minutes between consecutive places, by kind. These
 * are the measured times of a clear run with a margin on top, which is what
 * a timetable is. A missing kind falls back to `local`.
 */
export const RUN = {
  // Down the main: Bridgeport, Whiteside, Tiftonia, Wauhatchie, Lookout
  // Valley, the yard, St Elmo, Chattanooga, Brainerd, East Ridge, the plant
  // siding, Ringgold, Tunnel Hill, Dalton.
  "BD>WS": { express: 2, local: 3, fast: 3, freight: 3, loco: 2 },
  "WS>TF": { express: 2, local: 2.5, fast: 3, freight: 3, loco: 2 },
  "TF>WH": { express: 2, local: 2.5, fast: 2.5, freight: 2.5, loco: 2 },
  "WH>LV": { express: 2, local: 2.5, fast: 2.5, freight: 3, loco: 2 },
  "LV>RS": { freight: 3, fast: 3 },
  "RS>SE": { freight: 2.5, fast: 3.5 },
  "LV>SE": { express: 2.5, local: 3.5, fast: 3, freight: 3.5, loco: 2.5 },
  "SE>CT": { express: 2.5, local: 3, fast: 2.5, freight: 2.5, loco: 2 },
  "CT>BR": { express: 2, local: 2.5, fast: 2, freight: 2.5, loco: 2, high: 2 },
  "BR>ER": { express: 2, local: 2.5, fast: 2, freight: 2.5, loco: 1.5 },
  "ER>ES": { freight: 3, fast: 3 },
  "ER>RG": { express: 2, local: 2.5, fast: 2, freight: 2.5, loco: 1.5 },
  "RG>TH": { express: 1, local: 1, fast: 1.5, freight: 1.5, loco: 1 },
  "TH>DL": { express: 3, local: 3, fast: 3, freight: 3, loco: 3 },
  // Up the main.
  "DL>TH": { express: 2, local: 3, fast: 3, freight: 3, loco: 3 },
  "TH>RG": { express: 1, local: 1.5, fast: 1.5, freight: 1.5, loco: 1 },
  "RG>ER": { express: 1.5, local: 2, fast: 2, freight: 2.5, loco: 1.5 },
  "ES>ER": { freight: 2.5, fast: 2.5 },
  "ER>BR": { express: 2, local: 2.5, fast: 2.5, freight: 2.5, loco: 1.5 },
  "BR>CT": { express: 2, local: 2.5, fast: 2.5, freight: 2.5, loco: 1.5, high: 2.5 },
  "CT>SE": { express: 2.5, local: 3, fast: 2.5, freight: 3.5, loco: 2 },
  "SE>RS": { freight: 4, fast: 4 },
  "SE>LV": { express: 2.5, local: 3, fast: 3, freight: 3, loco: 2.5 },
  "RS>LV": { freight: 2, fast: 2, loco: 2 },
  "LV>WH": { express: 2, local: 3, fast: 3, freight: 3, loco: 2 },
  "WH>TF": { express: 2, local: 2.5, fast: 2.5, freight: 2.5, loco: 2 },
  "TF>WS": { express: 2, local: 2.5, fast: 3, freight: 3, loco: 2 },
  "WS>BD": { express: 2, local: 3, fast: 3, freight: 3, loco: 2 },
  // The branch: Ooltewah, Collegedale, then the single line into Cleveland.
  "CT>OO": { local: 4.5, empty: 4.5 },
  "OO>CD": { local: 2.5, empty: 2.5 },
  "CD>CL": { local: 4, empty: 4 },
  "CL>CD": { local: 4, empty: 4 },
  "CD>OO": { local: 3, empty: 3 },
  "OO>CT": { local: 5.5, empty: 5.5 },
  "CL>CL": { empty: 4.5, local: 4.5 },
  "CT>CT": { empty: 2 },
  "OO>TM": { empty: 3.5 },
  "TM>OO": { empty: 3.5 },
  // The high-speed line: off the main past Brainerd at Lovell Field
  // Junction, Lovell Field, and Calhoun.
  "BR>LF": { high: 3, local: 3.5 },
  "LF>CA": { high: 1.5, local: 1.5 },
  "CA>LF": { high: 2, local: 2.5 },
  "LF>BR": { high: 3, local: 3 },
  // The airport branch: over the flyover to Lovell Field Parkway, then two
  // and a half kilometres out to the airport and its cargo roads.
  "LF>PK": { local: 2, fast: 2.5 },
  "PK>LF": { local: 2, fast: 2.5 },
  "PK>AP": { local: 3.5 },
  "AP>PK": { local: 3.5 },
  "PK>AC": { fast: 5 },
  "AC>PK": { fast: 5 },
  // The training desk.
  "WI>MB": { express: 2.5, local: 3, freight: 3.5 },
  "MB>SR": { express: 3, local: 3.5, freight: 4 },
  "SR>MB": { express: 3, local: 3.5, freight: 4 },
  "MB>WI": { express: 2.5, local: 3, freight: 3.5 },
};

/** Seconds since midnight for "HH:MM". */
const secs = (text) => {
  const [h, m] = text.split(":");
  return Number(h) * 3600 + Number(m) * 60;
};
/** "HH:MM" for seconds since midnight. */
const hm = (t) => `${String(Math.floor(t / 3600)).padStart(2, "0")}:${String(Math.floor((t % 3600) / 60)).padStart(2, "0")}`;

/**
 * The shift the tests know, which is not one a signaller can clock in to:
 * the clock starts five minutes before the day's first train is due, the
 * last train is due by the end, and the shift is over at the hard end
 * whatever is left. The first window on offer is 06:00 (`CLOCK_INS`).
 */
export const SHIFT = { start: "05:55", end: "08:00", hardEnd: "08:45", ready: 300, day: 288 };
/** The day the timetable covers. */
export const DAY = { first: "05:55", last: "22:00" };
/** The two rush hours, when the extra trains run. */
export const PEAKS = [["07:00", "09:30"], ["16:00", "19:00"]];

/** Whether a time falls in a rush hour. */
export function inPeak(t) {
  return PEAKS.some(([a, b]) => t >= secs(a) && t < secs(b));
}

/**
 * When a signaller can clock in: on each hour and half hour from six in the
 * morning to eight at night, the clock starting then with two hours of
 * trains due, so a shift clocked in at 19:30 runs to 21:30.
 */
export const CLOCK_INS = Array.from({ length: 29 }, (_, i) => hm(6 * 3600 + i * 1800));

/** The shift a number rolls: one of the clock-in times, on the day the number rolls. */
export function shiftFor(seed) {
  const roll = rng(seed * 31 + 7);
  return shiftAt(CLOCK_INS[Math.floor(roll() * CLOCK_INS.length)], seed);
}

/**
 * The shift that starts at a clock-in time, on the day of the year a number
 * rolls, so the day is the same whatever time is picked: two hours of
 * trains from then, and three quarters of an hour after that to see what
 * is left home.
 */
export function shiftAt(clockIn, seed) {
  const roll = rng(seed * 31 + 7);
  roll();
  const day = 1 + Math.floor(roll() * 365);
  const start = secs(clockIn);
  return { start: hm(start), end: hm(start + 7200), hardEnd: hm(start + 7200 + 2700), ready: 300, day };
}

/* ---- The calendar ------------------------------------------------------ */

const MONTHS = [["January", 31], ["February", 28], ["March", 31], ["April", 30], ["May", 31], ["June", 30], ["July", 31], ["August", 31], ["September", 30], ["October", 31], ["November", 30], ["December", 31]];
const WEEKDAYS = ["Thursday", "Friday", "Saturday", "Sunday", "Monday", "Tuesday", "Wednesday"];

/** A day of the year, 1 to 365, as the roster writes it: "Thursday 14 November". The year is never said. */
export function dayName(day) {
  let d = Math.max(1, Math.min(365, Math.round(day ?? 1)));
  const weekday = WEEKDAYS[(d - 1) % 7];
  for (const [month, length] of MONTHS) {
    if (d <= length) return `${weekday} ${d} ${month}`;
    d -= length;
  }
  return `${weekday} 31 December`;
}

/** The season a day falls in: the weather it can bring, and whether the leaves are down. */
export function seasonOf(day) {
  const d = day ?? SHIFT.day;
  if (d >= 60 && d <= 151) return "spring";
  if (d >= 152 && d <= 243) return "summer";
  if (d >= 244 && d <= 334) return "autumn";
  return "winter";
}

/** Leaf fall: from late September to the end of November. */
export function leafSeason(day) {
  const d = day ?? SHIFT.day;
  return d >= 263 && d <= 334;
}

/** What to call a shift by when it starts. */
export function shiftName(shift) {
  const h = (secs(shift.start) + 300) / 3600;
  return h < 9 ? "Morning" : h < 12 ? "Mid-morning" : h < 15 ? "Midday" : h < 18 ? "Afternoon" : "Evening";
}

/**
 * The paths trains run, as legs. A leg is [place, platform, minutes
 * standing, extra]: a leg with minutes is a call, one without is passed or
 * is the end; "reverse" marks a call the train leaves the other way, and
 * "E" or "W" says which way a train standing at its origin faces.
 */
const PATHS = {
  expressDown: [["BD"], ["WS", "1"], ["TF", "1"], ["WH", "1"], ["LV", "1"], ["SE", "1"], ["CT", "2", 2], ["BR", "1"], ["ER", "1"], ["RG", "1"], ["TH", "1"], ["DL"]],
  expressUp: [["DL"], ["TH", "2"], ["RG", "2"], ["ER", "2"], ["BR", "2"], ["CT", "3", 2], ["SE", "2"], ["LV", "2"], ["WH", "2"], ["TF", "2"], ["WS", "2"], ["BD"]],
  // Semi-fast trains behind the expresses, calling at Wauhatchie, Chattanooga and East Ridge.
  semiDown: [["BD"], ["WS", "1"], ["TF", "1"], ["WH", "1", 1], ["LV", "1"], ["SE", "1"], ["CT", "2", 1], ["BR", "1"], ["ER", "1", 1], ["RG", "1"], ["TH", "1"], ["DL"]],
  semiUp: [["DL"], ["TH", "2"], ["RG", "2"], ["ER", "2", 1], ["BR", "2"], ["CT", "4", 1], ["SE", "2"], ["LV", "2"], ["WH", "2", 1], ["TF", "2"], ["WS", "2"], ["BD"]],
  // Stopping trains, calling everywhere. The up ones wait in the loop at Wauhatchie for the express to pass, and in the rush hour for the extra behind it.
  localDown: [["BD"], ["WS", "1", 1], ["TF", "1", 1], ["WH", "1", 1], ["LV", "1", 1], ["SE", "1", 1], ["CT", "2", 1], ["BR", "1", 1], ["ER", "1", 1], ["RG", "1", 1], ["TH", "1", 1], ["DL"]],
  localUp: (stand) => [["DL"], ["TH", "2", 1], ["RG", "2", 1], ["ER", "2", 1], ["BR", "2", 1], ["CT", "4", 1], ["SE", "2", 1], ["LV", "2", 1], ["WH", "3", stand], ["TF", "2", 1], ["WS", "2", 1], ["BD"]],
  // The rush-hour extras: into Chattanooga from either end, calling at the one big station on the way, and out again the way they came.
  cityFromWest: [["BD"], ["WS", "1", 1], ["TF", "1"], ["WH", "1", 1], ["LV", "1"], ["SE", "1"], ["CT", "1"]],
  westFromCity: [["CT", "1", null, "W"], ["SE", "2"], ["LV", "2"], ["WH", "2", 1], ["TF", "2"], ["WS", "2", 1], ["BD"]],
  cityFromEast: [["DL"], ["TH", "2", 1], ["RG", "2"], ["ER", "2", 1], ["BR", "2"], ["CT", "3"]],
  eastFromCity: [["CT", "3", null, "E"], ["BR", "1"], ["ER", "1", 1], ["RG", "1"], ["TH", "1", 1], ["DL"]],
  // Bridgeport to Cleveland over the branch, and back. Down trains cross the up shuttle at Collegedale, where the single line begins.
  branchDown: (plat) => [["BD"], ["WS", "1", 1], ["TF", "1", 1], ["WH", "1", 1], ["LV", "1", 1], ["SE", "1", 1], ["CT", "1", 1], ["OO", "1", 1], ["CD", "1", 1], ["CL", plat]],
  branchUp: (plat) => [["CL", plat], ["CD", "2", 1], ["OO", "2", 1], ["CT", "3", 1], ["SE", "2", 1], ["LV", "2", 1], ["WH", "3", 1], ["TF", "2", 1], ["WS", "2", 1], ["BD"]],
  // The shuttle between Cleveland and the bay at Chattanooga.
  shuttleUp: [["CL", "4"], ["CD", "2", 1], ["OO", "2", 1], ["CT", "5"]],
  shuttleDown: [["CT", "5"], ["OO", "1", 1], ["CD", "1", 1], ["CL", "4"]],
  // Freight: through trains looped at Riverside, the plant train that reverses at Enterprise South, the coal in ahead of the semi-fast, the yard's own, and light engines.
  loopFreight: [["BD"], ["WS", "1"], ["TF", "1"], ["WH", "1"], ["LV", "1"], ["RS", "loop", 16], ["SE", "1"], ["CT", "2"], ["BR", "1"], ["ER", "1"], ["RG", "1"], ["TH", "1"], ["DL"]],
  plantIn: [["BD"], ["WS", "1"], ["TF", "1"], ["WH", "1"], ["LV", "1"], ["RS", "loop", 16], ["SE", "1"], ["CT", "2"], ["BR", "1"], ["ER", "1"], ["ES", "siding"]],
  plantOut: [["ES", "siding"], ["ER", "2"], ["BR", "2"], ["CT", "3"], ["SE", "2"], ["RS", "yard"]],
  coal: [["DL"], ["TH", "2"], ["RG", "2"], ["ER", "2"], ["BR", "2"], ["CT", "4"], ["SE", "2"], ["RS", "yard"]],
  yardEast: [["RS", "yard", null, "E"], ["SE", "1"], ["CT", "2"], ["BR", "1"], ["ER", "1"], ["RG", "1"], ["TH", "1"], ["DL"]],
  yardWest: [["RS", "yard", null, "W"], ["LV", "2"], ["WH", "2"], ["TF", "2"], ["WS", "2"], ["BD"]],
  loco: [["DL"], ["TH", "2"], ["RG", "2"], ["ER", "2"], ["BR", "2"], ["CT", "3"], ["SE", "2"], ["LV", "2"], ["WH", "2"], ["TF", "2"], ["WS", "2"], ["BD"]],
  // The railhead treatment train, through the whole main without a stop, sent from whichever end the leaf fall is nearer.
  treatDown: [["BD"], ["WS", "1"], ["TF", "1"], ["WH", "1"], ["LV", "1"], ["SE", "1"], ["CT", "2"], ["BR", "1"], ["ER", "1"], ["RG", "1"], ["TH", "1"], ["DL"]],
  treatUp: [["DL"], ["TH", "2"], ["RG", "2"], ["ER", "2"], ["BR", "2"], ["CT", "3"], ["SE", "2"], ["LV", "2"], ["WH", "2"], ["TF", "2"], ["WS", "2"], ["BD"]],
  // The high-speed line, out of Chattanooga and off the main at the
  // junction: a train that runs through Lovell Field takes the fast line,
  // one that stops the slow line and its platform. They turn round in
  // platform 1 at Chattanooga, between the branch trains.
  highFastDown: [["CT", "1", null, "E"], ["BR", "1"], ["LF", "fast"], ["CA", "fast"]],
  highCallDown: [["CT", "1", null, "E"], ["BR", "1"], ["LF", "1", 2], ["CA", "fast"]],
  highFastUp: [["CA", "fast"], ["LF", "fast"], ["BR", "2"], ["CT", "1"]],
  highCallUp: [["CA", "fast"], ["LF", "2", 2], ["BR", "2"], ["CT", "1"]],
  // Lovell Link's airport trains: out of the bay at Chattanooga, off the
  // main at the junction, calling at Brainerd and at Lovell Field on the
  // slow line for the high-speed trains, then over the flyover, calling at
  // the parkway on the branch, and out to a platform at the airport; and
  // back the same way.
  airportDown: (plat) => [["CT", "5"], ["BR", "1", 1], ["LF", "1", 1], ["PK", "1", 1], ["AP", plat]],
  airportUp: (plat) => [["AP", plat, null, "W"], ["PK", "2", 1], ["LF", "2", 1], ["BR", "2", 1], ["CT", "5"]],
  // The air cargo: out of the yard at Riverside, along the slow line through
  // Lovell Field and the parkway, into a cargo road at the airport, and back
  // to the yard.
  cargoIn: (road) => [["RS", "yard", null, "E"], ["SE", "1"], ["CT", "2"], ["BR", "1"], ["LF", "1"], ["PK", "1"], ["AC", road]],
  cargoOut: (road) => [["AC", road, null, "W"], ["PK", "2"], ["LF", "2"], ["BR", "2"], ["CT", "3"], ["SE", "2"], ["RS", "yard"]],
};

/**
 * The pattern: for each kind of train, the minutes past each hour it
 * leaves its first place, and `peak` the extra ones in the rush hours.
 * Down trains come in at Bridgeport, up trains at Dalton, timed so that
 * the expresses pass Whiteside at :02 and :32 and Tunnel Hill at :05 and
 * :35 and everything else keeps its place behind them; the branch trains
 * back and the shuttle are formed at Cleveland from what arrives, so only
 * their down trains are timed here. A line with `back` turns round where
 * it ends and comes back as the service `back` describes, so many minutes
 * after it arrives: the rush-hour extras run into Chattanooga from both
 * ends of the line and out again, because a through train would only path
 * into the express behind it.
 */
const PATTERN = [
  { code: "1A", kind: "express", path: "expressDown", minutes: [59, 29] },
  { code: "1N", kind: "express", path: "expressUp", minutes: [3, 33], even: true },
  { code: "2A", kind: "local", path: "semiDown", minutes: [3, 33] },
  { code: "2N", kind: "local", path: "semiUp", minutes: [11, 41], peak: [19, 49], even: true },
  { code: "2D", kind: "local", path: "localDown", minutes: [13, 43] },
  { code: "2B", kind: "local", path: "localUp", minutes: [22, 52], even: true },
  { code: "2C", kind: "local", path: "branchDown", minutes: [7, 37], from: 5 },
  { code: "2T", kind: "local", path: "cityFromWest", peak: [19, 49], from: 1, back: { code: "2B", even: true, path: "westFromCity", after: 8 } },
  { code: "2T", kind: "local", path: "cityFromEast", peak: [6, 36], even: true, from: 2, back: { code: "2D", path: "eastFromCity", after: 7.5 } },
  // The high-speed line, half-hourly each way between Chattanooga and
  // Atlanta: one train calls at Lovell Field and the next runs through on
  // the fast line, past the airport train standing in the platform. Each
  // turns round in platform 1 at Chattanooga, in the gap between the branch
  // trains and the rush-hour extras, and goes back out as the other kind. A
  // number from 51 is one that does not stop.
  { code: "9T", kind: "high", path: "highCallUp", minutes: [8], even: true, back: { code: "9A", path: "highFastDown", after: 8.5, from: 51 } },
  { code: "9T", kind: "high", path: "highFastUp", minutes: [40], even: true, from: 52, back: { code: "9A", path: "highCallDown", after: 8.5 } },
  // The airport train leaves the airport at :43, comes up the main behind
  // the semi-fast at Brainerd, and goes back out of the bay at :19, a few
  // minutes ahead of the next high-speed train; at the airport it turns in
  // the platform it arrives in, which is 1 one hour and 2 the next. Its unit
  // does not stand the twenty minutes in the bay: it is changed at Ooltewah
  // TMD (`swap`, and `AIRPORT_SWAP` for how).
  { code: "2T", kind: "local", op: "lovell", path: "airportUp", minutes: [43], even: true, back: { code: "2L", path: "airportDown", after: 22, swap: true } },
];

/** The airport platform a Lovell Link train turns in, by the hour it leaves Chattanooga or the airport: 1 and 2 by turns. */
const airportPlat = (t) => (Math.floor(t / 3600) % 2 === 0 ? "1" : "2");

/** The time between a train's arrival at the end of its path and the train it forms leaving, in minutes. */
const TURN = { branch: 6, shuttleAtCity: 7.5, ecs: 15, airport: 6 };
/**
 * How the airport units are changed at Ooltewah TMD: the unit in from the
 * airport runs empty to the depot `in` minutes after it arrives in the bay,
 * and the unit that went in before it leaves the depot `out` minutes before
 * the train back is due, to form it. They take turns in one road of the
 * shed. Only outside the rush hours: then the throat at Chattanooga is
 * full, and the unit turns in the bay.
 */
const AIRPORT_SWAP = { road: "R2", in: 3, out: 17 };
/** The shuttle's day: up from Cleveland at the same minute past every hour from six until eight in the evening. */
const SHUTTLE = { first: 6, last: 20, minute: 25 };

/**
 * When the freights run: the same paths a few times a day, and the light
 * engines back. None of them is timed into a rush hour, which is how a
 * commuter railway keeps its freight. The air cargo leaves the yard behind
 * the high-speed train booked through, and comes back behind the one that
 * calls, into a cargo road and out of it again, 1 and 2 by turns.
 */
const FREIGHT = [
  { code: "6D", path: "loopFreight", kind: "freight", at: ["06:19", "10:19", "12:19", "14:19", "19:19", "20:49"], from: 61 },
  { id: "6P65", path: "plantIn", kind: "freight", at: "06:49", then: { id: "6R66", path: "plantOut", after: 76 } },
  { id: "6P75", path: "plantIn", kind: "freight", at: "14:49", then: { id: "6R76", path: "plantOut", after: 76 } },
  { code: "6R", path: "coal", kind: "freight", at: ["06:10", "10:10", "15:10", "19:10"], from: 62, even: true },
  { code: "4D", path: "yardEast", kind: "fast", at: ["09:57", "13:57", "20:57"], from: 66, even: true },
  { code: "6B", path: "yardWest", kind: "freight", at: ["10:04", "12:04", "15:04", "21:04"], from: 64, even: true },
  { code: "0B", path: "loco", kind: "loco", at: ["06:51", "13:51", "19:51"], from: 70, even: true },
  { code: "4L", path: "cargoIn", kind: "fast", at: ["11:23", "13:23", "21:23"], from: 71, roads: true, then: { code: "4R", path: "cargoOut", at: ["12:06", "14:06", "22:06"], from: 72, even: true } },
];

/**
 * The timetable of the whole day, laid out from the pattern: the clock-face
 * trains hour by hour with the rush-hour extras, the branch trains formed
 * at Cleveland from what arrives, the shuttle handed from end to end all
 * day, the freights at their times, and the empty stock that starts the
 * branch in the morning and puts the shuttle away at night. Numbers run
 * on through the day for each kind: odd down, even up, as the railway
 * numbers them.
 */
function buildDay() {
  const out = [];
  const taken = new Set(["2B30", "2B31", "6P65", "6R66", "6P75", "6R76", "5C81", "5C83", "5C85", "6B60"]);
  const counters = new Map();
  // The next number in a series: a code, odd or even, and where the series
  // starts, so two series of one code can run side by side.
  const next = (code, even, from) => {
    const key = `${code}${even ? "e" : "o"}${from ?? ""}`;
    let n = counters.get(key) ?? (from ?? (even ? 2 : 1));
    let id = `${code}${String(n).padStart(2, "0")}`;
    while (taken.has(id)) { n += 2; id = `${code}${String(n).padStart(2, "0")}`; }
    taken.add(id);
    counters.set(key, n + 2);
    return id;
  };
  const add = (s) => { out.push(s); return s; };
  const first = secs(DAY.first), last = secs(DAY.last);
  /** Every departure of a line through the day, in order. */
  const times = (line) => {
    const list = [];
    for (let h = 5; h <= 21; h++) {
      for (const m of line.minutes ?? []) list.push(h * 3600 + m * 60);
      for (const m of line.peak ?? []) { const t = h * 3600 + m * 60; if (inPeak(t)) list.push(t); }
    }
    return list.filter((t) => t >= first && t < last).sort((a, b) => a - b);
  };

  // Already on the railway when the day begins: the empty stock off the
  // sidings at Cleveland that forms the first branch train and the first
  // shuttle, the stopping train waiting in platform 4 at Chattanooga, and
  // the coal empties leaving the yard for the west.
  add({ id: "5C81", kind: "empty", at: "05:56", legs: [["CL", "S1"], ["CL", "neck", 1, "reverse"], ["CL", "2"]], then: "2B31" });
  add({ id: "5C83", kind: "empty", at: "06:06", legs: [["CL", "S2"], ["CL", "neck", 1, "reverse"], ["CL", "4"]], then: "2T41" });
  add({ id: "2B30", kind: "local", at: "05:58", legs: [["CT", "4", null, "W"], ["SE", "2", 1], ["LV", "2", 1], ["WH", "3", 1], ["TF", "2", 1], ["WS", "2", 1], ["BD"]] });
  add({ id: "6B60", kind: "freight", at: "05:57", legs: [["RS", "yard", null, "W"], ["LV", "2"], ["WH", "2"], ["TF", "2"], ["WS", "2"], ["BD"]] });

  // The clock-face trains.
  const swaps = [], downs = [], ups = [];
  let branchPlat = "3";
  const branchUps = [{ id: "2B31", at: secs("06:12"), plat: "2" }];
  for (const line of PATTERN) {
    for (const t of times(line)) {
      if (line.path === "branchDown") {
        const plat = branchPlat;
        branchPlat = branchPlat === "3" ? "2" : "3";
        const legs = PATHS.branchDown(plat);
        const s = add({ id: next(line.code, false, line.from), kind: line.kind, at: hm(t), legs });
        const back = arrivalOf(line.kind, legs, t) + TURN.branch * 60;
        if (back < last) branchUps.push({ at: back, plat, feeder: s });
        continue;
      }
      // The up stopping train stands in the loop at Wauhatchie for the express to pass, and in the rush hour for the extra behind it too.
      const legs = line.path === "localUp" ? PATHS.localUp(inPeak(t) ? 7 : 5) : line.path === "airportUp" ? PATHS.airportUp(airportPlat(t)) : PATHS[line.path];
      const s = add({ id: next(line.code, !!line.even, line.from), kind: line.kind, at: hm(t), legs, ...(line.op ? { op: line.op } : {}) });
      if (line.back) {
        const b = line.back;
        const at = arrivalOf(line.kind, s.legs, t) + b.after * 60;
        const r = add({ id: next(b.code, !!b.even, b.from), kind: line.kind, at: hm(at), legs: b.path === "airportDown" ? PATHS.airportDown(airportPlat(at)) : PATHS[b.path], ...(line.op ? { op: line.op } : {}) });
        if (b.swap) swaps.push({ up: s, back: r, arr: arrivalOf(line.kind, s.legs, t) });
        else s.then = r.id;
        if (b.path === "airportDown") downs.push(r);
        if (line.path === "airportUp") ups.push(s);
      }
    }
  }
  // At the airport each train in turns round in its platform to form the
  // next one out, the first of the day off the unit stabled there.
  for (const d of downs) {
    const arr = arrivalOf(d.kind, d.legs, secs(d.at));
    const up = ups.find((u) => secs(u.at) >= arr + TURN.airport * 60 && u.legs[0][1] === d.legs[d.legs.length - 1][1]);
    if (up) d.then = up.id;
  }
  // The airport units, changed at Ooltewah TMD each time round outside the
  // rush hours: the unit in from the airport runs empty to the depot, and the
  // one that went in before it comes out to form the train back. In the
  // rush hours the unit turns in the bay. The first swap brings the spare
  // off the depot, and the last puts a unit in for the night.
  let resting = null;
  for (const { up, back, arr } of swaps.sort((a, b) => a.arr - b.arr)) {
    if (inPeak(arr) || inPeak(secs(back.at))) { up.then = back.id; continue; }
    const road = AIRPORT_SWAP.road;
    const out = add({ id: `5T${back.id.slice(2)}`, kind: "empty", op: up.op, at: hm(secs(back.at) - AIRPORT_SWAP.out * 60), legs: [["TM", road, null, "W"], ["OO", "2"], ["CT", "5"]], then: back.id });
    if (resting) resting.then = out.id;
    const into = add({ id: `5M${up.id.slice(2)}`, kind: "empty", op: up.op, at: hm(arr + AIRPORT_SWAP.in * 60), legs: [["CT", "5", null, "E"], ["OO", "1"], ["TM", road]] });
    taken.add(out.id);
    taken.add(into.id);
    up.then = into.id;
    resting = into;
  }
  // The branch trains back to Whiteside, each formed by the one that came in, in time order.
  branchUps.sort((a, b) => a.at - b.at);
  for (const u of branchUps) {
    const id = u.id ?? next("2B", false, 31);
    add({ id, kind: "local", at: hm(u.at), legs: PATHS.branchUp(u.plat) });
    if (u.feeder) u.feeder.then = id;
  }
  // The shuttle, handed from end to end: up from Cleveland on the same
  // minute every hour, back from the bay when it has stood its turn, and
  // away to the sidings after the last.
  let prev = null;
  for (let h = SHUTTLE.first; h <= SHUTTLE.last; h++) {
    const t = h * 3600 + SHUTTLE.minute * 60;
    const up = add({ id: next("2T", false, 41), kind: "local", at: hm(t), legs: PATHS.shuttleUp });
    if (prev) prev.then = up.id;
    const down = add({ id: next("2C", true, 42), kind: "local", at: hm(arrivalOf("local", PATHS.shuttleUp, t) + TURN.shuttleAtCity * 60), legs: PATHS.shuttleDown });
    up.then = down.id;
    prev = down;
  }
  if (prev) {
    add({ id: "5C85", kind: "empty", at: hm(arrivalOf("local", PATHS.shuttleDown, secs(prev.at)) + TURN.ecs * 60), legs: [["CL", "4"], ["CL", "neck", 1, "reverse"], ["CL", "S2"]] });
    prev.then = "5C85";
  }
  // The freights.
  for (const f of FREIGHT) {
    if (f.id) {
      add({ id: f.id, kind: f.kind, at: f.at, legs: PATHS[f.path], then: f.then.id });
      add({ id: f.then.id, kind: f.kind, at: hm(secs(f.at) + f.then.after * 60), legs: PATHS[f.then.path] });
      continue;
    }
    f.at.forEach((at, i) => {
      // A pair out and back into roads by turns: the one out is the one that went in.
      const road = f.roads ? `C${(i % 2) + 1}` : null;
      const s = add({ id: next(f.code, !!f.even, f.from), kind: f.kind, at, legs: road ? PATHS[f.path](road) : PATHS[f.path] });
      if (f.then) s.then = add({ id: next(f.then.code, !!f.then.even, f.then.from), kind: f.kind, at: f.then.at[i], legs: road ? PATHS[f.then.path](road) : PATHS[f.then.path] }).id;
    });
  }
  return out.sort((a, b) => secs(a.at) - secs(b.at) || a.id.localeCompare(b.id));
}

/** Booked running time in minutes between two consecutive places for a kind of train. */
function runTime(prev, at, kind) {
  const run = RUN[`${prev}>${at}`] ?? {};
  return run[kind] ?? run.freight ?? run.local ?? 4;
}

/** When a train of a kind leaving on a path at a time reaches the end of it, in seconds. */
function arrivalOf(kind, legs, at) {
  let t = at;
  for (let i = 1; i < legs.length; i++) {
    t += Math.round(runTime(legs[i - 1][0], legs[i][0], kind) * 60);
    if (i < legs.length - 1 && legs[i][2] !== null && legs[i][2] !== undefined) t += legs[i][2] * 60;
  }
  return t;
}

/** The services of the whole day. */
export const SERVICES = buildDay();

/**
 * The timetable of a shift: each service in the window with a time at
 * every leg, worked from its start time and the booked running times. A
 * call gets an arrival and a departure; a pass gets one time; the first
 * leg is where the train comes from and the last where it ends. A train
 * formed by one outside the plan comes on standing where it is booked out
 * of (`spawnDue()`), so a shift is planned with the hour before it
 * (`before`) and taken over running.
 *
 * `before` takes in that many seconds of the railway ahead of the window as
 * well, each of its services marked `warm`: the trains out at the clock-in,
 * and the ones that bring in what the shift's first trains are formed of.
 */
export function planFor(services = SERVICES, shift = SHIFT, before = 0) {
  // Every train due to start in the window, and a train formed by one of
  // those a little after the end, so that what comes in goes out again.
  const start = secs(shift.start), end = secs(shift.end);
  const inWindow = new Set(services.filter((s) => secs(s.at) >= start - before && secs(s.at) < end).map((s) => s.id));
  const feeders = new Map();
  for (const s of services) if (s.then) feeders.set(s.then, s.id);
  for (let grew = true; grew;) {
    grew = false;
    for (const s of services) {
      const feeder = feeders.get(s.id);
      if (inWindow.has(s.id) || !feeder || !inWindow.has(feeder) || secs(s.at) >= end + 900) continue;
      inWindow.add(s.id);
      grew = true;
    }
  }
  // Stock is not brought off a depot only to stand somewhere: a run out of
  // a depot's road to form a train after the shift stays where it is.
  for (const s of services) {
    if (!inWindow.has(s.id) || s.kind !== "empty" || !s.then || inWindow.has(s.then)) continue;
    if (isDepotRoad(s.legs[0][0], s.legs[0][1])) inWindow.delete(s.id);
  }
  // Empty stock booked into a depot road gives way as the planner's own
  // does, and has the same time booked on top of its running for it.
  const plan = services.filter((s) => inWindow.has(s.id)).map((s) => {
    const [at, plat] = s.legs[s.legs.length - 1];
    if (s.kind !== "empty" || !isDepotRoad(at, plat)) return planned(s, feeders.get(s.id), inWindow);
    return { ...planned(s, feeders.get(s.id), inWindow, DEPOT_ALLOWANCE), stabling: true };
  });
  // Stock whose work is done inside the shift, with nothing booked out of
  // it until after, runs empty to its depot rather than vanish where it
  // stops: formed by the train that came in, like any other working.
  const taken = new Set(services.map((s) => s.id));
  const done = [];
  for (const p of plan) {
    if (p.then) continue;
    const last = p.entries[p.entries.length - 1];
    // Only a train left in a platform: one in a siding or a yard is put away already.
    if (last.fringe || last.arr === null || !/^\d+$/.test(last.plat ?? "")) continue;
    if (stablings(p.operator, last.at, last.plat).length) done.push({ p, last });
  }
  done.sort((a, b) => a.last.arr - b.last.arr);
  // Every depot road and when it is taken, as spans of time: stock booked
  // out of one holds it until it leaves, and stock booked into one from
  // when it can first be there until the train it forms leaves, or for
  // good, stabled. A road is free for a train if nothing holds it over the
  // train's span, so nothing stabled early takes a road a later train was
  // booked into. A booked arrival whose road is taken, by stock left there
  // when the shift cut its next working off, goes to the depot's next free
  // road, and what it forms leaves from there.
  const held = new Map();
  const hold = (at, road, from, to) => held.set(`${at} ${road}`, [...(held.get(`${at} ${road}`) ?? []), [from, to]]);
  const freeFor = (at, road, from, to) => (held.get(`${at} ${road}`) ?? []).every(([a, b]) => b <= from || a >= to);
  const byId = new Map(plan.map((s) => [s.id, s]));
  // Stock booked out of a depot with nothing bringing it in during the
  // shift has been standing there since before it: each in a road of its
  // own, since the shift starts with it all on the depot at once.
  const outOfDepots = plan.filter((s) => !s.formedBy && isDepotRoad(s.entries[0].at, s.entries[0].plat));
  for (const s of outOfDepots.sort((a, b) => a.entries[0].dep - b.entries[0].dep)) {
    const first = s.entries[0];
    const road = [first.plat, ...DEPOTS[first.at].roads].find((r) => freeFor(first.at, r, -Infinity, first.dep)) ?? first.plat;
    first.plat = road;
    hold(first.at, road, -Infinity, first.dep);
  }
  const intoDepots = plan.filter((s) => isDepotRoad(s.entries[s.entries.length - 1].at, s.entries[s.entries.length - 1].plat));
  intoDepots.sort((a, b) => a.entries[a.entries.length - 1].arr - b.entries[b.entries.length - 1].arr);
  for (const s of intoDepots) {
    const end = s.entries[s.entries.length - 1];
    const next = s.then ? byId.get(s.then) : null;
    const from = end.arr - (s.stabling ? DEPOT_ALLOWANCE * 60 : 0), to = next ? next.entries[0].dep : Infinity;
    const road = [end.plat, ...DEPOTS[end.at].roads].find((r) => freeFor(end.at, r, from, to)) ?? end.plat;
    end.plat = road;
    if (next) next.entries[0].plat = road;
    hold(end.at, road, from, to);
  }
  // Into each depot one at a time, never closer than `DEPOT_GAP` behind
  // whatever went in last, and to the first depot on its list with a road
  // free when it gets there. With none free anywhere, it stays in its
  // platform, stabled there.
  const lastIn = new Map();
  for (const { p, last } of done) {
    let pick = null;
    for (const way of stablings(p.operator, last.at, last.plat)) {
      let dep = last.arr + STABLE_TURN * 60;
      if (!way.depot) { pick = { way, road: null, dep }; break; }
      const first = DEPOTS[way.depot].roads[0];
      dep += Math.max(0, (lastIn.get(way.depot) ?? -Infinity) + DEPOT_GAP * 60 - arrivalOf("empty", way.legs(first), dep));
      const arr = arrivalOf("empty", way.legs(first), dep);
      const road = DEPOTS[way.depot].roads.find((r) => freeFor(way.depot, r, arr, Infinity));
      if (road) { pick = { way, road, dep, arr }; break; }
    }
    if (!pick) continue;
    if (pick.road) {
      hold(pick.way.depot, pick.road, pick.arr, Infinity);
      lastIn.set(pick.way.depot, pick.arr);
    }
    const ecs = { id: freeId(pick.way.code, p.id, taken), kind: "empty", op: p.operator, at: hm(pick.dep), legs: pick.way.legs(pick.road) };
    p.then = ecs.id;
    plan.push({ ...planned(ecs, p.id, new Set([p.id]), DEPOT_ALLOWANCE), formedBy: true, stabling: true });
  }
  for (const p of plan) if (p.entries[0].dep < start) p.warm = true;
  // A train out of a platform that nothing all day brings in to form it is
  // the first of the day there: its stock has stood in the platform since
  // the night before, and is there from the first of the plan.
  for (const p of plan) {
    const first = p.entries[0];
    if (!p.formedBy && !feeders.has(p.id) && !first.fringe && /^\d+$/.test(first.plat ?? "")) p.standing = true;
  }
  return plan.sort((a, b) => a.entries[0].dep - b.entries[0].dep || a.id.localeCompare(b.id));
}

/** How long stock stands after its last train before it runs empty to the depot, in minutes. */
const STABLE_TURN = 5;
/** The least time between two trains of empty stock into the same sidings, in minutes. */
const DEPOT_GAP = 6;
/**
 * The time booked into a move to the depot on top of its running, in
 * minutes: empty stock gives way to every booked train nearly due, so its
 * path has the room to, as a real one would.
 */
const DEPOT_ALLOWANCE = 8;

/**
 * The ways stock done with at a place can go to a depot, best first, each
 * with the legs to one of the depot's roads. At Chattanooga, anything in
 * platform 1 or the bay goes on into the carriage siding past platform 1
 * without crossing a running line, and whatever does not fit, or is in
 * platform 3 and cannot get there without reversing on the main, runs up
 * the branch to Ooltewah TMD. Whatever is done in a platform at Cleveland
 * goes into the depot there by the neck. Anything of Peachline's with no
 * road free goes back to Atlanta by the fast line. The code is the empty
 * train's: class 5 and the letter of where it is going. A freight ends in
 * the yard or the works it was going to, and is shunted in from there.
 */
function stablings(operator, at, plat) {
  const ways = [];
  if (at === "CT" && (plat === "1" || plat === "5")) ways.push({ code: "5T", depot: "CT", legs: (road) => [["CT", plat, null, "E"], ["CT", road]] });
  if (at === "CT" && (operator === "valley" || operator === "peachline" || operator === "lovell")) ways.push({ code: "5M", depot: "TM", legs: (road) => [["CT", plat, null, "E"], ["OO", "1"], ["TM", road]] });
  if (at === "CL" && operator === "valley") ways.push({ code: "5C", depot: "CL", legs: (road) => [["CL", plat, null, "W"], ["CL", "neck", 1, "reverse"], ["CL", road]] });
  if (at === "CT" && operator === "peachline") ways.push({ code: "5A", depot: null, legs: () => [["CT", plat, null, "E"], ["BR", "1"], ["LF", "fast"], ["CA", "fast"]] });
  return ways;
}

/**
 * The ways stock can go to a depot from where its train was really left,
 * rather than where it was booked to be left: `stablings()` from that
 * platform, best first, each with the way it sets off (`dir`), the place it
 * is routed towards first (`toward(road)`, as an entry names one), and
 * `make(road)`, the empty train leaving at `dep` under a headcode not in
 * `taken`, booked as the plan books one.
 */
export function stablingsFrom(p, at, plat, dep, taken) {
  return stablings(p.operator, at, plat).map((way) => ({
    depot: way.depot,
    dir: way.legs(null)[0][3] ?? null,
    toward: (road) => {
      const [to, line = null] = way.legs(road)[1];
      return { at: to, plat: line, fringe: FRINGE[to] ? fringeOf(to, line, "out") : null };
    },
    make: (road) => {
      const ecs = { id: freeId(way.code, p.id, taken), kind: "empty", op: p.operator, at: hm(dep), legs: way.legs(road) };
      return { ...planned(ecs, p.id, new Set([p.id]), DEPOT_ALLOWANCE), formedBy: true, stabling: true };
    },
  }));
}

/** A headcode of a code not yet taken: the number of the train it follows, or the next one up of the same oddness. */
function freeId(code, after, taken) {
  let n = Number(after.slice(2)) || 0;
  for (let i = 0; i < 50; i++, n = (n + 2) % 100) {
    const id = `${code}${String(n).padStart(2, "0")}`;
    if (!taken.has(id)) { taken.add(id); return id; }
  }
  return `${code}${after.slice(2)}`;
}

/** One service as the plan holds it: a time at every leg, `allowance` minutes on the last, and what it forms and is formed by within the window. */
function planned(s, feeder, inWindow, allowance = 0) {
  const entries = [];
  let t = secs(s.at);
  let prev = null;
  s.legs.forEach((leg, i) => {
    const [at, plat = null, stand = null, extra = null] = leg;
    const last = i === s.legs.length - 1;
    const entry = { at, plat, name: PLACE[at], call: false, fringe: null, arr: null, dep: null, pass: null, reverse: extra === "reverse", optional: plat === "loop" };
    if (i === 0) {
      entry.dep = t;
      if (FRINGE[at]) entry.fringe = fringeOf(at, plat, "in");
      else if (extra === "E" || extra === "W") entry.dir = extra;
    } else {
      t += Math.round(runTime(prev, at, s.kind) * 60);
      if (last) {
        t += allowance * 60;
        entry.call = !FRINGE[at];
        if (FRINGE[at]) { entry.fringe = fringeOf(at, plat, "out"); entry.pass = t; }
        else entry.arr = t;
      } else if (stand !== null) {
        entry.call = true;
        entry.arr = t;
        t += stand * 60;
        entry.dep = t;
      } else {
        entry.pass = t;
      }
    }
    entries.push(entry);
    prev = at;
  });
  return { id: s.id, kind: s.kind, operator: s.op ?? OPERATOR_OF[s.kind], entries, then: s.then && inWindow.has(s.then) ? s.then : null, formedBy: !!feeder && inWindow.has(feeder) };
}

const PLACE = {
  BD: "Bridgeport", WS: "Whiteside", TF: "Tiftonia", WH: "Wauhatchie", LV: "Lookout Valley", RS: "Riverside", SE: "St Elmo", CT: "Chattanooga", BR: "Brainerd",
  ER: "East Ridge", ES: "Enterprise South", RG: "Ringgold", TH: "Tunnel Hill", DL: "Dalton", OO: "Ooltewah", CD: "Collegedale", CL: "Cleveland",
  LF: "Lovell Field", PK: "Lovell Field Parkway", AP: "Lovell Field Airport", AC: "Airport cargo", CA: "Calhoun", TM: "Ooltewah TMD",
  WI: "Williams Island", MB: "Moccasin Bend", SR: "Stringers Ridge",
};

/**
 * Where stock is stabled, by the place its roads are timetabled at: each
 * depot's roads in the order they are filled, and what it is called. One
 * train to a road, and a train stabled in one stays there.
 */
export const DEPOTS = {
  CT: { name: "Chattanooga carriage siding", short: "siding", roads: ["S1"] },
  TM: { name: "Ooltewah TMD", short: "TMD", roads: ["R1", "R2", "R3", "R4"] },
  CL: { name: "Cleveland depot", short: "depot", roads: ["S1", "S2"] },
  // Not a depot, but the same to the signaller: a freight in a cargo road
  // stands there, one to a road, until it goes back to the yard.
  AC: { name: "the air cargo terminal", short: "cargo terminal", roads: ["C1", "C2"] },
};

/** Whether a timetable place and platform is a depot's road. */
export function isDepotRoad(at, plat) {
  return !!DEPOTS[at]?.roads.includes(plat);
}

/**
 * Which rows of a train's timetable its card shows and which it folds away,
 * from the places in order, the places on the signaller's desk and any rows
 * to keep besides (where the train is now). The first and the last show,
 * and every place on the desk with the one either side of it; a run of two
 * or more of the rest folds into one row, and a run of one shows, since its
 * fold would take the same room. A train that never comes to the desk
 * shows whole. In order: { show: index } or { fold: [index, …] }.
 */
export function foldJourney(places, desk, keep = []) {
  const on = places.map((p) => desk.includes(p));
  if (!on.includes(true)) return places.map((_, i) => ({ show: i }));
  const shown = new Set([0, places.length - 1, ...keep]);
  on.forEach((yes, i) => { if (yes) for (const j of [i - 1, i, i + 1]) shown.add(j); });
  const rows = [];
  let run = [];
  const end = () => {
    if (run.length > 1) rows.push({ fold: run });
    else for (const i of run) rows.push({ show: i });
    run = [];
  };
  places.forEach((_, i) => {
    if (!shown.has(i)) { run.push(i); return; }
    end();
    rows.push({ show: i });
  });
  end();
  return rows;
}

/* ---- The training desk ------------------------------------------------- */

/**
 * The school's shift: three quarters of an hour on the training desk, a
 * May morning, with a train for each thing the desk teaches. One arrives
 * with no description and a circuit fails under the last two, both on the
 * clock from the start, so the lesson comes whether the pupil is quick or
 * slow.
 */
export const TRAINING = {
  shift: { start: "09:55", end: "10:40", hardEnd: "11:10", ready: 300, day: 130 },
  services: [
    { id: "2S01", kind: "local", at: "10:00", legs: [["WI"], ["MB", "1", 1], ["SR"]] },
    { id: "2W02", kind: "local", at: "10:05", legs: [["SR"], ["MB", "2", 1], ["WI"]] },
    { id: "1S03", kind: "express", at: "10:11", legs: [["WI"], ["MB", "1"], ["SR"]] },
    { id: "2S05", kind: "local", at: "10:15", legs: [["WI"], ["MB", "2", 1], ["SR"]] },
    { id: "2W08", kind: "local", at: "10:19", legs: [["SR"], ["MB", "2", 1], ["WI"]] },
    { id: "2S09", kind: "local", at: "10:24", legs: [["WI"], ["MB", "1", 1], ["SR"]] },
    { id: "6W10", kind: "freight", at: "10:29", legs: [["SR"], ["MB", "2"], ["WI"]] },
    { id: "2S11", kind: "local", at: "10:33", legs: [["WI"], ["MB", "1", 1], ["SR"]] },
  ],
  disruptions: [
    { kind: "nodesc", service: "2W08" },
    { kind: "tc", tc: "SC.DM6", at: secs("10:23") },
  ],
};

/* ---- What goes wrong --------------------------------------------------- */

/** A small seeded generator, so a shift number always means the same shift. */
export function rng(seed) {
  let a = (seed >>> 0) || 1;
  return () => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * How much goes wrong at each level. `extra` is how many of the three
 * troubles that come one to a shift, a signal out, a driver missing and
 * leaf fall, the shift rolls; `weather` whether the weather turns.
 */
export const LEVELS = {
  calm: { name: "Calm", note: "A few trains turn up late. Nothing breaks.", late: 2, failures: 0, possession: false, nodesc: 0, extra: 0, weather: false },
  mixed: { name: "Mixed", note: "Late running, one failure on the ground, one train that will not go, and one more thing: a signal out, a driver missing, the line blocked, or leaves on the line in season. What you do not ring in, control does.", late: 3, failures: 1, possession: false, nodesc: 1, extra: 1, weather: false },
  rough: { name: "Rough", note: "Everything at once, and every fault yours to ring in: failures, a line out for engineering, a signal out, no driver, the line blocked, leaves on the line in season, the weather, trains arriving with no description.", late: 4, failures: 2, possession: true, nodesc: 2, extra: 4, weather: true },
};

/**
 * The fault team that mends signals, points and track circuits, once a
 * fault is rung in: the minutes it takes to reach each desk from its base at
 * Chattanooga, how long a look takes where it turns out nothing is wrong,
 * and how many minutes each kind of fault wants the line for. The
 * technicians work on the track, so nothing passes them while they do: a
 * fault rung in is a fault mended sooner, and the line lost for a while
 * when they get there.
 */
export const FAULT_TEAM = {
  travel: { SC: 3, CT: 6, RS: 8, ER: 8, WH: 10, LF: 10, CL: 12, TH: 14, WS: 14 },
  look: 2,
  work: { signal: 3, tc: 5, points: 6 },
};

/**
 * Who rings a fault on the ground in when the signaller has not, in
 * seconds: the driver of a train come to a signal showing nothing, `driver`
 * after the first stood at it (null: the drivers leave it to the
 * signaller), and Control, `control` after the failure, so nothing stays
 * broken for good. Calm rings everything in for you and rough leaves it to
 * you. A fault on another desk is rung in by the signaller there after
 * `colleague`, and on the training desk nobody but the instructor, late.
 */
export const RINGS_IN = {
  calm: { driver: 60, control: 60 },
  mixed: { driver: 120, control: 600 },
  rough: { driver: null, control: 1200 },
  school: { driver: null, control: 600 },
  colleague: 60,
};

/**
 * A train with a fault whose driver is told to isolate it and go on, rather
 * than stand for the fitter: the minutes isolating takes, and the speed it
 * may run at after, in mph, until it has finished its working.
 */
export const LIMP = { isolate: 1, mph: 25 };

/**
 * What a call about nothing costs, in points off the shift: a fault team
 * sent to a thing with nothing wrong with it, or a driver rung about a
 * train with nothing wrong with it. More than a platform change, less than
 * a stop sent past, and taken when it is found, not when it is rung: the
 * number read back is the signaller's chance to catch it first.
 */
export const FALSE_CALL = 25;

/**
 * The phone's list: what can be wrong, as the signaller would say it, and
 * who the call goes to. Its number on the phone is its place in the list.
 * Each call costs something, or it would happen by itself: the fault team
 * mends a fault and wants the line to do it, and a failed train taken on
 * clears its platform and runs slow the rest of the way.
 */
export const CALLS = [
  { issue: "signal", says: "A signal showing nothing", to: "Fault control" },
  { issue: "points", says: "Points that will not move", to: "Fault control" },
  { issue: "tc", says: "A circuit red with nothing on it", to: "Fault control" },
  { issue: "train", says: "A failed train, to go on slowly", to: "The driver" },
];

/** Circuits and points that can fail, chosen for where it hurts. */
const TC_FAULTS = ["CT.DM8", "CT.UM6", "RS.DM6A", "RS.UM5A", "CL.UB3", "CT.UM2", "CL.SL", "WH.DM3A", "WH.UM3A", "ER.DM6A", "ER.UM3A", "WS.DM5", "TH.UM3"];
const POINT_FAULTS = ["129A", "105", "133", "321", "201", "127A", "331", "411", "413", "503A", "505", "603A", "703"];
/**
 * Lines that can be under possession when the shift begins, and how many
 * minutes into the shift they are handed back: a length, not a time of
 * day, because the shift can start anywhere in the day. Whiteside's and
 * East Ridge's are the Down Main between their crossovers, which a train is
 * taken round by hand, over 603 and 605 or 511 and 513: ARS never sets a
 * road along the other line, so each is only ever the signaller's own, and
 * names what takes the trains round it, which does not fail in the same
 * shift.
 */
const POSSESSIONS = [
  { tc: "CL.P3", minutes: 70 },
  { tc: "CT.P4", minutes: 60 },
  { tc: "CT.P1", minutes: 80 },
  { tc: "RS.DGL", minutes: 80 },
  { tc: "WH.P3", minutes: 75 },
  { tc: "CL.P2", minutes: 50 },
  { tc: "TH.UGL", minutes: 85 },
  { tc: "WS.DM5", minutes: 50, around: ["603A", "603B", "605A", "605B"], byHand: true },
  { tc: "ER.DM7A", minutes: 55, around: ["511A", "511B", "513A", "513B"], byHand: true },
];
/**
 * Signals that can fail, showing nothing: the busy controlled ones on each
 * desk, and a few automatics, where the driver goes on by the rule instead.
 */
const SIGNAL_FAULTS = ["CT13", "CT4", "CT1", "RS3", "WH1", "WH2", "ER7", "TH3", "WS5", "CL15", "CL8", "CT23", "WS9", "TH7"];
/** The blocks of a run, lettered from A. */
const blocks = (tc, n) => Array.from({ length: n }, (_, i) => `${tc}${String.fromCharCode(65 + i)}`);
/** Where the trees are: a run whose railhead the leaves foul, both lines, and the end of the main the treatment train is sent from. */
const LEAF_FALL = [
  { where: "in the cutting at Tiftonia", tcs: [...blocks("WH.DM3", 6), ...blocks("WH.UM3", 6)], from: "west" },
  { where: "on the climb out of Whiteside", tcs: [...blocks("WS.DM7", 6), ...blocks("WS.UM7", 6)], from: "west" },
  { where: "on the approaches to Chetoogeta tunnel", tcs: [...blocks("TH.DM4", 4), "TH.UM3", ...blocks("TH.UM2", 4)], from: "east" },
  { where: "between Ringgold and East Ridge", tcs: [...blocks("ER.DM6", 3), ...blocks("ER.UM3", 3)], from: "east" },
];
/** Low ground that floods: a circuit or two under water at walking pace. */
const FLOODS = [
  { where: "under the works at Riverside", tcs: ["RS.DM6C", "RS.UM5B"] },
  { where: "at the mouth of Chetoogeta tunnel", tcs: ["TH.DM4B", "TH.UM3"] },
  { where: "on the branch below Ooltewah", tcs: ["CL.DB1B", "CL.UB1B"] },
  { where: "at Slygo Road", tcs: ["WS.LCD", "WS.LCU", "WS.DM3", "WS.UM5A"] },
];
/** Speeds under the weather and the leaves, in metres a second. */
export const SLOW = { wind: 27, flood: 4.5, leaves: 15, heat: 27, snow: 22 };
/** What the weather can turn to in each season. */
const WEATHER = { spring: ["wind", "flood"], summer: ["heat", "flood"], autumn: ["wind", "flood"], winter: ["ice", "snow"] };
/** The hours the rail gets hot enough to slow the trains, in summer. */
const HEAT = ["12:00", "19:00"];
/** Places the line gets blocked from outside the railway, both lines at once, and what by. */
const BLOCKS = [
  { where: "in the cutting at Tiftonia", tcs: ["WH.DM3C", "WH.UM3C"] },
  { where: "by the works at Riverside", tcs: ["RS.DM6B", "RS.UM5B"] },
  { where: "on the climb out of Whiteside", tcs: ["WS.DM7C", "WS.UM7C"] },
  { where: "between Brainerd and East Ridge", tcs: ["ER.DM2B", "ER.UM1B"] },
  { where: "at the mouth of Chetoogeta tunnel", tcs: ["TH.DM4B", "TH.UM3"] },
  { where: "on the branch at Ooltewah", tcs: ["CL.DB1C", "CL.UB1C"] },
];
/** What blocks the line, and who rings it in. */
const BLOCK_REASONS = [
  { what: "Trespassers", from: "Police" },
  { what: "Cattle on the line", from: "A driver" },
  { what: "A tree down across the line", from: "A driver" },
  { what: "A person on the line", from: "A driver" },
  { what: "Children on the embankment", from: "A member of the public" },
  { what: "A road vehicle through the fence", from: "Police" },
];

/**
 * The shift's troubles, rolled from the seed and the level: which trains
 * enter late and by how much, what fails and when, which train arrives
 * without a description, and what is under possession from the start.
 * `zone` is the signaller's desk, where the line under possession is.
 * @param {string | null} [zone]
 */
export function disruptionsFor(seed, level, plan, shift = SHIFT, zone = null) {
  const roll = rng(seed * 7919 + 13);
  const pick = (list) => list[Math.floor(roll() * list.length)];
  const shape = LEVELS[level] ?? LEVELS.mixed;
  const out = [];
  // The line under possession is on the signaller's own desk, where it has
  // one to give up: rolled anywhere, it was on somebody else's more often
  // than not, and the desk saw nothing of it. With no desk of their own, or
  // no such line on it, it is anywhere a colleague can take the trains
  // round it. What takes them round is spared failing.
  const own = shape.possession ? POSSESSIONS.filter((p) => p.tc.startsWith(`${zone}.`)) : [];
  const spared = new Set(own.flatMap((p) => [p.tc, ...(p.around ?? [])]));
  // The trains coming on to the old railway. The high-speed line's are rolled
  // apart, below, so that a shift on any other desk is the one it always was.
  const entering = plan.filter((s) => s.entries[0].fringe && !s.formedBy && !HIGH_SPEED_IN.has(s.entries[0].fringe));
  const used = new Set();
  for (let i = 0; i < shape.late && entering.length; i++) {
    const s = pick(entering);
    if (used.has(s.id)) continue;
    used.add(s.id);
    out.push({ kind: "late", service: s.id, minutes: 3 + Math.floor(roll() * 8) });
  }
  const start = secs(shift.start);
  for (let i = 0; i < shape.failures; i++) {
    const at = start + 1500 + Math.floor(roll() * 4200);
    const minutes = 10 + Math.floor(roll() * 10);
    if (i % 2 === 0) out.push({ kind: "tc", tc: pick(TC_FAULTS.filter((tc) => !spared.has(tc))), at, until: at + minutes * 60 });
    else out.push({ kind: "points", point: pick(POINT_FAULTS.filter((p) => !spared.has(p))), at, until: at + minutes * 60 });
  }
  if (shape.failures) {
    const calls = plan.filter((s) => s.kind === "local" && s.entries.some((e) => e.call && e.at === "CT" && e.dep));
    const s = pick(calls);
    if (s) out.push({ kind: "fail", service: s.id, at: "CT", minutes: 8 + Math.floor(roll() * 7) });
  }
  for (let i = 0; i < shape.nodesc; i++) {
    const s = pick(entering.filter((e) => !used.has(e.id) && e.entries[0].dep > start + 900));
    if (!s) break;
    used.add(s.id);
    out.push({ kind: "nodesc", service: s.id });
  }
  if (shape.possession) {
    const p = pick(own.length ? own : POSSESSIONS.filter((q) => !q.byHand));
    out.push({ kind: "possession", tc: p.tc, until: start + p.minutes * 60 });
  }
  // One to a shift each: a signal showing nothing, a train at Chattanooga
  // with no driver to take it on, the line blocked from outside, and in
  // the leaf season leaves on the line. Mixed rolls one of them, rough has
  // them all.
  const season = seasonOf(shift.day);
  const extras = ["signal", "crew", "examine", ...(leafSeason(shift.day) ? ["leaves"] : [])];
  const chosen = shape.extra >= extras.length ? extras : Array.from({ length: shape.extra }, () => extras.splice(Math.floor(roll() * extras.length), 1)[0]);
  const hardEnd = secs(shift.hardEnd ?? shift.end);
  for (const what of chosen) {
    if (what === "signal") {
      const at = start + 900 + Math.floor(roll() * 4800);
      out.push({ kind: "signal", signal: pick(SIGNAL_FAULTS), at, until: at + (12 + Math.floor(roll() * 12)) * 60 });
    } else if (what === "crew") {
      const taken = new Set(out.filter((d) => d.kind === "fail").map((d) => d.service));
      const calls = plan.filter((s) => s.kind === "local" && !taken.has(s.id) && s.entries.some((e) => e.call && e.at === "CT" && e.dep));
      const s = pick(calls);
      if (s) out.push({ kind: "crew", service: s.id, at: "CT", minutes: 6 + Math.floor(roll() * 8) });
    } else if (what === "examine") {
      // Something on the line: both lines blocked at one place until it is
      // cleared, then the first train each way examines the line at caution.
      const b = pick(BLOCKS);
      const at = start + 900 + Math.floor(roll() * 4800);
      const why = pick(BLOCK_REASONS);
      out.push({ kind: "examine", where: b.where, tcs: b.tcs, reason: why.what, from: why.from, at, until: at + (8 + Math.floor(roll() * 7)) * 60 });
    } else {
      // The leaves are down when the shift begins and stay until the
      // treatment train has been through, or the shift is over.
      const fall = pick(LEAF_FALL);
      out.push({ kind: "leaves", where: fall.where, tcs: fall.tcs, from: fall.from, cap: SLOW.leaves, at: start, until: hardEnd, by: fall.from === "east" ? "3B12" : "3D11" });
    }
  }
  if (shape.weather) {
    let at = start + 600 + Math.floor(roll() * 4200);
    const minutes = 30 + Math.floor(roll() * 20);
    let what = pick(WEATHER[season]);
    // The rail is only hot in the afternoon: a morning shift in summer gets the rain instead.
    if (what === "heat") {
      at = Math.max(at, secs(HEAT[0]));
      if (at + 600 > Math.min(secs(shift.end), secs(HEAT[1]))) what = "flood";
    }
    if (what === "wind" || what === "snow") out.push({ kind: "weather", what, at, until: at + minutes * 60, cap: SLOW[what] });
    else if (what === "heat") out.push({ kind: "weather", what, at, until: Math.min(at + minutes * 60, secs(HEAT[1])), cap: SLOW.heat });
    else if (what === "flood") {
      const f = pick(FLOODS);
      out.push({ kind: "weather", what, where: f.where, tcs: f.tcs, at, until: at + minutes * 60, cap: SLOW.flood });
    } else {
      // A cold snap: two sets of points frozen where they lie, one after
      // the other, and not ones already failing this shift.
      const failing = new Set([...out.filter((d) => d.kind === "points").map((d) => d.point), ...spared]);
      const first = pick(POINT_FAULTS.filter((p) => !failing.has(p)));
      out.push({ kind: "points", point: first, at, until: at + minutes * 60, frozen: true });
      out.push({ kind: "points", point: pick(POINT_FAULTS.filter((p) => p !== first && !failing.has(p))), at: at + 600, until: at + 600 + minutes * 60, frozen: true });
    }
  }
  return [...out, ...highSpeedTroubles(seed, shape, plan, shift)];
}

/** Where trains come on to the high-speed line. */
const HIGH_SPEED_IN = new Set(["CA-UF", "CA-US"]);
/**
 * On the high-speed line: circuits and points that hurt when they fail, and
 * the fast line blocks taken for work, each the first beyond a signal
 * somebody works, as on the rest of the railway, so there is a signal to
 * authorise a train past or to send it the other way from. A possession
 * names the points that take the trains round it on the slow line, which
 * are not then failed as well: with both, nothing could pass at all. At
 * the airport: the foot of the flyover, the scissors' diamond, the junction
 * and the throat's points, and a platform taken for work, so the trains
 * booked into it are found another.
 */
const HIGH_SPEED_FAULTS = {
  tcs: ["LF.DF3", "LF.UF6", "LF.DS1", "LF.US2", "LF.DF6", "LF.UF3", "LF.AD2", "LF.BDA", "LF.SX"],
  points: ["911", "917A", "915A", "913", "925A", "927", "933A", "935"],
  possessions: [{ tc: "LF.DF3", minutes: 50, around: ["911"] }, { tc: "LF.UF6", minutes: 45, around: ["917A", "913"] }, { tc: "LF.AP2", minutes: 60, around: [] }],
};

/**
 * The high-speed line's own troubles, from a generator of its own: a train
 * or two in late from Calhoun, or an airport train with a fault at Lovell
 * Field on its way back, a failure on the ground at mixed and worse, and
 * at rough a fast line under possession, so the trains that would have run
 * through have to be taken along the slow line, and a train arriving with
 * no description. The airport trains take their share of the late running
 * as they did when they came in from Calhoun, so the high-speed trains are
 * not late any more often for their having gone to the airport: a late
 * high-speed train in the rush hour holds up Chattanooga's platform 1.
 */
function highSpeedTroubles(seed, shape, plan, shift) {
  const roll = rng(seed * 104729 + 71);
  const pick = (list) => list[Math.floor(roll() * list.length)];
  const out = [];
  const start = secs(shift.start);
  const entering = plan.filter((s) => HIGH_SPEED_IN.has(s.entries[0].fringe) && !s.formedBy);
  const fromAirport = plan.filter((s) => s.entries[0].at === "AP" && s.entries.some((e) => e.at === "LF" && e.call));
  const lateable = [...entering, ...fromAirport];
  const used = new Set();
  for (let i = 0; i < shape.late - 1 && lateable.length; i++) {
    const s = pick(lateable);
    if (used.has(s.id)) continue;
    used.add(s.id);
    const minutes = 3 + Math.floor(roll() * 8);
    out.push(s.entries[0].at === "AP" ? { kind: "fail", service: s.id, at: "LF", minutes } : { kind: "late", service: s.id, minutes });
  }
  const possession = shape.possession ? pick(HIGH_SPEED_FAULTS.possessions) : null;
  if (shape.failures) {
    const at = start + 1500 + Math.floor(roll() * 4200);
    const until = at + (10 + Math.floor(roll() * 10)) * 60;
    if (roll() < 0.5) out.push({ kind: "tc", tc: pick(HIGH_SPEED_FAULTS.tcs), at, until });
    else out.push({ kind: "points", point: pick(HIGH_SPEED_FAULTS.points.filter((p) => !possession?.around.includes(p))), at, until });
  }
  if (possession) out.push({ kind: "possession", tc: possession.tc, until: start + possession.minutes * 60 });
  if (shape.nodesc > 1) {
    const s = pick(entering.filter((e) => !used.has(e.id) && e.entries[0].dep > start + 900));
    if (s) out.push({ kind: "nodesc", service: s.id });
  }
  return out;
}

/**
 * What the start screen says the day will be like: the season's own
 * weather, and what the shift has rolled, said the way a forecast says it,
 * so a signaller can brace without being told the hour.
 */
export function forecastFor(seed, level, plan, shift = SHIFT) {
  const season = seasonOf(shift.day);
  const base = { spring: "showers and sun", summer: "warm and close", autumn: "grey and still", winter: "cold and bright" }[season];
  const words = [];
  for (const d of disruptionsFor(seed, level, plan, shift)) {
    if (d.kind === "weather" && d.what === "wind") words.push("gales expected");
    else if (d.kind === "weather" && d.what === "flood") words.push("heavy rain, low ground may flood");
    else if (d.kind === "weather" && d.what === "heat") words.push("hot, rail temperatures watched from midday");
    else if (d.kind === "weather" && d.what === "snow") words.push("snow showers");
    else if (d.kind === "points" && d.frozen && !words.includes("hard frost, points heaters on")) words.push("hard frost, points heaters on");
    else if (d.kind === "leaves") words.push("leaf fall, the treatment train is diagrammed");
  }
  return `${dayName(shift.day)}. Forecast: ${[base, ...words].join("; ")}.`;
}

/**
 * The railhead treatment train a leaf fall sends for: through the whole
 * main without a stop from the end nearer the trees, booked forty minutes
 * into the shift, 3D11 to Dalton or 3B12 to Bridgeport.
 */
export function treatmentTrain(leaves, shift = SHIFT) {
  return { id: leaves.by, kind: "treatment", path: leaves.from === "east" ? "treatUp" : "treatDown", at: hm(secs(shift.start) + 40 * 60), legs: PATHS[leaves.from === "east" ? "treatUp" : "treatDown"] };
}
