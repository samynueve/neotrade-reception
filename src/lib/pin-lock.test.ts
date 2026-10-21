import { describe, expect, it } from "vitest";
import { isLocked, LOCK_MINUTES, lockEnd } from "./pin-lock";

describe("pin-lock", () => {
  const now = new Date("2026-10-20T08:00:00Z");
  it("bloque pendant LOCK_MINUTES", () => {
    const until = lockEnd(now);
    expect(until.getTime()).toBe(now.getTime() + LOCK_MINUTES * 60_000);
    expect(isLocked(until, now)).toBe(true);
    expect(isLocked(until, new Date(now.getTime() + LOCK_MINUTES * 60_000 + 1))).toBe(false);
    expect(isLocked(null, now)).toBe(false);
  });
});
