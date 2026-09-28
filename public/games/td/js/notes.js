// Wave notes: a banner that drops in from the top before each wave. It warns
// about whatever the coming wave brings that no wave before it has, a rush or
// a siege, a boss, a new mutation, and on a wave with nothing new it may just
// pass the time. Anything that comes round more than once draws from a pool
// and takes its turn through it, so the fourth Titan is not announced in the
// same words as the first.
import { CAMPAIGN_WAVES, MUTATIONS, composeWave, mutationFrom } from "./schedule.js";

/** The first time a kind of cube walks in. */
const FIRST = {
  fast: "Sprinters join in. Blink and they are already past your slowest tower.",
  swarm: "Swarms! Tiny, fragile, and never, ever alone. Anything with a blast eats them for breakfast.",
  armoured: "Blocks roll in. Their plating shaves points off every hit, so small shots barely tickle.",
  shield: "Shielded cubes. Pop the shell first, then deal with the soft bit inside.",
  tank: "A tank. Slow, armoured, and five lives if it reaches the door. Do not let it reach the door.",
  medic: "Medics now: they patch up everything walking near them. Rude. Kill them first.",
  boss: "Boss wave! The Hauler closes it out: slow, stubborn, six lives at the door, and it only feels half of any freeze.",
  charger: "Chargers: the more you hurt them, the faster they run. Finish what you start.",
  splitter: "Splitters pop into two runners when they die. Two for the price of one, sadly.",
  juggernaut: "A juggernaut: a shielded tank that laughs off half of every blast. Shells are the wrong answer here.",
  hidden: "Hidden cubes. Most of your towers cannot see them at all, so check who can before they sneak past.",
  phase: "Phasers flicker out of reach every few seconds. Beams lose them, so time your hits.",
  titan: "A Titan closes the wave: enormous, armoured, fifteen lives, and fire slides right off. Freezing it buys a moment, not a win.",
  warden: "Wardens: everything inside their ring takes 40% less damage. Take out the bodyguard first.",
  bomber: "Bombers knock out nearby towers when they pop. Kill them at range, not on your doorstep.",
  regen: "Regenerators knit themselves back together as they walk. Chip damage will not cut it; focus them.",
  wraith: "Wraiths: fast, hidden and phasing, all at once. Pick a tower that can see them, and good luck.",
  necromancer: "Necromancers raise fresh cubes as they walk. Every second one lives is another cube on the road.",
  brood: "A Broodmother closes it out. It bursts into three hydras, and each of those bursts into two blocks. It is cubes all the way down.",
  colossus: "The Colossus arrives: a monster shield, twenty-five lives, and lightning goes straight to ground in it. Arc towers, take the day off.",
  hydra: "Hydras split into two blocks when they fall. Cut one down, fight two.",
  revenant: "Revenants get back up once. Kill them twice; they are used to it.",
  blink: "Blinks jump a stride down the road every few seconds. Slow towers will keep swinging at thin air.",
  aegis: "Aegis cubes wrap their friends in shields and keep rebuilding them. Bring them down first or everything lasts twice as long.",
  geode: "Geodes: mostly shell, and nothing touches the inside until the outside gives. Crack one and three runners come out of it, so keep something quick behind whatever does the cracking. They pay well.",
  courser: "A Courser leads this rush: boss-sized, unseen by most towers, and quicker than the chaff around it. Whatever can see it had better be able to keep up.",
};

/**
 * The new kinds worth a warning on their own: the ones that beat a defence
 * built for what came before, not merely more of the same. The rest are only
 * told of when every note is wanted.
 */
const THREATS = new Set(["boss", "juggernaut", "hidden", "phase", "titan", "bomber", "wraith", "necromancer", "brood", "colossus", "revenant", "aegis", "courser", "geode"]);
/** Likewise the mutations: the first of them, and the ones that undo a defence. */
const MUTATION_THREATS = new Set(["molten", "charged", "void", "glass"]);

