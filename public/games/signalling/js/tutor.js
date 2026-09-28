// The lesson on the training desk: a run of steps over the board. A step is
// read and dismissed with Next, or asks the pupil to do something, or to
// watch something happen, and the last hands the desk over. While a step asks
// for something done, only that works (`allows()`), each thing it asks for is
// a line that takes a tick once done, and the clock waits; while one asks for
// something watched, the clock runs until the desk shows it. A step is done
// by the pupil doing what it asks, told to the lesson the moment it happens
// (`did()`), and never by a look at the desk that something done earlier, or
// undone since, could fool. Nothing here changes the railway: the interface
// asks, does, and tells.

import { CALLS } from "./schedule.js";

/* ---- What a step can ask for --------------------------------------------- */

/** A route from a signal to a signal, or `off` the board at the arrow box where its line leaves. */
const route = (from, to, off = false) => ({ kind: "route", from, to, off });
/** The barriers at Moccasin Road, down or up. */
const lower = { kind: "lower", lc: "MB" };
const raise = { kind: "raise", lc: "MB" };
/** The clock started. */
const start = { kind: "rate" };
/** A driver given authority past a signal at danger. */
const authorise = (signal) => ({ kind: "authorise", signal });
/** A description typed into a berth. */
const interpose = (berth, desc) => ({ kind: "interpose", berth, desc });
/** A fault rung in on the phone: what is wrong, and where. */
const ring = (issue, id) => ({ kind: "ring", issue, id });

/* ---- What a step can watch for ------------------------------------------ */

/** The train of `service` while it is on the board, or null before and after. */
function trainOf(sim, service) {
  return [...sim.trains.values()].find((x) => x.service === service) ?? null;
}

/** Whether the train of `service` is on any of the circuits `tcs`. */
function on(sim, service, tcs) {
  const t = trainOf(sim, service);
  return !!t && tcs.some((tc) => sim.tcs.get(tc)?.trains.has(t.id));
}

/** Whether the train of `service` has got as far as any of `tcs` or finished altogether. */
function reached(sim, service, tcs) {
  return sim.results.has(service) || on(sim, service, tcs);
}

/** Whether the train of `service` stands in its platform ready to start: its box flashing yellow, the time to set its road out. */
function readyToLeave(sim, service) {
  const t = trainOf(sim, service);
  return !!t && sim.platformState(t) === "ready";
}

/** Whether Moccasin Road has nothing set over it and nothing on it. */
function roadFree(sim) {
  return !sim.lcHeld(sim.net.lcs.get("MB"));
}

/** The upper line short of the road: a train going east enters on it, so one on the board and on none of it is over the road. */
const DOWN_SHORT = ["SC.WID", "SC.DM1", "SC.DM2", "SC.LCD"];
/** The lower line past the road, where a train going west is over it. */
const UP_PAST = ["SC.UM7", "SC.UM8", "SC.WIU"];
/** The line past MB9 and MB11, where a train has left their blocks. */
const PAST_MB9 = ["SC.DM7B", "SC.DM7C", "SC.DM7D", "SC.DM7E", "SC.DM7F", "SC.SRD"];
const PAST_MB11 = PAST_MB9.slice(1);

/** Whether the train of `service` has left all of `tcs` behind it: finished, or on the board and on none of them. */
function clearOf(sim, service, tcs) {
  if (sim.results.has(service)) return true;
  const t = trainOf(sim, service);
  return !!t && !tcs.some((tc) => sim.tcs.get(tc)?.trains.has(t.id));
}

/** Whether a train going east is over the road, with the road free again behind it. */
function downOver(sim, service) {
  return roadFree(sim) && clearOf(sim, service, DOWN_SHORT);
}

/**
 * Whether a train going east is away past MB9 with the whole of it: its
 * front on the line from MB9 to the edge, and its tail off the circuit
 * behind MB9. Only then has its road through the station given back every
 * circuit and set of points, for the next train to have them.
 */
function awayPastMB9(sim, service) {
  return roadFree(sim) && reached(sim, service, PAST_MB9) && clearOf(sim, service, ["SC.DM7A"]);
}

/** Whether a train going west is over the road and the road is free again behind it. */
function upOver(sim, service) {
  return roadFree(sim) && reached(sim, service, UP_PAST);
}

/* ---- The steps ----------------------------------------------------------- */

