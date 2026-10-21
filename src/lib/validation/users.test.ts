import { describe, expect, it } from "vitest";
import { firstManagerSchema, newUserSchema } from "./users";

describe("newUserSchema", () => {
  it("accepte un cariste avec un PIN confirmé", () => {
    expect(newUserSchema.safeParse({ name: "Karim", role: "CARISTE", pin: "1234", pin2: "1234" }).success).toBe(true);
  });
  it("refuse deux PIN différents", () => {
    const r = newUserSchema.safeParse({ name: "Karim", role: "CARISTE", pin: "1234", pin2: "1235" });
    expect(r.success).toBe(false);
  });
  it("exige le code d'installation pour le premier responsable", () => {
    expect(firstManagerSchema.safeParse({ name: "Yo", setupCode: "", pin: "2468", pin2: "2468" }).success).toBe(false);
  });
});
