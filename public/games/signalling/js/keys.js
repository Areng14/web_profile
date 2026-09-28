// The keys the desk answers to, in one table that the handler and the tips on
// the buttons are built from and the written guide's Appendix A is held to by
// a test, so none of them can say something the others do not. One action to a key, from the
// letters, the number row and the arrows, grouped the way the screen is.
// Nothing here is read while a box is being typed in.

/**
 * Every key: `key` as the browser names it (a letter in lower case), `id` the
 * action it runs, `group` and `does` what the guide calls it, `repeat` for one
 * that goes on while it is held, and `el` the control whose tip shows the key.
 */
export const KEYS = [
  { key: "0", id: "hold", group: "The clock", does: "Hold the clock, on the training desk", el: '#rate [data-rate="0"]' },
  { key: "1", id: "rate1", group: "The clock", does: "Real time", el: '#rate [data-rate="1"]' },
  { key: "2", id: "rate2", group: "The clock", does: "Twice real time", el: '#rate [data-rate="2"]' },
  { key: "4", id: "rate4", group: "The clock", does: "Four times real time", el: '#rate [data-rate="4"]' },
  { key: "8", id: "rate8", group: "The clock", does: "Eight times real time", el: '#rate [data-rate="8"]' },
  // The arrows move the view the way they point, as a map's do: left looks
  // further west. A drag still takes hold of the board and follows the hand.
  { key: "ArrowLeft", id: "west", group: "The board", does: "Look further west", repeat: true },
  { key: "ArrowRight", id: "east", group: "The board", does: "Look further east", repeat: true },
  { key: "ArrowUp", id: "north", group: "The board", does: "Look further up", repeat: true },
  { key: "ArrowDown", id: "south", group: "The board", does: "Look further down", repeat: true },
  { key: "i", id: "zoomIn", group: "The board", does: "Zoom in", repeat: true },
  { key: "o", id: "zoomOut", group: "The board", does: "Zoom out", repeat: true },
  { key: "b", id: "home", group: "The board", does: "The board back as it opened" },
  { key: "z", id: "fit", group: "The board", does: "The whole desk in view" },
  { key: "c", id: "drop", group: "The board", does: "Put down a signal chosen for a route" },
  { key: "m", id: "network", group: "The board", does: "The network diagram, and back", el: "#mapBtn" },
  { key: "t", id: "timetable", group: "The panel", does: "Timetable", el: '.tabs [data-pane="timetable"]' },
  { key: "r", id: "trains", group: "The panel", does: "Trains", el: '.tabs [data-pane="trains"]' },
  { key: "a", id: "alarms", group: "The panel", does: "Alarms", el: '.tabs [data-pane="alarms"]' },
  { key: "k", id: "ackAll", group: "The panel", does: "Acknowledge every alarm", el: "#ackAll" },
  { key: "f", id: "find", group: "The panel", does: "Find a train, operator or place", el: "#sideFilter" },
  { key: "p", id: "phone", group: "The phone", does: "The phone, where the pointer is, and hang up", el: "#phoneBtn" },
  { key: "h", id: "guide", group: "Help", does: "The written guide, and back", el: "#guideBtn" },
  { key: "l", id: "lesson", group: "Help", does: "Learn the desk: the lesson", el: "#learnDesk" },
  { key: "s", id: "menu", group: "Help", does: "The menu: sound, the shift and the lesson", el: "#menuBtn" },
  { key: "Enter", id: "next", group: "Help", does: "Next, in the lesson", el: "#tutorNext" },
];

/**
 * The phone's own keys, which it takes while it is open in place of the
 * desk's: the number of a call on its list, and in the box for where,
 * Enter to ring and Backspace, with the box empty, back to the list. A
 * number the list has not got does nothing, and the rest of the desk's
 * keys wait until the phone is put down.
 */
export const PHONE_KEYS = [
  { key: "1", short: "choose", does: "The first thing on the list, and so on down it" },
  { key: "Enter", short: "ring", does: "Ring, with the number typed for where" },
  { key: "Backspace", short: "back", does: "Back to the list, from an empty box" },
  { key: "p", short: "hang up", does: "Hang up, from the list" },
];

/** A key as the screen writes it. */
export function keyLabel(key) {
  return { ArrowLeft: "←", ArrowRight: "→", ArrowUp: "↑", ArrowDown: "↓" }[key] ?? (key.length === 1 ? key.toUpperCase() : key);
}

/**
 * Whether a key pressed with `el` in focus is that control's rather than the
 * desk's: anything typed in a box, and Enter on a button or a link, which
 * presses it or follows it. `el` is what really has the focus, inside the
 * rule book's shadow root too, where the event's own target stops at the host.
 */
export function leftToControl(key, el) {
  if (!el?.closest) return false;
  if (el.closest("input, textarea, select, [contenteditable]")) return true;
  return key === "Enter" && el.closest("button, a[href]") !== null;
}

/** The entry for a key the browser reports, whichever case a letter came in, or null. */
export function keyFor(key) {
  const k = key.length === 1 ? key.toLowerCase() : key;
  return KEYS.find((e) => e.key === k) ?? null;
}