/** The first wave a mutation can turn up in. */
const MUTATING = {
  molten: "Mutations start here, and molten cubes lead the way: fire does nothing to them, and they bake the towers they walk past.",
  charged: "Charged cubes: quick, lightning passes straight through them, and they knock out towers on their way out.",
  rime: "Rime cubes: frost slides right off and nothing slows them, but fire bites deep. Light them up.",
  gilded: "Gilded cubes: slow, plated, and worth a small fortune to whoever cracks one. Go and get rich.",
  chrome: "Chrome cubes: shells and bullets skid off the shine. Burn them or freeze them instead.",
  neon: "Neon cubes: barely there, and far too fast. Blink and you missed them. Literally.",
  void: "Void cubes: hidden, and gone entirely every few seconds. Spooky.",
  glass: "Glass cubes shatter easily and come apart when they do. A glass boss leaves two titans behind, so hold the celebrations.",
  blight: "Blighted cubes heal themselves and anything walking beside them. Find the source and end it.",
  overgrown: "Overgrown cubes: triple the health, and twice the lives at the door. Big, green trouble.",
};

/**
 * A boss that has been before, told a different way each time it returns.
 * Each line is given the words for however many of it there are, so two
 * Titans read as two Titans and not as one.
 */
const BOSS_BACK = {
  boss: [
    (w) => `${w.Some} again. Slow, stubborn, and still six lives at the door.`,
    (w) => `${w.Some} ${w.is} back to haul ${w.itself} down your road. Frost only gets ${w.them} so far.`,
  ],
  titan: [
    (w) => `${w.Some} ${w.is} lumbering in at the back. Fire runs off ${w.them} like rain, so bring anything else.`,
    (w) => `${w.Some} again. Frost buys you a few seconds at best, then ${w.they} ${w.breaks} free and keep${w.s} walking.`,
    (w) => `The ground shakes: here ${w.comes} ${w.some}. Fifteen lives ${w.each}at the door, and ${w.they} know${w.s} it.`,
    (w) => `${w.Some} to finish. Pile on raw damage, because nothing holds ${w.them} still for long.`,
    (w) => `${w.Some} ${w.is} back, and ${w.is} deeply unimpressed by your tar pit.`,
    (w) => `Brace yourself: ${w.some} at the end. Your flame towers can sit this one out.`,
  ],
  brood: [
    (w) => `${w.Some} again, and each one is really three hydras and six blocks in a trench coat. Leave room in the kill zone.`,
    (w) => `${w.Some} ${w.brings} the whole family. Save some firepower for the kids.`,
    (w) => `${w.Some} at the back. Killing ${w.them} is the easy third of the job.`,
  ],
  colossus: [
    (w) => `${w.Some} ${w.is} back. Lightning grounds straight through ${w.them}, so do not count on your arcs.`,
    (w) => `${w.Some} ${w.rolls} in behind a shield like a wall. Strip it, then start on the twenty-five lives underneath.`,
    (w) => `The sky goes dark: ${w.some}. Freeze ${w.them} all you like; ${w.they} will shake it off.`,
  ],
};
const BOSS_NAMES = { boss: ["Hauler", "Haulers"], titan: ["Titan", "Titans"], brood: ["Broodmother", "Broodmothers"], colossus: ["Colossus", "Colossi"] };
/** The order bosses are mentioned in when a wave ends on more than one. */
const BOSS_ORDER = ["colossus", "brood", "titan", "boss"];
const NUMBERS = ["no", "one", "two", "three", "four", "five", "six"];

/** Every seventh wave from 14. */
const RUSH = [
  "A rush: nothing but quick cubes, packed nose to tail. Slow-turning towers, good luck.",
  "Rush wave. Hundreds of tiny feet. Anything with a blast radius just became your favourite tower.",
  "Everything fast, all at once. If a tower takes a second to aim, that is a second too long.",
  "Here comes the stampede. Cones, bursts and splash: this is your moment.",
  "Speed round. It is over in a blink, one way or the other.",
  "A rush, and the fastest one yet. They are fragile, they are quick, and there are far too many of them.",
];

