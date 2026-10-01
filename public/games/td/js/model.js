import { routeCells, routesOf, sizeOf, propsFor } from "./layouts.js";
import { TOWERS, SELL_REFUND, spentOn, upgradePrice, statsFor, nextUpgrade, MAX_TIER, CROSS_CAP, PIERCE_RESIST_POWER, mostOf } from "./resources.js";
import { ENEMIES, DIFFICULTIES, KILL_REWARD, SPLIT_THROW, chargeAt, composeWave, hpScale, clearBonus, killPay, CAMPAIGN_WAVES, MUTATIONS, rollMutation, specFor, levelOf } from "./schedule.js";
import { buildPath, pointAt, segmentAt } from "./route.js";

/** Target modes, in the order the card cycles them. */
export const TARGETS = ["first", "last", "strong", "weak"];

/** How far to the side of the head each barrel of a multi-gun tower sits, matching the models. */
export function gunOffset(kind, i, guns) {
  if (guns < 2) return 0;
  if (kind === "cannon") return i === 0 ? -0.1 : 0.1;
  if (kind === "mortar") return i === 0 ? -0.17 : 0.17;
  return 0; // bolt barrels ring the axis closely enough to share a muzzle line
}

/** Seconds an enemy stays alight after the flame moves off it. */
export const BURN_FOR = 2.5;

/** The most any tower can be lifted by the beacons over it, whatever stands. */
export const BEACON_CAP = { damage: 0.45, rate: 0.4, reach: 1.2 };

/** How long a tower is knocked out for on easy, and the floor a baked one keeps. */
export const EMP_BASE = 2, SCORCH_CAP = 0.75;

/**
 * The whole simulation, with no drawing in it. `update(dt)` advances it;
 * the renderer reads the public fields. Events for the page to react to
 * are queued in `events` and drained by whoever reads them.
 */
/** The soonest a rift can tear again, whatever it has bought. */
const RIFT_SOONEST = 8;

/** How quickly a boulder gathers pace, in cells a second, each second. */
const BOULDER_PICKUP = 3;

/** Souls a second a necromancer eats out of an urn it is standing near. */
const SOUL_DRAIN = 3;
/** How far a wail travels each second, in cells along the road. */
const WAIL_SPEED = 9;

/**
 * How many souls a broken cube gives an urn: one for a runner, a few more
 * for each threefold step up in health, so a boss is worth a small haunting.
 * Taken from the cube's kind rather than its scaled health, so a late runner
 * is still one soul.
 */
function soulsOf(type) {
  const hp = (ENEMIES[type] && ENEMIES[type].hp) || 20;
  return 1 + Math.max(0, Math.floor(Math.log(hp / 20) / Math.log(3)));
}

/** How long a tower caught in a mine's blast is knocked out for. */
const MINE_STUN = 0.8;
/** How long a bomber or a charged cube knocks a tower out for, before `bite`. */
const EMP_STUN = 2;
/** However hard a difficulty bites, a baked tower keeps a quarter of its pace. */
const SCORCH_MOST = 0.75;

/**
 * Bosses do not stand still for anyone. A slow reaches a boss at half its
 * strength, never past BOSS_SLOW_MOST, and wears off in half the time; a stun
 * only checks its stride and a daze does nothing. Worse for the defence, a
 * boss kept slowed, stunned or held for BOSS_GRIT seconds all told breaks
 * free and walks unbound for BOSS_UNBOUND seconds, which nothing can slow.
 * Without this a frost tower beside a tar pit froze the Colossus in place
 * and every boss died where it stood.
 */
const BOSS_SLOW_SHARE = 0.5;
const BOSS_SLOW_MOST = 0.35;
const BOSS_HOLD_SHARE = 0.5;
const BOSS_GRIT = 3;
const BOSS_UNBOUND = 4;
/**
 * However the towers combine, a boss makes at least this share of its own
 * pace: a slow, a lodestone's drag and a landslide's shove each stay inside
 * their own limits, but together they could still have held one in place.
 * A rift's one slip back is a setback of its own and is not counted.
 */
const BOSS_LEAST_PACE = 0.45;

/** How far from the middle of its cell a prop stands in the way of a line of sight, in cells. */
const PROP_BULK = 0.36;
/** How finely a tower's view of the road is worked out, in cells along it. */
const SIGHT_STEP = 0.25;

export class Simulation {
  constructor(map, difficulty = "easy", sandbox = false) {
    this.map = map;
    // Sandbox was once a difficulty of its own, played at normal strength.
    if (difficulty === "sandbox") { difficulty = "normal"; sandbox = true; }
    this.difficulty = DIFFICULTIES[difficulty] ? difficulty : "easy";
    this.sandbox = !!sandbox;
    this.level = levelOf(this.difficulty, this.sandbox);
    // How hard a cube's trick against the board lands here.
    this.bite = this.level.bite || 1;
    // What a step up costs here, against its listed price, and what selling
    // one hands back.
    this.upkeep = this.level.upkeep || 1;
    this.refund = this.level.refund === undefined ? SELL_REFUND : this.level.refund;
    const { cols, rows } = sizeOf(map);
    this.cols = cols;
    this.rows = rows;
    // Every way through the board: its road, where a cube on it takes shape
    // coming in and where it counts as through. Each door stands at the
    // board's edge and its road runs on a little past it; a cube is
    // untouchable until it has fully come through the door, which the view
    // draws as taking shape over 0.8 cells.
    this.routes = routesOf(map).map((waypoints) => {
      const path = buildPath(waypoints);
      const first = path.points[0], last = path.points[path.points.length - 1];
      const beyond = Math.max(0, last.x - cols, -last.x, last.y - rows, -last.y);
      return { path, leakAt: path.total - beyond, enterAt: Math.max(0, first.x - cols, -first.x, first.y - rows, -first.y) + 0.8 };
    });
    this.nextRoute = 0;
    // The first route, for anything that only ever needs one.
    this.path = this.routes[0].path;
    this.leakAt = this.routes[0].leakAt;
    this.enterAt = this.routes[0].enterAt;
    this.blocked = routeCells(map);
    // Trees, crystals and the rest standing where nothing is built yet; each
    // closes its cell until it is cleared. The keys cleared are kept for saves.
    this.props = propsFor(map);
    this.propsCleared = [];
    // Bumped when a prop goes, so what each tower can see is worked out again.
    this.propsVersion = 0;
    this.towers = [];
    this.enemies = [];
    this.shots = [];
    this.mines = [];           // laid on the road, waiting to be walked on
    this.wails = [];           // souls let go, running out along the road
    this.boulders = [];        // rolling the wrong way up the road
    this.gold = this.level.gold;
    this.lives = this.level.lives;
    this.maxLives = this.level.lives;
    this.wave = 0;             // waves started
    this.cleared = 0;          // waves fully cleared
    this.phase = "build";      // build | wave | won | lost
    this.queue = [];           // spawns still to come this wave
    this.waveClock = 0;
    this.leakedThisWave = false;
    // What walked through on the leak that ended the run, once one has.
    this.lastThrough = null;
    this.kills = 0;
    this.events = [];
    this.nextId = 1;
    // Bumped whenever the board changes in a way that alters what a tower
    // does, which for beacons means any building, selling or upgrading at all.
    this.auraVersion = 1;
  }

  // ---- Building ------------------------------------------------------
  canBuild(c, r) {
    if (c < 0 || c >= this.cols || r < 0 || r >= this.rows) return false;
    if (this.blocked.has(c + "," + r) || this.props.has(c + "," + r)) return false;
    return !this.towers.some((t) => t.c === c && t.r === r);
  }
  /** The prop standing on a cell, or null. */
  propAt(c, r) { return this.props.get(c + "," + r) || null; }
  /** Pay to clear the prop on a cell. The sandbox clears for nothing. */
  clearProp(c, r) {
    const key = c + "," + r, prop = this.props.get(key);
    if (!prop || this.phase === "won" || this.phase === "lost") return false;
    if (!this.level.free) {
      if (this.gold < prop.cost) return false;
      this.gold -= prop.cost;
    }
    this.props.delete(key);
    this.propsCleared.push(key);
    this.propsVersion += 1;
    return true;
  }

