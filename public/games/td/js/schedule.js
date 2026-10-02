// Enemy types and how waves are composed. Speed is cells per second,
// armour is flat damage knocked off every hit, reward is gold on a kill.
// leak: lives it takes if it reaches the far door at full health; what it
// actually takes scales with the health it has left, never below one.
// shield: damage that must be burned off before health takes any.
// heal: health per second given to enemies within healRange. split: how
// many runners it breaks into when killed. phase: seconds untouchable
// (on) and seconds vulnerable (off), cycling from the moment it appears.
// hidden: only towers whose tier has `detect` can aim at it; blasts still hurt it.
// charge: how much faster it runs on its last legs, coming on evenly as it
// is hurt rather than switching on at half health. guard: enemies within
// that many cells take 40% less damage while it lives. emp: on death, towers
// within that many cells are knocked out for two seconds. regen: fraction
// of max health healed per second. raise: every so many seconds it raises
// one of the listed types beside it, up to `max` of them over its life.
// splitInto: what it breaks into when killed (default a runner).
// blink: jumps `dist` cells down the road every `every` seconds.
// aegis: tops up a shield of `amount` on everything within `range` cells.
// revive: gets back up once at this fraction of its health.
// resist: damage multiplier from a named tower, 0 for outright immunity.
// tough: how much of the wave's health curve it takes. The bosses start
// enormous, so they climb more slowly and the last waves stay watchable.
// Anything tough is also a boss to crowd control: see BOSS_GRIT in model.js.
export const ENEMIES = {
  basic: { name: "Runner", hp: 20, speed: 1.6, armour: 0, reward: 5, size: 0.3, colour: "#bab6b6", leak: 1, blurb: "The ordinary cube. Nothing special, and there are always more of them." },
  fast: { name: "Sprinter", hp: 16, speed: 4.4, armour: 0, reward: 7, size: 0.24, colour: "#eae7e7", leak: 1, blurb: "Light and quick. Gets past slow towers before they turn." },
  armoured: { name: "Block", hp: 80, speed: 1.15, armour: 4, reward: 14, size: 0.36, colour: "#7d7979", leak: 3, blurb: "Thick-skinned: knocks a few points off every hit. Piercing and heavy hits get through." },
  boss: { name: "Hauler", hp: 520, speed: 0.95, armour: 5, tough: 0.6, reward: 70, size: 0.46, colour: "#605d5d", leak: 6, blurb: "The first boss. Slow, tough, and costly if it reaches the door." },
  swarm: { name: "Swarm", hp: 8, speed: 2.9, armour: 0, reward: 2, size: 0.17, colour: "#cfcaca", leak: 1, blurb: "Tiny and fragile, but they come in packs. Blasts and cones clear them." },
  shield: { name: "Shield", hp: 42, speed: 1.35, armour: 0, reward: 16, size: 0.32, colour: "#8f8b8b", shield: 75, leak: 3, blurb: "Wears a shell that soaks damage before its health takes any. Burn the shell off first." },
  medic: { name: "Medic", hp: 70, speed: 1.25, armour: 0, reward: 20, size: 0.3, colour: "#e6e2e2", heal: 9, healRange: 1.3, healMost: 4, leak: 2, blurb: "Heals whatever walks near it. Kill it before the cubes it escorts." },
  splitter: { name: "Splitter", hp: 48, speed: 1.45, armour: 1, reward: 10, size: 0.34, colour: "#a8a4a4", split: 2, splitInto: "basic", leak: 2, blurb: "Breaks into two runners on the spot when it dies." },
  phase: { name: "Phaser", hp: 40, speed: 1.7, armour: 0, reward: 12, size: 0.28, colour: "#d0cccc", phase: { on: 1.2, off: 2.2 }, leak: 1, blurb: "Every few seconds it goes untouchable for a moment. Beams lose it; time your hits." },
  hidden: { name: "Hidden", hp: 36, speed: 2.1, armour: 0, reward: 11, size: 0.28, colour: "#c4c0c0", hidden: true, leak: 1, blurb: "Faint and unseen by most towers. Only some can aim at it; blasts still hurt it." },
  // The heavies: slow, thick-skinned, and ruinous if they get through.
  tank: { name: "Tank", hp: 360, speed: 0.82, armour: 8, reward: 52, size: 0.42, colour: "#6e6a6a", leak: 5, blurb: "Slow, heavily armoured, and five lives if it gets through." },
  juggernaut: { name: "Juggernaut", hp: 950, speed: 0.85, armour: 7, tough: 0.6, reward: 145, size: 0.5, colour: "#575353", shield: 300, leak: 10, resist: { cannon: 0.5, mortar: 0.5 }, blurb: "A tank with a heavy shield on top. Its plating shrugs off half of any blast, so shells are the wrong answer." },
  titan: { name: "Titan", hp: 2200, speed: 0.72, armour: 11, tough: 0.55, reward: 300, size: 0.58, colour: "#4a4646", leak: 15, resist: { flame: 0, frost: 0.25 }, blurb: "The mid-campaign boss. Enormous health, thick armour, fifteen lives, and fire simply runs off it." },
  // The late-campaign cast.
  charger: { name: "Charger", hp: 130, speed: 1.3, armour: 1, reward: 22, size: 0.36, colour: "#b0acac", leak: 3, charge: 3.4, blurb: "Every point of damage makes it quicker. Barely hurt it is ordinary; on its last legs it runs at three and a half times its pace." },
  warden: { name: "Warden", hp: 240, speed: 1.05, armour: 3, reward: 38, size: 0.38, colour: "#7a7676", leak: 4, guard: 1.3, blurb: "Everything inside its ring takes 40% less damage while it lives." },
  bomber: { name: "Bomber", hp: 75, speed: 1.7, armour: 0, reward: 15, size: 0.3, colour: "#8c8888", leak: 2, emp: 1.6, blurb: "When it dies, towers close by are knocked out for two seconds." },
  regen: { name: "Regenerator", hp: 300, speed: 1.15, armour: 2, reward: 44, size: 0.4, colour: "#9a9696", leak: 4, regen: 0.022, blurb: "Knits its own health back at a steady rate. Focus it down." },
  wraith: { name: "Wraith", hp: 60, speed: 3.2, armour: 0, reward: 24, size: 0.26, colour: "#d6d2d2", leak: 2, hidden: true, phase: { on: 1, off: 1.8 }, blurb: "Fast, hidden and phasing all at once." },
  necromancer: { name: "Necromancer", hp: 460, speed: 0.85, armour: 3, reward: 75, size: 0.42, colour: "#5a5656", leak: 5, raise: { every: 2.2, max: 8, types: ["basic", "basic", "fast", "armoured"] }, blurb: "Raises a fresh cube beside it every couple of seconds until its strength is spent. Kill it early." },
  // Waves 32 and up: the campaign keeps introducing new shapes to the end.
  hydra: { name: "Hydra", hp: 300, speed: 1.05, armour: 4, reward: 50, size: 0.42, colour: "#8a8686", leak: 4, split: 2, splitInto: "armoured", blurb: "Comes apart into two blocks when it falls, so killing it is only half the work." },
  blink: { name: "Blink", hp: 190, speed: 1.5, armour: 1, reward: 32, size: 0.32, colour: "#c9c5c5", leak: 3, blink: { every: 2.6, dist: 1.5 }, blurb: "Skips a stride further down the road every few seconds. Slow towers rarely get a second shot." },
  brood: { name: "Broodmother", hp: 3000, speed: 0.8, armour: 9, tough: 0.55, reward: 380, size: 0.6, colour: "#4f4a4a", leak: 18, split: 3, splitInto: "hydra", blurb: "A boss built to come apart: it breaks into three hydras, and every one of those breaks into two blocks. Killing it is a third of the work." },
  aegis: { name: "Aegis", hp: 320, speed: 1.0, armour: 3, reward: 60, size: 0.42, colour: "#767272", shield: 160, aegis: { range: 1.7, amount: 45, rate: 5, most: 3 }, leak: 5, blurb: "Wraps everything around it in a shield and rebuilds it. Bring it down first." },
  revenant: { name: "Revenant", hp: 420, speed: 1.05, armour: 5, reward: 70, size: 0.44, colour: "#6b6767", leak: 5, revive: 0.45, blurb: "Falls, then gets back up once at partial health. It has to be killed twice." },
  devourer: { name: "Devourer", hp: 10000, speed: 0.68, armour: 18, tough: 0.5, reward: 1400, size: 0.78, colour: "#332f2f", leak: 40, shield: 1200, split: 2, splitInto: "titan", resist: { flame: 0, arc: 0.4, prism: 0.5 }, blurb: "The last boss. A vast shield, it eats fire whole, shrugs off lightning and light, and breaks into two titans when it finally falls." },
  // The shell is the puzzle and the split is the price of solving it slowly:
  // nothing hurts the body until the shell gives, and once it does the thing
  // opens and three runners come out past a tower still turning. Worth hunting,
  // cracking one pays better for the trouble than anything else its size, which
  // is the whole reason to take it on rather than let it walk.
  geode: { name: "Geode", hp: 170, shield: 430, speed: 1.2, armour: 2, reward: 120, size: 0.38, colour: "#85807f", leak: 3, split: 3, splitInto: "fast", blurb: "Mostly shell, and hollow behind it. Nothing touches the inside until the outside gives, and then it splits open and three runners come out. Worth a great deal to whoever cracks one." },
  // Every other heavy on the road lumbers, so a defence built for them is a
  // defence built to grind something down slowly. This one is boss-sized and
  // boss-priced and crosses the board in a third of the time, unseen by most of
  // what would shoot it. It demands 1,800 damage a second where a Titan demands
  // 1,584, and it gives a fifth of the time to find it.
  courser: { name: "Courser", hp: 750, speed: 2.4, armour: 4, tough: 0.5, reward: 200, size: 0.46, colour: "#b5b0b0", leak: 4, hidden: true, blurb: "Boss-sized and running like chaff, and most towers cannot see it at all. It leads the rushes: by the time it is spotted it is halfway down the road." },
  colossus: { name: "Colossus", hp: 7000, speed: 0.62, armour: 16, tough: 0.5, reward: 750, size: 0.7, colour: "#3e3a3a", leak: 25, shield: 1100, resist: { arc: 0, prism: 0.4 }, blurb: "The late boss: a huge shield, huge health, twenty-five lives, and it earths every bolt of lightning." },
};

