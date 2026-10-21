"use client";

/** Préférences propres à ce téléphone (son, vibration, lecteur de scan). */
export type Prefs = { sound: boolean; vibration: boolean };
const KEY = "reception-prefs";
const DEFAULTS: Prefs = { sound: true, vibration: true };

export function getPrefs(): Prefs {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) ?? "{}") };
  } catch {
    return DEFAULTS;
  }
}

export function setPrefs(patch: Partial<Prefs>): Prefs {
  const next = { ...getPrefs(), ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // stockage indisponible (navigation privée) : réglage valable jusqu'à la fermeture
  }
  return next;
}