  // ---- Sight ---------------------------------------------------------
  /**
   * Whether a line on the board passes a prop: one standing within
   * PROP_BULK of the middle of its cell. `own` is a cell the line may pass,
   * the one it starts from.
   */
  blockedBetween(x0, y0, x1, y1, own) {
    if (!this.props.size) return false;
    const dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy);
    const steps = Math.ceil(len / 0.1);
    for (let k = 1; k < steps; k++) {
      const x = x0 + (dx * k) / steps, y = y0 + (dy * k) / steps;
      const c = Math.floor(x), r = Math.floor(y), key = c + "," + r;
      if (key === own || !this.props.has(key)) continue;
      if (Math.hypot(x - (c + 0.5), y - (r + 0.5)) <= PROP_BULK) return true;
    }
    return false;
  }
  /**
   * What a tower can see of the road: for each route, whether each point along
   * it every SIGHT_STEP is in clear view. Neither the tower nor the road
   * moves, so it is only worked out again when a prop is cleared.
   */
  sightOf(t) {
    if (t.sight && t.sightAt === this.propsVersion) return t.sight;
    const cx = t.c + 0.5, cy = t.r + 0.5, own = t.c + "," + t.r;
    t.sight = this.routes.map((route) => {
      const seen = new Uint8Array(Math.ceil(route.path.total / SIGHT_STEP) + 1);
      for (let k = 0; k < seen.length; k++) {
        const p = pointAt(route.path, k * SIGHT_STEP);
        seen[k] = this.blockedBetween(cx, cy, p.x, p.y, own) ? 0 : 1;
      }
      return seen;
    });
    t.sightAt = this.propsVersion;
    return t.sight;
  }
  /** Whether a tower has a clear line to a cube. */
  sees(t, e) {
    if (!this.props.size) return true;
    const seen = this.sightOf(t)[e.route || 0];
    return !!seen[Math.max(0, Math.min(seen.length - 1, Math.round(e.distance / SIGHT_STEP)))];
  }
  /**
   * The ground a tower at a cell can see within its range, as the ends of
   * rays cast all round it: a ray stops at a prop, at its range, or for a
   * tower that reaches the whole map, at the edge of the board.
   */
  sightShape(c, r, range, rays = 160) {
    const cx = c + 0.5, cy = r + 0.5, own = c + "," + r;
    const far = isFinite(range) ? range : Math.hypot(this.cols, this.rows);
    const out = [];
    for (let k = 0; k < rays; k++) {
      const a = (k / rays) * Math.PI * 2, ux = Math.cos(a), uy = Math.sin(a);
      let d = 0.05;
      for (; d < far; d += 0.05) {
        const x = cx + ux * d, y = cy + uy * d;
        if (!isFinite(range) && (x < 0 || y < 0 || x > this.cols || y > this.rows)) break;
        const pc = Math.floor(x), pr = Math.floor(y), key = pc + "," + pr;
        if (key !== own && this.props.has(key) && Math.hypot(x - (pc + 0.5), y - (pr + 0.5)) <= PROP_BULK) break;
      }
      d = Math.min(d, far);
      out.push({ x: cx + ux * d, y: cy + uy * d });
    }
    return out;
  }
  towerAt(c, r) { return this.towers.find((t) => t.c === c && t.r === r) || null; }
  /** How many of a kind are standing. */
  countOf(kind) {
    let n = 0;
    for (const t of this.towers) if (t.kind === kind) n += 1;
    return n;
  }
  /** Whether no more of a kind may be built. The sandbox has no such limit. */
  atCap(kind) {
    // A level may allow fewer mints than the list does: none, on Ruin.
    const most = kind === "mint" && this.level.mints !== undefined ? this.level.mints : mostOf(kind);
    return !this.level.free && this.countOf(kind) >= most;
  }
  /** Whether the level allows no more towers standing at all, whatever their kind. */
  atStand() {
    return !this.level.free && !!this.level.stand && this.towers.length >= this.level.stand;
  }

  place(kind, c, r) {
    const spec = TOWERS[kind];
    if (!spec || this.phase === "won" || this.phase === "lost") return false;
    if (this.atCap(kind) || this.atStand()) return false;
    if (!this.canBuild(c, r) || (!this.level.free && this.gold < spec.cost)) return false;
    if (!this.level.free) this.gold -= spec.cost;
    this.towers.push({ id: this.nextId++, kind, c, r, tiers: [0, 0], power: 0, cooldown: 0, aim: 0, target: spec.target || "first", dealt: 0, earned: 0 });
    // Built with a wave already walking: a mint has nothing to show for it yet.
    if (this.phase === "wave") this.towers[this.towers.length - 1].builtIn = this.wave;
    this.auraVersion += 1;
    const up = this.towers[this.towers.length - 1];
    if (this.stats(up).pull || this.stats(up).urn || this.stats(up).boulder) this.anchorOn(up);
    return true;
  }
  /** The next step on a path (0 or 1), or null when it is maxed or locked by the other path. */
  upgradeCost(tower, path = 0) {
    const up = nextUpgrade(tower.kind, tower.tiers, path);
    return up ? upgradePrice(up, this.upkeep) : null;
  }
  upgrade(tower, path = 0) {
    const cost = this.upgradeCost(tower, path);
    if (cost === null || (!this.level.free && this.gold < cost)) return false;
    if (!this.level.free) this.gold -= cost;
    tower.tiers[path] += 1;
    tower.cached = null;
    this.auraVersion += 1;
    // A step that sets `sacrifice` consecrates the tower the moment it is bought.
    const bought = TOWERS[tower.kind].paths[path].upgrades[tower.tiers[path] - 1];
    const sets = {}; bought.apply(sets);
    if (sets.sacrifice) this.consecrate(tower, sets.sacrifice);
    return true;
  }

  /**
   * Where on the road a tower that pulls drags everything to: the nearest
   * point on it. Found when the tower goes up, since neither it nor the road
   * moves afterwards, and kept as a distance and as a point so the view can
   * mark it without walking the road itself.
   */
  anchorOn(t) {
    const cx = t.c + 0.5, cy = t.r + 0.5;
    // The nearest point on every route, and of those the nearest of all.
    t.anchors = this.routes.map((route) => {
      let best = 0, bestD = Infinity;
      for (let d = 0; d < route.leakAt; d += 0.1) {
        const p = pointAt(route.path, d);
        const dist = Math.hypot(p.x - cx, p.y - cy);
        if (dist < bestD) { bestD = dist; best = d; }
      }
      return { d: best, away: bestD };
    });
    t.anchorRoute = 0;
    t.anchors.forEach((a, i) => { if (a.away < t.anchors[t.anchorRoute].away) t.anchorRoute = i; });
    t.anchor = t.anchors[t.anchorRoute].d;
    t.anchorAt = pointAt(this.routes[t.anchorRoute].path, t.anchor);
    // Whatever it has to face faces the road there: the boulder's chute.
    t.aim = Math.atan2(t.anchorAt.y - cy, t.anchorAt.x - cx);
  }

  /** Absorb every other tower within reach: their gold becomes this tower's power. */
  consecrate(tower, { radius, cap }) {
    tower.power = tower.power || 0;
    for (const o of this.towers.slice()) {
      if (o === tower || Math.hypot(o.c - tower.c, o.r - tower.r) > radius) continue;
      tower.power += spentOn(o, this.upkeep) + (o.power || 0);
      this.towers.splice(this.towers.indexOf(o), 1);
      this.events.push({ type: "absorb", kind: o.kind, x: o.c + 0.5, y: o.r + 0.5, to: { x: tower.c + 0.5, y: tower.r + 0.5 } });
    }
    tower.power = Math.min(cap, tower.power);
    tower.cached = null;
    this.auraVersion += 1;
    this.events.push({ type: "consecrate", x: tower.c + 0.5, y: tower.r + 0.5, power: tower.power });
  }
  sell(tower) {
    const i = this.towers.indexOf(tower);
    if (i < 0) return 0;
    const refund = Math.floor(spentOn(tower, this.upkeep) * this.refund);
    this.gold += refund;
    this.towers.splice(i, 1);
    // Whoever laid them is gone, so the mines go with them.
    this.mines = this.mines.filter((m) => m.by !== tower);
    this.auraVersion += 1;
    return refund;
  }
  /**
   * Stats with every bought upgrade applied, and every beacon in reach, cached
   * until something on the board changes.
   */
  stats(tower) {
    if (!tower.cached || tower.cachedAt !== this.auraVersion) {
      const s = statsFor(tower.kind, tower.tiers);
      if (tower.power) {
        // Absorbed gold makes it brighter: more damage, more streams, more reach.
        s.damage *= 1 + tower.power / 800;
        s.beams = (s.beams || 1) + Math.floor(tower.power / 2200);
        s.range += Math.min(2, tower.power / 3000);
        s.power = tower.power;
      }
      // What the beacons lift. They never lift each other, and they do not
      // simply add up: a beacon lifts one tower by a share of what it would
      // alone, halving for each beacon already over it. One is most of the
      // gain, a second is worth building, a fourth is worth nothing, which is
      // what stops a huddle of them turning every gun on the board into two.
      if (s.damage && !s.boost) {
        const over = [];
        for (const b of this.towers) {
          if (b === tower || b.stunned > 0) continue;
          // Read the beacon's own bought stats directly: going through this
          // method again would only ask what lifts the beacon, which is
          // nothing, and would recurse to find out.
          const lift = statsFor(b.kind, b.tiers).boost;
          if (!lift || Math.hypot(b.c - tower.c, b.r - tower.r) > lift.range) continue;
          over.push(lift);
        }
        // Strongest first, so which beacon counts in full never depends on the
        // order they happen to have been built in.
        over.sort((a, b) => (b.damage || 0) + (b.rate || 0) + (b.reach || 0) - ((a.damage || 0) + (a.rate || 0) + (a.reach || 0)));
        let damage = 0, rate = 0, reach = 0;
        over.forEach((lift, i) => {
          const share = 1 / 2 ** i;
          damage += (lift.damage || 0) * share;
          rate += (lift.rate || 0) * share;
          reach += (lift.reach || 0) * share;
        });
        if (damage || rate || reach) {
          s.lifted = { damage: Math.min(BEACON_CAP.damage, damage), rate: Math.min(BEACON_CAP.rate, rate), range: Math.min(BEACON_CAP.reach, reach) };
          s.damage *= 1 + s.lifted.damage;
          s.rate *= 1 + s.lifted.rate;
          s.range += s.lifted.range;
        }
      }
      tower.cached = s;
      tower.cachedAt = this.auraVersion;
    }
    return tower.cached;
  }

  // ---- Waves ---------------------------------------------------------
  /**
   * Sandbox only: the next wave to start is `n`. Only between waves, so the
   * one under way is not renumbered halfway through.
   */
  jumpTo(n) {
    if (!this.level.free || this.phase !== "build") return false;
    this.wave = Math.max(0, Math.min(999, Math.floor(n) - 1));
    return true;
  }
  /**
   * Sandbox only: one cube of the given kind, on the road now. Between waves
   * it opens the next wave with nothing in it but what is sent, so the cube
   * comes at that wave's strength, and it ends like any other once the road
   * is clear.
   */
  send(type, mut) {
    if (!this.level.free || !ENEMIES[type]) return false;
    if (this.phase === "build") { this.wave += 1; this.queue = []; this.waveClock = 0; this.leakedThisWave = false; this.phase = "wave"; this.events.push({ type: "wave", wave: this.wave }); }
    if (this.phase !== "wave") return false;
    this.spawn(type, 0, mut);
    return true;
  }
  startWave() {
    if (this.phase !== "build") return false;
    this.wave += 1;
    this.queue = composeWave(this.wave, this.difficulty);
    this.waveClock = 0;
    this.leakedThisWave = false;
    this.phase = "wave";
    this.events.push({ type: "wave", wave: this.wave });
    return true;
  }
  /**
   * Put a cube on the road. `mut` decides what it walks in as: left out, it
   * rolls for a mutation; null forces a plain one; a name forces that one,
   * which is how a splitter's halves come out the same colour as the whole.
   */
  spawn(type, distance = 0, mut, route) {
    // Left out, the routes take their turns.
    if (route === undefined) { route = this.nextRoute % this.routes.length; this.nextRoute += 1; }
    const mutation = mut === undefined ? rollMutation(this.wave, ENEMIES[type], this.difficulty) : mut;
    const spec = specFor(type, mutation);
    // Bosses start enormous, so they take only part of the wave's health curve.
    const curve = spec.tough ? 1 + (hpScale(this.wave, this.difficulty) - 1) * spec.tough : hpScale(this.wave, this.difficulty);
    const hp = Math.round(spec.hp * curve * this.level.hp);
    const p = pointAt(this.routes[route].path, distance);
    this.enemies.push({
      id: this.nextId++, type, mut: mutation, spec, hp, maxHp: hp, distance, route,
      speed: spec.speed, slow: 0, slowLeft: 0, stunLeft: 0, x: p.x, y: p.y,
      shield: spec.shield ? Math.round(spec.shield * curve * this.level.hp) : 0,
      phaseClock: 0, phased: false, hidden: !!spec.hidden,
      burn: 0, burnDps: 0, venom: 0, venomDps: 0, venomSpread: 0, brittle: 0, guarded: false, broodClock: 0, dazed: 0,
      blinkClock: 0, revived: false, raised: 0, maxShield: spec.shield ? Math.round(spec.shield * curve * this.level.hp) : 0,
      immune: distance < this.routes[route].enterAt,
    });
    return this.enemies[this.enemies.length - 1];
  }
  /** The route a cube is walking. */
  routeOf(e) { return this.routes[e.route || 0]; }
  /** How far a cube has left to go: nearer the door it leaves by is further along. */
  progress(e) { return e.distance - this.routeOf(e).leakAt; }

  /**
   * Deal damage to an enemy: nothing while phased, shield first, then armour
   * unless pierced. For damage poured in over time (dt given) armour comes
   * off per second instead of per hit.
   */
  damage(e, amount, pierce, dt, by) {
    if (e.phased || e.immune || e.dead) return;
    // Some of the heavies shrug off particular towers outright, until a prism
    // has absorbed enough to burn through.
    const resist = e.spec.resist;
    // A prism full enough burns through a resistance, but a weakness (a
    // multiplier above one) is the cube's own fault and always counts.
    const through = resist && by && resist[by.kind] < 1 && (by.power || 0) >= PIERCE_RESIST_POWER;
    if (resist && by && resist[by.kind] !== undefined && !through) {
      amount *= resist[by.kind];
      if (amount <= 0) return;
    }
    const before = Math.max(0, e.hp) + e.shield;
    this.hurt(e, amount, pierce, dt);
    if (by) by.dealt = (by.dealt || 0) + (before - (Math.max(0, e.hp) + e.shield));
  }
  /**
   * Slow a cube by `slow` for `seconds`, as far as it lets itself be slowed.
   * Says whether it took, so what rides along with a chill (brittleness,
   * putting a fire out) goes only where the chill went.
   */
  chill(e, slow, seconds) {
    if (e.spec.unchillable || e.unbound > 0) return false;
    if (e.spec.tough) { slow = Math.min(BOSS_SLOW_MOST, slow * BOSS_SLOW_SHARE); seconds *= BOSS_HOLD_SHARE; }
    e.slow = Math.max(e.slow, slow);
    e.slowLeft = Math.max(e.slowLeft, seconds);
    return true;
  }
  /** Stop a cube dead for `seconds`. A boss is only slowed as hard as a boss can be. */
  stun(e, seconds) {
    if (e.spec.unchillable || e.unbound > 0) return false;
    if (e.spec.tough) return this.chill(e, BOSS_SLOW_MOST / BOSS_SLOW_SHARE, seconds / BOSS_HOLD_SHARE);
    e.stunLeft = Math.max(e.stunLeft || 0, seconds);
    return true;
  }
  /**
   * Hold every boss to BOSS_LEAST_PACE. Measured from one update to the next,
   * so every shot, drag, shove and slow of the step between is counted
   * together, and a boss held back further than that is put where it would
   * have been at the least pace it is allowed.
   */
  keepBossesWalking(dt) {
    for (const e of this.enemies) {
      if (!e.spec.tough || e.dead) continue;
      if (e.mark !== undefined && this.phase === "wave") {
        const least = e.mark + e.speed * BOSS_LEAST_PACE * e.markDt;
        if (e.distance < least) {
          e.distance = least;
          const p = pointAt(this.routeOf(e).path, e.distance);
          e.x = p.x; e.y = p.y;
        }
      }
      e.mark = e.distance;
      e.markDt = dt;
    }
  }
  /** Leave a cube confused, going nowhere. Bosses keep their bearings. */
  daze(e, seconds) {
    if (e.spec.tough) return false;
    e.dazed = Math.max(e.dazed || 0, seconds);
    return true;
  }
  hurt(e, amount, pierce, dt) {
    if (e.guarded) amount *= 0.6; // under a warden
    if (e.shield > 0) {
      const used = Math.min(e.shield, amount);
      e.shield -= used; amount -= used;
      if (amount <= 0) return;
    }
    // Stripped in a suppressor's field, and a shredding shot (a share given
    // for pierce) only meets part of what is left.
    const shred = typeof pierce === "number" && pierce < 1 ? pierce : 0;
    const armour = Math.max(0, e.spec.armour - (e.armourCut || 0)) * (1 - shred);
    if (e.exposed) amount *= 1 + e.exposed;
    if (e.spec.frail) amount *= e.spec.frail; // glass: everything hurts more
    if (e.brittle && (e.slow > 0 || e.stunLeft > 0)) amount *= 1 + e.brittle; // frozen brittle
    if (pierce === true || pierce >= 1) e.hp -= amount;
    else if (dt) e.hp -= Math.max(amount * 0.25, amount - armour * 3 * dt);
    else e.hp -= Math.max(1, amount - armour);
  }

  // ---- Simulation ----------------------------------------------------
  update(dt) {
    this.keepBossesWalking(dt);
    // Shots keep flying between waves too, so nothing hangs in the air, and
    // the sappers keep laying, so the road is ready before the cubes arrive.
    this.moveShots(dt);
    // Knocked-out towers come round in every phase, so one caught at the end
    // of a wave is not still down through the build.
    for (const t of this.towers) {
      if (!(t.stunned > 0)) continue;
      t.stunned -= dt; t.beams = []; t.flame = false;
      if (t.stunned <= 0) { t.stunned = 0; this.auraVersion += 1; }
    }
    this.layMines(dt);
    if (this.phase !== "wave") return;
    this.waveClock += dt;
    while (this.queue.length && this.queue[0].at <= this.waveClock) {
      const next = this.queue.shift();
      // The last boss's road is the next in turn, unless the level draws it.
      const road = next.finale && this.level.roll ? Math.floor(Math.random() * this.routes.length) : undefined;
      const walked = this.spawn(next.type, 0, next.mut, road);
      if (next.finale) {
        // Carried on the cube so it survives a save, and so the door knows.
        if (walked) walked.finale = true;
        this.events.push({ type: "finale", name: specFor(next.type, next.mut).name });
      }
    }

    this.hush();
    const hatched = [];
    for (const e of this.enemies) {
      if (e.slowLeft > 0) { e.slowLeft -= dt; if (e.slowLeft <= 0) { e.slow = 0; e.brittle = 0; } }
      // A stun keeps a clock of its own. It used to be a slow of 100% sharing
      // the slow's clock, and anything that tops a slow up while a cube stands
      // in it, tar above all, kept a stunned cube stunned for good: it could
      // not walk out of the tar that kept it there.
      if (e.stunLeft > 0) e.stunLeft -= dt;
      // Brittleness from being held goes the moment the hold does, unless a
      // chill is keeping it up.
      if (e.held !== undefined && e.held <= 0 && e.slowLeft <= 0) e.brittle = 0;
      // A boss kept under long enough tears loose and walks unbound for a
      // while. Its patience comes back half as fast as it went.
      if (e.spec.tough) {
        if (e.unbound > 0) e.unbound -= dt;
        else if (e.slow > 0 || e.stunLeft > 0 || e.held > 0) {
          e.grit = (e.grit || 0) + dt;
          if (e.grit >= BOSS_GRIT) {
            e.grit = 0; e.unbound = BOSS_UNBOUND;
            e.slow = 0; e.slowLeft = 0; e.stunLeft = 0; e.brittle = 0; e.dazed = 0; e.mired = 0;
            this.events.push({ type: "unbound", x: e.x, y: e.y, h: e.spec.size * 0.85, name: e.spec.name });
          }
        } else if (e.grit > 0) e.grit = Math.max(0, e.grit - dt * 0.5);
      }
      const spec0 = e.spec;
      // Chargers bolt once hurt; regenerators knit back; necromancers raise more.
      const charge = e.hush >= 4 ? 1 : chargeAt(spec0, e.hp / e.maxHp);
      if (spec0.regen && e.hp < e.maxHp && !(e.hush >= 1)) e.hp = Math.min(e.maxHp, e.hp + e.maxHp * spec0.regen * dt);
      if (spec0.raise && !e.immune && !(e.hush >= 1) && e.raised < (spec0.raise.max || 99)) {
        e.broodClock += dt;
        if (e.broodClock >= spec0.raise.every) {
          e.broodClock = 0;
          e.raised += 1;
          const type = spec0.raise.types[Math.floor(Math.random() * spec0.raise.types.length)];
          hatched.push({ type, at: e.distance - 0.35, route: e.route });
          this.events.push({ type: "raise", x: e.x, y: e.y });
        }
      }
      // Blinks skip forward every few seconds.
      if (spec0.blink && !e.immune && !(e.hush >= 2)) {
        e.blinkClock += dt;
        if (e.blinkClock >= spec0.blink.every) {
          e.blinkClock = 0;
          e.distance += spec0.blink.dist;
          this.events.push({ type: "blink", from: { x: e.x, y: e.y }, h: spec0.size * 0.85 });
        }
      }
      // A confused cube has lost its bearings and makes no ground at all
      // until it finds them again.
      if (e.dazed > 0) e.dazed -= dt;
      else if (!(e.stunLeft > 0)) e.distance += e.speed * charge * (1 - e.slow) * dt;
      const p = pointAt(this.routeOf(e).path, e.distance);
      e.x = p.x; e.y = p.y;
      e.immune = e.distance < this.routeOf(e).enterAt;
      const spec = e.spec;
      if (spec.phase) {
        e.phaseClock += dt;
        e.phased = e.phaseClock % (spec.phase.on + spec.phase.off) > spec.phase.off;
        if (e.hush >= 3) e.phased = false; // grounded
      }
      // Still alight from a flame tower.
      if (e.burn > 0) { e.burn -= dt; this.damage(e, e.burnDps * dt, !!(e.burnBy && e.burnBy.melts), dt, e.burnBy); if (e.burn <= 0) e.burnDps = 0; }
      // Poisoned: it eats through armour and nothing puts it out.
      if (e.venom > 0) { e.venom -= dt; this.damage(e, e.venomDps * dt, true, dt, e.venomBy); if (e.venom <= 0) e.venomDps = 0; }
    }
    for (const h of hatched) this.spawn(h.type, Math.max(0, h.at), undefined, h.route);
    // Medics mend whatever walks near them; wardens shield it.
    for (const e of this.enemies) e.guarded = false;
    for (const m of this.enemies) {
      const spec = m.spec;
      // A medic only has hands enough for a few at a time.
      if (spec.heal && !(m.hush >= 1)) {
        const hurt = [];
        for (const e of this.enemies) {
          if (e === m || e.hp >= e.maxHp) continue;
          const d2 = Math.hypot(e.x - m.x, e.y - m.y);
          if (d2 <= spec.healRange) hurt.push({ e, d2 });
        }
        hurt.sort((a, b) => a.d2 - b.d2);
        for (const { e } of hurt.slice(0, spec.healMost || 4)) e.hp = Math.min(e.maxHp, e.hp + spec.heal * dt);
      }
      if (spec.guard && !(m.hush >= 3)) for (const e of this.enemies) if (e !== m && Math.hypot(e.x - m.x, e.y - m.y) <= spec.guard) e.guarded = true;
      // An aegis wraps a few of its closest neighbours in a shield and keeps
      // rebuilding it. It only ever holds up a handful, so a crowd cannot
      // turn it into limitless healing.
      if (spec.aegis && !m.immune && !(m.hush >= 1)) {
        const cap = Math.round(spec.aegis.amount * hpScale(this.wave, this.difficulty) * this.level.hp);
        const near = [];
        for (const e of this.enemies) {
          if (e === m || e.shield >= cap) continue;
          const d2 = Math.hypot(e.x - m.x, e.y - m.y);
          if (d2 <= spec.aegis.range) near.push({ e, d2 });
        }
        near.sort((a, b) => a.d2 - b.d2);
        for (const { e } of near.slice(0, spec.aegis.most || 4)) {
          e.shield = Math.min(cap, e.shield + spec.aegis.rate * hpScale(this.wave, this.difficulty) * this.level.hp * dt);
        }
      }
    }
    // Leaks: anything past the end of the route.
    for (const e of this.enemies) {
      if (e.distance >= this.routeOf(e).leakAt) {
        e.dead = true;
        // Lives lost scale with the health it still has, never below one,
        // except for the last boss of the campaign, which is not something a
        // road survives: reaching the door with it costs everything left.
        const lost = e.finale
          ? Math.max(1, this.lives)
          : Math.max(1, Math.ceil((e.spec.leak || 1) * Math.min(1, e.hp / e.maxHp)));
        if (!this.level.free) this.lives -= lost;
        this.leakedThisWave = true;
        // Whatever walked through last is what ended the run, if this is the
        // leak that finishes it. Kept as plain values so it survives a save and
        // outlives the cube, which is about to be swept up.
        if (this.lives <= 0 && !this.level.free && !this.lastThrough) {
          this.lastThrough = { type: e.type, mut: e.mut || null, lost, finale: !!e.finale, wave: this.wave };
        }
        this.events.push({ type: "leak", enemy: e, lost, finale: !!e.finale });
      }
    }

    this.springMines(dt);
    this.tendUrns(dt);
    this.rollBoulders(dt);
    this.openRifts(dt);

    // Lodestones drag whatever is in reach along the road to the point nearest
    // them and hold it there. Weight tells, as it does for a shove: a runner
    // comes the whole way, a tank barely, a boss not at all unless the well
    // is deep enough to move even that a little.
    // Drag back along the road is shared out between every lodestone a cube
    // is in, and never comes to more than half its walking pace: past the
    // anchor a cube is slowed, never pinned. Bosses lose a quarter at most.
    // At nearly its whole pace, as it once was, a lodestone past its anchor
    // was a harder slow than a maxed frost. Without this, anything slower than the pull, a boss above
    // all, stood at the anchor for as long as the lodestone did.
    for (const e of this.enemies) e.dragged = 0;
    for (const t of this.towers) {
      const s = this.stats(t);
      if (!s.pull || t.stunned > 0) continue;
      const cx = t.c + 0.5, cy = t.r + 0.5;
      if (t.anchor === undefined) this.anchorOn(t);
      const held = [];
      for (const e of this.enemies) {
        if (e.dead || e.immune || e.phased || e.unbound > 0) continue;
        if (Math.hypot(e.x - cx, e.y - cy) > s.pull.range) continue;
        const size = e.spec.size;
        const give = size >= 0.55 ? (s.heavyPull ? 0.15 : 0) : Math.min(1, Math.pow(0.3 / size, 2));
        if (!give) continue;
        const gap = t.anchors[e.route || 0].d - e.distance;
        let step = Math.min(Math.abs(gap), s.pull.speed * give * dt);
        if (gap < 0) {
          const most = e.stunLeft > 0 ? 0 : e.speed * (1 - e.slow) * dt * (e.spec.tough ? 0.25 : 0.5);
          step = Math.max(0, Math.min(step, most - e.dragged));
          e.dragged += step;
        }
        e.distance += Math.sign(gap) * step;
        e.held = 0.15; // the view draws the tether while this lasts
        e.heldBy = { x: cx, y: cy };
        if (s.pullBrittle) e.brittle = Math.max(e.brittle, s.pullBrittle);
        held.push(e);
      }
      // Pressed together, they grind: every neighbour within half a cell
      // costs a held cube more each second.
      if (s.pull.crush && held.length > 1) {
        for (const e of held) {
          let near = 0;
          for (const o of held) if (o !== e && Math.hypot(o.x - e.x, o.y - e.y) < 0.5) near++;
          if (near) this.damage(e, s.pull.crush * Math.min(6, near) * dt, false, dt, t);
        }
      }
    }
    for (const e of this.enemies) {
      if (e.held > 0) e.held -= dt;
      e.mired = Math.max(0, (e.mired || 0) - dt);
    }

    // Tar pits mire whatever is wading through them. Nothing is aimed at, so
    // hidden cubes are caught the same as any other.
    for (const t of this.towers) {
      const s = this.stats(t);
      if (!s.mire) continue; // tar on the road keeps working while the pit is down
      const cx = t.c + 0.5, cy = t.r + 0.5;
      for (const e of this.enemies) {
        if (e.dead || e.immune || e.phased) continue;
        if (Math.hypot(e.x - cx, e.y - cy) > s.mire.range) continue;
        // Kept just topped up, so a cube shakes it off a moment after it
        // walks clear rather than carrying it down the road.
        if (this.chill(e, s.mire.slow, 0.2)) {
          // The view draws it wading while this lasts, in tar of this kind.
          e.mired = 0.2;
          e.miredAcid = !!(s.mire.damage || s.mire.brittle);
          e.brittle = Math.max(e.brittle, s.mire.brittle || 0);
        }
        if (s.mire.damage) this.damage(e, s.mire.damage * dt, true, dt, t);
      }
    }

    // Molten cubes bake whatever they walk past: a tower close to one works
    // slower for as long as it is there.
    const hot = this.enemies.filter((e) => e.spec.scorch && !e.immune && !e.dead && !(e.hush >= 4));
    for (const t of this.towers) {
      let heat = 0;
      if (hot.length) for (const e of hot) if (Math.hypot(t.c + 0.5 - e.x, t.r + 0.5 - e.y) <= e.spec.scorch.range) heat = Math.max(heat, Math.min(SCORCH_MOST, e.spec.scorch.slow * this.bite));
      t.scorched = heat;
    }

    for (const t of this.towers) this.fire(t, dt);


    const born = [];
    // Mints take a share of every bounty. Only the best of them counts, or a
    // row of cheap mints would pay for the whole board.
    const cut = this.towers.reduce((a, t) => Math.max(a, this.stats(t).bounty || 0), 0);
    for (const e of this.enemies) {
      if (!e.dead && e.hp <= 0) {
        const spec = e.spec;
        // A revenant gets back up once instead of dying.
        if (spec.revive && !e.revived && !(e.hush >= 2)) {
          e.revived = true;
          e.hp = Math.round(e.maxHp * spec.revive);
          e.shield = 0;
          this.events.push({ type: "revive", x: e.x, y: e.y, h: spec.size * 0.85 });
          continue;
        }
        e.dead = true;
        // A plague-bearer hands its poison to whatever was standing near it.
        if (e.venomDps > 0 && e.venomSpread > 0) {
          for (const o of this.enemies) {
            if (o === e || o.dead || o.immune) continue;
            if (Math.hypot(o.x - e.x, o.y - e.y) > e.venomSpread) continue;
            o.venom = Math.max(o.venom, e.venom > 0 ? e.venom : 2);
            o.venomDps = Math.max(o.venomDps, e.venomDps);
            o.venomSpread = e.venomSpread;
            o.venomBy = e.venomBy;
          }
          this.events.push({ type: "spread", x: e.x, y: e.y, radius: e.venomSpread });
        }
        this.kills += 1;
        // Its soul goes to every urn within reach, whoever broke it.
        for (const t of this.towers) {
          const st = this.stats(t);
          if (!st.urn || Math.hypot(t.c + 0.5 - e.x, t.r + 0.5 - e.y) > st.range) continue;
          const worth = soulsOf(e.type) + (st.urn.extra || 0);
          t.souls = Math.min(st.urn.hold, (t.souls || 0) + worth);
          this.events.push({ type: "soul", x: e.x, y: e.y, h: spec.size * 0.85, n: worth, to: { x: t.c + 0.5, y: t.r + 0.5, tier: t.tiers[0] + t.tiers[1] } });
        }
        const paid = Math.max(1, Math.round(spec.reward * this.level.reward * KILL_REWARD * killPay(this.wave, this.difficulty)));
        const extra = Math.round(paid * cut);
        this.gold += paid + extra;
        this.events.push({ type: "kill", enemy: e, gold: paid + extra, bonus: extra });
        // A splitter or hydra breaks into smaller cubes where it fell.
        const split = spec.split || 0;
        // The halves come out the same colour as the whole, unless it was the
        // mutation itself that made it come apart: then they walk in plain,
        // or a glass cube would splinter for ever. A mutation can also say it
        // is not passed on at all, which is how the last boss stays the only
        // Ascendant thing on the board.
        const worn = MUTATIONS[e.mut];
        const heir = worn && (worn.heirless || (worn.traits && worn.traits.split)) ? null : e.mut;
        // A boss throws its pieces back up the road as it comes apart, further
        // the bigger it was and never more than a share of the route; a
        // splitter drops its halves at its feet. SPLIT_THROW says why, and why
        // it must not shrink.
        const back = spec.tough ? Math.min(SPLIT_THROW.base + spec.size * SPLIT_THROW.perSize, this.routeOf(e).leakAt * SPLIT_THROW.most) : 0.2;
        for (let k = 0; k < split; k++) born.push({ type: spec.splitInto || "basic", at: Math.max(0, e.distance - back + k * 0.4 / Math.max(1, split - 1)), mut: heir, route: e.route });
        // A bomber knocks out the towers around it.
        const emp = e.hush >= 4 ? 0 : spec.emp;
        if (emp) {
          const out = EMP_STUN * this.bite;
          for (const t of this.towers) if (Math.hypot(t.c + 0.5 - e.x, t.r + 0.5 - e.y) <= emp) { t.stunned = out; t.cooldown = Math.max(t.cooldown, out); t.beams = []; t.flame = false; }
          this.auraVersion += 1;
          this.events.push({ type: "emp", x: e.x, y: e.y, radius: emp });
        }
      }
    }
    this.enemies = this.enemies.filter((e) => !e.dead);
    for (const b of born) this.spawn(b.type, b.at, b.mut, b.route);

    if (this.lives <= 0) {
      this.lives = 0;
      this.phase = "lost";
      this.events.push({ type: "lost", through: this.lastThrough || null });
      return;
    }
    if (!this.queue.length && !this.enemies.length) {
      this.cleared = this.wave;
      this.wails = [];
      // Boulders still rolling when the road clears crumble where they are,
      // rather than simply being gone.
      for (const b of this.boulders) if (b.wait <= 0) this.events.push({ type: "rubble", x: b.x, y: b.y, burst: 0, tier: b.tier, crumble: true });
      this.boulders = [];
      // Mines do not keep: whatever is still lying there fizzles out, unless
      // the sapper that laid it has long fuses.
      const stale = this.mines.filter((m) => !m.keep);
      if (stale.length) {
        this.mines = this.mines.filter((m) => m.keep);
        for (const m of stale) this.events.push({ type: "dud", x: m.x, y: m.y });
      }
      const bonus = clearBonus(this.wave, this.leakedThisWave, this.difficulty);
      this.gold += bonus;
      // Mints pay out once the road is clear. Yields add up; the dividend
      // does not. Only the best policy on the board pays, as only the best
      // cut of a kill does, and it pays on the gold that was in hand when the
      // round began, otherwise each mint would earn interest on what the one
      // before it had just handed over.
      const purse = this.gold;
      let banker = null;
      for (const t of this.towers) {
        const s = this.stats(t);
        if (!s.interest || t.builtIn === this.wave) continue;
        if (!banker || s.interest > this.stats(banker).interest) banker = t;
      }
      for (const t of this.towers) {
        const s = this.stats(t);
        if (!s.yield || t.builtIn === this.wave) continue;
        const dividend =
          t === banker ? Math.min(s.interestCap, Math.floor(purse * s.interest)) : 0;
        const paid = s.yield + dividend;
        this.gold += paid;
        t.earned = (t.earned || 0) + paid;
        this.events.push({ type: "earn", x: t.c + 0.5, y: t.r + 0.5, gold: paid });
      }
      this.phase = this.wave === CAMPAIGN_WAVES ? "won" : "build";
      this.events.push({ type: "cleared", wave: this.wave, bonus, leaked: this.leakedThisWave });
      // A mint underwriting the run buys a life back now and then. Only the
      // best policy on the board pays out, so a row of mints is no insurance.
      let mend = null;
      for (const t of this.towers) {
        const m = this.stats(t).mend;
        if (m && (!mend || m.lives > mend.lives)) mend = m;
      }
      if (mend && this.cleared % mend.every === 0 && this.lives < this.maxLives) {
        const gained = Math.min(mend.lives, this.maxLives - this.lives);
        this.lives += gained;
        this.events.push({ type: "heal", lives: gained });
      }
      if (this.phase === "won") this.events.push({ type: "won" });
    }
  }

  /**
   * Sappers lob mines onto the stretch of road they can reach, keeping up to
   * `most` of them out and never crowding two into the same place. A mine is
   * in the air for a moment before it settles, which is what the view draws.
   */
  layMines(dt) {
    for (const t of this.towers) {
      const s = this.stats(t);
      if (!s.mine || t.stunned > 0) continue;
      t.mineClock = (t.mineClock || 0) - dt;
      if (t.mineClock > 0) continue;
      const mine = s.mine;
      const out = this.mines.filter((m) => m.by === t).length;
      if (out >= mine.most) { t.mineClock = 0.3; continue; }
      const cx = t.c + 0.5, cy = t.r + 0.5;
      // Every spot along the road it can reach, less the ones already mined,
      // and of those the one furthest from every other mine, so the field is
      // spread out. With a forward observer and cubes on the road, the spot
      // the nearest of them will step on soonest comes first, so the mine
      // goes off rather than lying behind the wave.
      const walkers = mine.smart ? this.enemies.filter((e) => !e.dead && !e.phased) : [];
      let best = null, bestGap = -1, bestWait = Infinity;
      this.routes.forEach((route, ri) => {
        for (let d = 0; d < route.leakAt; d += 0.4) {
          const p = pointAt(route.path, d);
          if (Math.hypot(p.x - cx, p.y - cy) > s.range) continue;
          // Measured on the ground, so road two routes share is mined once.
          let gap = Infinity;
          for (const m of this.mines) gap = Math.min(gap, Math.hypot(m.x - p.x, m.y - p.y));
          if (gap < 0.7) continue;
          // How soon a cube reaches it: the mine takes 0.45s to land, so
          // anything closer than that walks past before it is armed.
          let wait = Infinity;
          for (const e of walkers) {
            if ((e.route || 0) !== ri) continue;
            const ahead = d - e.distance;
            const pace = Math.max(0.05, e.speed * (1 - e.slow));
            if (ahead / pace >= 0.5) wait = Math.min(wait, ahead / pace);
          }
          if (wait < bestWait || (wait === bestWait && gap > bestGap)) { bestWait = wait; bestGap = gap; best = { d, p, route: ri }; }
        }
      });
      // Nowhere to put one that is not already mined.
      if (!best) { t.mineClock = 0.5; continue; }
      this.mines.push({
        id: this.nextId++, by: t, distance: best.d, route: best.route, x: best.p.x, y: best.p.y,
        damage: mine.damage, splash: mine.splash, fall: 0.45, keep: !!mine.keep,
        from: { x: cx, y: cy },
      });
      t.mineClock = Math.max(0.8, mine.every);
      t.aim = Math.atan2(best.p.y - cy, best.p.x - cx); // the tube turns to follow
      this.events.push({ type: "lay", x: cx, y: cy, to: { x: best.p.x, y: best.p.y } });
    }
  }

  /** Anything walking onto a mine sets it off, taking its neighbours with it. */
  /**
   * Urns: a necromancer standing in reach feeds on what one holds, and one
   * that is full lets go. Each wail runs out both ways along the road from
   * the point nearest its urn and strikes every cube once as its front goes
   * past, for so much a soul it carried. Phased cubes it passes through.
   */
  tendUrns(dt) {
    for (const t of this.towers) {
      const s = this.stats(t);
      if (!s.urn) continue;
      const cx = t.c + 0.5, cy = t.r + 0.5;
      t.souls = t.souls || 0;
      t.drainer = null;
      for (const e of this.enemies) {
        if (e.dead || e.immune || !e.spec.raise) continue;
        if (Math.hypot(e.x - cx, e.y - cy) <= s.range) { t.drainer = e; break; }
      }
      if (t.drainer) t.souls = Math.max(0, t.souls - SOUL_DRAIN * dt);
      if (t.stunned > 0) continue;
      if (t.souls >= s.urn.hold * (s.urn.early ? 2 / 3 : 1) && t.souls >= 1) this.release(t, s);
    }
    for (const w of this.wails) {
      w.front += WAIL_SPEED * dt;
      if (w.front < 0) continue; // a second wail, still waiting its turn
      for (const e of this.enemies) {
        if (e.dead || e.phased || w.hit.has(e)) continue;
        const origin = w.origins[e.route || 0];
        if (origin === null || Math.abs(e.distance - origin) > w.front) continue;
        w.hit.add(e);
        this.damage(e, w.damage, false, 0, w.by);
        if (e.dead) continue;
        if (w.slow) this.chill(e, w.slow, 2);
        if (w.stun) this.stun(e, w.stun);
      }
    }
    this.wails = this.wails.filter((w) => w.front < w.span);
  }

  /** An urn lets go of everything it holds, in one wail or, with Requiem, two. */
  release(t, s) {
    if (t.anchor === undefined) this.anchorOn(t);
    const souls = Math.floor(t.souls);
    // It runs out along every route that passes within the urn's reach, from
    // the point on each nearest the urn.
    const origins = t.anchors.map((a, i) => (i === t.anchorRoute || a.away <= s.range ? a.d : null));
    const wail = (damage, front) => ({
      id: this.nextId++, by: t, origins, front, span: s.urn.span, damage,
      slow: s.urn.slow || 0, stun: s.urn.stun || 0, hit: new Set(), souls,
    });
    this.wails.push(wail(souls * s.urn.per, 0));
    if (s.urn.twice) this.wails.push(wail(souls * s.urn.per * 0.6, -WAIL_SPEED * 0.7));
    this.events.push({ type: "wail", x: t.c + 0.5, y: t.r + 0.5, tier: t.tiers[0] + t.tiers[1], souls });
    t.souls = 0;
  }

  springMines(dt) {
    if (!this.mines.length) return;
    let went = false;
    for (const m of this.mines) {
      if (m.fall > 0) { m.fall -= dt; continue; } // still in the air
      const tripped = this.enemies.some((e) => !e.dead && !e.immune && !e.phased && Math.hypot(e.x - m.x, e.y - m.y) <= 0.32);
      if (!tripped) continue;
      this.detonate(m);
      went = true;
    }
    if (went) this.mines = this.mines.filter((m) => !m.dead);
  }

  /** A mine goes off where it lies: whatever is near takes the blast, towers included. */
  detonate(m) {
    {
      m.dead = true;
      for (const e of this.enemies) {
        if (e.dead || Math.hypot(e.x - m.x, e.y - m.y) > m.splash) continue;
        this.damage(e, m.damage, false, 0, m.by);
      }
      // The charge does not know what is friendly. Every tower standing in
      // the blast is knocked out by it, the same as a bomber does, save the
      // sapper that laid it, which is braced for its own. A bigger blast is
      // therefore a bigger liability: mines cannot be laid under a line of
      // towers for free.
      for (const t of this.towers) {
        if (t === m.by || Math.hypot(t.c + 0.5 - m.x, t.r + 0.5 - m.y) > m.splash) continue;
        t.stunned = Math.max(t.stunned || 0, MINE_STUN);
        this.auraVersion += 1;
        t.cooldown = Math.max(t.cooldown, MINE_STUN);
        t.beams = []; t.flame = false;
      }
      this.events.push({ type: "mine", x: m.x, y: m.y, splash: m.splash });
    }
  }

  /**
   * Rifts. Seldom, a rift tears the road open under the cubes furthest along
   * in its reach and drops them back out upstream, to walk that stretch again.
   * A cube that has been through a rift cannot go through one again, so it
   * shoves rather than stalls; a boss slips only a little way and still uses
   * the tear up. Hidden cubes need seeing first, and phased ones slip it.
   */
  openRifts(dt) {
    for (const t of this.towers) {
      const s = this.stats(t);
      if (!s.rift || t.stunned > 0) continue;
      const r = s.rift;
      const tier = t.tiers[0] + t.tiers[1];
      // A tear that is open takes every cube that walks into it, until it
      // closes or has taken as many as it can hold.
      t.tears = (t.tears || []).filter((tr) => tr.left > 0 && tr.taken < tr.most);
      for (const tr of t.tears) {
        tr.left -= dt;
        for (const e of this.enemies) {
          if (tr.taken >= tr.most) break;
          if (e.dead || e.hp <= 0 || e.immune || e.phased || (e.hidden && !s.detect && !e.revealed)) continue;
          if (Math.hypot(e.x - tr.x, e.y - tr.y) > 0.35) continue;
          // A black hole swallows an ordinary cube whole, even one that has
          // been through a tear before. A boss only slips, and only once.
          if (tr.hole && !e.spec.tough) this.swallow(e, t, tier);
          else if (!e.rifted) this.tear(e, e.spec.tough ? 2 : r.back, r, t, tier, true);
          else continue;
          tr.taken += 1;
        }
      }
      t.riftClock = (t.riftClock === undefined ? 3 : t.riftClock) - dt;
      if (t.riftClock > 0) continue;
      // Open one where the cube furthest along in reach stands, and with Twin
      // tears a second where the next cube a few cells back stands.
      const reachable = this.enemies
        .filter((e) => !e.dead && !e.rifted && this.inReach(t, s, e))
        .sort((a, b) => this.progress(b) - this.progress(a));
      if (!reachable.length) { t.riftClock = 0.25; continue; }
      t.riftClock = Math.max(RIFT_SOONEST, r.every);
      const spots = [];
      for (const e of reachable) {
        if (spots.length >= Math.max(1, r.count)) break;
        if (spots.some((q) => Math.hypot(q.x - e.x, q.y - e.y) < 2)) continue;
        spots.push({ x: e.x, y: e.y });
      }
      // With a Chasm every so many openings are black holes, open half again as long.
      t.opened = (t.opened || 0) + 1;
      const hole = !!r.hole && t.opened % r.hole === 0;
      for (const at of spots) {
        const tr = { x: at.x, y: at.y, left: (r.open || 2) * (hole ? 1.5 : 1), most: r.most || 4, taken: 0, hole };
        t.tears.push(tr);
        this.events.push({ type: "riftopen", x: at.x, y: at.y, open: tr.left, tier, hole });
      }
      if (r.swap) {
        const walking = this.enemies.filter((e) => !e.dead && !e.immune && !e.spec.tough);
        if (walking.length > 1) {
          let front = walking[0], rear = walking[0];
          // The two ends of one route, since a distance only means anything on its own road.
          for (const e of walking) if (this.progress(e) > this.progress(front)) front = e;
          rear = front;
          for (const e of walking) if (e.route === front.route && e.distance < rear.distance) rear = e;
          if (front !== rear) {
            const fromFront = { x: front.x, y: front.y, h: front.spec.size * 0.85 }, fromRear = { x: rear.x, y: rear.y, h: rear.spec.size * 0.85 };
            [front.distance, rear.distance] = [rear.distance, front.distance];
            for (const e of [front, rear]) { const p = pointAt(this.routeOf(e).path, e.distance); e.x = p.x; e.y = p.y; }
            this.events.push({ type: "rift", from: fromFront, to: { x: front.x, y: front.y, h: fromFront.h }, tier });
            this.events.push({ type: "rift", from: fromRear, to: { x: rear.x, y: rear.y, h: fromRear.h }, tier });
          }
        }
      }
    }
  }

  /** A black hole takes a cube for good. It dies there, and pays as any kill does. */
  swallow(e, t, tier) {
    t.dealt = (t.dealt || 0) + Math.max(0, e.hp) + e.shield;
    e.hp = 0;
    e.shield = 0;
    e.revived = true; // nothing gets back up from inside one
    e.swallowed = true;
    this.events.push({ type: "swallow", x: e.x, y: e.y, h: e.spec.size * 0.85, size: e.spec.size, colour: e.spec.colour, tier });
  }

  /**
   * Send one cube back `back` cells through a tear, with whatever the rift
   * adds. `open` says it went through a tear already standing open, which the
   * view is already drawing, so only the tear it drops out of is new.
   */
  tear(e, back, r, t, tier, open) {
    const from = { x: e.x, y: e.y, h: e.spec.size * 0.85 };
    const was = e.distance;
    e.distance = Math.max(this.routeOf(e).enterAt, e.distance - back);
    const p = pointAt(this.routeOf(e).path, e.distance);
    e.x = p.x; e.y = p.y;
    e.rifted = true;
    const tough = !!e.spec.tough;
    // The slip is the rift's to give, so the least pace starts again from where it lands.
    if (tough && e.mark !== undefined) e.mark -= was - e.distance;
    if (r.daze) this.daze(e, r.daze);
    if (r.slow) this.chill(e, r.slow, 2);
    if (r.tear) this.damage(e, e.maxHp * (tough ? 0.05 : r.tear), true, 0, t);
    this.events.push({ type: "rift", from, to: { x: e.x, y: e.y, h: from.h }, tier, open: !!open });
  }

  /**
   * Suppressors: how deep in silence every cube stands, and what the field
   * does to it besides. `hush` is the deepest level any field it is in
   * reaches: 1 stops regenerating, mending, shielding and raising; 2 blinking
   * and getting up again; 3 phasing and warding; 4 what mutations do. A
   * knocked-out suppressor's field is gone until it comes round.
   */
  hush() {
    const fields = [];
    for (const t of this.towers) {
      if (t.stunned > 0) continue;
      const s = this.stats(t);
      if (s.hush) fields.push({ x: t.c + 0.5, y: t.r + 0.5, range: s.range, h: s.hush });
    }
    for (const e of this.enemies) {
      e.hush = 0; e.revealed = false; e.armourCut = 0; e.exposed = 0;
      for (const f of fields) {
        if (Math.hypot(e.x - f.x, e.y - f.y) > f.range) continue;
        e.hush = Math.max(e.hush, f.h.level || 1);
        if (f.h.reveal) e.revealed = true;
        e.armourCut = Math.max(e.armourCut, f.h.strip || 0);
        e.exposed = Math.max(e.exposed, f.h.expose || 0);
      }
    }
  }

  /**
   * Boulders. Each one is let go onto the road beside its chute and rolls the
   * wrong way, upstream toward the door the cubes come in by, gathering pace.
   * Everything it meets is hit by how fast it is rolling, and the hit costs it
   * weight and pace; out of weight it breaks. A boss stops it dead unless it
   * is a landslide. Hidden cubes are hit, being run into rather than aimed at;
   * phased ones it passes through. Corners cost it pace, and a mine it rolls
   * over goes off under it, chipping it as it does.
   */
  rollBoulders(dt) {
    for (const t of this.towers) {
      const s = this.stats(t);
      if (!s.boulder || t.stunned > 0) continue;
      t.boulderClock = (t.boulderClock === undefined ? 1.5 : t.boulderClock) - dt;
      if (t.boulderClock > 0) continue;
      // Held back until there is something on the road to roll into.
      if (!this.enemies.some((e) => !e.immune)) { t.boulderClock = 0.25; continue; }
      t.boulderClock = Math.max(1.5, s.boulder.every);
      if (t.anchor === undefined) this.anchorOn(t);
      for (let k = 0; k < s.boulder.count; k++) {
        this.boulders.push({
          id: this.nextId++, by: t, distance: t.anchor, route: t.anchorRoute, speed: 1, wait: k * 0.6, travelled: 0,
          weight: s.boulder.weight, max: s.boulder.weight, damage: s.boulder.damage, top: s.boulder.top, run: s.boulder.run,
          burst: s.boulder.burst || 0, landslide: !!s.boulder.landslide, share: s.boulder.share || 0, hit: new Set(), seg: -1,
          x: t.anchorAt.x, y: t.anchorAt.y, tier: t.tiers[0],
        });
      }
      this.events.push({ type: "boulder", x: t.c + 0.5, y: t.r + 0.5 });
    }
    for (const b of this.boulders) {
      if (b.wait > 0) { b.wait -= dt; continue; }
      b.speed = Math.min(b.top, b.speed + BOULDER_PICKUP * dt);
      const step = b.speed * dt;
      b.distance -= step;
      b.travelled += step;
      const road = this.routes[b.route || 0].path;
      const seg = segmentAt(road, b.distance);
      if (b.seg >= 0 && seg !== b.seg) { b.speed *= 0.7; this.events.push({ type: "grind", x: b.x, y: b.y }); }
      b.seg = seg;
      const p = pointAt(road, b.distance);
      b.x = p.x; b.y = p.y;
      // What it meets is measured on the ground, so it runs into cubes on any
      // route that shares its road.
      for (const m of this.mines) {
        if (m.dead || m.fall > 0 || Math.hypot(m.x - b.x, m.y - b.y) > 0.3) continue;
        this.detonate(m);
        b.weight -= 30;
      }
      if (this.mines.some((m) => m.dead)) this.mines = this.mines.filter((m) => !m.dead);
      for (const e of this.enemies) {
        if (b.weight <= 0) break;
        if (e.dead || e.phased || e.immune || b.hit.has(e)) continue;
        if (Math.hypot(e.x - b.x, e.y - b.y) > 0.28 + e.spec.size * 0.5) continue;
        b.hit.add(e);
        const blow = b.damage * (0.25 + 0.75 * (b.speed / b.top)) + e.maxHp * b.share;
        const before = Math.max(0, e.hp) + e.shield;
        this.damage(e, blow, false, 0, b.by);
        const dealt = before - (Math.max(0, e.hp) + e.shield);
        b.weight -= Math.max(dealt, blow * 0.35);
        const big = !!e.spec.tough || e.spec.size >= 0.5;
        if (big && !b.landslide) b.weight = 0;
        b.speed *= big ? (b.landslide ? 0.85 : 0.55) : 0.85;
        if (b.landslide && !e.dead) e.distance = Math.max(this.routeOf(e).enterAt, e.distance - (big ? 0.3 : 0.8));
        this.events.push({ type: "crush", x: e.x, y: e.y, h: e.spec.size * 0.85, big, killed: !!e.dead, enemy: e.id });
      }
      if (b.weight <= 0 || b.distance <= 0 || b.travelled >= b.run) {
        b.done = true;
        if (b.burst) {
          for (const e of this.enemies) if (!e.dead && !e.phased && Math.hypot(e.x - b.x, e.y - b.y) <= b.burst) this.damage(e, b.damage * 0.5, false, 0, b.by);
        }
        this.events.push({ type: "rubble", x: b.x, y: b.y, burst: b.burst, tier: b.tier });
      }
    }
    if (this.boulders.length) this.boulders = this.boulders.filter((b) => !b.done);
  }

  /** Advance every shot; a shot that arrives lands and is dropped. */
  moveShots(dt) {
    for (const s of this.shots) {
      s.life -= dt;
      if (s.free) { this.flyOn(s, dt); continue; }
      const target = s.target && !s.target.dead ? s.target : null;
      // Follow the target while it lives. A blast shell flies on to where it
      // last was and bursts there; a single-target shot with nothing left to hit fizzles.
      // Keep aiming at where it will be, not where it is, so the shot runs
      // straight at the meeting point instead of curving in behind the cube.
      if (target) { const p = this.lead(s.x, s.y, target, s.speed); s.tx = p.x; s.ty = p.y; }
      else if (!s.stats.splash) { s.done = true; continue; }
      const dx = s.tx - s.x, dy = s.ty - s.y, dist = Math.hypot(dx, dy);
      const step = s.speed * dt;
      if (dist > 1e-4) { s.vx = dx / dist; s.vy = dy / dist; }
      if (dist <= step || s.life <= 0) {
        this.hit(s, { x: s.tx, y: s.ty }, target);
        // A shot that goes through carries on the way it was flying, into
        // whatever is walking behind the cube it struck.
        if (target && s.stats.passes && !s.stats.splash && !s.stats.chain && s.vx !== undefined) {
          s.free = true; s.left = s.stats.passes; s.struck = [target]; s.run = 3;
          s.x = s.tx; s.y = s.ty; s.life = Math.max(s.life, 1);
          continue;
        }
        s.done = true;
      } else {
        s.x += s.vx * step; s.y += s.vy * step;
      }
    }
    this.shots = this.shots.filter((s) => !s.done);
  }

  /** A shot flying on past what it struck: through the next cubes in its path, until it has gone far enough or struck enough. */
  flyOn(s, dt) {
    let travel = s.speed * dt;
    while (travel > 0 && !s.done) {
      const step = Math.min(0.15, travel); // small steps, so it cannot skip over a cube
      travel -= step;
      s.x += s.vx * step; s.y += s.vy * step; s.run -= step;
      for (const e of this.enemies) {
        if (e.dead || e.phased || e.immune || s.struck.includes(e)) continue;
        if (e.hidden && !s.stats.detect && !e.revealed) continue;
        if (Math.hypot(e.x - s.x, e.y - s.y) > e.spec.size * 0.6 + 0.08) continue;
        s.struck.push(e);
        s.target = e;
        this.hit(s, { x: e.x, y: e.y }, e);
        if (--s.left <= 0) { s.done = true; break; }
      }
      if (s.run <= 0 || s.life <= 0) s.done = true;
    }
    // Drawn at the height of the last cube it went through.
    s.tx = s.x; s.ty = s.y;
  }

  /** Continue past the campaign into endless waves. */
  goEndless() {
    if (this.phase === "won") this.phase = "build";
  }

  /** Nothing catches light on a cube that fire runs off. */
  fireproof(e) {
    const resist = e.spec.resist;
    return !!resist && resist.flame === 0;
  }

  /**
   * Where to aim so the shot and the cube arrive in the same place. The cube
   * runs along the road, so the guess is made along the road: take the time a
   * shot would need to reach where it stands, look that far ahead of it, and
   * refine until the two agree.
   */
  lead(fromX, fromY, e, speed) {
    const spec = e.spec;
    // Whatever it is doing now: bolting, slowed, or staggering backwards.
    const charge = chargeAt(spec, e.hp / e.maxHp);
    const v = e.dazed > 0 || e.stunLeft > 0 ? 0 : e.speed * charge * (1 - e.slow);
    if (!v) return { x: e.x, y: e.y };
    let time = Math.hypot(e.x - fromX, e.y - fromY) / speed;
    // A plain guess swings from one side of the answer to the other, so every
    // pass is averaged with the one before it. Four settle the meeting point
    // for anything the board can field, a mortar shell chasing a sprinter
    // included.
    for (let i = 0; i < 4; i++) {
      const p = pointAt(this.routeOf(e).path, Math.max(0, e.distance + v * time));
      time = (time + Math.hypot(p.x - fromX, p.y - fromY) / speed) / 2;
    }
    return pointAt(this.routeOf(e).path, Math.max(0, e.distance + v * time));
  }

  /** Can this tower reach that enemy: inside its range, outside any blind spot. */
  inReach(t, s, e) {
    const d = Math.hypot(e.x - (t.c + 0.5), e.y - (t.r + 0.5));
    return !e.phased && !e.immune && !(e.hidden && !s.detect && !e.revealed) && d <= s.range && !(s.minRange && d < s.minRange) && (s.lobs || this.sees(t, e));
  }

  fire(t, dt) {
    if (t.stunned > 0) return; // worn off in update
    const s = this.stats(t);
    if (!s.damage) return; // a mint has nothing to shoot with
    // Everything this tower does runs slower while a molten cube is beside it.
    const pace = 1 - (t.scorched || 0);
    const cx = t.c + 0.5, cy = t.r + 0.5;
    // Target the enemy furthest along the route that the tower can reach.
    // Which reachable enemy to aim at, by the tower's target mode.
    const better = (e, best) => {
      if (!best) return true;
      switch (t.target) {
        case "last": return this.progress(e) < this.progress(best);
        case "strong": return e.hp > best.hp || (e.hp === best.hp && this.progress(e) > this.progress(best));
        case "weak": return e.hp < best.hp || (e.hp === best.hp && this.progress(e) > this.progress(best));
        default: return this.progress(e) > this.progress(best);
      }
    };
    const pick = (skip) => {
      let best = null;
      for (const e of this.enemies) if (!e.dead && this.inReach(t, s, e) && !(skip && skip(e)) && better(e, best)) best = e;
      return best;
    };
    if (s.cone) {
      // Fire sweeps a cone toward the furthest reachable enemy and burns
      // everything inside it, hidden or not.
      const target = pick();
      t.flame = !!target;
      if (!target) return;
      t.aim = Math.atan2(target.y - cy, target.x - cx);
      const ax = Math.cos(t.aim), ay = Math.sin(t.aim);
      for (const e of this.enemies) {
        const dx = e.x - cx, dy = e.y - cy, d = Math.hypot(dx, dy);
        if (e.dead || d > s.range + 0.2) continue;
        if (d > 0.3 && (dx * ax + dy * ay) / d < s.coneCos) continue;
        this.damage(e, s.damage * pace * dt, !!s.pierce, dt, t);
        t.melts = !!s.melt; // its burning gets under armour
        if (!e.phased && !this.fireproof(e)) { e.burn = s.burnFor || BURN_FOR; e.burnDps = Math.max(e.burnDps, s.burn); e.burnBy = t; }
      }
      return;
    }
    if (s.beam) {
      // Beams hold their targets while they can, each heating toward double damage.
      const want = s.beams || 1;
      t.beams = (t.beams || []).filter((b) => !b.target.dead && this.inReach(t, s, b.target)).slice(0, want);
      while (t.beams.length < want) {
        const best = pick((e) => t.beams.some((b) => b.target === e));
        if (!best) break;
        t.beams.push({ target: best, heat: 0 });
      }
      if (!t.beams.length) return;
      t.aim = Math.atan2(t.beams[0].target.y - cy, t.beams[0].target.x - cx);
      t.spark = (t.spark || 0) - dt;
      const spark = t.spark <= 0;
      if (spark) t.spark = 0.12;
      for (const b of t.beams) {
        b.heat = Math.min(1, b.heat + dt * (s.heatRate || 0.5));
        this.damage(b.target, s.damage * (1 + b.heat) * pace * dt, s.pierce, dt, t);
        if (s.through) {
          // Everything along the line from the emitter to the target is cut too.
          const tx = b.target.x - cx, ty = b.target.y - cy, len = Math.hypot(tx, ty) || 1;
          for (const e of this.enemies) {
            if (e === b.target || e.dead) continue;
            const ex = e.x - cx, ey = e.y - cy, along = (ex * tx + ey * ty) / len;
            if (along < 0 || along > len) continue;
            if (Math.abs(ex * ty - ey * tx) / len < 0.35) this.damage(e, s.damage * (1 + b.heat) * pace * dt, s.pierce, dt, t);
          }
        }
        if (spark) this.events.push({ type: "hit", x: b.target.x, y: b.target.y, kind: t.kind });
      }
      return;
    }
    // Each barrel is a gun of its own: its own cooldown, its own aim, and its
    // own target when there are enough to go round. The rate is shared, so a
    // second barrel does not double the fire, it splits it.
    const guns = s.guns || 1;
    if (!t.guns || t.guns.length !== guns) t.guns = Array.from({ length: guns }, (_, i) => ({ aim: t.aim, cooldown: (i / guns) / s.rate }));
    const muzzle = { bolt: 0.55, cannon: 0.6, mortar: 0.31, sniper: 0.9, venom: 0.45, siege: 0.85 }[t.kind] || 0;
    const speed = { cannon: 6, mortar: 4, sniper: 75, arc: 80, venom: 13, siege: 9 }[t.kind] || 10;
    // A gun keeps its target between shots and tracks it, so barrels that fire
    // on different ticks still spread across the crowd instead of all
    // swinging to the same cube.
    for (const gun of t.guns) {
      if (gun.target && (gun.target.dead || !this.inReach(t, s, gun.target))) gun.target = null;
      if (gun.target) { const p = this.lead(cx, cy, gun.target, speed); gun.aim = Math.atan2(p.y - cy, p.x - cx); }
    }
    for (let i = 0; i < guns; i++) {
      const gun = t.guns[i];
      gun.cooldown -= dt;
      if (gun.cooldown > 0) continue;
      const held = new Set(t.guns.filter((other, j) => j !== i && other.target).map((other) => other.target));
      const best = pick((e) => held.has(e)) || pick();
      if (!best) { gun.target = null; continue; }
      gun.target = best;
      gun.cooldown = guns / (s.rate * Math.max(0.2, pace));
      const aimAt = this.lead(cx, cy, best, speed);
      gun.aim = Math.atan2(aimAt.y - cy, aimAt.x - cx);
      if (i === 0) t.aim = gun.aim;
      // The shot leaves that barrel's muzzle: out along its aim, and sideways
      // by where the barrel sits on the head.
      const lat = gunOffset(t.kind, i, guns);
      const x = cx + Math.cos(gun.aim) * muzzle - Math.sin(gun.aim) * lat, y = cy + Math.sin(gun.aim) * muzzle + Math.cos(gun.aim) * lat;
      this.shots.push({ x, y, target: best, tx: aimAt.x, ty: aimAt.y, speed, life: 2.5, kind: t.kind, tier: t.tiers[0] + t.tiers[1], stats: s, tower: t, total: Math.hypot(aimAt.x - x, aimAt.y - y) });
      this.events.push({ type: "shot", kind: t.kind, x, y, aim: gun.aim, tier: t.tiers[0] + t.tiers[1] });
    }
  }

  /** A shot lands at `at`; `target` is the enemy it was chasing, or null if that died on the way. */
  hit(shot, at, target) {
    const s = shot.stats;
    // A siege shot carries off a share of whatever it lands on as well as its
    // own weight, which is nothing against a runner and ruinous against a boss.
    const damage = (e, amount = s.damage + (s.heavy ? s.heavy * e.maxHp : 0)) => this.damage(e, amount, s.pierce || s.shred || false, 0, shot.tower);
    // Who is struck: everything in the blast, or the chain, or just the target.
    let struck = target ? [target] : [];
    if (s.splash) {
      struck = this.enemies.filter((e) => !e.dead && Math.hypot(e.x - at.x, e.y - at.y) <= s.splash);
      // A heavy shot takes its share only of what it lands on; the rest of the
      // blast is plain weight.
      for (const e of struck) (s.heavy && e !== target ? damage(e, s.damage) : damage(e));
    } else if (!target) {
      return;
    } else if (s.chain) {
      // Jump to the nearest enemy not yet struck, up to `chain` more times.
      let from = target, amount = s.damage;
      damage(target);
      for (let k = 0; k < s.chain; k++) {
        let next = null, nd = 1.4;
        for (const e of this.enemies) { if (e.dead || struck.includes(e)) continue; const d = Math.hypot(e.x - from.x, e.y - from.y); if (d < nd) { nd = d; next = e; } }
        if (!next) break;
        amount *= s.chainKeep;
        damage(next, amount);
        struck.push(next);
        from = next;
      }
      // The bolt runs from the coil to the first target, then on down the chain.
      const t = shot.tower;
      this.events.push({ type: "arc", from: { x: t.c + 0.5, y: t.r + 0.5, tier: t.tiers[0] + t.tiers[1] }, points: struck.map((e) => ({ x: e.x, y: e.y, h: e.spec.size * 0.85 })) });
    } else {
      damage(target);
    }
    for (const e of struck) {
      if (e.phased) continue;
      if (s.slow && this.chill(e, s.slow, s.slowFor)) {
        e.brittle = Math.max(e.brittle, s.brittle || 0);
        e.burn = 0; e.burnDps = 0; // ice puts the fire out
      }
      if (s.stun) this.stun(e, s.stun);
      if (s.daze && Math.random() < s.daze.chance) this.daze(e, s.daze.for);
      // Shoved back along the road. Weight tells: a runner goes the full
      // distance, a tank barely moves, and the bosses do not budge at all.
      if (s.knockback) {
        const size = e.spec.size;
        const give = size >= 0.55 || e.spec.tough ? 0 : Math.min(1, Math.pow(0.3 / size, 2));
        if (give) e.distance = Math.max(this.routeOf(e).enterAt, e.distance - s.knockback * give);
      }
      if (s.burn && !this.fireproof(e)) { e.burn = Math.max(e.burn, s.burnFor || BURN_FOR); e.burnDps = Math.max(e.burnDps, s.burn); e.burnBy = shot.tower; }
      if (s.poison) {
        e.venom = Math.max(e.venom, s.poisonFor || 4);
        e.venomDps = Math.max(e.venomDps, s.poison);
        e.venomSpread = Math.max(e.venomSpread, s.spread || 0);
        e.venomBy = shot.tower;
      }
    }
    this.events.push({
      type: "hit", x: at.x, y: at.y, kind: shot.kind, splash: s.splash || 0, h: target ? target.spec.size * 0.85 : 0.25,
      // Everything else the blast reached, so the view can show it struck.
      struck: s.splash ? struck.filter((e) => e !== target).map((e) => ({ x: e.x, y: e.y, h: e.spec.size * 0.85 })) : [],
    });
  }

  // ---- Saving --------------------------------------------------------
  /**
   * The run as it stands, as plain data. Between waves that is the board and
   * the purse; with a wave under way it is the road as well, the cubes on it,
   * those still to come, the mines, wails and boulders, and each tower's
   * clocks, so a page taken away mid-wave picks up at the same moment. What
   * points at something else is written as its id. Shots in the air and
   * anything only drawn are left out: they are over in a moment, and a shot
   * carries the stats it was fired with, which are worked out again anyway.
   */
  snapshot() {
    const snap = {
      map: this.map.id, cols: this.cols, rows: this.rows, difficulty: this.difficulty, sandbox: this.sandbox, gold: this.gold, lives: this.lives, maxLives: this.maxLives, wave: this.wave, cleared: this.cleared,
      kills: this.kills, phase: this.phase, props: this.propsCleared.slice(), nextId: this.nextId, nextRoute: this.nextRoute,
      towers: this.towers.map((t) => ({ id: t.id, kind: t.kind, c: t.c, r: t.r, tiers: t.tiers.slice(), power: t.power || 0, target: t.target, dealt: Math.round(t.dealt || 0), earned: Math.round(t.earned || 0), live: liveOf(t) })),
      // Long-fused mines lie there between waves too, so they are always kept.
      mines: this.mines.filter((m) => !m.dead).map((m) => ({ ...m, by: idOf(m.by), from: { x: m.from.x, y: m.from.y } })),
    };
    if (this.phase === "wave") {
      snap.road = {
        queue: this.queue.map((q) => ({ ...q })),
        waveClock: this.waveClock,
        leakedThisWave: this.leakedThisWave,
        // Every field a cube has, whatever it is, so one added later is kept
        // without this having to learn of it. Only the references are swapped.
        enemies: this.enemies.filter((e) => !e.dead).map((e) => {
          const { spec, burnBy, venomBy, heldBy, ...rest } = e;
          return { ...rest, burnBy: idOf(burnBy), venomBy: idOf(venomBy), heldBy: heldBy ? { x: heldBy.x, y: heldBy.y } : null };
        }),
        wails: this.wails.map((w) => ({ ...w, by: idOf(w.by), origins: w.origins.slice(), hit: idsOf(w.hit) })),
        boulders: this.boulders.filter((b) => !b.done).map((b) => ({ ...b, by: idOf(b.by), hit: idsOf(b.hit) })),
      };
    }
    return snap;
  }
  /**
   * A run back from a snapshot. A wave that was under way comes back as it
   * was; if what was saved of it cannot be read, the wave is set to be fought
   * again from the start instead, over the board as it stood.
   */
  static restore(map, snap) {
    // A run saved on a board of another size has nowhere to resume: every old
    // cell may still be in bounds, with the road somewhere else entirely. A
    // save from before a snapshot carried its size cannot say which board it
    // was built on, so it is refused the same way, the call dropOldBests()
    // makes for a best kept under no version.
    const { cols, rows } = sizeOf(map);
    if (snap.cols !== cols || snap.rows !== rows) throw new Error("saved on a board of another size");
    try {
      return Simulation.rebuild(map, snap);
    } catch (err) {
      const wave = snap.phase === "wave" ? Math.max(0, (snap.wave | 0) - 1) : snap.wave;
      const phase = snap.phase === "wave" ? "build" : snap.phase;
      const towers = Array.isArray(snap.towers) ? snap.towers.map(({ live, ...t }) => t) : snap.towers;
      return Simulation.rebuild(map, { ...snap, wave, phase, towers, road: null, mines: null });
    }
  }
  static rebuild(map, snap) {
    const g = new Simulation(map, snap.difficulty || "easy", !!snap.sandbox);
    g.gold = snap.gold; g.wave = snap.wave; g.cleared = snap.cleared;
    // A run keeps the lives it had. The row they are drawn in is whatever the
    // difficulty gives unless the save says otherwise, so a save from before
    // this was written still comes back with a row that fits.
    if (Number.isFinite(snap.maxLives) && snap.maxLives > 0) g.maxLives = Math.round(snap.maxLives);
    g.lives = Number.isFinite(snap.lives) ? Math.min(g.maxLives, Math.round(snap.lives)) : g.maxLives;
    g.kills = snap.kills || 0; g.phase = snap.phase === "lost" ? "build" : snap.phase;
    // Ids carry on from where the run left them, so what the save points at still matches.
    if (Number.isInteger(snap.nextId) && snap.nextId > 0) g.nextId = snap.nextId;
    // And the routes take their turns where they left off.
    if (Number.isInteger(snap.nextRoute) && snap.nextRoute >= 0) g.nextRoute = snap.nextRoute;
    const towerById = new Map();
    // Props the run had cleared, and any a tower from before there were props
    // is standing on.
    const gone = [...(Array.isArray(snap.props) ? snap.props : []), ...snap.towers.map((t) => t.c + "," + t.r)];
    for (const key of gone) if (g.props.delete(key)) g.propsCleared.push(key);
    g.propsVersion += 1;
    for (const t of snap.towers) {
      if (!TOWERS[t.kind] || !g.canBuild(t.c, t.r)) continue;
      // Older saves had one tier number: it becomes progress on the first path.
      const tiers = Array.isArray(t.tiers) ? [Math.min(t.tiers[0] | 0, MAX_TIER), Math.min(t.tiers[1] | 0, MAX_TIER)] : [Math.min(t.tier | 0, MAX_TIER), 0];
      if (tiers[0] > CROSS_CAP && tiers[1] > CROSS_CAP) tiers[1] = CROSS_CAP;
      // Older saves carry no ids, and those towers are simply numbered afresh.
      const id = Number.isInteger(t.id) && t.id > 0 && !towerById.has(t.id) ? t.id : g.nextId++;
      g.towers.push({ id, kind: t.kind, c: t.c, r: t.r, tiers, power: Math.max(0, t.power | 0), cooldown: 0, aim: 0, target: TARGETS.includes(t.target) ? t.target : "first", dealt: Math.max(0, t.dealt | 0), earned: Math.max(0, t.earned | 0) });
      const back = g.towers[g.towers.length - 1];
      towerById.set(id, back);
      if (g.stats(back).pull || g.stats(back).urn || g.stats(back).boulder) g.anchorOn(back);
      if (t.live) g.resumeTower(back, t.live);
    }
    if (Array.isArray(snap.mines)) g.mines = snap.mines.map((m) => g.mineFrom(m, towerById));
    const enemyById = g.phase === "wave" ? g.resumeRoad(snap.road, towerById) : new Map();
    // A gun or beam keeps the cube it had, if that cube is still about.
    for (const t of g.towers) {
      if (t.savedGuns) t.guns = t.savedGuns.map((gun) => ({ aim: finite(gun.aim), cooldown: finite(gun.cooldown), target: enemyById.get(gun.target) || null }));
      if (t.savedBeams) t.beams = t.savedBeams.map((b) => ({ target: enemyById.get(b.target), heat: finite(b.heat) })).filter((b) => b.target);
      delete t.savedGuns; delete t.savedBeams;
    }
    // Nothing new may take an id something restored already has.
    for (const o of [...g.towers, ...g.enemies, ...g.mines, ...g.wails, ...g.boulders]) if (o.id >= g.nextId) g.nextId = o.id + 1;
    return g;
  }

  /** A tower's clocks and holds as they were saved. The anchors are found again rather than read. */
  resumeTower(t, live) {
    for (const key of TOWER_LIVE) if (plain(live[key])) t[key] = live[key];
    if (typeof live.dealt === "number" && isFinite(live.dealt)) t.dealt = Math.max(0, live.dealt);
    if (typeof live.earned === "number" && isFinite(live.earned)) t.earned = Math.max(0, live.earned);
    // Held cubes are linked up once the road is back.
    if (Array.isArray(live.guns)) t.savedGuns = live.guns;
    if (Array.isArray(live.beams)) t.savedBeams = live.beams;
    if (Array.isArray(live.tears)) {
      t.tears = live.tears.map((tr) => ({ x: finite(tr.x), y: finite(tr.y), left: finite(tr.left), most: finite(tr.most), taken: finite(tr.taken), hole: !!tr.hole }));
    }
  }

  mineFrom(m, towerById) {
    if (!this.routes[m.route | 0]) throw new Error("mine on a road the map does not have");
    return {
      id: finite(m.id), by: towerById.get(m.by) || null, distance: finite(m.distance), route: m.route | 0, x: finite(m.x), y: finite(m.y),
      damage: finite(m.damage), splash: finite(m.splash), fall: finite(m.fall), keep: !!m.keep,
      from: { x: finite(m.from && m.from.x), y: finite(m.from && m.from.y) },
    };
  }

  /**
   * The wave under way, back on the road: the queue and its clock, the cubes
   * with every field they had, then everything that points at a cube or a
   * tower linked up by id. Gives back the cubes by id, for the towers' holds
   * on them. Anything malformed throws, and `restore` falls back to the
   * board between waves.
   */
  resumeRoad(road, towerById) {
    if (!road || !Array.isArray(road.queue) || !Array.isArray(road.enemies)) throw new Error("no wave saved");
    this.waveClock = finite(road.waveClock);
    this.leakedThisWave = !!road.leakedThisWave;
    // A kind no longer in the schedule has nowhere to walk, so it is left out.
    this.queue = road.queue.filter((q) => q && ENEMIES[q.type]).map((q) => {
      const next = { type: q.type, at: finite(q.at) };
      if (q.mut !== undefined) next.mut = q.mut && MUTATIONS[q.mut] ? q.mut : null;
      if (q.finale) next.finale = true;
      return next;
    });
    const enemyById = new Map();
    const nextId = this.nextId, nextRoute = this.nextRoute;
    for (const saved of road.enemies) {
      if (!saved || !ENEMIES[saved.type]) continue;
      const route = saved.route | 0;
      if (!this.routes[route]) throw new Error("cube on a road the map does not have");
      for (const key of ["hp", "maxHp", "distance", "x", "y"]) finite(saved[key]);
      // Spawned first so every field has its starting value, then overlaid
      // with what was saved, leaving the spec to be looked up from the kind.
      const mut = saved.mut && MUTATIONS[saved.mut] ? saved.mut : null;
      this.spawn(saved.type, 0, mut, route);
      const e = this.enemies[this.enemies.length - 1];
      for (const [key, value] of Object.entries(saved)) {
        if (key === "spec" || key === "mut" || key === "route" || key === "burnBy" || key === "venomBy" || key === "heldBy") continue;
        if (plain(value)) e[key] = value;
      }
      e.burnBy = towerById.get(saved.burnBy) || null;
      e.venomBy = towerById.get(saved.venomBy) || null;
      if (saved.heldBy) e.heldBy = { x: finite(saved.heldBy.x), y: finite(saved.heldBy.y) };
      enemyById.set(e.id, e);
    }
    // Spawning moved these on; they belong where the run had them.
    this.nextId = nextId;
    this.nextRoute = nextRoute;
    const cubes = (ids) => new Set((Array.isArray(ids) ? ids : []).map((id) => enemyById.get(id)).filter(Boolean));
    this.wails = (Array.isArray(road.wails) ? road.wails : []).map((w) => {
      if (!Array.isArray(w.origins) || w.origins.length !== this.routes.length) throw new Error("wail on roads the map does not have");
      return {
        id: finite(w.id), by: towerById.get(w.by) || null, origins: w.origins.map((o) => (o === null ? null : finite(o))),
        front: finite(w.front), span: finite(w.span), damage: finite(w.damage), slow: finite(w.slow), stun: finite(w.stun), hit: cubes(w.hit), souls: finite(w.souls),
      };
    });
    this.boulders = (Array.isArray(road.boulders) ? road.boulders : []).map((b) => {
      if (!this.routes[b.route | 0]) throw new Error("boulder on a road the map does not have");
      const back = { hit: cubes(b.hit), by: towerById.get(b.by) || null, route: b.route | 0 };
      for (const key of ["id", "distance", "speed", "wait", "travelled", "weight", "max", "damage", "top", "run", "burst", "share", "seg", "x", "y", "tier"]) back[key] = finite(b[key]);
      back.landslide = !!b.landslide;
      return back;
    });
    return enemyById;
  }
}

