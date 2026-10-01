// Sixteen towers, each with two upgrade paths of four steps. Like the BTD
// activities, one path can be taken all the way while the other stops at two.
// `base` is what you buy; each upgrade's `apply` rewrites the stats.
//
// Stat meanings. Ranges are in cells, rates in shots per second, damage per
// hit. splash: blast radius. slow/slowFor: fraction and seconds. beam: damage
// is per second and pours in constantly, heating toward double; beams: how
// many targets at once; heatRate: how fast it heats; through: the beam also
// cuts everything along its line. chain: hits jump to that many more enemies
// nearby; chainKeep: damage kept per jump; stun: seconds a struck enemy
// stands still; daze: a chance each strike leaves it confused, making no
// ground at all for a while; knockback: cells a struck cube is shoved back,
// falling away sharply with size and ignored by bosses. guns: how many
// barrels, each turning to its own target; the rate is shared between them.
// minRange: cannot hit anything nearer. lobs: fires over props rather than
// needing a clear line to its target, which every other tower does. pierce: armour is ignored; shred:
// that share of armour is ignored. passes: a shot that lands flies on the way
// it was going and strikes that many more cubes in its path. range
// Infinity: the whole map. cone: damage per second to all in
// a cone toward the target, hidden or not; coneCos: how wide (lower is
// wider, -1 is all round). burn/burnFor: damage per second and duration kept
// after the fire moves on; Frost puts it out. brittle: extra damage taken
// while slowed by this tower. detect: can aim at hidden enemies. stream:
// a beam drawn as a stream of light shards. yield: gold paid at the end of
// every wave, with interest paying that share of the purse on top, capped at
// interestCap. bounty: the share it adds to every kill anywhere on the board,
// and only the best mint standing takes it. mend: buys a life
// back every so many waves cleared, and only the best policy on the board pays. A tower with no
// damage never fires. sacrifice: buying the step
// absorbs every other tower within `radius` cells, their gold becoming
// the tower's power (up to `cap`): more damage, more streams, more reach.
// boost: a beacon lifts every other tower within `range` cells by that share
// of its damage and rate, and by `reach` cells of range; beacons add up, to a
// limit. mire: everything inside `range` is slowed by `slow`, takes `brittle`
// more damage and `damage` a second, and nothing needs aiming at. poison /
// poisonFor: damage a second left behind by a hit and how long it lasts; it
// ignores armour and frost does not put it out. spread: a poisoned cube
// passes it on within that many cells when it dies. heavy: damage added equal
// to that share of whatever it hits, at full health. mine: lobs mines onto
// the road within range, `most` of them at a time and one every `every`
// seconds, each waiting until something walks onto it and then taking
// `damage` off everything within `splash` cells. pull: drags every cube within
// `range` along the road toward the point nearest the tower at `speed` cells
// a second, falling away with weight as knockback does, and holds them there
// while it can; `crush` is damage a second to each held cube for every other
// cube pressed up against it.
/**
 * A Prism holding at least this much absorbed power burns through anything a
 * cube would otherwise shrug off. It is the one answer to the late bosses'
 * immunities, and it costs a corner of the board to reach.
 */
export const PIERCE_RESIST_POWER = 6000;

/**
 * The most towers any difficulty lets a run bring. Each difficulty says how
 * many it actually allows, and none allows more than this. Leaving the rest
 * behind is the point: a board built out of these ten is a different board
 * from one built out of another ten.
 */
export const LOADOUT = 10;
/**
 * The most of any one kind of tower a run may stand at once. A kind can set
 * its own, lower: mints, which would otherwise be bought in rows and pay for
 * everything else.
 */
export const MOST_OF_A_KIND = 10;
/** How many of `kind` may stand at once. */
export const mostOf = (kind) => (TOWERS[kind] && TOWERS[kind].most) || MOST_OF_A_KIND;

/**
 * Presets: named racks to load in one go. Default is the only one built in
 * and cannot be removed; anything the player saves sits after it. A preset is
 * trimmed to the difficulty's allowance when it is loaded.
 */
export const PRESETS = [
  { name: "Default", kinds: ["bolt", "cannon", "frost", "venom", "arc", "mortar", "sniper", "flame", "mint", "prism"] },
];

/** The ten a run starts you with, one of every job on the board. */
export const DEFAULT_LOADOUT = PRESETS[0].kinds;

export const MAX_TIER = 4;
export const CROSS_CAP = 2;

const mul = (k, f) => (s) => { s[k] *= f; };
// The two towers that work on an area of their own carry a small object of
// numbers rather than flat stats, so their steps add into a copy of it.
const into = (key) => (o) => (s) => { s[key] = { ...s[key] }; for (const [k, v] of Object.entries(o)) s[key][k] = (s[key][k] || 0) + v; };
// The same for multiplying. Both cope with the object not being there yet:
// an upgrade is run against a bare object to ask what it sets, both by the
// guide and by the tower that buys it, so reaching into what it has not got
// is how a step takes the whole page down with it.
const times = (key) => (o) => (s) => { s[key] = { ...s[key] }; for (const [k, f] of Object.entries(o)) s[key][k] = (s[key][k] || 0) * f; };
const boost = into("boost");
const mire = into("mire");
const mine = into("mine");
const pull = into("pull");
const urn = into("urn");
const boulder = into("boulder");
const hush = into("hush");
const rift = into("rift");
const add = (k, v) => (s) => { s[k] = (s[k] || 0) + v; };
const set = (o) => (s) => { Object.assign(s, o); };
const all = (...fns) => (s) => { for (const f of fns) f(s); };