// ---- Mutations ------------------------------------------------------
// A cube can walk in changed. A mutation repaints it, bends its numbers and
// can hand it a trait its kind never had: a molten block, a charged sprinter,
// a gilded swarm worth robbing. They start turning up in the teens and grow
// commoner to the end of the campaign.
//
// hp, shield, speed, reward, leak and size are multipliers; armour is added.
// resist merges over the type's own, and a value above 1 is a weakness, not a
// resistance. traits are merged in whole, so a mutation can give a cube a
// phase, a regen or a shield out of nothing. from: the first wave it appears.
// weight: how often it is picked against the others. maxSize: mutations that
// would make a boss absurd skip anything already that big. shards: what a
// mutation that comes apart leaves behind, decided by what it landed on.
/**
 * Every mutation, and what it costs to meet one. `weight` is how often it is
 * rolled against the others; `spite` is how much it punishes a board rather
 * than how much it pays for being killed, a gilded cube is fat and worth a
 * fortune and turns nothing aside, a chrome one turns the three heaviest
 * hitters aside and pays little. A difficulty leans the pool toward spite by
 * its own `lean`, so a hard run meets the ones that hurt rather than the ones
 * that pay. Nothing about any mutation changes; only which of them turn up.
 */
export const MUTATIONS = {
  molten: {
    name: "Molten", colour: "#ff6a2b", glow: "#ffc48a", from: 12, weight: 1.2, spite: 1.3,
    blurb: "Runs white-hot. Fire does nothing to it, its heat bakes the towers it walks past into firing slower, and cold bites deep.",
    hp: 1.35, reward: 1.6,
    resist: { flame: 0, frost: 1.6 },
    traits: { scorch: { range: 1.4, slow: 0.35 } },
  },
  charged: {
    name: "Charged", colour: "#4fb8ff", glow: "#d6f0ff", from: 14, weight: 1.2, spite: 1.3,
    blurb: "Carrying a current. Lightning earths straight through it, it moves half again as fast, and it knocks out the towers around it when it goes.",
    hp: 0.9, speed: 1.45, reward: 1.5,
    resist: { arc: 0, bolt: 0.6 },
    traits: { emp: 1.2 },
  },
  rime: {
    name: "Rime", colour: "#8fe8ff", glow: "#eafaff", from: 17, weight: 1, spite: 1.2,
    blurb: "Frozen through already. Nothing can slow it further and frost slides off, but the cold has left it brittle against fire.",
    hp: 1.5, speed: 0.85, reward: 1.6,
    resist: { frost: 0, flame: 1.5 },
    traits: { unchillable: true },
  },
  gilded: {
    name: "Gilded", colour: "#ffc94a", glow: "#fff0bd", from: 19, weight: 0.8, spite: 0.4,
    blurb: "Plated in gold: heavy, slow, hard to crack, and worth a small fortune to whoever cracks it.",
    hp: 2.4, speed: 0.9, reward: 7, armour: 5,
  },
  chrome: {
    name: "Chrome", colour: "#cfd9ee", glow: "#ffffff", from: 22, weight: 1, spite: 1.4,
    blurb: "Mirror-finished and thickly plated. Shells and bullets skid off it; something that burns or freezes does better.",
    hp: 1.6, speed: 0.8, reward: 1.8, armour: 7,
    resist: { cannon: 0.55, mortar: 0.55, sniper: 0.7 },
  },
  neon: {
    name: "Neon", colour: "#49ff9a", glow: "#dfffe9", from: 25, weight: 1.1, spite: 0.5,
    blurb: "Burning its whole life at once: barely there, far too fast, and far too bright to hide. Worth three of anything else.",
    hp: 0.5, speed: 1.8, reward: 3,
    traits: { hidden: false, charge: 1.6 },
  },
  void: {
    name: "Void", colour: "#a86bff", glow: "#e2ccff", from: 28, weight: 1, spite: 1.4,
    blurb: "Half here at the best of times: unseen by most towers, and gone entirely every few seconds. Even light struggles to hold it.",
    hp: 1.3, reward: 2.4,
    resist: { prism: 0.6 },
    traits: { hidden: true, phase: { on: 0.9, off: 1.7 } },
  },
  blight: {
    name: "Blight", colour: "#a8e04b", glow: "#e8ffbc", from: 32, weight: 0.9, spite: 1.2,
    blurb: "Rotten and spreading. It knits itself back together as it walks and mends whatever walks with it.",
    hp: 1.4, reward: 2, maxSize: 0.5,
    traits: { regen: 0.022, heal: 8, healRange: 1.5, healMost: 3 },
  },
  glass: {
    name: "Glass", colour: "#efe6ff", glow: "#ffffff", from: 30, weight: 0.9, spite: 0.7,
    blurb: "Thin, quick and ready to go: everything hurts it half again as much, and it comes apart when it breaks. A cube leaves splinters; a boss leaves two titans.",
    hp: 0.6, speed: 1.3, reward: 2.5,
    traits: { frail: 1.5, split: 2 },
    shards: (base) => (base.size > 0.55 ? "titan" : "swarm"),
  },
  overgrown: {
    name: "Overgrown", colour: "#ff5f7e", glow: "#ffd0d9", from: 36, weight: 0.7, spite: 1.3,
    blurb: "Grown far past its kind: half again the size, three times the health, and twice as costly at the door.",
    hp: 3, speed: 0.72, reward: 3.5, leak: 2, size: 1.4, armour: 3, maxSize: 0.55,
  },
  // Never rolled. Only the last boss of the campaign wears it, on hard and on
  // ruin: the worst of the others at once. It is not passed on to the titans
  // it breaks into (heirless): two Ascendant titans on the doorstep, at twice
  // a titan's toll each, ended a hard run that had not leaked a cube all
  // campaign, whatever the board.
  ascendant: {
    name: "Ascendant", colour: "#ff4a1c", glow: "#ffe08a", from: 50, never: true, heirless: true,
    blurb: "What the last boss becomes on hard and on Ruin, and nowhere else: the worst of every other mutation at once. Three times the health and half again the shield, thicker armour, a heat that bakes the towers it passes, a cold that cannot touch it, and a knock-out for everything near it when it falls.",
    // No `leak` of its own: the last boss takes every life left if it reaches
    // the door whatever it is worth (model.js, the leak charge), so a
    // doubled toll here never applied and only ever put a "Lives ×2" row in
    // the field guide that meant nothing.
    hp: 3, shield: 1.5, speed: 0.92, armour: 5, reward: 3,
    traits: { unchillable: true, scorch: { range: 2, slow: 0.45 }, emp: 2.4 },
  },
};

