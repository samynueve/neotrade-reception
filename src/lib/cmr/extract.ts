import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { Locale } from "@/i18n/config";
import { KN_80977_652747 } from "./fixture";
import { extractionSchema, type Extraction } from "./schema";

/** Erreur de lecture ; le code est traduit à l'affichage (dictionnaire, rubrique errors). */
export type ExtractionErrorCode = "not_configured" | "bad_key" | "rate_limited" | "rejected" | "no_connection" | "unavailable" | "refused" | "too_long" | "incomplete";
export class ExtractionError extends Error {
  constructor(public code: ExtractionErrorCode) {
    super(code);
  }
}

/** Langue dans laquelle Claude rédige ses doutes (« doubts »), celle de l'utilisateur. */
const DOUBT_LANGUAGE: Record<Locale, string> = { fr: "français", en: "anglais", de: "allemand", ar: "arabe" };

export type DocumentImage = { data: Buffer; mediaType: "image/jpeg" | "image/png" | "image/webp" };

const MODEL = "claude-opus-5-5";

const SYSTEM = `Tu lis des photos de documents de transport Kuehne+Nagel reçus à quai par SAS KASMI (NEOTRADE) à Douvrin.
Deux documents possibles, une ou plusieurs pages chacun, photos dans n'importe quel ordre :
- la CMR-Ladeliste : en-tête (LADELISTENR., RELATION, encadré EMPF/ORT/LKW/ANH avec lieu, date et heure), puis des positions et, en bas de la dernière page, ENDSUMMEN (colis, poids) et W-WERT total ;
- le Fahrauftrag : Reise, Datum, Fahrzeug, Anhänger, Plombe 1 et 2, Unternehmer, lignes Entladestelle (poids, Kolli, Bordero, Sendungsnummer), Gesamtgewicht.

Recopie exactement ce qui est imprimé. Les nombres sont au format allemand : « 3.673,0 » vaut 3673 et « 1501,13 » vaut 1501.13.
Ne devine jamais une valeur : si elle est illisible ou absente, mets null et explique-le dans doubts.
Un tampon « ORIGINAL » ou des barres verticales tracées au stylo à côté des numéros ne font pas partie des valeurs.
Les mentions écrites à la main (ex. « 25 Missing Box ») vont dans handwrittenNotes, pas dans les positions.
Si les photos semblent incomplètes (ENDSUMMEN absent, numéros de position qui sautent), signale-le dans doubts.`;

let client: Anthropic | null = null;

/** Lit les documents sur les photos et renvoie leurs données structurées. */
export async function extractDocuments(images: DocumentImage[], locale: Locale = "fr"): Promise<Extraction> {
  // Mode démonstration : renvoie la lecture de l'exemple réel 80977/652747, sans appel à l'API
  if (process.env.CMR_EXTRACTION_MOCK === "true") return structuredClone(KN_80977_652747);
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new ExtractionError("not_configured");
  }
  client ??= new Anthropic({ timeout: 55_000, maxRetries: 0 });

  const content: Anthropic.Beta.BetaContentBlockParam[] = images.flatMap((img, i) => [
    { type: "text" as const, text: `Photo ${i + 1} :` },
    { type: "image" as const, source: { type: "base64" as const, media_type: img.mediaType, data: img.data.toString("base64") } },
  ]);
  content.push({ type: "text", text: `Lis ces documents. Rédige les éventuels « doubts » en ${DOUBT_LANGUAGE[locale]}.` });

  let response;
  try {
    response = await client.beta.messages.parse({
      model: MODEL,
      max_tokens: 16000,
      // Si le modèle refuse pour une raison de sécurité, l'API rejoue la demande sur un modèle de secours
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "medium", format: betaZodOutputFormat(extractionSchema) },
      system: SYSTEM,
      messages: [{ role: "user", content }],
    });
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) throw new ExtractionError("bad_key");
    if (error instanceof Anthropic.RateLimitError) throw new ExtractionError("rate_limited");
    if (error instanceof Anthropic.BadRequestError) throw new ExtractionError("rejected");
    if (error instanceof Anthropic.APIConnectionError) throw new ExtractionError("no_connection");
    if (error instanceof Anthropic.APIError) throw new ExtractionError("unavailable");
    throw error;
  }

  if (response.stop_reason === "refusal") throw new ExtractionError("refused");
  if (response.stop_reason === "max_tokens") throw new ExtractionError("too_long");
  if (!response.parsed_output) throw new ExtractionError("incomplete");
  return response.parsed_output;
}
