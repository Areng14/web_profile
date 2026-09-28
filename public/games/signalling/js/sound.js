// Sound, synthesised in the page: a short click when a route sets, a low
// buzz when the interlocking refuses, a two-note chime for an alarm, a
// rising pair when a step of the lesson is done, and a ding when a train
// comes onto the desk. All of it sits under a master
// level; the ding has a level of its own, and the rest an effects level,
// so a busy desk can quieten one without losing the other.

let ctx = null;
const levels = { master: 0.5, effects: 0.8, arrivals: 0.8 };

function ensure() {
  if (typeof window === "undefined") return null;
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return null;
  if (!ctx) ctx = new Ctx();
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  return ctx;
}

function tone(freq, dur, type, gain, delay = 0, channel = "effects") {
  const c = ensure();
  if (!c) return;
  const level = gain * levels.master * levels[channel];
  if (level <= 0.001) return;
  const osc = c.createOscillator();
  const amp = c.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  const at = c.currentTime + delay;
  amp.gain.setValueAtTime(0.0001, at);
  amp.gain.exponentialRampToValueAtTime(level, at + 0.008);
  amp.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  osc.connect(amp).connect(c.destination);
  osc.start(at);
  osc.stop(at + dur + 0.02);
}

/** Play one of the named sounds. */
export function play(name) {
  switch (name) {
    case "set": tone(1320, 0.05, "square", 0.05); break;
    case "click": tone(900, 0.03, "square", 0.04); break;
    case "refuse": tone(150, 0.2, "sawtooth", 0.08); break;
    case "alarm": tone(988, 0.14, "sine", 0.12); tone(740, 0.16, "sine", 0.12, 0.16); break;
    case "end": tone(523, 0.2, "sine", 0.1); tone(659, 0.2, "sine", 0.1, 0.2); tone(784, 0.3, "sine", 0.1, 0.4); break;
    case "step": tone(784, 0.12, "sine", 0.08); tone(1175, 0.2, "sine", 0.08, 0.1); break;
    // A single struck note with a faint octave over it, like a bell.
    case "arrive": tone(1568, 0.45, "sine", 0.07, 0, "arrivals"); tone(3136, 0.25, "sine", 0.02, 0, "arrivals"); break;
    default: break;
  }
}

export function setLevel(which, value) {
  if (which in levels) levels[which] = Math.max(0, Math.min(1, value));
}

export function levelOf(which) {
  return levels[which];
}

export function setLevels(kept) {
  if (!kept) return;
  for (const k of Object.keys(levels)) if (Number.isFinite(kept[k])) setLevel(k, kept[k]);
}

export function allLevels() {
  return { ...levels };
}