/** The per-tower fields that are plain numbers or flags, kept for a wave under way. */
const TOWER_LIVE = ["cooldown", "aim", "stunned", "flame", "spark", "melts", "souls", "mineClock", "riftClock", "opened", "boulderClock", "builtIn", "scorched"];

/** A tower's live state as plain data, cubes it holds written as ids. */
function liveOf(t) {
  const live = { dealt: t.dealt || 0, earned: t.earned || 0 };
  for (const key of TOWER_LIVE) if (plain(t[key])) live[key] = t[key];
  if (t.guns) live.guns = t.guns.map((gun) => ({ aim: gun.aim, cooldown: gun.cooldown, target: idOf(gun.target) }));
  if (t.beams) live.beams = t.beams.map((b) => ({ target: idOf(b.target), heat: b.heat }));
  if (t.tears) live.tears = t.tears.map((tr) => ({ ...tr }));
  return live;
}

function idOf(o) { return o && o.id !== undefined ? o.id : null; }
function idsOf(set) { return [...set].map(idOf).filter((id) => id !== null); }
/** A value that survives being written out as it is: a finite number, a flag or a string. */
function plain(v) { return typeof v === "boolean" || typeof v === "string" || (typeof v === "number" && isFinite(v)); }
/** A saved number that has to be one. Anything else means the save cannot be trusted. */
function finite(v) {
  if (typeof v !== "number" || !isFinite(v)) throw new Error("not a number where one was saved");
  return v;
}
