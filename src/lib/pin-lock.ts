/** Blocage d'un compte après trop d'erreurs de PIN (stocké en base : fonctionne avec plusieurs instances). */
export const MAX_PIN_ATTEMPTS = 5;
export const LOCK_MINUTES = 15;

export function isLocked(lockedUntil: Date | null | undefined, now = new Date()): boolean {
  return !!lockedUntil && lockedUntil > now;
}

/** Fin du blocage posé à la dernière erreur autorisée. */
export function lockEnd(now = new Date()): Date {
  return new Date(now.getTime() + LOCK_MINUTES * 60_000);
}
