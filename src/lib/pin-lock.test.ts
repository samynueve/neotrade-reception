import { describe, expect, it } from "vitest";
import { afterFailure, isLocked, LOCK_MINUTES, MAX_PIN_ATTEMPTS } from "./pin-lock";

describe("pin-lock", () => {
  const now = new Date("2026-10-20T08:00:00Z");
  it("compte les erreurs puis bloque", () => {
    expect(afterFailure(0, now)).toEqual({ failedPinAttempts: 1, lockedUntil: null });
    const locked = afterFailure(MAX_PIN_ATTEMPTS - 1, now);
    expect(locked.failedPinAttempts).toBe(0);
    expect(locked.lockedUntil?.getTime()).toBe(now.getTime() + LOCK_MINUTES * 60_000);
    expect(isLocked(locked.lockedUntil, now)).toBe(true);
    expect(isLocked(locked.lockedUntil, new Date(now.getTime() + LOCK_MINUTES * 60_000 + 1))).toBe(false);
  });
});
