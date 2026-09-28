// All sound is synthesised here with the Web Audio API: no files, nothing
// fetched. The context is created on the first pointer or key press, as
// browsers require. Everything is short and quiet; the mix is meant to sit
// under the simulation, not on top of it.
const SOUND_KEY = "td.sound";
const VOLUME_KEY = "td.volume";

// Everything runs through the master, which the mute switch silences. Under
// it the music and the sound effects each have a level of their own.
let ctx = null, master = null, musicBus = null, sfxBus = null, noiseBuffer = null;
let muted = false;
let volume = { music: 1, sfx: 1 };
try { muted = localStorage.getItem(SOUND_KEY) === "0"; } catch {}
try {
  const saved = JSON.parse(localStorage.getItem(VOLUME_KEY) || "null");
  const level = (v) => (typeof v === "number" && v >= 0 && v <= 1 ? v : 1);
  if (saved) volume = { music: level(saved.music), sfx: level(saved.sfx) };
} catch {}

/** Create the context. Safe to call repeatedly; does nothing until a user gesture. */
export function initAudio() {
  if (ctx) { if (ctx.state === "suspended") ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = muted ? 0 : 0.6;
  master.connect(ctx.destination);
  musicBus = ctx.createGain(); musicBus.gain.value = volume.music; musicBus.connect(master);
  sfxBus = ctx.createGain(); sfxBus.gain.value = volume.sfx; sfxBus.connect(master);
  // A second of white noise, reused for every hiss, thump and crackle.
  noiseBuffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const data = noiseBuffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  startMusic();
}

// ---- Music ----------------------------------------------------------------
// A very quiet, slow, generative pad: notes from a pentatonic scale drift in
// and out over a low drone, a new one every few seconds, never the same
// twice. It is meant to be barely there.
const SCALE = [146.83, 174.61, 196, 220, 261.63, 293.66, 349.23, 392, 440, 523.25]; // D E F# A C D E F# A C, no semitones anywhere
let music = null;
function startMusic() {
  if (music) return;
  const out = ctx.createGain(); out.gain.value = 0.16; out.connect(musicBus);
  const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 1400; lp.connect(out);
  // A soft echo for space.
  const delay = ctx.createDelay(1.5); delay.delayTime.value = 0.42;
  const fb = ctx.createGain(); fb.gain.value = 0.45; const wet = ctx.createGain(); wet.gain.value = 0.35;
  lp.connect(delay); delay.connect(fb); fb.connect(delay); delay.connect(wet); wet.connect(out);
  // The drone: D two octaves down, barely moving.
  for (const [freq, level] of [[73.42, 0.5], [110, 0.25], [146.83, 0.12]]) {
    const o = ctx.createOscillator(); o.type = "sine"; o.frequency.value = freq;
    const g = ctx.createGain(); g.gain.value = level;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.05 + Math.random() * 0.04; const lg = ctx.createGain(); lg.gain.value = level * 0.3; lfo.connect(lg); lg.connect(g.gain); lfo.start();
    o.connect(g); g.connect(lp); o.start();
  }
  const note = (freq, at, dur, level) => {
    const o = ctx.createOscillator(); o.type = "triangle"; o.frequency.value = freq;
    const o2 = ctx.createOscillator(); o2.type = "sine"; o2.frequency.value = freq * 2.001;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(level, at + dur * 0.35);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    const g2 = ctx.createGain(); g2.gain.value = 0.25; o2.connect(g2); g2.connect(g);
    o.connect(g); g.connect(lp);
    o.start(at); o2.start(at); o.stop(at + dur + 0.1); o2.stop(at + dur + 0.1);
  };
  let next = ctx.currentTime + 1.5, last = -1;
  const tick = () => {
    while (next < ctx.currentTime + 1.2) {
      let i = Math.floor(Math.random() * SCALE.length);
      if (i === last) i = (i + 2) % SCALE.length;
      last = i;
      const dur = 4 + Math.random() * 4;
      note(SCALE[i], next, dur, 0.09);
      if (Math.random() < 0.3) note(SCALE[(i + 2) % SCALE.length], next + 0.4 + Math.random() * 0.8, dur, 0.06);
      next += 2 + Math.random() * 3.5;
    }
  };
  music = { timer: setInterval(tick, 400) };
  tick();
}
export function isMuted() { return muted; }
export function setMuted(m) {
  muted = m;
  try { localStorage.setItem(SOUND_KEY, m ? "0" : "1"); } catch {}
  if (master) master.gain.setTargetAtTime(m ? 0 : 0.6, ctx.currentTime, 0.02);
}
/** The music and sound effect levels, each from 0 to 1. */
export function getVolume() { return { ...volume }; }
export function setVolume(next) {
  volume = { ...volume, ...next };
  try { localStorage.setItem(VOLUME_KEY, JSON.stringify(volume)); } catch {}
  if (!ctx) return;
  musicBus.gain.setTargetAtTime(volume.music, ctx.currentTime, 0.03);
  sfxBus.gain.setTargetAtTime(volume.sfx, ctx.currentTime, 0.03);
}

// ---- Building blocks --------------------------------------------------
function tone({ freq, to = freq, type = "sine", dur = 0.1, gain = 0.1, at = 0, attack = 0.005, filter = 0, q = 1 }) {
  const t0 = ctx.currentTime + at;
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (to !== freq) osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), t0 + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  let node = osc;
  if (filter) { const f = ctx.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = filter; f.Q.value = q; osc.connect(f); node = f; }
  node.connect(g); g.connect(sfxBus);
  osc.start(t0); osc.stop(t0 + dur + 0.05);
}
function noise({ dur = 0.1, gain = 0.1, at = 0, type = "lowpass", freq = 1000, to = 0, q = 1, attack = 0.003 }) {
  const t0 = ctx.currentTime + at;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer;
  src.loop = true;
  src.playbackRate.value = 0.8 + Math.random() * 0.4;
  const f = ctx.createBiquadFilter();
  f.type = type; f.frequency.setValueAtTime(freq, t0); f.Q.value = q;
  if (to) f.frequency.exponentialRampToValueAtTime(Math.max(40, to), t0 + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(f); f.connect(g); g.connect(sfxBus);
  src.start(t0); src.stop(t0 + dur + 0.05);
}

// ---- One-shots ----------------------------------------------------------
// Many towers fire at once; the same sound is allowed a few times per short
// window and then dropped, so a wave never turns into a wall of clicks.
const recent = new Map();
function allow(name, limit = 3, window = 0.07) {
  const t = ctx.currentTime;
  const list = (recent.get(name) || []).filter((x) => t - x < window);
  if (list.length >= limit) return false;
  list.push(t); recent.set(name, list);
  return true;
}

const SOUNDS = {
  // Bolt: a soft, low "pft" rather than a click, and rationed harder below.
  "shot:bolt": () => tone({ freq: 420, to: 190, dur: 0.045, gain: 0.03, filter: 1100 }),
  "shot:cannon": () => { noise({ dur: 0.16, gain: 0.22, freq: 500, to: 120 }); tone({ freq: 95, to: 40, dur: 0.22, gain: 0.25 }); },
  "shot:mortar": () => { noise({ dur: 0.22, gain: 0.2, freq: 360, to: 90 }); tone({ freq: 70, to: 32, dur: 0.3, gain: 0.28 }); tone({ freq: 700, to: 1800, type: "sine", dur: 0.5, gain: 0.02, at: 0.05 }); },
  "shot:burst": () => { noise({ dur: 0.07, gain: 0.14, type: "bandpass", freq: 1400, q: 1.5 }); tone({ freq: 520, to: 180, dur: 0.09, gain: 0.08 }); },
  // Frost: a breath of cold air, rising hiss with an icy edge, no note.
  "shot:frost": () => { noise({ dur: 0.2, gain: 0.07, type: "bandpass", freq: 2600, to: 9000, q: 0.9, attack: 0.03 }); noise({ dur: 0.12, gain: 0.03, type: "highpass", freq: 7000, at: 0.04 }); },
  "shot:arc": () => { noise({ dur: 0.11, gain: 0.16, type: "bandpass", freq: 2800, q: 2.5 }); tone({ freq: 2400, to: 900, type: "sawtooth", dur: 0.05, gain: 0.04, filter: 3000 }); },
  lay: () => { noise({ dur: 0.09, gain: 0.07, type: "bandpass", freq: 700, q: 1.4 }); tone({ freq: 260, to: 150, dur: 0.1, gain: 0.05 }); },
  mine: () => { noise({ dur: 0.3, gain: 0.26, freq: 900, to: 90 }); tone({ freq: 110, to: 34, dur: 0.34, gain: 0.28 }); tone({ freq: 1400, to: 300, type: "square", dur: 0.09, gain: 0.05 }); },
  "shot:venom": () => { noise({ dur: 0.13, gain: 0.09, type: "bandpass", freq: 900, to: 300, q: 1.2 }); tone({ freq: 300, to: 120, type: "sine", dur: 0.16, gain: 0.05 }); },
  "shot:siege": () => { noise({ dur: 0.26, gain: 0.2, freq: 260, to: 70 }); tone({ freq: 60, to: 28, dur: 0.36, gain: 0.3 }); tone({ freq: 180, to: 90, type: "square", dur: 0.14, gain: 0.05 }); },
  "shot:sniper": () => { noise({ dur: 0.07, gain: 0.26, type: "highpass", freq: 1800 }); tone({ freq: 1600, to: 220, type: "square", dur: 0.09, gain: 0.08, filter: 2600 }); },
  // Impacts are pure bass: a sine dropping in pitch, no noise on top.
  "hit:cannon": () => tone({ freq: 85, to: 32, dur: 0.28, gain: 0.3 }),
  "hit:mortar": () => tone({ freq: 65, to: 26, dur: 0.42, gain: 0.36 }),
  "hit:burst": () => tone({ freq: 120, to: 45, dur: 0.16, gain: 0.2 }),
  "hit:sniper": () => tone({ freq: 150, to: 55, dur: 0.1, gain: 0.16 }),
  "hit:frost": () => tone({ freq: 130, to: 70, dur: 0.1, gain: 0.08 }),
  leak: () => { tone({ freq: 220, to: 110, type: "sawtooth", dur: 0.4, gain: 0.14, filter: 900 }); tone({ freq: 165, to: 82, type: "sawtooth", dur: 0.4, gain: 0.08, filter: 700, at: 0.04 }); },
  wave: () => { tone({ freq: 330, to: 660, dur: 0.22, gain: 0.08 }); tone({ freq: 495, to: 990, dur: 0.22, gain: 0.04, at: 0.03 }); },
  cleared: () => { [523, 659, 784].forEach((f, i) => tone({ freq: f, dur: 0.16, gain: 0.08, at: i * 0.09 })); },
  won: () => { [523, 659, 784, 1046].forEach((f, i) => tone({ freq: f, dur: 0.35, gain: 0.09, at: i * 0.12 })); },
  lost: () => { tone({ freq: 440, to: 110, type: "sawtooth", dur: 1.1, gain: 0.14, filter: 1200 }); tone({ freq: 330, to: 82, type: "sawtooth", dur: 1.1, gain: 0.08, filter: 900, at: 0.05 }); },
  // A prop cleared: a crunch and a falling note.
  clear: () => { noise({ dur: 0.28, gain: 0.16, freq: 1400, to: 160 }); tone({ freq: 320, to: 90, dur: 0.26, gain: 0.08 }); tone({ freq: 1500, to: 700, type: "sine", dur: 0.12, gain: 0.03, at: 0.04 }); },
  place: () => { noise({ dur: 0.06, gain: 0.14, freq: 600 }); tone({ freq: 210, to: 140, dur: 0.09, gain: 0.1 }); },
  upgrade: () => { tone({ freq: 660, dur: 0.1, gain: 0.07 }); tone({ freq: 880, dur: 0.14, gain: 0.07, at: 0.09 }); },
  sell: () => { tone({ freq: 880, dur: 0.1, gain: 0.06 }); tone({ freq: 550, dur: 0.14, gain: 0.06, at: 0.09 }); },
  denied: () => tone({ freq: 200, to: 160, type: "square", dur: 0.09, gain: 0.04, filter: 800 }),
  absorb: () => { tone({ freq: 300, to: 900, dur: 0.5, gain: 0.06 }); noise({ dur: 0.4, gain: 0.05, type: "bandpass", freq: 1500, to: 3500, q: 2 }); },
  consecrate: () => { tone({ freq: 110, to: 440, type: "sawtooth", dur: 1.3, gain: 0.16, filter: 2200, attack: 0.3 }); [440, 660, 880, 1320].forEach((f, i) => tone({ freq: f, dur: 0.8, gain: 0.05, at: 0.5 + i * 0.1 })); },
  click: () => tone({ freq: 900, dur: 0.03, gain: 0.03 }),
  // A second off the clock before a wave starts itself: drier and lower
  // than a click, so a countdown does not sound like being clicked at.
  tick: () => { tone({ freq: 620, dur: 0.045, gain: 0.035 }); noise({ dur: 0.02, gain: 0.02, type: "bandpass", freq: 2400, q: 3 }); },
  // What the ticks were counting towards: the same note, an octave up and
  // with a floor under it, so the count resolves rather than just stopping.
  go: () => {
    tone({ freq: 620, to: 1240, dur: 0.18, gain: 0.07 });
    tone({ freq: 310, to: 620, dur: 0.26, gain: 0.05, type: "triangle" });
    tone({ freq: 90, to: 60, dur: 0.22, gain: 0.12 });
    noise({ dur: 0.12, gain: 0.05, type: "bandpass", freq: 1800, to: 600, q: 1.5 });
  },
  raise: () => { tone({ freq: 160, to: 320, type: "sawtooth", dur: 0.5, gain: 0.05, filter: 700, attack: 0.15 }); noise({ dur: 0.4, gain: 0.04, freq: 500, to: 150 }); },
  coins: () => { [880, 1175, 1568].forEach((f, i) => tone({ freq: f, dur: 0.18, gain: 0.05, at: i * 0.05 })); noise({ dur: 0.12, gain: 0.03, type: "bandpass", freq: 4200, q: 2 }); },
  heal: () => { [659, 880, 1319].forEach((f, i) => tone({ freq: f, dur: 0.5, gain: 0.05, at: i * 0.12, attack: 0.08 })); },
  emp: () => { noise({ dur: 0.3, gain: 0.18, type: "bandpass", freq: 1800, to: 200, q: 1.5 }); tone({ freq: 900, to: 90, type: "sawtooth", dur: 0.45, gain: 0.08, filter: 1600 }); },
  // A soul going in: a faint, breathy rising note.
  soul: () => { tone({ freq: 740, to: 1180, type: "sine", dur: 0.28, gain: 0.018, attack: 0.08 }); },
  // A wail: two voices sliding down against each other over a rush of air.
  // A boulder let go: a low scrape and a thump as it drops onto the road.
  // A tear: a rising, hollow suck of air, and a pop as it closes.
  // A black hole opening: a long falling roar under the tear's own sound.
  hole: () => { noise({ dur: 1.1, gain: 0.12, type: "lowpass", freq: 900, to: 120, q: 1 }); tone({ freq: 220, to: 55, type: "sine", dur: 1, gain: 0.09 }); tone({ freq: 1200, to: 300, type: "sine", dur: 0.35, gain: 0.04 }); },
  // Something going into one: a short drop in pitch, gone.
  swallow: () => { tone({ freq: 700, to: 90, type: "sine", dur: 0.22, gain: 0.07 }); noise({ dur: 0.18, gain: 0.05, type: "bandpass", freq: 1800, to: 200, q: 3 }); },
  rift: () => { noise({ dur: 0.45, gain: 0.1, type: "bandpass", freq: 300, to: 2600, q: 2 }); tone({ freq: 180, to: 900, type: "sine", dur: 0.4, gain: 0.06 }); tone({ freq: 1400, to: 500, type: "sine", dur: 0.12, gain: 0.05, at: 0.4 }); },
  boulder: () => { noise({ dur: 0.35, gain: 0.12, type: "bandpass", freq: 300, to: 120, q: 0.8 }); tone({ freq: 70, to: 40, dur: 0.3, gain: 0.2, at: 0.18 }); },
  crush: () => { tone({ freq: 110, to: 45, dur: 0.14, gain: 0.16 }); noise({ dur: 0.08, gain: 0.08, freq: 700, to: 200 }); },
  "crush:big": () => { tone({ freq: 60, to: 28, dur: 0.35, gain: 0.3 }); noise({ dur: 0.25, gain: 0.14, freq: 400, to: 90 }); },
  rubble: () => { noise({ dur: 0.4, gain: 0.14, type: "bandpass", freq: 900, to: 150, q: 0.7 }); tone({ freq: 90, to: 40, dur: 0.25, gain: 0.12 }); },
  wail: () => {
    tone({ freq: 880, to: 220, type: "sawtooth", dur: 1.1, gain: 0.07, filter: 1800, attack: 0.06 });
    tone({ freq: 932, to: 196, type: "sawtooth", dur: 1.2, gain: 0.05, filter: 1400, attack: 0.1 });
    noise({ dur: 0.9, gain: 0.08, type: "bandpass", freq: 2400, to: 400, q: 0.8 });
  },
};

// Sounds that would otherwise fire constantly get a tighter ration.
const LIMITS = { "shot:bolt": [1, 0.11], "shot:frost": [2, 0.15], soul: [2, 0.12], swallow: [2, 0.1] };

/** Play a named sound; `size` (enemy size) pitches a kill. */
export function play(name, size) {
  if (!ctx || muted || volume.sfx <= 0) return;
  if (name === "kill") {
    if (!allow("kill", 4)) return;
    const f = 1400 / (0.5 + (size || 0.3) * 3);
    noise({ dur: 0.07, gain: 0.12, type: "bandpass", freq: f, q: 1.2 });
    tone({ freq: f * 0.5, to: f * 0.25, dur: 0.08, gain: 0.05 });
    return;
  }
  const fn = SOUNDS[name];
  const [limit, window] = LIMITS[name] || [3, 0.07];
  if (!fn || !allow(name, limit, window)) return;
  fn();
}

// ---- Loops --------------------------------------------------------------
// Beams and fire hum while active; their gain follows how many are going.
const loops = {};
function loop(name, build) {
  if (loops[name]) return loops[name];
  const g = ctx.createGain(); g.gain.value = 0.0001; g.connect(sfxBus);
  build(g);
  return (loops[name] = { g });
}
function buildLoops() {
  loop("laser", (g) => {
    const f = ctx.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = 700; f.connect(g);
    for (const [freq, type] of [[110, "sawtooth"], [220, "sine"], [221.5, "sine"]]) { const o = ctx.createOscillator(); o.type = type; o.frequency.value = freq; o.connect(f); o.start(); }
  });
  loop("prism", (g) => {
    // A glassy shimmer: high pure partials in slightly detuned pairs that
    // beat gently against each other, each breathing on its own slow cycle,
    // with a short echo for an airy tail. No pitch wobble anywhere.
    const hp = ctx.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 700;
    const delay = ctx.createDelay(0.5); delay.delayTime.value = 0.19;
    const fb = ctx.createGain(); fb.gain.value = 0.4;
    const wet = ctx.createGain(); wet.gain.value = 0.5;
    hp.connect(g); hp.connect(delay); delay.connect(fb); fb.connect(delay); delay.connect(wet); wet.connect(g);
    const partials = [[880, 1], [883.5, 0.8], [1318.5, 0.55], [1322, 0.45], [1760, 0.3], [1764, 0.25], [2637, 0.14]];
    partials.forEach(([freq, level], k) => {
      const o = ctx.createOscillator(); o.frequency.value = freq;
      const amp = ctx.createGain(); amp.gain.value = level * 0.5;
      // Slow breathing, a different pace for each partial so they twinkle.
      const lfo = ctx.createOscillator(); lfo.frequency.value = 0.17 + k * 0.09;
      const depth = ctx.createGain(); depth.gain.value = level * 0.4;
      lfo.connect(depth); depth.connect(amp.gain); lfo.start(ctx.currentTime + k * 0.3);
      o.connect(amp); amp.connect(hp); o.start();
    });
  });
  loop("flame", (g) => {
    const src = ctx.createBufferSource(); src.buffer = noiseBuffer; src.loop = true;
    const f = ctx.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = 900;
    src.connect(f); f.connect(g); src.start();
  });
}
/** Set how many of each looping source are active this frame. */
export function setLoops({ laser = 0, prism = 0, flame = 0 }) {
  if (!ctx) return;
  if (!loops.laser) buildLoops();
  const t = ctx.currentTime;
  const target = (n, per, max) => (muted ? 0.0001 : Math.max(0.0001, Math.min(max, n * per)));
  loops.laser.g.gain.setTargetAtTime(target(laser, 0.035, 0.12), t, 0.08);
  loops.prism.g.gain.setTargetAtTime(target(prism, 0.012, 0.03), t, 0.2);
  loops.flame.g.gain.setTargetAtTime(target(flame, 0.06, 0.14), t, 0.08);
}
