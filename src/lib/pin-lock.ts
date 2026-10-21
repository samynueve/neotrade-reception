/** Blocage d'un compte après trop d'erreurs de PIN (stocké en base : fonctionne avec plusieurs instances). */
export const MAX_PIN_ATTEMPTS = 5;
export const LOCK_MINUTES = 15;

export function isLocked(lockedUntil: Date | null | undefined, now = new Date()): boolean {
  return !!lockedUntil && lockedUntil > now;
}

/** Nouvel état après une erreur de PIN. */
export function afterFailure(failedPinAttempts: number, now = new Date()): { failedPinAttempts: number; lockedUntil: Date | null } {
  const attempts = failedPinAttempts + 1;
  if (attempts >= MAX_PIN_ATTEMPTS) return { failedPinAttempts: 0, lockedUntil: new Date(now.getTime() + LOCK_MINUTES * 60_000) };
  return { failedPinAttempts: attempts, lockedUntil: null };
}