export const TOWERS = {
  bolt: {
    name: "Bolt", shape: "square", colour: "#ff9783", cost: 40,
    blurb: "Quick single shots. Cheap, reliable, weak against armour.",
    base: { damage: 5, rate: 4, range: 2.5 },
    paths: [
      { name: "Marksman", upgrades: [
        { name: "Sharper bolts", cost: 45, blurb: "+3 damage.", apply: add("damage", 3) },
        { name: "Long barrel", cost: 70, blurb: "+0.6 range.", apply: add("range", 0.6) },
        { name: "Piercing bolts", cost: 130, blurb: "Ignores armour, +6 damage, and each bolt flies on through one more cube.", apply: all(set({ pierce: true, passes: 1 }), add("damage", 6)) },
        { name: "Deadeye", cost: 260, blurb: "Double damage, sees hidden.", apply: all(mul("damage", 2), set({ detect: true })) },
      ] },
      { name: "Rapid fire", upgrades: [
        { name: "Quick loader", cost: 40, blurb: "+1.5 shots a second.", apply: add("rate", 1.5) },
        { name: "Twin bolts", cost: 80, blurb: "+2 shots a second, from two barrels that aim on their own.", apply: all(add("rate", 2), set({ guns: 2 })) },
        { name: "Overclock", cost: 150, blurb: "Rate times 1.5, +2 damage.", apply: all(mul("rate", 1.5), add("damage", 2)) },
        { name: "Gatling", cost: 280, blurb: "Rate times 1.6, +4 damage, a third barrel, and armour counts for half.", apply: all(mul("rate", 1.6), add("damage", 4), set({ guns: 3, shred: 0.5 })) },
      ] },
    ],
  },
  cannon: {
    name: "Cannon", shape: "circle", colour: "#ff563c", cost: 80,
    blurb: "Slow, heavy hits that punch through armour.",
    base: { damage: 30, rate: 0.6, range: 2.8 },
    paths: [
      { name: "Heavy shells", upgrades: [
        { name: "Bigger shells", cost: 90, blurb: "+15 damage.", apply: add("damage", 15) },
        { name: "Knockback", cost: 140, blurb: "Shoves cubes back down the road; bosses stand firm.", apply: set({ knockback: 0.8 }) },
        { name: "Blast shells", cost: 230, blurb: "Shells burst in a 1.2 cell blast, +20 damage.", apply: all(set({ splash: 1.2 }), add("damage", 20)) },
        { name: "Bunker buster", cost: 380, blurb: "Double damage.", apply: mul("damage", 2) },
      ] },
      { name: "Rapid fire", upgrades: [
        { name: "Faster reload", cost: 70, blurb: "+0.2 shots a second.", apply: add("rate", 0.2) },
        { name: "Spotter", cost: 100, blurb: "+0.6 range.", apply: add("range", 0.6) },
        { name: "Auto-loader", cost: 200, blurb: "+0.35 shots a second, +0.4 range.", apply: all(add("rate", 0.35), add("range", 0.4)) },
        { name: "Twin cannon", cost: 360, blurb: "Rate times 1.6, from two barrels that aim on their own.", apply: all(mul("rate", 1.6), set({ guns: 2 })) },
      ] },
    ],
  },
  burst: {
    name: "Burst", shape: "diamond", colour: "#ffc4b8", cost: 90,
    blurb: "Hits everything near the target. Best against crowds.",
    base: { damage: 10, rate: 1.2, range: 2.5, splash: 1 },
    paths: [
      { name: "Bigger blast", upgrades: [
        { name: "Bigger burst", cost: 100, blurb: "+0.3 blast radius.", apply: add("splash", 0.3) },
        { name: "Heavier burst", cost: 150, blurb: "+0.3 radius, +5 damage.", apply: all(add("splash", 0.3), add("damage", 5)) },
        { name: "Shockwave", cost: 240, blurb: "+0.5 radius; the blast slows for a second.", apply: all(add("splash", 0.5), set({ slow: 0.3, slowFor: 1 })) },
        { name: "Cataclysm", cost: 400, blurb: "Double damage, +0.5 radius.", apply: all(mul("damage", 2), add("splash", 0.5)) },
      ] },
      { name: "Rapid fire", upgrades: [
        { name: "Quick fuse", cost: 80, blurb: "+0.4 shots a second.", apply: add("rate", 0.4) },
        { name: "Double fuse", cost: 130, blurb: "+0.5 shots a second.", apply: add("rate", 0.5) },
        { name: "Keen eye", cost: 200, blurb: "+0.5 range, sees hidden.", apply: all(add("range", 0.5), set({ detect: true })) },
        { name: "Storm", cost: 340, blurb: "Rate times 1.6.", apply: mul("rate", 1.6) },
      ] },
    ],
  },
  frost: {
    name: "Frost", shape: "hex", colour: "#d7d3d3", cost: 60,
    blurb: "Barely hurts, but slows whatever it touches and puts out fire. Bosses feel half of it, 35% at most, and break free if kept slow.",
    base: { damage: 2, rate: 2, range: 2.5, slow: 0.4, slowFor: 1.5 },
    paths: [
      { name: "Deep freeze", upgrades: [
        { name: "Colder", cost: 60, blurb: "Slows 10% more.", apply: add("slow", 0.1) },
        { name: "Lasting chill", cost: 90, blurb: "Slow lasts a second longer.", apply: add("slowFor", 1) },
        { name: "Brittle", cost: 180, blurb: "Slowed enemies take 25% more damage from anything.", apply: set({ brittle: 0.25 }) },
        { name: "Absolute zero", cost: 320, blurb: "Slows 85% for three seconds.", apply: set({ slow: 0.85, slowFor: 3 }) },
      ] },
      { name: "Wide chill", upgrades: [
        { name: "Longer reach", cost: 60, blurb: "+0.5 range.", apply: add("range", 0.5) },
        { name: "Chill burst", cost: 120, blurb: "Hits everything within 0.8 cells of the target.", apply: set({ splash: 0.8 }) },
        { name: "Quick spray", cost: 170, blurb: "+1 shot a second.", apply: add("rate", 1) },
        { name: "Blizzard", cost: 300, blurb: "+0.6 blast radius, sees hidden.", apply: all(add("splash", 0.6), set({ detect: true })) },
      ] },
    ],
  },
  mint: {
    name: "Mint", shape: "square", colour: "#5aa172", cost: 170, most: 3,
    blurb: "Pays out at the end of every wave and takes a cut of every kill on the board, but never fires a shot. Cheap to stand up and dear to grow. However many mints stand, only the best cut and the best dividend on the board count; a mint built during a wave earns nothing when that wave ends.",
    base: { yield: 35, bounty: 0.05 },
    paths: [
      { name: "Bigger yield", upgrades: [
        { name: "Deeper seams", cost: 250, blurb: "+20 gold a wave.", apply: add("yield", 20) },
        { name: "Second shift", cost: 500, blurb: "+30 gold a wave.", apply: add("yield", 30) },
        { name: "Refinery", cost: 950, blurb: "+45 gold a wave.", apply: add("yield", 45) },
        { name: "Motherlode", cost: 1900, blurb: "Two fifths again the yield and the cut.", apply: all(mul("yield", 1.4), mul("bounty", 1.4)) },
      ] },
      { name: "Dividends", upgrades: [
        { name: "Interest", cost: 300, blurb: "Also pays 2% of your gold each wave, up to 25.", apply: set({ interest: 0.02, interestCap: 25 }) },
        { name: "Better terms", cost: 600, blurb: "3% of your gold, up to 45.", apply: set({ interest: 0.03, interestCap: 45 }) },
        { name: "Vault", cost: 1100, blurb: "5% of your gold, up to 70.", apply: set({ interest: 0.05, interestCap: 70 }) },
        { name: "Underwriting", cost: 2200, blurb: "7% of your gold, up to 110, and buys a life back every third wave.", apply: set({ interest: 0.07, interestCap: 110, mend: { every: 3, lives: 1 } }) },
      ] },
    ],
  },
  beacon: {
    name: "Beacon", shape: "hex", colour: "#b8c4d8", cost: 140,
    blurb: "Fires nothing itself. Every other tower within its reach hits harder and faster. A second beacon over the same tower counts for half of what the best one gives it, a third for a quarter, and no tower is lifted past half again its damage.",
    base: { boost: { range: 2.2, damage: 0.08, rate: 0.08, reach: 0 } },
    paths: [
      { name: "Amplifier", upgrades: [
        { name: "Louder", cost: 120, blurb: "+5% damage to everything it reaches.", apply: boost({ damage: 0.05 }) },
        { name: "Wider signal", cost: 200, blurb: "Reaches 0.8 cells further.", apply: boost({ range: 0.8 }) },
        { name: "Harmonics", cost: 340, blurb: "+8% damage.", apply: boost({ damage: 0.08 }) },
        { name: "Resonance", cost: 620, blurb: "+12% damage and 0.6 cells more reach.", apply: boost({ damage: 0.12, range: 0.6 }) },
      ] },
      { name: "Metronome", upgrades: [
        { name: "Faster beat", cost: 130, blurb: "+8% rate to everything it reaches.", apply: boost({ rate: 0.08 }) },
        { name: "Spotting", cost: 220, blurb: "+0.5 range to everything it reaches.", apply: boost({ reach: 0.5 }) },
        { name: "Drumfire", cost: 360, blurb: "+12% rate.", apply: boost({ rate: 0.12 }) },
        { name: "Overdrive", cost: 640, blurb: "+15% rate and +0.5 range.", apply: boost({ rate: 0.15, reach: 0.5 }) },
      ] },
    ],
  },
  tar: {
    name: "Tar pit", shape: "square", colour: "#5e4a3c", cost: 70,
    blurb: "Fires nothing and kills nothing on its own. Everything that walks near it wades, and no amount of walking shakes it off, though a cube frozen through already is unbothered. A boss wades at half the slow and tears loose after a few seconds in it.",
    base: { mire: { range: 2, slow: 0.3, brittle: 0, damage: 0 } },
    paths: [
      { name: "Thicker tar", upgrades: [
        { name: "Deeper", cost: 90, blurb: "Slows 10% more.", apply: mire({ slow: 0.1 }) },
        { name: "Wider", cost: 160, blurb: "+0.8 cells.", apply: mire({ range: 0.8 }) },
        { name: "Sucking", cost: 280, blurb: "Slows 10% more.", apply: mire({ slow: 0.1 }) },
        { name: "Quagmire", cost: 480, blurb: "Slows 15% more, +0.6 cells.", apply: mire({ slow: 0.15 }) },
      ] },
      { name: "Corrosive", upgrades: [
        { name: "Acrid", cost: 120, blurb: "Whatever is wading takes 20% more damage.", apply: mire({ brittle: 0.2 }) },
        { name: "Caustic", cost: 210, blurb: "5 damage a second to everything in it.", apply: mire({ damage: 5 }) },
        { name: "Etching", cost: 350, blurb: "15% more damage taken, 5 more a second.", apply: mire({ brittle: 0.15, damage: 5 }) },
        { name: "Solvent", cost: 600, blurb: "25% more damage taken, 15 more a second.", apply: mire({ brittle: 0.25, damage: 15 }) },
      ] },
    ],
  },
  sapper: {
    name: "Sapper", shape: "square", colour: "#9c8654", cost: 120,
    blurb: "Lobs mines onto the road and waits. A mine lies there until something steps on it, then takes out whatever is around it, towers included: anything but the sapper itself is knocked out for a moment. The charges do not keep either, and anything left when a wave ends fizzles out.",
    base: { range: 3, mine: { damage: 42, splash: 0.9, every: 3.2, most: 3 } },
    paths: [
      { name: "Heavier charges", upgrades: [
        { name: "More powder", cost: 110, blurb: "+30 damage a mine.", apply: mine({ damage: 30 }) },
        { name: "Shrapnel", cost: 190, blurb: "+0.4 cells of blast.", apply: mine({ splash: 0.4 }) },
        { name: "Shaped charge", cost: 320, blurb: "+75 damage a mine.", apply: mine({ damage: 75 }) },
        { name: "Demolition", cost: 560, blurb: "Double the damage, +0.3 blast.", apply: all(times("mine")({ damage: 2 }), mine({ splash: 0.3 })) },
      ] },
      { name: "Deep pockets", upgrades: [
        { name: "Bigger satchel", cost: 100, blurb: "One more mine on the road at a time.", apply: mine({ most: 1 }) },
        { name: "Forward observer", cost: 170, blurb: "Each mine goes where the next cube is about to step, not just wherever is emptiest.", apply: mine({ smart: 1 }) },
        { name: "Long fuses", cost: 300, blurb: "Mines keep between waves instead of fizzling, +0.7 range.", apply: all(mine({ keep: 1 }), add("range", 0.7)) },
        { name: "Saturation", cost: 520, blurb: "Two more mines, laid 1.8 seconds faster.", apply: all(mine({ most: 2, every: -1.8 })) },
      ] },
    ],
  },
  lodestone: {
    name: "Lodestone", shape: "hex", colour: "#6f6a8a", cost: 130,
    blurb: "Fires nothing. Everything within reach is dragged along the road toward it and bunched there, which is where a mortar or a burst would like them. Nothing is held for good: past the stone a cube loses half its pace at most, a boss a quarter, and heavy cubes barely move at all.",
    base: { pull: { range: 2.1, speed: 1.2, crush: 0 } },
    paths: [
      { name: "Stronger pull", upgrades: [
        { name: "Denser core", cost: 120, blurb: "Pulls 0.4 cells a second harder.", apply: pull({ speed: 0.4 }) },
        { name: "Wider field", cost: 200, blurb: "+0.7 cells of reach.", apply: pull({ range: 0.7 }) },
        { name: "Deep well", cost: 340, blurb: "Pulls 0.6 harder.", apply: pull({ speed: 0.6 }) },
        { name: "Singularity", cost: 600, blurb: "Pulls 0.8 harder, +0.6 reach; even the heaviest cubes give a little.", apply: all(pull({ speed: 0.8, range: 0.6 }), set({ heavyPull: true })) },
      ] },
      { name: "Crush", upgrades: [
        { name: "Grinding", cost: 130, blurb: "Held cubes take 3 damage a second for every other cube pressed against them.", apply: pull({ crush: 3 }) },
        { name: "Pressure", cost: 230, blurb: "5 more a second per neighbour.", apply: pull({ crush: 5 }) },
        { name: "Compaction", cost: 380, blurb: "Held cubes also take 12% more damage from everything.", apply: set({ pullBrittle: 0.12 }) },
        { name: "Implosion", cost: 660, blurb: "12 more a second per neighbour, 22% more damage taken.", apply: all(pull({ crush: 12 }), set({ pullBrittle: 0.22 })) },
      ] },
    ],
  },
  venom: {
    name: "Venom", shape: "circle", colour: "#a8bf3f", cost: 110,
    blurb: "A weak shot that leaves poison behind. The poison ignores armour outright and no amount of frost puts it out, so it is the answer to anything thickly plated.",
    base: { damage: 4, rate: 1.1, range: 2.6, poison: 10, poisonFor: 4 },
    paths: [
      { name: "Stronger toxin", upgrades: [
        { name: "Concentrate", cost: 110, blurb: "+8 poison a second.", apply: add("poison", 8) },
        { name: "Corrosive", cost: 190, blurb: "+12 poison a second.", apply: add("poison", 12) },
        { name: "Necrotic", cost: 320, blurb: "+20 poison a second.", apply: add("poison", 20) },
        { name: "Liquefy", cost: 560, blurb: "Double the poison.", apply: mul("poison", 2) },
      ] },
      { name: "Contagion", upgrades: [
        { name: "Lingering", cost: 100, blurb: "Poison lasts 3 seconds longer.", apply: add("poisonFor", 3) },
        { name: "Spreading", cost: 180, blurb: "A poisoned cube passes it on within 1.2 cells when it dies.", apply: set({ spread: 1.2 }) },
        { name: "Airborne", cost: 300, blurb: "Passes it on within 2 cells, +0.6 range.", apply: all(set({ spread: 2 }), add("range", 0.6)) },
        { name: "Plague", cost: 540, blurb: "Passes it on within 3 cells, sees hidden.", apply: set({ spread: 3, detect: true }) },
      ] },
    ],
  },
  siege: {
    name: "Siege", shape: "diamond", colour: "#c2402c", cost: 220, target: "strong",
    blurb: "One enormous slow shot that takes a share of whatever it hits along with its own weight, ignoring armour, and crushes what stands close by. It barely troubles a runner and tears into anything huge.",
    base: { damage: 95, rate: 0.32, range: 3.2, heavy: 0.02, pierce: true, splash: 0.45 },
    paths: [
      { name: "Heavier charge", upgrades: [
        { name: "Greater mass", cost: 200, blurb: "+60 damage.", apply: add("damage", 60) },
        { name: "Deadweight", cost: 340, blurb: "Takes 3% of what it hits rather than 2%.", apply: set({ heavy: 0.03 }) },
        { name: "Ruin", cost: 520, blurb: "+120 damage, 5% share.", apply: all(add("damage", 120), set({ heavy: 0.05 })) },
        { name: "Cataclysm", cost: 900, blurb: "Double damage, 7% share.", apply: all(mul("damage", 2), set({ heavy: 0.07 })) },
      ] },
      { name: "Faster winch", upgrades: [
        { name: "Better crew", cost: 180, blurb: "+0.1 shots a second.", apply: add("rate", 0.1) },
        { name: "Longer arm", cost: 300, blurb: "+1 range.", apply: add("range", 1) },
        { name: "Counterweight", cost: 460, blurb: "+0.15 shots a second, sees hidden.", apply: all(add("rate", 0.15), set({ detect: true })) },
        { name: "Clockwork", cost: 800, blurb: "Rate times 1.8.", apply: mul("rate", 1.8) },
      ] },
    ],
  },
  arc: {
    name: "Arc", shape: "hex", colour: "#ffd8cc", cost: 120,
    blurb: "Lightning that jumps from the target to enemies near it, weaker with each jump.",
    base: { damage: 16, rate: 1.2, range: 2.6, chain: 3, chainKeep: 0.7 },
    paths: [
      { name: "More jumps", upgrades: [
        { name: "One more jump", cost: 130, blurb: "+1 jump.", apply: add("chain", 1) },
        { name: "Two more jumps", cost: 190, blurb: "+2 jumps.", apply: add("chain", 2) },
        { name: "Conductor", cost: 300, blurb: "Jumps lose no damage.", apply: set({ chainKeep: 1 }) },
        { name: "Storm", cost: 480, blurb: "+4 jumps, damage times 1.5.", apply: all(add("chain", 4), mul("damage", 1.5)) },
      ] },
      { name: "Stronger current", upgrades: [
        { name: "Higher voltage", cost: 120, blurb: "+12 damage.", apply: add("damage", 12) },
        { name: "Disorient", cost: 170, blurb: "35% chance to leave a cube confused, going nowhere for 1.2 seconds.", apply: set({ daze: { chance: 0.35, for: 1.2 } }) },
        { name: "Stun", cost: 260, blurb: "Everything struck stands still for 0.4 seconds.", apply: set({ stun: 0.4 }) },
        { name: "Overload", cost: 440, blurb: "Double damage, sees hidden, disorients 60% of the time.", apply: all(mul("damage", 2), set({ detect: true, daze: { chance: 0.6, for: 1.5 } })) },
      ] },
    ],
  },
  mortar: {
    name: "Mortar", shape: "square", colour: "#e0776a", cost: 130,
    blurb: "Lobs heavy shells a long way with a wide blast, over anything in the way, but cannot hit anything close.",
    base: { damage: 40, rate: 0.4, range: 5, minRange: 2, splash: 1.5, lobs: true },
    paths: [
      { name: "Heavy ordnance", upgrades: [
        { name: "Heavier shells", cost: 140, blurb: "+25 damage.", apply: add("damage", 25) },
        { name: "Wider blast", cost: 210, blurb: "+0.4 blast radius.", apply: add("splash", 0.4) },
        { name: "Incendiary", cost: 320, blurb: "Everything in the blast burns for 2.5 seconds.", apply: set({ burn: 6, burnFor: 2.5 }) },
        { name: "Doomsday", cost: 540, blurb: "Double damage, +0.6 radius.", apply: all(mul("damage", 2), add("splash", 0.6)) },
      ] },
      { name: "Fire control", upgrades: [
        { name: "Closer aim", cost: 120, blurb: "Blind spot shrinks to 1.3 cells.", apply: set({ minRange: 1.3 }) },
        { name: "Concussion", cost: 180, blurb: "Everything in the blast stands stunned for 0.6 seconds.", apply: set({ stun: 0.6 }) },
        { name: "Spotter", cost: 260, blurb: "+1.5 range, sees hidden.", apply: all(add("range", 1.5), set({ detect: true })) },
        { name: "Rapid fire", cost: 420, blurb: "Rate times 1.8, from two tubes that aim on their own.", apply: all(mul("rate", 1.8), set({ guns: 2 })) },
      ] },
    ],
  },
  sniper: {
    name: "Sniper", shape: "diamond", colour: "#ffe9e3", cost: 150,
    blurb: "One enormous shot at a time, straight through armour, at anything it can see anywhere on the map.",
    base: { damage: 90, rate: 0.35, range: Infinity, pierce: true },
    paths: [
      { name: "Stopping power", upgrades: [
        { name: "Heavy round", cost: 160, blurb: "+60 damage.", apply: add("damage", 60) },
        { name: "Heavier round", cost: 240, blurb: "+100 damage.", apply: add("damage", 100) },
        { name: "Shattering round", cost: 380, blurb: "Hits burst 0.6 cells around the target.", apply: set({ splash: 0.6 }) },
        { name: "Cranial", cost: 640, blurb: "Damage times 2.5.", apply: mul("damage", 2.5) },
      ] },
      { name: "Rapid fire", upgrades: [
        { name: "Quick bolt", cost: 150, blurb: "+0.15 shots a second.", apply: add("rate", 0.15) },
        { name: "Night scope", cost: 200, blurb: "Sees hidden.", apply: set({ detect: true }) },
        { name: "Fast hands", cost: 320, blurb: "+0.25 shots a second.", apply: add("rate", 0.25) },
        { name: "Semi-auto", cost: 560, blurb: "Rate times 2.", apply: mul("rate", 2) },
      ] },
    ],
  },
  flame: {
    name: "Flame", shape: "circle", colour: "#ff7a5c", cost: 100,
    blurb: "Sprays a short cone of fire. Whatever it touches keeps burning after it moves on, unless Frost puts it out, and the burning gets under armour.",
    base: { damage: 10, rate: 0, range: 2.4, cone: true, coneCos: 0.8, burn: 4, burnFor: 2.5, melt: true },
    paths: [
      { name: "Hotter fire", upgrades: [
        { name: "Richer fuel", cost: 110, blurb: "+8 damage a second, +3 burn.", apply: all(add("damage", 8), add("burn", 3)) },
        { name: "Sticky fuel", cost: 160, blurb: "+5 burn.", apply: add("burn", 5) },
        { name: "Napalm", cost: 260, blurb: "Burns last five seconds.", apply: set({ burnFor: 5 }) },
        { name: "Inferno", cost: 430, blurb: "Damage times 2.5, double burn, and the spray itself melts through armour.", apply: all(mul("damage", 2.5), mul("burn", 2), set({ pierce: true })) },
      ] },
      { name: "Wider spray", upgrades: [
        { name: "Longer reach", cost: 100, blurb: "+0.6 range.", apply: add("range", 0.6) },
        { name: "Wide nozzle", cost: 150, blurb: "A much wider cone.", apply: set({ coneCos: 0.5 }) },
        { name: "Far throw", cost: 240, blurb: "+0.5 range, sees hidden.", apply: all(add("range", 0.5), set({ detect: true })) },
        { name: "Firestorm", cost: 400, blurb: "Fire all the way round.", apply: set({ coneCos: -1 }) },
      ] },
    ],
  },
  prism: {
    name: "Prism", shape: "diamond", colour: "#fff1ec", cost: 300,
    blurb: "A floating crystal that pours light into its target, straight through armour, heating as it holds one. Its Sacrifice path absorbs the towers around it into raw power, and asks the highest price on the board for the privilege.",
    base: { damage: 26, rate: 0, range: 3.4, beam: true, beams: 1, heatRate: 0.8, stream: true, pierce: true },
    paths: [
      { name: "Sacrifice", upgrades: [
        { name: "Bright shards", cost: 330, blurb: "+14 damage a second.", apply: add("damage", 14) },
        { name: "Wide prism", cost: 420, blurb: "+0.8 range.", apply: add("range", 0.8) },
        { name: "Consecrate", cost: 1500, blurb: "Absorbs towers within 2.5 cells; their gold becomes power, up to 3000.", apply: set({ sacrifice: { radius: 2.5, cap: 3000 } }) },
        { name: "Ascension", cost: 4000, blurb: "Absorbs within 4 cells, up to 12000 power, sees hidden. Past 6000 nothing resists its light.", apply: all(set({ sacrifice: { radius: 4, cap: 12000 }, detect: true }), mul("damage", 1.5)) },
      ] },
      { name: "More streams", upgrades: [
        { name: "Split light", cost: 300, blurb: "Two streams, two targets.", apply: set({ beams: 2 }) },
        { name: "Triple light", cost: 450, blurb: "Three streams, +8 damage a second.", apply: all(set({ beams: 3 }), add("damage", 8)) },
        { name: "Through-light", cost: 650, blurb: "Streams cut everything along their line and see hidden.", apply: set({ through: true, detect: true }) },
        { name: "Prism storm", cost: 1250, blurb: "Six streams, damage times 2.5, heating twice as fast.", apply: all(set({ beams: 6 }), mul("damage", 2.5), mul("heatRate", 2)) },
      ] },
    ],
  },
  urn: {
    name: "Urn", shape: "circle", colour: "#9f8cff", cost: 160,
    blurb: "Fires nothing. Every cube that breaks within reach, whoever broke it, gives its soul to the urn, and bigger cubes give more. Full, it lets them all go in one wail down the road that strikes everything it passes. A necromancer nearby feeds on what it holds.",
    base: { range: 3, urn: { hold: 20, per: 6, span: 5 } },
    paths: [
      { name: "Soulfire", upgrades: [
        { name: "Brighter flame", cost: 110, blurb: "+2 damage a soul.", apply: urn({ per: 2 }) },
        { name: "Wider reach", cost: 180, blurb: "Gathers souls from 1.2 cells further.", apply: add("range", 1.2) },
        { name: "Heavier souls", cost: 300, blurb: "Every cube gives one soul more.", apply: urn({ extra: 1 }) },
        { name: "Requiem", cost: 560, blurb: "Wails twice, the second at 60%, and +2 damage a soul.", apply: urn({ twice: 1, per: 2 }) },
      ] },
      { name: "Wailing", upgrades: [
        { name: "Longer wail", cost: 100, blurb: "The wail runs 3 cells further each way.", apply: urn({ span: 3 }) },
        { name: "Grave chill", cost: 170, blurb: "Cubes it strikes are slowed 35% for 2 seconds.", apply: urn({ slow: 0.35 }) },
        { name: "Restless", cost: 280, blurb: "Lets go at two thirds full, and runs 2 cells further.", apply: urn({ early: 1, span: 2 }) },
        { name: "Banshee", cost: 520, blurb: "Cubes it strikes stop dead for 0.8 seconds, and +2 damage a soul.", apply: urn({ stun: 0.8, per: 2 }) },
      ] },
    ],
  },
  boulder: {
    name: "Boulder", shape: "circle", colour: "#b3a592", cost: 140, most: 3,
    blurb: "Lets a boulder roll the wrong way up the road, gathering pace. Every hit hurts by how fast it rolls and wears it down, and a boss stops it. It sets off any mine it rolls over.",
    base: { range: 1.5, boulder: { every: 7, damage: 45, weight: 110, top: 4.5, run: 12, count: 1 } },
    paths: [
      { name: "Heavier stone", upgrades: [
        { name: "Denser rock", cost: 110, blurb: "+90 weight: it goes through more before it breaks.", apply: boulder({ weight: 90 }) },
        { name: "Granite", cost: 190, blurb: "+100 damage at full pace.", apply: boulder({ damage: 100 }) },
        { name: "Rubble", cost: 320, blurb: "Breaks into rubble that hits everything within a cell for half.", apply: boulder({ burst: 1.1 }) },
        { name: "Landslide", cost: 580, blurb: "Rolls on through bosses at full pace, shoves what it hits back, hits half again as hard and takes 8% of its health, and carries far more weight.", apply: all(boulder({ landslide: 1, share: 0.08 }), times("boulder")({ damage: 1.5, weight: 3 })) },
      ] },
      { name: "Quarry", upgrades: [
        { name: "Quick release", cost: 100, blurb: "Lets one go 1.5 seconds sooner.", apply: boulder({ every: -1.5 }) },
        { name: "Long run", cost: 170, blurb: "Rolls 6 cells further before it crumbles.", apply: boulder({ run: 6 }) },
        { name: "Second stone", cost: 300, blurb: "Two boulders, one after the other.", apply: boulder({ count: 1 }) },
        { name: "Avalanche", cost: 540, blurb: "Three, and a second sooner again.", apply: boulder({ count: 1, every: -1 }) },
      ] },
    ],
  },
  suppressor: {
    name: "Suppressor", shape: "hex", colour: "#8f9bb3", cost: 180,
    blurb: "Inside its field cubes take a little more damage and lose what makes them special: no regenerating, mending, shielding or raising. Its upgrades silence more.",
    base: { range: 2.4, hush: { level: 1, expose: 0.15 } },
    paths: [
      { name: "Wider field", upgrades: [
        { name: "Broad field", cost: 120, blurb: "+0.8 range.", apply: add("range", 0.8) },
        { name: "Anchoring", cost: 220, blurb: "Blinkers cannot skip ahead and revenants do not get up again.", apply: hush({ level: 1 }) },
        { name: "Grounding", cost: 360, blurb: "Phased cubes are dragged back where they can be hit, wardens shield nothing, +0.6 range.", apply: all(hush({ level: 1 }), add("range", 0.6)) },
        { name: "Silence", cost: 640, blurb: "Mutations too: no heat off molten cubes, no knock-out from charged ones, no charging.", apply: hush({ level: 1 }) },
      ] },
      { name: "Unmasking", upgrades: [
        { name: "Unveil", cost: 110, blurb: "Hidden cubes in the field can be seen by every tower.", apply: hush({ reveal: 1 }) },
        { name: "Strip", cost: 200, blurb: "Cubes in the field lose 3 armour.", apply: hush({ strip: 3 }) },
        { name: "Exposed", cost: 340, blurb: "Cubes in the field take 20% more damage.", apply: hush({ expose: 0.2 }) },
        { name: "Null", cost: 600, blurb: "30% more again, and 3 more armour off.", apply: hush({ expose: 0.3, strip: 3 }) },
      ] },
    ],
  },
  rift: {
    name: "Rift", shape: "diamond", colour: "#4fd8ff", cost: 150,
    blurb: "Every so often it tears the road open for a few seconds, and cubes that walk in drop back out upstream to walk that stretch again. Each cube goes through once; bosses barely slip.",
    base: { range: 2.6, rift: { every: 9, back: 10, count: 1, open: 6, most: 30 } },
    paths: [
      { name: "Deeper rift", upgrades: [
        { name: "Longer drop", cost: 120, blurb: "Sends cubes 3 cells further back.", apply: rift({ back: 3 }) },
        { name: "Restless tear", cost: 210, blurb: "Tears 2.5 seconds sooner.", apply: rift({ every: -2.5 }) },
        { name: "Twin tears", cost: 360, blurb: "Opens a second tear at once, further back along the road.", apply: rift({ count: 1 }) },
        { name: "Chasm", cost: 620, blurb: "Further back and sooner, and every third tear is a black hole that swallows ordinary cubes whole.", apply: rift({ back: 3, every: -2.5, open: 1, most: 3, hole: 3 }) },
      ] },
      { name: "Unstable", upgrades: [
        { name: "Disorienting", cost: 110, blurb: "Cubes come out dazed for 2 seconds.", apply: rift({ daze: 2 }) },
        { name: "Tearing", cost: 200, blurb: "The fall costs a cube 12% of its health, a boss 5%.", apply: rift({ tear: 0.12 }) },
        { name: "Mire of time", cost: 330, blurb: "Cubes come out slowed 40% for 2 seconds.", apply: rift({ slow: 0.4 }) },
        { name: "Swap", cost: 580, blurb: "Each tear also swaps the cube furthest along the road with the one furthest back.", apply: rift({ swap: 1 }) },
      ] },
    ],
  },
};