/** Every eleventh wave from 22. */
const SIEGE = [
  "A siege: plating on plating, and nothing light to thin out. Pierce it, melt it, or sell something.",
  "Siege wave. The slowest parade in the world, and every float is armoured.",
  "The armoured column is back. Small shots will ping off all day, so bring the heavy stuff.",
  "Siege. Nothing quick, nothing light, and nothing that goes down easily.",
];

/** For a wave with nothing new in it. Said now and then, never while still fresh. */
const QUIET = [
  "The cubes do not know why they walk the road. Neither does anyone else.",
  "Somewhere a runner is telling another runner that this is the one.",
  "Gold in the purse kills nothing.",
  "The door at the far end has never once been closed.",
  "Nobody has asked the cubes what they want. It is probably the door.",
  "Frost would like it known that it does more than it looks.",
  "Every cube that gets through is somebody's fault.",
  "A quiet wave. It will not last.",
  "A mint does not fire. A mint does not need to.",
  "A good wave to upgrade something. Go on.",
  "A sprinter once stopped to look at a tower. Once.",
  "The swarm has a plan. The plan is more swarm.",
  "If it wears a shell, take the shell off first.",
  "The road does not care who builds beside it.",
  "Nothing new this time. Just more of the old, but angrier.",
  "The boulders would like to apologise in advance.",
  "The trees were here before the road. They would like that remembered.",
  "The cubes have been practising. Have you?",
  "Fun fact: no cube has ever read one of these notes.",
  "A tower with nothing in range is just expensive scenery.",
  "The Hauler sends its regards. From a distance, thankfully.",
  "Somewhere, a tar pit is waiting patiently. It is very good at waiting.",
  "Runners are cheap. That is exactly why there are so many.",
  "A lodestone walks into a road. Everything else walks into the lodestone.",
  "Keep calm and upgrade the sniper.",
  "Nothing special this wave. The cubes are saving themselves for later.",
  "The prism is quietly soaking up light. Nobody tell the cubes.",
  "That gap in your defence? The cubes have noticed it too.",
  "Every cube is somebody's favourite. Not yours, though.",
  "A breather. Spend it wisely, or spend it all.",
];
/** How many of the most recent quiet lines are held back from coming round again. */
const QUIET_REST = 8;

const FINALE_AS = { easy: "Chrome", normal: "Gilded", hard: "Ascendant", ruin: "Ascendant" };

const recentQuiet = [];
const seenBy = new Map();
const kindsBy = new Map();

/** The kinds of cube in wave `n`, remembered once worked out. */
function kindsIn(n, difficulty) {
  const key = difficulty + ":" + n;
  let kinds = kindsBy.get(key);
  if (!kinds) { kinds = new Set(composeWave(n, difficulty).map((x) => x.type)); kindsBy.set(key, kinds); }
  return kinds;
}

/** The kinds of cube every wave before `n` has already sent. */
function seenBefore(n, difficulty) {
  let known = seenBy.get(difficulty);
  if (!known) { known = [new Set()]; seenBy.set(difficulty, known); }
  for (let k = known.length; k < n; k++) {
    const next = new Set(known[k - 1]);
    for (const x of composeWave(k, difficulty)) next.add(x.type);
    known.push(next);
  }
  return known[n - 1];
}

/**
 * The words for `count` of a boss, for BOSS_BACK to build a line from: "a
 * Titan ... is ... it" for one, "three Titans ... are ... they" for more.
 */
function bossWords(type, count) {
  const [one, many] = BOSS_NAMES[type];
  const single = count === 1;
  const some = single ? (type === "colossus" ? "the Colossus" : "a " + one) : (NUMBERS[count] || String(count)) + " " + many;
  return {
    some, Some: some[0].toUpperCase() + some.slice(1),
    is: single ? "is" : "are", they: single ? "it" : "they", them: single ? "it" : "them", itself: single ? "itself" : "themselves",
    s: single ? "s" : "", comes: single ? "comes" : "come", breaks: single ? "breaks" : "break",
    brings: single ? "brings" : "bring", rolls: single ? "rolls" : "roll", each: single ? "" : "each ",
  };
}

/** How many waves before `n` a boss of this kind has already ended. */
function timesBefore(type, n, difficulty) {
  let times = 0;
  for (let k = 10; k < n; k++) if (kindsIn(k, difficulty).has(type)) times++;
  return times;
}