/**
 * The steps, in order. `text` is what the step teaches. A step with `next`
 * is read and dismissed. One with `acts` asks for those things in turn, with
 * the clock held; one with `until(sim, memo)` then runs the clock until the
 * desk shows it, `watch` saying what to look for and `memo` kept for the step
 * while it is shown. `free` hands the desk over, with `yours` saying what for.
 * `spot` is what the board points at while nothing is asked for.
 */
export const STEPS = [
  {
    text: "This is the training desk: the signalling school's own line, which is on the railway's diagram nowhere. The board is the railway seen from above, and you are its signaller. The lesson takes you through eight trains, one thing at a time. A step you only read goes on with Next. A step that asks you to do something lets only that work, and the clock waits for you. A step that asks you to watch runs the clock until what it says has happened. Every step ends with a tick, and the next takes its place.",
    next: true,
  },
  {
    text: "The story first, since the drivers will talk to you as if you know it. The county electrified the line at 25 kV on the wires, fed from the Riverside works' old switchyard once NerGy took the traction contract, and bought the whole thing as a British package: wires, signalling, this workstation and a signaller to go with it. That is why the trains keep left, why every signal has a number and every train a four-character headcode, and why the rules you are about to use read the way they do.",
    next: true,
  },
  {
    text: "A headcode says what a train is and where it is going. The digit is its class: 1 an express, 2 a stopping or semi-fast train, 9 a high-speed train, 4 and 6 freight, 5 empty stock. The letter is the place it finishes, one letter to each: B Bridgeport and D Dalton, just past the ends, N and A for the trains that run on to Nashville and Atlanta, T Chattanooga, C Cleveland, L the airport, R the yard at Riverside. Five operators run on it. Ridgeline has the Nashville to Atlanta expresses, 1A and 1N, calling only at Chattanooga. Peachline has the high-speed trains, 9A to Atlanta and 9T back. Valley Rail is the county's own: the 2B and 2D stopping trains, the 2A and 2N semi-fasts, the 2C trains up the Cleveland branch and the shuttle into the bay, and the rush-hour extras. Lovell Link runs the airport trains, 2L out and 2T back. Lookout Freight brings the coal into Riverside for NerGy's boilers on 6R62 and takes the through freights past. The eight trains here are the school's, lettered for its own two ends: S Stringers Ridge and W Williams Island.",
    next: true,
  },
  {
    text: "Reading the board. Trains keep left, so the upper line carries trains going east and the lower line trains going west. Grey track has nothing on it and nothing set. White track is a route somebody has set: locked for one train, and nothing else can be set across it. Red track has a train on it. Red broken into dash and dot is a track circuit that has failed: it shows occupied with nothing on it.",
    next: true,
  },
  {
    text: "Blocks, which everything else comes back to. The line is cut into track circuits, each of which knows when a train is on it and turns red. The stretch from one signal to the next is a block, and only one train is ever let into a block at a time: a signal clears only when every circuit in the block ahead of it is clear. The block blinking now runs from MB9 to MB11.",
    spot: "tc:SC.DM7B",
    next: true,
  },
  {
    text: "Signals. The ones on a hooked post, like MB1, are yours: each stays red until you set it a route. The small pins are automatics, which clear by themselves whenever the block ahead is free; you never set a route from one. Red is stop. One yellow is go on, but the next signal is red, so one block is clear. Two yellows say the next signal is showing one, so two blocks are clear. Green is go on with three or more.",
    spot: "signal:MB1",
    next: true,
  },
  {
    text: "What is coming. The board never says: the Timetable tab on the right does, with every train due on this desk, where it comes from and goes to, its booked time and its platform. Trains says where each one is now, and Next here in the bar keeps the soonest. First is 2S01 from Williams Island at 10:00, for platform 1.",
    spot: 'ui:.tabs [data-pane="timetable"]',
    next: true,
  },
  {
    text: "A route is the road from one signal to the next. You pick where it starts, then where it ends, and the interlocking sets it only if it is safe: the track clear and nothing else set across it. MB1 is the first signal 2S01 will come to.",
    acts: [route("MB1", "MB3")],
  },
  {
    text: "The track under the route has turned white: it is set and locked. MB1 is still red, because the route crosses Moccasin Road, and a signal over a road only clears once the barriers are down.",
    acts: [lower],
  },
  {
    text: "The clock. It waits while a step asks you to do something and runs while one asks you to watch; 2×, 4× and 8× hurry a wait, and the keys 1, 2, 4 and 8 do the same. On a real shift it never stops. Once the barriers are down MB1 clears to one yellow, because MB3 beyond it is still red: the driver has one block clear and will be ready to stop at MB3.",
    acts: [start],
    watch: "Watch the barriers come down and MB1 clear.",
    spot: "signal:MB1",
    until: (sim) => sim.aspect("MB1") !== "red",
  },
  {
    text: "MB1 is off, one yellow. Now the road into the station.",
    acts: [route("MB3", "MB5")],
  },
  {
    text: "MB3 is off with one yellow for MB5 at the platform end, so MB1 behind it shows two yellows: two blocks clear. A route gives itself back behind the train circuit by circuit, going grey again, so the next train can have it.",
    watch: "Watch 2S01 over the road and into platform 1.",
    spot: "lc:MB",
    until: (sim) => downOver(sim, "2S01"),
  },
  {
    text: "2S01 is over the road, and nothing else is set across it, so the road can have its barriers back. They never go up while a route still holds them.",
    acts: [raise],
  },
  {
    text: "2S01 calls at platform 1. The platform box is white while it loads, and flashes yellow once it is ready to leave: train ready to start, TRTS. Its road out is set then and not before, since a road set early holds its points and circuits and can block another move.",
    watch: "Watch platform 1's box go from white to flashing yellow.",
    spot: "signal:MB5",
    until: (sim) => readyToLeave(sim, "2S01"),
  },
  {
    text: "Ready to start. Its road out runs to MB9, the first automatic: you set that much and the automatics do the rest, so the white runs on through them to the edge of the board.",
    acts: [route("MB5", "MB9")],
  },
  {
    text: "Now watch the blocks work. As 2S01 passes MB9, MB9 goes red behind it, because its block is occupied. Once the train is into the next block, MB9 comes off again, yellow, since MB11 is now red behind the train. Nobody touches anything: this is how the automatics keep trains apart on the plain line, a block at a time.",
    watch: "Watch MB9 go red behind 2S01 and come off again.",
    spot: "signal:MB9",
    until: (sim, memo) => {
      if (on(sim, "2S01", ["SC.DM7B"])) memo.red = true;
      return (memo.red || reached(sim, "2S01", PAST_MB11)) && sim.aspect("MB9") !== "red";
    },
  },
  {
    text: "2W02 is coming the other way on the lower line, from Stringers Ridge, for platform 2. From MB2 its road runs through four automatics, MB10 to MB16, to MB4: ask for MB2 to MB4 and you set the first block, the automatics do the rest, and the white shows the whole road.",
    acts: [route("MB2", "MB4"), route("MB4", "MB6")],
  },
  {
    text: "2W02 comes in over the automatics to call at platform 2. Its road on waits for its box to flash yellow, as 2S01's did.",
    watch: "Watch 2W02 into platform 2 until it is ready to start.",
    spot: "signal:MB6",
    until: (sim) => readyToLeave(sim, "2W02"),
  },
  {
    text: "Its road on crosses Moccasin Road again and runs off the board to Williams Island. Lower the barriers first this time, so MB6 clears as soon as its road is set. A route off the edge ends at the arrow box where the line leaves the board.",
    acts: [lower, route("MB6", "MB8"), route("MB8", "WI-U", true)],
  },
  {
    text: "MB6 clears once the barriers are down, and 2W02 goes on over the road.",
    watch: "Watch 2W02 away over the road.",
    spot: "lc:MB",
    until: (sim) => upOver(sim, "2W02"),
  },
  {
    text: "1S03 is an express and does not stop. Give it the whole road before it reaches MB1: with every signal ahead off, MB1 shows green and the driver keeps up speed. Set it late and the driver sees yellow, brakes for a red one ahead, and the express loses time. The barriers are still down from 2W02, so set the road straight away.",
    acts: [route("MB1", "MB3"), route("MB3", "MB5"), route("MB5", "MB9")],
  },
  {
    text: "With the whole road set, MB1 shows green: three blocks and more clear, and the driver keeps up speed.",
    watch: "Watch 1S03 run through on greens, and away past MB9.",
    spot: "signal:MB1",
    until: (sim) => awayPastMB9(sim, "1S03"),
  },
  {
    text: "2S05 is booked platform 2, the far side. Points 801 swing across for it as the route sets, and stay locked while the route holds them: the leg drawn broken away at the points is the way they are not set. The barriers are still down.",
    acts: [route("MB1", "MB3"), route("MB3", "MB7")],
  },
  {
    text: "Watch the points: 801 swings across as 2S05's road is made.",
    watch: "Watch 2S05 over the road and across into platform 2.",
    spot: "points:801",
    until: (sim) => downOver(sim, "2S05"),
  },
  {
    text: "Nothing more is due over the road for a while, and a road left waiting behind lowered barriers soon has the police on the phone.",
    acts: [raise],
  },
  {
    text: "2S05 calls at platform 2. Its road out waits for TRTS, like every train's out of a platform.",
    watch: "Watch platform 2's box until 2S05 is ready to start.",
    spot: "signal:MB7",
    until: (sim) => readyToLeave(sim, "2S05"),
  },
  {
    text: "Out again, points 803 take it back to its own line past the platform.",
    acts: [route("MB7", "MB9")],
  },
  {
    text: "803 swings as the road out is made, and 2S05 crosses back over it to MB9.",
    watch: "Watch 2S05 cross back over 803 to MB9.",
    spot: "points:803",
    until: (sim) => awayPastMB9(sim, "2S05"),
  },
  {
    // Often 2W08 is at MB2 already by now and this goes by at once, so what
    // it teaches is on the step after, where the pupil always sees it.
    text: "2W08 is next, from Stringers Ridge, and something about it is wrong.",
    watch: "Watch for 2W08 at MB2.",
    spot: "berth:MB2",
    until: (sim) => {
      const t = trainOf(sim, "2W08");
      return !!t && sim.signalAhead(t)?.id === "MB2" && t.v === 0;
    },
  },
  {
    text: "Every train carries a four-character headcode, shown in the berth by the signal ahead of it and stepped on from berth to berth as it runs: that is how the board knows which train is which. 2W08 has come with none, so its berth by MB2 is blank and nothing on the board can tell which train it is. Give it its number.",
    acts: [interpose("MB2", "2W08")],
  },
  {
    text: "Now route 2W08 as you did 2W02, as far as platform 2 for now.",
    acts: [route("MB2", "MB4"), route("MB4", "MB6")],
  },
  {
    text: "The barriers can wait until a train is near the road: a road closed for nothing is a road queueing.",
    watch: "Watch 2W08 into platform 2 until it is ready to start.",
    spot: "signal:MB6",
    until: (sim) => readyToLeave(sim, "2W08"),
  },
  {
    text: "2W08 is ready to start, so close the road for it now and set its way on to Williams Island.",
    acts: [lower, route("MB6", "MB8"), route("MB8", "WI-U", true)],
  },
  {
    text: "Something is about to go wrong past platform 1. DM6 will fail: a track circuit that shows occupied with nothing on it, drawn red broken into dash and dot.",
    watch: "Watch 2W08 over the road, and DM6 fail.",
    spot: "tc:SC.DM6",
    until: (sim) => upOver(sim, "2W08") && sim.tcs.get("SC.DM6").failed,
  },
  {
    text: "DM6 has failed. 2S09 is coming for platform 1: set its road in as usual. The barriers are still down from 2W08.",
    acts: [route("MB1", "MB3"), route("MB3", "MB5")],
  },
  {
    text: "2S09 runs in to platform 1 like any other train. Its way out is another matter.",
    watch: "Watch 2S09 over the road and into platform 1.",
    spot: "lc:MB",
    until: (sim) => downOver(sim, "2S09"),
  },
  {
    text: "2S09 is over the road, so the road can have its barriers back.",
    acts: [raise],
  },
  {
    text: "Its road out waits for TRTS as usual.",
    watch: "Watch platform 1's box until 2S09 is ready to start.",
    spot: "signal:MB5",
    until: (sim) => readyToLeave(sim, "2S09"),
  },
  {
    text: "MB5 will not clear into a block it thinks is occupied, so 2S09 would stand there for good. Set its road out anyway, so the points are locked, then give the driver your authority to pass the red signal and go on at caution to the next one.",
    acts: [route("MB5", "MB9"), authorise("MB5")],
  },
  {
    text: "A fault is only mended once somebody rings it in, and on a real shift that is you. The phone asks what is wrong first, then where: 3 is a circuit red with nothing on it, and this one is DM6, as its alarm says and a click on the red track tells you too. Fault control reads the number back, so check it: a wrong one sends the fault team to the wrong place. When they get there they want DM6 to themselves for five minutes and nothing passes them, so ring a fault in when a gap in the trains suits, as it does now, with 2S09 about to go and nothing behind it for a while.",
    acts: [ring("tc", "DM6")],
  },
  {
    text: "Rung in. Meanwhile the driver has your authority: 2S09 goes past MB5 at caution, slowly, over the failed circuit to MB9, and on as normal from there.",
    watch: "Watch 2S09 go past MB5 at caution.",
    spot: "signal:MB5",
    until: (sim) => reached(sim, "2S09", PAST_MB9),
  },
  {
    text: "That is the desk, and it is yours now: everything works, and the clock runs as you set it. Until the fault team has mended DM6 a train past MB5 needs your authority, and while they have it nothing passes at all. Alarms say who rang them in, and the Alarms tab keeps them. On a real desk a train kept standing ten minutes with nowhere to go earns a black mark, and three marks and the board relieves you; here nobody is counting. The railway is eight desks, Whiteside to Tunnel Hill, the branch to Cleveland and the high-speed line at Lovell Field, and a shift is two hours of one of them with the other seven staffed around you.",
    free: true,
    yours: "Work 6W10, the freight, and 2S11 through on your own.",
    until: (sim) => sim.finished,
  },
];