/**
 * How much faster a cube is running for the health it has left: its ordinary
 * pace at full health, its whole charge at death's door, and an even ramp
 * between. Everything that needs to know a cube's speed goes through here, so
 * the view, the aiming and the walking all agree.
 */
export function chargeAt(spec, frac) {
  if (!spec.charge) return 1;
  return 1 + (spec.charge - 1) * (1 - Math.max(0, Math.min(1, frac)));
}

/** How likely any one cube in wave n walks in mutated, on this difficulty. */
export function mutationChance(n, difficulty) {
  const { from, per, cap } = shapeOf(difficulty).mutate;
  return n < from ? 0 : Math.min(cap, (n - (from - 1)) * per);
}

/** The wave a mutation can first be rolled on, pulled in or pushed out by the difficulty. */
export function mutationFrom(mutation, difficulty) {
  return Math.max(2, Math.round(mutation.from * (shapeOf(difficulty).gates || 1)));
}

/** Roll a mutation for a cube of this spec in wave n, or null for a plain one. */
export function rollMutation(n, spec, difficulty) {
  const chance = mutationChance(n, difficulty);
  if (!chance || Math.random() >= chance) return null;
  const lean = shapeOf(difficulty).lean || 0;
  let total = 0;
  const pool = [];
  for (const [id, m] of Object.entries(MUTATIONS)) {
    if (m.never || n < mutationFrom(m, difficulty) || (m.maxSize && spec.size > m.maxSize)) continue;
    // Leaning the pool changes which mutation is rolled, never what it is once
    // it has been: a hard run meets chrome and void where an easy one meets
    // gilded and neon, and every one of them behaves the same wherever it lands.
    total += (m.weight || 1) * (lean ? (m.spite || 1) ** lean : 1);
    pool.push([id, total]);
  }
  if (!pool.length) return null;
  const roll = Math.random() * total;
  for (const [id, upto] of pool) if (roll < upto) return id;
  return pool[pool.length - 1][0];
}

