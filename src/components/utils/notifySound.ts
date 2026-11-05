/**
 * Notification sounds, generated with the Web Audio API (no audio files needed).
 * - On by default; the user can mute it from the bell panel. The choice is kept in localStorage.
 * - Browsers only allow sound after the user has clicked/tapped/typed on the page once, so the audio context
 *   is unlocked on the first interaction. A notification that arrives before that is silent (the popup still shows).
 */
const KEY = "aviator-notify-sound";
let ctx: AudioContext | null = null;
let unlockBound = false;

const getCtx = (): AudioContext | null => {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    try { ctx = new AC(); } catch { return null; }
  }
  return ctx;
};

/** Call once (e.g. when the app mounts): resumes audio on the first user gesture. */
export const bindSoundUnlock = () => {
  if (typeof window === "undefined" || unlockBound) return;
  unlockBound = true;
  const unlock = () => {
    const c = getCtx();
    if (c && c.state === "suspended") void c.resume().catch(() => {});
    if (c && c.state === "running") {
      ["pointerdown", "keydown", "touchstart"].forEach((e) => window.removeEventListener(e, unlock));
    }
  };
  ["pointerdown", "keydown", "touchstart"].forEach((e) => window.addEventListener(e, unlock, { passive: true }));
};

export const isNotifySoundOn = (): boolean => {
  if (typeof window === "undefined") return true;
  try { return localStorage.getItem(KEY) !== "off"; } catch { return true; }
};

export const setNotifySoundOn = (on: boolean) => {
  try { localStorage.setItem(KEY, on ? "on" : "off"); } catch { /* private mode: ignore */ }
};

type Note = { f: number; at: number; dur: number; vol?: number; type?: OscillatorType };

const play = (notes: Note[]) => {
  const c = getCtx();
  if (!c) return;
  if (c.state === "suspended") void c.resume().catch(() => {});
  if (c.state !== "running" && c.state !== "suspended") return;
  const t0 = c.currentTime + 0.02;
  for (const n of notes) {
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = n.type ?? "sine";
    osc.frequency.value = n.f;
    const peak = n.vol ?? 0.18;
    gain.gain.setValueAtTime(0.0001, t0 + n.at);
    gain.gain.exponentialRampToValueAtTime(peak, t0 + n.at + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + n.at + n.dur);
    osc.connect(gain).connect(c.destination);
    osc.start(t0 + n.at);
    osc.stop(t0 + n.at + n.dur + 0.05);
  }
};

const SOUNDS: Record<string, Note[]> = {
  // soft two-note chime
  default: [{ f: 880, at: 0, dur: 0.18 }, { f: 1175, at: 0.12, dur: 0.28 }],
  // money in: bright ascending
  deposit: [{ f: 659, at: 0, dur: 0.14 }, { f: 880, at: 0.1, dur: 0.14 }, { f: 1319, at: 0.2, dur: 0.3 }],
  withdrawal: [{ f: 988, at: 0, dur: 0.16 }, { f: 784, at: 0.13, dur: 0.26 }],
  // big win: little fanfare
  win: [{ f: 523, at: 0, dur: 0.14 }, { f: 659, at: 0.11, dur: 0.14 }, { f: 784, at: 0.22, dur: 0.14 }, { f: 1047, at: 0.33, dur: 0.45, vol: 0.22 }],
  security: [{ f: 440, at: 0, dur: 0.2, type: "triangle" }, { f: 440, at: 0.28, dur: 0.2, type: "triangle" }],
  // admin needs attention (new withdrawal / signup)
  admin: [{ f: 784, at: 0, dur: 0.12 }, { f: 784, at: 0.18, dur: 0.12 }, { f: 1047, at: 0.36, dur: 0.3 }],
  // announcement: attention-grabbing triple
  announce: [{ f: 698, at: 0, dur: 0.16, type: "triangle" }, { f: 880, at: 0.18, dur: 0.16, type: "triangle" }, { f: 1047, at: 0.36, dur: 0.34, type: "triangle" }],
};

/** Plays the sound for a notification type. Does nothing when muted. */
export const playNotifySound = (type: string = "default", force = false) => {
  if (!force && !isNotifySoundOn()) return;
  try { play(SOUNDS[type] ?? SOUNDS.default); } catch { /* never let a sound break the UI */ }
};
