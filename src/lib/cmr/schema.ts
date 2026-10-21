import { z } from "zod/v4";

/**
 * Données lues sur les photos des documents Kuehne+Nagel (CMR-Ladeliste et Fahrauftrag).
 * Ce schéma est envoyé à Claude (sortie structurée) : les descriptions servent de consignes de lecture.
 * Toutes les valeurs absentes ou illisibles valent null (jamais inventées).
 */
const party = z.object({
  name: z.string().nullable().describe("Raison sociale (ligne EMP ou ABS)"),
  street: z.string().nullable().describe("Rue, telle qu'imprimée"),
  zip: z.string().nullable().describe("Code postal"),
  city: z.string().nullable().describe("Ville"),
});

export const ladelistePositionSchema = z.object({
  pos: z.number().int().describe("Numéro de position (colonne POS)"),
  shipmentNumber: z.string().describe("N° d'envoi en tête de position, format 362/000/XXXXXXX"),
  consignee: party.describe("Destinataire (EMP)"),
  shipper: party.describe("Expéditeur (ABS)"),
  description: z.string().nullable().describe("Contenu (INHALT), ex. GIFT_WRAP ITEM, SWEATSHIRT ITEM, GOODS"),
  printedNumber: z.string().nullable().describe("N° de la colonne ZEICHEN + NR (chiffres uniquement, ex. 00340312892450832). null si la position n'en a pas"),
  borderoRefs: z.array(z.string()).describe("N° des lignes « BORDERO -NR. » de la position, dans l'ordre, doublons compris"),
  packages: z.number().int().describe("Nombre de colis de la colonne ANZ. (ex. 15 pour « 15 SPEZ. PA »)"),
  packagingType: z.string().nullable().describe("Type d'emballage, ex. « SPEZ. PA »"),
  weightKg: z.number().describe("Poids brut B-GEW en kg (« 3.673,0 » = 3673)"),
  valueEur: z.number().nullable().describe("Valeur W-WERT en euros (« 1501,13 » = 1501.13)"),
});

export const extractionSchema = z.object({
  ladeliste: z
    .object({
      loadingListNumber: z.string().nullable().describe("LADELISTENR., ex. « 80977/652747 » (sans espaces)"),
      relation: z.string().nullable().describe("RELATION, ex. X085"),
      truckPlate: z.string().nullable().describe("Ligne LKW de l'encadré en haut à gauche"),
      trailerPlate: z.string().nullable().describe("Ligne ANH de l'encadré en haut à gauche"),
      issuedPlace: z.string().nullable().describe("Lieu d'émission, ex. HAUNECK"),
      issuedAt: z.string().nullable().describe("Date et heure d'émission au format AAAA-MM-JJTHH:MM (« 15.10.26 13:50 » = 2026-10-15T13:50)"),
      positions: z.array(ladelistePositionSchema).describe("Toutes les positions de toutes les pages, dans l'ordre"),
      totalPackages: z.number().int().nullable().describe("ENDSUMMEN : total des colis"),
      totalWeightKg: z.number().nullable().describe("ENDSUMMEN : total du poids en kg"),
      totalValueEur: z.number().nullable().describe("W-WERT total en euros, en bas du document"),
    })
    .nullable()
    .describe("CMR-Ladeliste, null si aucune photo ne la montre"),
  fahrauftrag: z
    .object({
      reise: z.string().nullable().describe("N° Reise"),
      date: z.string().nullable().describe("Datum au format AAAA-MM-JJ"),
      barcodeNumber: z.string().nullable().describe("Numéro sous le code-barres en haut à droite, ex. 652747"),
      vehiclePlate: z.string().nullable().describe("Fahrzeug"),
      trailerPlate: z.string().nullable().describe("Anhänger"),
      seals: z.array(z.string()).describe("Valeurs de Plombe 1 et Plombe 2 (vides ignorées)"),
      subcontractor: z.string().nullable().describe("Unternehmer"),
      totalWeightKg: z.number().nullable().describe("Gesamtgewicht en kg"),
      stops: z
        .array(
          z.object({
            shipmentNumber: z.string().describe("Sendungsnummer"),
            weightKg: z.number().nullable().describe("Gewicht"),
            packages: z.number().int().nullable().describe("Kolli"),
            bordero: z.string().nullable().describe("Bordero"),
            zip: z.string().nullable(),
            city: z.string().nullable(),
          }),
        )
        .describe("Lignes Entladestelle"),
    })
    .nullable()
    .describe("Fahrauftrag, null si aucune photo ne le montre"),
  handwrittenNotes: z.array(z.string()).describe("Mentions manuscrites visibles sur les documents (ex. « 25 Missing Box »), recopiées telles quelles"),
  doubts: z.array(z.string()).describe("Valeurs mal lisibles ou incertaines (photo floue, pliure, reflet), en français ; page manquante soupçonnée"),
});

export type Extraction = z.infer<typeof extractionSchema>;
export type LadelistePosition = z.infer<typeof ladelistePositionSchema>;

/**
 * Schéma JSON donné à Claude dans la consigne. Il n'est pas imposé par l'API (sortie structurée) :
 * avec autant de champs facultatifs, l'API refuse (« compiled grammar is too large »). La réponse est validée ici.
 */
export const extractionJsonSchema = JSON.stringify(z.toJSONSchema(extractionSchema));

/** Réponse texte de Claude → données validées, ou null si elle ne respecte pas le schéma. */
export function parseExtraction(text: string): Extraction | null {
  // Tolère un bloc ```json … ``` ou une phrase autour de l'objet
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  let raw: unknown;
  try {
    raw = JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
  const parsed = extractionSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}