/* ---- Where the lesson is ------------------------------------------------- */

/** A description as the berths hold it, and a number as the phone hears it. */
const headcode = (text) => String(text ?? "").toUpperCase().replace(/[^0-9A-Z]/g, "").slice(0, 4);
const said = (text) => String(text ?? "").toUpperCase().replace(/\s+/g, "");

/** Whether `action`, as the interface tells it, is the thing `act` asks for. */
function fulfils(act, action) {
  if (act.kind !== action.kind) return false;
  switch (act.kind) {
    case "route": return action.from === act.from && action.to === act.to;
    case "lower": case "raise": return action.lc === act.lc;
    case "rate": return action.rate > 0;
    case "authorise": return action.signal === act.signal;
    case "interpose": return action.berth === act.berth && headcode(action.desc) === act.desc;
    case "ring": return action.issue === act.issue && said(action.id) === act.id;
    default: return false;
  }
}

/** Whether `action` is one of the moves on the way to `act`: the start of its route, its box, its phone and its call. */
function leadsTo(act, action) {
  switch (action.kind) {
    case "pick": return act.kind === "route" && action.signal === act.from;
    case "interposeOpen": return act.kind === "interpose" && action.berth === act.berth;
    case "phone": return act.kind === "ring";
    case "call": return act.kind === "ring" && action.issue === act.issue;
    default: return false;
  }
}