const mutated = new Map();

/** The spec a cube of this type actually walks in with, mutation and all. */
export function specFor(type, mut) {
  const base = ENEMIES[type];
  if (!mut || !MUTATIONS[mut]) return base;
  const key = type + "|" + mut;
  const had = mutated.get(key);
  if (had) return had;
  const m = MUTATIONS[mut];
  // A boss already starts enormous, so a mutation only partly takes on it, the
  // same way the wave's health curve does, and that has to include what it is
  // worth. A gilded devourer took a fraction of the health a gilded runner does
  // and the whole seven times the pay, which is one kill for two maxed snipers.
  const soft = (mult) => (base.tough ? 1 + (mult - 1) * base.tough : mult);
  const s = { ...base, ...(m.traits || {}) };
  s.name = m.name + " " + base.name;
  s.colour = m.colour;
  s.glow = m.glow;
  s.mutation = mut;
  if (m.hp) s.hp = Math.max(1, Math.round(base.hp * soft(m.hp)));
  if (m.shield && base.shield) s.shield = Math.round(base.shield * soft(m.shield));
  if (m.speed) s.speed = Math.round(base.speed * m.speed * 100) / 100;
  if (m.reward) s.reward = Math.max(1, Math.round(base.reward * soft(m.reward)));
  if (m.leak) s.leak = Math.max(1, Math.round((base.leak || 1) * soft(m.leak)));
  if (m.size) s.size = Math.round(base.size * m.size * 100) / 100;
  if (m.armour) s.armour = base.armour + m.armour;
  if (m.resist || base.resist) s.resist = { ...(base.resist || {}), ...(m.resist || {}) };
  // What it comes apart into is its own business, and depends on its size.
  if (m.shards) s.splitInto = m.shards(base);
  mutated.set(key, s);
  return s;
}

