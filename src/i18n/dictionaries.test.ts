import { describe, expect, it } from "vitest";
import { CHECK_CODES, checkText } from "@/lib/cmr/checks";
import { LOCALES } from "./config";
import { DICTIONARIES } from "./dictionaries";
import { makeFormat } from "./format";

/** Liste des chemins d'un dictionnaire (« scan.okTitle », « importFlow.tips[2] »…). */
function paths(o: unknown, prefix = ""): string[] {
  if (Array.isArray(o)) return o.flatMap((v, i) => paths(v, `${prefix}[${i}]`));
  if (o && typeof o === "object") return Object.entries(o).flatMap(([k, v]) => paths(v, prefix ? `${prefix}.${k}` : k));
  return [`${prefix}:${typeof o}`];
}

describe("dictionnaires", () => {
  const reference = paths(DICTIONARIES.fr).sort();

  it.each(LOCALES)("%s a exactement les mêmes textes que le français", (l) => {
    expect(paths(DICTIONARIES[l]).sort()).toEqual(reference);
  });

  it.each(LOCALES)("%s : aucun texte vide et chaque fonction répond", (l) => {
    const d = DICTIONARIES[l];
    const f = makeFormat(l);
    const walk = (o: unknown): void => {
      if (typeof o === "string") expect(o.trim().length).toBeGreaterThan(0);
      else if (typeof o === "function") expect(String((o as (...a: unknown[]) => unknown)(3, f) ?? "x").length).toBeGreaterThan(0);
      else if (o && typeof o === "object") Object.values(o).forEach(walk);
    };
    walk({ ...d, checks: {} });
    for (const code of CHECK_CODES) {
      const text = checkText(d, { level: "warn", code, params: { sum: 18, total: 18, line: 2, value: "362/00O/0863122", shipment: "362/000/0863122", city: "LOOS EN GOHELLE", count: 15, type: "SPEZ. PA", bordero: "65035, 65049", lines: "1 + 5", code: "00340312892450832", reise: "80977", number: "652747", seals: "756015", old: "362/000/0863121", date: "2026-10-15T11:50:00Z", text: "25 Missing Box", missing: 25, list: "80977/652747" } }, f);
      expect(text).not.toContain("undefined");
    }
  });
});
