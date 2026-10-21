import { describe, expect, it } from "vitest";
import { loginSchema, safeRedirect } from "./auth";

describe("loginSchema", () => {
  it("accepte un PIN de 4 à 6 chiffres", () => {
    expect(loginSchema.safeParse({ userId: "u1", pin: "1234" }).success).toBe(true);
    expect(loginSchema.safeParse({ userId: "u1", pin: "123456" }).success).toBe(true);
  });
  it("refuse un PIN trop court, trop long ou non numérique", () => {
    for (const pin of ["123", "1234567", "12a4", ""]) expect(loginSchema.safeParse({ userId: "u1", pin }).success).toBe(false);
  });
});

describe("safeRedirect", () => {
  it("garde les chemins internes uniquement", () => {
    expect(safeRedirect("/receptions/abc")).toBe("/receptions/abc");
    expect(safeRedirect("//evil.com")).toBe("/");
    expect(safeRedirect("https://evil.com")).toBe("/");
    expect(safeRedirect(null)).toBe("/");
  });
});