export const CAMPAIGN_WAVES = 50;

/**
 * How far a boss throws its pieces back up the road as it comes apart: `base`
 * cells plus `perSize` for every unit of its size, and never more than `most`
 * of the route. A splitter drops its halves at its feet, but a boss killed on
 * the doorstep would otherwise hand over two fresh heavies already past every
 * tower on the board, which is a loss however well the boss itself was fought.
 * The cap keeps a short route from being handed a whole fresh run at the throw
 * a long one barely notices.
 *
 * This distance is load-bearing and has no margin in it: the two titans the
 * Devourer leaves are worth thirty lives between them at full health, more
 * than any difficulty has, and are only survivable because the road they are
 * thrown back up is enough to kill them in. Shortening a route, weakening the
 * late towers or cutting these numbers reopens a last wave that cannot be won.
 */
export const SPLIT_THROW = { base: 1.5, perSize: 5, most: 0.22 };

/**
 * What a kill is worth, against the reward on the cube. Cubes pay for
 * themselves less than they once did, so a Mint is worth the ground it
 * stands on.
 */
export const KILL_REWARD = 0.7;

// Difficulty scales enemy health and rewards and sets the starting purse, the
// lives, and how many of the fifteen towers may be brought to a run. No
// difficulty gives lives back on its own any more: a life is bought back by a
// mint underwriting the run. Easy is the baseline the waves were tuned on.
//
// `upkeep` is what an upgrade costs against its listed price. Building is the
// same price everywhere, a tower is a tower, but climbing one costs a fifth
// less on easy and a third more on hard, so the difference shows up in how deep
// a board can be taken rather than in how wide it is. Hard gets a little of that
// back in the purse and in what a cube pays, because the point of it is being
// made to choose which tower gets the money, not being too poor to have one.
//
// The second half of each entry is the shape of its campaign rather than a
// multiplier on it, and every one of them was a constant until now:
//
//   mutate  when a cube can first walk in changed, how fast that climbs and
//           how far it goes, `from` is the first wave, `per` the step a wave,
//           `cap` the ceiling.
//   gates   scales every mutation's own `from`, so a difficulty can meet the
//           whole roster sooner or later than the list says.
//   thin    how much of the late-wave thinning applies, from 1 for all of it to
//           0 for none. The thinning is a mercy: it is what keeps wave 45 a
//           handful of fat cubes instead of a column of them.
//   leak    what is left of a wave's clear bonus once something got through.
//   wane    how far what a kill pays falls away over a campaign, and the floor
//           it stops at. A wave pays for the board that answers it, so late
//           gold arrives faster than there is anything worth spending it on:
//           a hard run reached wave 44 with fifty thousand it had no use for.
//           Waning it keeps a purse a thing being spent rather than counted.
//   lean    how far the mutation pool leans toward what punishes a board and
//           away from what pays for being killed. Every mutation raises what a
//           cube is worth, a changed cube pays two and a half times a plain
//           one on easy, so meeting more of them is income as well as trouble.
//   bite    how hard a cube's trick against the board lands: how long a bomber
//           or a charged cube knocks a tower out for, and how much a molten one
//           slows what it walks past. It is the one kind of pressure a purse
//           cannot answer, a stunned tower is stunned however rich you are,
//           and changed cubes grow commoner every wave, so it is felt more and
//           more as a campaign goes on.
//   climb   how fast the health curve rises, against easy's. `hp` decides where
//           a campaign starts and this decides how steeply it goes; a
//           difficulty that only moves `hp` is flat, and lands its weight on
//           the waves a board is least able to answer.
//   refund  the share of a tower's cost that selling hands back.
//   finale  the mutation the last boss of the campaign walks in wearing.
//   hidden  the wave the first unseen chaff walks in; courser, the wave the
//           first pack of Coursers heads a rush. Ruin pulls both into the
//           opening, so a kit needs eyes from the start.
//
// The last three are structure rather than numbers, and only Ruin sets them:
//
//   stand   the most towers a run may have standing at once, whatever their
//           kind. Cells, not gold, are the lever that sinks a good kit.
//   mints   how many mints may stand; none, on Ruin, so nothing underwrites
//           the run and no life is ever bought back.
//   roll    the last boss walks in on a road drawn at random rather than the
//           next in turn, so the finale cannot be met with three boulders
//           on a road worked out in advance.
//   settle  the level's own scale on the settling-in sum the clear bonus pays
//           over the opening waves; 1 where it is not set.
export const DIFFICULTIES = {
  easy: {
    name: "Easy", note: "Soft cubes, cheap upgrades, a deep purse, twenty-five lives, ten towers",
    hp: 0.75, reward: 1.25, gold: 240, lives: 25, slots: 10, upkeep: 0.8,
    mutate: { from: 12, per: 0.014, cap: 0.4 }, gates: 1, thin: 1, climb: 1, bite: 1, lean: 0, wane: null, leak: 0.5, refund: 0.7, finale: "chrome", hidden: 15, courser: 28,
  },
  // Normal sits between the two rather than beside easy: mutation a couple of
  // waves sooner and half again as likely by the end, the roster met a little
  // earlier, a quarter of the late-wave mercy given up, and a leak and a sale
  // that both cost more than easy and less than hard.
  normal: {
    name: "Normal", note: "A steeper climb, changed cubes from wave ten, upgrades at list price, twenty lives, nine towers",
    hp: 0.9, reward: 1.15, gold: 210, lives: 20, slots: 9, upkeep: 1,
    mutate: { from: 10, per: 0.0145, cap: 0.52 }, gates: 0.8, thin: 0.75, climb: 1.1, bite: 1.2, lean: 0.6, wane: { per: 0.012, floor: 0.46 }, leak: 0.3, refund: 0.5, finale: "gilded", hidden: 15, courser: 28,
  },
  // Hard is not easy with more health on the cubes. It is the campaign the
  // roster was written for: mutation from wave seven rather than wave twelve and
  // climbing to two cubes in three, every kind of it met while there is still a
  // run left to play, half the late-wave mercy so the end is long as well as
  // heavy, a leak that costs the whole wave's bonus, and a refund thin enough
  // that a tower put down in the wrong place mostly stays there.
  hard: {
    name: "Hard", note: "A campaign that keeps getting steeper, changed cubes from wave seven that knock towers out for longer, cubes worth less the later they walk in, dear upgrades, twelve lives, seven towers",
    hp: 1.1, reward: 1.1, gold: 190, lives: 12, slots: 7, upkeep: 1.35,
    mutate: { from: 7, per: 0.015, cap: 0.65 }, gates: 0.6, thin: 0.5, climb: 1.3, bite: 1.6, lean: 1.4, wane: { per: 0.018, floor: 0.36 }, leak: 0, refund: 0.35, finale: "ascendant", hidden: 15, courser: 28,
  },
  // Ruin is hard's campaign, cube for cube and number for number, and harder
  // only in what it takes away. Past hard the numbers stop being the lever:
  // a steeper climb makes the last boss unkillable for any ordinary board and
  // more gold buys nothing once a board is full, so a fourth level built out
  // of multipliers is not harder, it is over. What sinks a good kit, measured,
  // is cells, sight and choice. Five towers to bring and fourteen to stand,
  // no mint, unseen cubes from the eighth wave and Coursers heading the very
  // first rush, eight lives, and a last boss whose road is drawn rather than
  // dealt. Having no mint, its opening is paid for by a deeper settling-in
  // sum: two and a half times the others'. Measured, a scripted player with
  // exactly the right five towers finishes one campaign in ten, on three
  // lives or so, and an ordinary kit reaches the forties and never finishes;
  // built out and maxed, fourteen towers finish it only when two or more are
  // fed prisms. That is what it is for. #Pain on Ruin nobody finishes.
  ruin: {
    name: "Ruin", note: "Hard's campaign with five towers, fourteen of them standing at most, no mint, unseen cubes from wave eight, and eight lives",
    hp: 1.1, reward: 1.1, gold: 190, lives: 8, slots: 5, upkeep: 1.35,
    mutate: { from: 7, per: 0.015, cap: 0.65 }, gates: 0.6, thin: 0.5, climb: 1.3, bite: 1.6, lean: 1.4, wane: { per: 0.018, floor: 0.36 }, leak: 0, refund: 0.35, finale: "ascendant", hidden: 8, courser: 14,
    stand: 14, mints: 0, roll: true, settle: 2.5,
  },
};

