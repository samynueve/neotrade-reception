"use client";

import { getPrefs } from "./prefs";

/** Retour immédiat au scan : bip et vibration (utile avec des gants et du bruit à quai), réglables dans Réglages. */
let ctx: AudioContext | null = null;

/** iPhone : le son reste bloqué tant que l'audio n'a pas été démarré pendant un toucher de l'écran. */
export function unlockSound() {
  try {
    ctx ??= new AudioContext();
    if (ctx.state === "suspended") void ctx.resume();
  } catch {
    // son indisponible
  }
}

function tone(freq: number, ms: number, delay = 0) {
  try {
    ctx ??= new AudioContext();
    if (ctx.state === "suspended") void ctx.resume();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "square";
    o.frequency.value = freq;
    g.gain.value = 0.12;
    o.connect(g).connect(ctx.destination);
    const t = ctx.currentTime + delay / 1000;
    o.start(t);
    o.stop(t + ms / 1000);
  } catch {
    // son indisponible : la couleur et la vibration suffisent
  }
}

const SOUNDS = {
  ok: () => tone(1400, 90),
  warn: () => (tone(700, 120), tone(700, 120, 180)),
  error: () => tone(250, 380),
};
const VIBRATIONS = { ok: [60], warn: [80, 60, 80], error: [200, 80, 200, 80, 200] };

export function feedback(kind: "ok" | "warn" | "error") {
  const prefs = getPrefs();
  if (prefs.sound) SOUNDS[kind]();
  if (prefs.vibration) navigator.vibrate?.(VIBRATIONS[kind]);
}