/** The number a call has on the phone's list. */
function callKey(issue) {
  return CALLS.findIndex((c) => c.issue === issue) + 1;
}

/**
 * @typedef {{ entrance?: string | null, interposing?: string | null, phone?: { up: boolean, calling: string | null } }} LessonUi
 * What the pupil has on the go, as far as the lesson's words and pointer need it.
 */

/**
 * What the lesson asks for `act`, in so many words. Without `ui` it is the
 * whole of it, for a line done or still to come; with it, the next move as
 * far as the pupil has got: `ui` says which signal is chosen for a route
 * (`entrance`), which berth's box is open (`interposing`), and whether the
 * phone is up and what was chosen on it (`phone: { up, calling }`).
 * @param {{ kind: string, [key: string]: any }} act
 * @param {LessonUi | null} [ui]
 * @returns {string}
 */
export function actWords(act, ui = null) {
  if (!ui) {
    if (act.kind === "interpose") return `Right-click the berth by ${act.berth}, choose Interpose a description and type ${act.desc}`;
    if (act.kind === "ring") return `Ring ${act.id} in: P for the phone, ${callKey(act.issue)}, then ${act.id} and Enter`;
    ui = {};
  }
  switch (act.kind) {
    case "route": {
      const to = act.off ? "the arrow box at the edge of the board" : act.to;
      return ui.entrance === act.from ? `Now click ${to}` : `Click ${act.from}, then ${to}`;
    }
    case "lower": return "Right-click the crossing and choose Lower the barriers";
    case "raise": return "Right-click the crossing and choose Raise the barriers";
    case "rate": return "Press 1× at the top, or the 1 key, to start the clock";
    case "authorise": return `Right-click ${act.signal} and choose Authorise the driver past at danger`;
    case "interpose": return ui.interposing === act.berth ? `Type ${act.desc} and press Enter` : `Right-click the berth by ${act.berth} and choose Interpose a description`;
    case "ring":
      if (!ui.phone?.up) return "Press P, or the phone at the top";
      if (ui.phone.calling !== act.issue) return `Press ${callKey(act.issue)}: ${CALLS[callKey(act.issue) - 1].says.toLowerCase()}`;
      return `Type ${act.id} and press Enter`;
    default: return "";
  }
}