/** The difficulty an argument names, whatever it is: a key, a level, or nothing. */
export function shapeOf(difficulty) {
  if (difficulty && typeof difficulty === "object") return difficulty;
  return DIFFICULTIES[difficulty] || DIFFICULTIES.easy;
}

/**
 * The sandbox, laid over a difficulty: that difficulty's cubes and waves, but
 * nothing costs and nothing is lost, every tower comes along and the wave can
 * be jumped to. No best is kept for it.
 */
export const SANDBOX_NOTE = "Every tower, free to build, nothing lost, any wave; no best kept";
export function levelOf(difficulty, sandbox) {
  const level = DIFFICULTIES[difficulty] || DIFFICULTIES.easy;
  return sandbox ? { ...level, name: level.name + " sandbox", gold: 0, slots: 99, free: true } : level;
}

/**
 * Health multiplier for wave n: linear early, steepening from wave 20, steeper
 * again past the campaign. `climb` is the difficulty's own scale on how fast
 * that rises, not on where it starts, which is what `hp` is for. A difficulty
 * that only raises `hp` is the same campaign times a constant: hardest on wave
 * one, where the board is a tower and a half, and no harder than it ever was by
 * the time the board is finished.
 */
export function hpScale(n, difficulty) {
  const climb = shapeOf(difficulty).climb || 1;
  const linear = n <= CAMPAIGN_WAVES
    ? 1 + 0.13 * climb * (n - 1)
    : 1 + 0.13 * climb * (CAMPAIGN_WAVES - 1) + 0.32 * climb * (n - CAMPAIGN_WAVES);
  return linear * (1 + 0.028 * climb * Math.max(0, n - 20));
}

