import { describe, expect, it } from "vitest";
import { KN_80977_652747 } from "./fixture";
import { extractionJsonSchema, parseExtraction } from "./schema";

describe("parseExtraction — réponse texte de Claude", () => {
  const json = JSON.stringify(KN_80977_652747);

  it("accepte l'objet JSON seul, dans un bloc ```json ou avec une phrase autour", () => {
    expect(parseExtraction(json)).toEqual(KN_80977_652747);
    expect(parseExtraction("```json\n" + json + "\n```")).toEqual(KN_80977_652747);
    expect(parseExtraction("Voici la lecture :\n" + json)).toEqual(KN_80977_652747);
  });

  it("refuse une réponse sans JSON, tronquée ou hors schéma", () => {
    expect(parseExtraction("Je ne peux pas lire ces photos.")).toBeNull();
    expect(parseExtraction(json.slice(0, -20))).toBeNull();
    expect(parseExtraction(JSON.stringify({ ...KN_80977_652747, doubts: "non" }))).toBeNull();
  });

  it("donne à Claude un schéma JSON avec les consignes de lecture", () => {
    expect(extractionJsonSchema).toContain("ENDSUMMEN");
    expect(extractionJsonSchema).toContain('"handwrittenNotes"');
  });
});