export const SELL_REFUND = 0.7;

/** The stats of a tower with the given path tiers [a, b]. */
export function statsFor(kind, tiers) {
  const spec = TOWERS[kind];
  const s = { ...spec.base };
  spec.paths.forEach((p, i) => { for (let k = 0; k < (tiers[i] || 0); k++) p.upgrades[k].apply(s); });
  return s;
}

/** Whether the next step on `path` is allowed: one path to the top, the other no further than the cap. */
export function canUpgrade(tiers, path) {
  if (tiers[path] >= MAX_TIER) return false;
  const other = tiers[1 - path];
  return other <= CROSS_CAP || tiers[path] < CROSS_CAP;
}

/** The next upgrade on a path, or null if there is none or it is locked. */
export function nextUpgrade(kind, tiers, path) {
  return canUpgrade(tiers, path) ? TOWERS[kind].paths[path].upgrades[tiers[path]] : null;
}

/**
 * What an upgrade costs at a given upkeep, the difficulty's multiplier on
 * every listed upgrade price. Everything that charges for a step up or prints
 * one goes through here, so the shop, the codex and the purse never disagree.
 */
export function upgradePrice(upgrade, upkeep = 1) {
  return Math.round(upgrade.cost * upkeep);
}

/** Everything paid into a tower so far, at the upkeep it was paid at. */
export function spentOn(tower, upkeep = 1) {
  const spec = TOWERS[tower.kind];
  let total = spec.cost;
  spec.paths.forEach((p, i) => { for (let k = 0; k < (tower.tiers[i] || 0); k++) total += upgradePrice(p.upgrades[k], upkeep); });
  return total;
}