/**
 * What the board points at for `act`, as far as the pupil has got with it:
 * a thing on the board as `Screen.spotAt()` names it, or `ui:` and a
 * selector for a control off the board.
 * @param {{ kind: string, [key: string]: any }} act
 * @param {LessonUi} [ui]
 * @returns {string | null}
 */
export function actSpot(act, ui = {}) {
  switch (act.kind) {
    case "route": {
      if (ui.entrance !== act.from) return `signal:${act.from}`;
      return act.off ? `exit:${act.to}` : `signal:${act.to}`;
    }
    case "lower": case "raise": return `lc:${act.lc}`;
    case "rate": return 'ui:#rate [data-rate="1"]';
    case "authorise": return `signal:${act.signal}`;
    case "interpose": return ui.interposing === act.berth ? "ui:#interposeInput" : `berth:${act.berth}`;
    case "ring":
      if (!ui.phone?.up) return "ui:#phoneBtn";
      if (ui.phone.calling !== act.issue) return `ui:#phoneList [data-call="${callKey(act.issue) - 1}"]`;
      return "ui:#phoneInput";
    default: return null;
  }
}

/** Where the lesson is: which step, how much of what it asks for is done, and whether it is over. */
export class Tutor {
  constructor(steps = STEPS) {
    this.steps = steps;
    this.at = 0;
    this.done = false;
    // How many of the step's acts are done, and what it has seen so far, for one that waits on something to happen in turn.
    this.ticks = 0;
    this.memo = {};
  }