/**
 * The longest a wave may take to send, in seconds. Sending the cubes, not
 * fighting them, is where nearly all of a wave's time went: at wave fifty the
 * schedule alone ran 52 seconds of a 75 second wave. A wave is meant to be a
 * dangerous few seconds rather than a parade, so the schedule is squeezed hard
 * to fit, and the cubes arrive in a thick column instead of a queue.
 */
function maxSpan(n) {
  return Math.min(34, 15 + n * 0.4);
}

/** Squeeze a spawn list into its wave's span. */
function compress(list, n) {
  const span = list.length ? list[list.length - 1].at : 0;
  const cap = maxSpan(n);
  if (span > cap) { const k = cap / span; for (const s of list) s.at *= k; }
  return list;
}

/**
 * The spawn list for wave n: [{ type, at, mut? }] with `at` seconds from the
 * start. `difficulty` only matters for the last wave of the campaign, whose
 * final boss walks in mutated to suit it.
 */
export function composeWave(n, difficulty) {
  const shape = shapeOf(difficulty);
  // How much of the late-wave thinning this difficulty is spared.
  const mercy = shape.thin === undefined ? 1 : shape.thin;
  // When the unseen first walk in: the chaff, and the Coursers heading a rush.
  const hiddenFrom = shape.hidden === undefined ? 15 : shape.hidden;
  const courserFrom = shape.courser === undefined ? 28 : shape.courser;
  const list = [];
  let t = 0;
  const gap = Math.max(0.22, 0.8 - n * 0.013);
  const push = (type, count, spacing = gap) => {
    for (let i = 0; i < count; i++) { list.push({ type, at: t }); t += spacing; }
    if (count > 0) t += 0.5;
  };
  // Each kind grows to a cap and no further, and past the middle of the
  // campaign the column is thinned as well as capped: late waves get harder
  // through the health curve, not through an ever longer queue. The bosses at
  // the end of a wave are counted out by hand and are never thinned.
  const grow = (from, per, start, cap = 10) => {
    if (n < from) return 0;
    const raw = Math.min(cap, start + (n - from) * per);
    const late = n <= 35 ? 1 : 1 - (1 - Math.max(0.62, 1 - (n - 35) * 0.026)) * mercy;
    return Math.max(1, Math.round(raw * late));
  };
  // Weak cubes thin out as the campaign goes on: past the middle the threat is
  // a handful of tough shapes, not a hundred runners.
  const chaff = (count) => Math.max(2, Math.round(count * (1 - (1 - Math.max(0.22, 1 - Math.max(0, n - 14) * 0.035)) * mercy)));

  // Every seventh wave from 14 is a rush: nothing but the quick cubes, packed
  // close. It is over fast, but a tower that cannot turn will miss all of it.
  if (n >= 14 && n % 7 === 0) {
    push("fast", 16 + Math.round(n * 0.7), gap * 0.28);
    push("swarm", 18 + Math.round(n * 0.8), gap * 0.2);
    push("fast", 10 + Math.round(n * 0.5), gap * 0.26);
    if (n >= 21) push("wraith", grow(21, 0.45, 4, 16), gap * 0.5);
    // Counted out by hand, like every other boss: a rush is no reason to thin
    // them. They come as a pack and close together, one at a time is a boss a
    // single tower picks off, and three arriving at once is the rush.
    if (n >= courserFrom) push("courser", 3 + Math.floor((n - courserFrom) / 7), gap * 0.9);
    if (n >= 28) push("charger", grow(28, 0.4, 4, 12), gap * 0.6);
    if (n >= 36) push("blink", grow(36, 0.35, 3, 10), gap * 0.7);
    return compress(list, n);
  }
  // Every eleventh from 22 is a siege: the armoured column, and nothing light.
  if (n >= 22 && n % 11 === 0) {
    push("armoured", grow(22, 0.5, 8, 20) - (n >= 33 ? grow(33, 0.2, 2, 5) : 0), gap * 1.1);
    push("tank", grow(22, 0.35, 3, 12), gap * 1.6);
    push("juggernaut", grow(22, 0.2, 1, 6), 2.4);
    if (n >= 33) push("revenant", grow(33, 0.25, 2, 6), gap * 1.4);
    if (n >= 44) push("hydra", grow(44, 0.3, 3, 6), gap * 1.3);
    if (n >= 33) push("geode", grow(33, 0.2, 2, 5), gap * 1.2);
    push("titan", 1 + Math.floor((n - 22) / 22), 3.5);
    return compress(list, n);
  }

  push("basic", chaff(6 + n * 1.1));
  if (n >= 3) push("fast", grow(3, 0.8, 3, 12), gap * 0.5);
  if (n >= 4) push("swarm", chaff(8 + n * 1.3), gap * 0.3);
  // From 19 part of the armoured column comes shelled instead, so a wave is a
  // different problem rather than a longer one.
  if (n >= 6) push("armoured", grow(6, 0.55, 2, 10) - (n >= 19 ? grow(19, 0.2, 1, 5) : 0), gap * 1.2);
  // Hidden cubes wait until the towers that can see them are within reach.
  if (n >= hiddenFrom) push("hidden", grow(hiddenFrom, 0.6, 2, 10), gap * 0.8);
  if (n >= 8) push("shield", grow(8, 0.45, 2, 9) - (n >= 19 ? grow(19, 0.15, 1, 4) : 0), gap * 1.1);
  if (n >= 9) push("tank", grow(9, 0.4, 1, 7), gap * 1.6);
  if (n >= 19) push("geode", grow(19, 0.28, 2, 7), gap * 1.3);
  if (n >= 10) { push("basic", chaff(4), gap * 0.8); push("medic", grow(10, 0.26, 1, 5), gap); }
  if (n >= 11) push("charger", grow(11, 0.45, 2, 9), gap);
  if (n >= 12) push("splitter", grow(12, 0.4, 2, 8), gap * 1.1);
  if (n >= 13 && (n - 13) % 4 === 0) push("juggernaut", 1 + Math.floor((n - 13) / 9), 2.4);
  if (n >= 14) push("phase", grow(14, 0.5, 3, 10), gap * 0.7);
  if (n >= 16) push("warden", grow(16, 0.22, 1, 4), gap * 1.4);
  if (n >= 18) push("bomber", grow(18, 0.35, 2, 7), gap);
  if (n >= 20) push("regen", grow(20, 0.28, 1, 5), gap * 1.5);
  if (n >= 22) push("wraith", grow(22, 0.45, 2, 9), gap * 0.6);
  if (n >= 24) push("necromancer", grow(24, 0.18, 1, 3), gap * 2);
  if (n >= 26) push("tank", grow(26, 0.3, 2, 6), gap * 1.7);
  if (n >= 32) push("hydra", grow(32, 0.3, 2, 6), gap * 1.3);
  if (n >= 36) push("blink", grow(36, 0.4, 2, 7), gap * 0.8);
  if (n >= 40) push("aegis", grow(40, 0.2, 1, 3), gap * 1.6);
  if (n >= 44) push("revenant", grow(44, 0.28, 2, 4), gap * 1.3);
  // Every fifth wave from 10 ends on a boss: the Hauler first, the Titan from
  // 15, the Colossus every tenth from 30, and the Devourer from 50. The
  // Broodmother comes on the fives that are not tens, from 25, and brings a
  // second wave of its own with it when it falls.
  if (n % 5 === 0 && n >= 10) {
    if (n >= 50 && n % 10 === 0) { push("devourer", 1 + Math.floor((n - 50) / 20), 5); push("colossus", 1 + Math.floor((n - 50) / 10), 4); }
    else if (n >= 30 && n % 10 === 0) { push("titan", 1 + Math.floor((n - 30) / 10), 3); push("colossus", 1 + Math.floor((n - 30) / 20), 4.5); }
    else if (n >= 15) push("titan", 1 + Math.floor((n - 15) / 10), 3.5);
    else push("boss", 1 + Math.floor((n - 5) / 10), 2.5);
    if (n >= 25 && n % 10 !== 0) push("brood", 1 + Math.floor((n - 25) / 30), 4);
  }
  // The last wave of the campaign ends on its final boss: the Devourer, in the
  // mutation the difficulty calls for, walking in last.
  if (n === CAMPAIGN_WAVES) {
    // It takes the place of the plain Devourer the tens would have sent.
    for (let i = list.length - 1; i >= 0; i--) if (list[i].type === "devourer") list.splice(i, 1);
    t += 2;
    list.push({ type: "devourer", at: t, mut: shape.finale || DIFFICULTIES.easy.finale, finale: true });
  }
  return compress(list, n);
}