/** Said the moment the last boss of the campaign steps onto the road, by the name it walks in as. */
const FINALE_ARRIVES = [
  (name) => `The ${name} is on the road. Everything you built was for this.`,
  (name) => `Here it is: the ${name}. No more waves after this one, so hold nothing back.`,
  (name) => `The ${name} has arrived, and it is not stopping for anyone. Make it count.`,
];
export function finaleLine(name) {
  return FINALE_ARRIVES[Math.floor(Math.random() * FINALE_ARRIVES.length)](name);
}

/**
 * The note shown before wave `n`: a title, its lines, and whether it is
 * a warning. Null when it has nothing to say.
 */
export function notesFor(n, difficulty) {
  const title = "Wave " + n;
  // Each line says whether it is a real warning, which is all the notes show
  // when only warnings are wanted.
  const note = (heading, lines, warn) => ({ title: heading, lines: lines.map((l) => l.text), major: lines.map((l) => l.major), warn });
  if (n === 1) return note(title, [{ text: "Runners first. Consider it a warm-up.", major: false }], false);
  if (n === CAMPAIGN_WAVES) {
    const as = FINALE_AS[difficulty] || FINALE_AS.easy;
    return note(title + " · The last wave", [{
      text: as === "Ascendant"
        ? "This is it. The Devourer walks in last, and here it walks in Ascendant: every mutation at once. Everything you have, right now."
        : "This is it. The Devourer walks in last, and it walks in " + as + ". Whatever you were saving gold for, spend it now.",
      major: true,
    }], true);
  }
  if (n === CAMPAIGN_WAVES + 1) return note(title, [{ text: "Past the end of the campaign. Nothing is counted from here, and it only gets nastier. How long can you hold?", major: true }], true);

  const lines = [];
  let tag = "";
  if (n >= 14 && n % 7 === 0) {
    tag = "Rush";
    lines.push({ text: RUSH[(n / 7 - 2) % RUSH.length], major: true });
  } else if (n >= 22 && n % 11 === 0) {
    tag = "Siege";
    lines.push({ text: SIEGE[(n / 11 - 2) % SIEGE.length], major: true });
  }
  if (n <= CAMPAIGN_WAVES) {
    const seen = seenBefore(n, difficulty);
    const kinds = kindsIn(n, difficulty);
    const fresh = [...kinds].filter((t) => !seen.has(t) && FIRST[t]);
    for (const t of fresh) lines.push({ text: FIRST[t], major: THREATS.has(t) });
    // A boss that has been before is still worth a warning, in words it has
    // not had yet: the pool is walked in turn by how often it has come.
    const counts = {};
    for (const x of composeWave(n, difficulty)) counts[x.type] = (counts[x.type] || 0) + 1;
    for (const type of BOSS_ORDER) {
      if (!counts[type] || fresh.includes(type)) continue;
      const pool = BOSS_BACK[type];
      const line = pool[timesBefore(type, n, difficulty) % pool.length];
      lines.push({ text: line(bossWords(type, counts[type])), major: true });
    }
  }
  // The wave a mutation can first turn up in is the difficulty's, not the
  // list's: hard meets molten on seven, so warning about it on twelve is five
  // waves of cubes too late.
  for (const [id, m] of Object.entries(MUTATIONS)) if (!m.never && mutationFrom(m, difficulty) === n && MUTATING[id]) lines.push({ text: MUTATING[id], major: MUTATION_THREATS.has(id) });
  if (lines.length) return note(tag ? title + " · " + tag : title, lines, true);

  // Nothing to warn about: now and then, something to read, and never one
  // that was read only a few waves ago.
  if (Math.random() > 0.45) return null;
  const choices = QUIET.map((_, i) => i).filter((i) => !recentQuiet.includes(i));
  const i = choices[Math.floor(Math.random() * choices.length)];
  recentQuiet.push(i);
  if (recentQuiet.length > QUIET_REST) recentQuiet.shift();
  return note(title, [{ text: QUIET[i], major: false }], false);
}