  /** The step being shown, or null once the lesson is over. */
  get step() {
    return this.done ? null : (this.steps[this.at] ?? null);
  }

  /**
   * What the step is waiting on: "read" for Next, "do" for the pupil, "watch"
   * for the desk, "free" once the desk is the pupil's; null when it is over.
   */
  get phase() {
    const s = this.step;
    if (!s) return null;
    if (s.next) return "read";
    if (s.free) return "free";
    if (this.ticks < (s.acts?.length ?? 0)) return "do";
    return "watch";
  }

  /** The thing the step asks for now, or null when it asks for nothing. */
  get act() {
    return this.phase === "do" ? this.step.acts[this.ticks] : null;
  }

  /** Whether the clock waits: while a step is read or asks for something done. */
  get holdsClock() {
    return this.phase === "read" || this.phase === "do";
  }

  /**
   * Whether the interface may do `action` now: anything once the desk is the
   * pupil's; while a step is watched, only the clock; while one asks for
   * something, only that thing and the moves on the way to it; and nothing
   * while a step is read.
   */
  allows(action) {
    const phase = this.phase;
    if (phase === null || phase === "free") return true;
    if (phase === "watch") return action.kind === "rate";
    if (phase === "read") return false;
    return fulfils(this.act, action) || leadsTo(this.act, action);
  }

  /** Tell the lesson `action` has happened; true when it was what the step asked for, which then takes its tick. */
  did(action) {
    const act = this.act;
    if (!act || !fulfils(act, action)) return false;
    this.ticks++;
    return true;
  }

  /** Move past every step the desk shows done; true when what is shown has changed. */
  tick(sim) {
    let changed = false;
    for (;;) {
      const s = this.step;
      if (!s) break;
      const phase = this.phase;
      if (phase === "read" || phase === "do") break;
      if (s.until && !s.until(sim, this.memo)) break;
      this.advance();
      changed = true;
    }
    return changed;
  }

  /** On to the next step, as Next does for one that only has to be read. */
  advance() {
    if (this.done) return;
    this.at++;
    this.ticks = 0;
    this.memo = {};
    if (this.at >= this.steps.length) this.done = true;
  }
}