/**
 * What a kill on wave n pays, against the listed reward. Clearing a wave is not
 * waned with it: a run that is struggling kills less and so earns less already,
 * and the bonus for holding a wave is the part of a purse it can still count on.
 */
export function killPay(n, difficulty) {
  const wane = shapeOf(difficulty).wane;
  if (!wane) return 1;
  return Math.max(wane.floor, 1 - wane.per * (n - 1));
}

/**
 * Gold for clearing wave n; what a leak leaves of it is the difficulty's to say.
 *
 * A payment that grows with the wave, plus a settling-in bonus over the
 * opening waves. Kill gold is a share of what walks in, so it is worth
 * almost nothing while the waves are small and a fortune once they are
 * enormous, which is backwards. The run is decided in the teens, where the
 * cubes first outgrow a board bought out of wave-one runners, and by wave
 * thirty the same gold is a rounding error. The bonus is all but gone by
 * wave twenty, so it pays for the opening without flooding the end.
 */
export function clearBonus(n, leaked, difficulty) {
  // `settle` is a level's own scale on the settling-in sum: a level that sells
  // no mint has nothing else paying for its opening.
  const settle = shapeOf(difficulty).settle === undefined ? 1 : shapeOf(difficulty).settle;
  const base = 11 + n * 2 + Math.round(250 * settle * Math.exp(-(n - 1) / 11));
  const left = shapeOf(difficulty).leak;
  return leaked ? Math.floor(base * (left === undefined ? 0.5 : left)) : base;
}
