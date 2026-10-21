import { z } from "zod";

/**
 * Opérations de scan enregistrées sur le téléphone (IndexedDB) puis envoyées au serveur.
 * Chaque opération porte l'identifiant du scan créé sur le téléphone : renvoyer deux fois la même ne change rien.
 */
export const DAMAGE_TYPES = ["CARTON_ECRASE", "CARTON_OUVERT", "CARTON_MOUILLE", "FILM_DECHIRE", "PALETTE_CASSEE", "CONTENU_VISIBLE_ABIME", "AUTRE"] as const;

export const DAMAGE_LABEL: Record<(typeof DAMAGE_TYPES)[number], string> = {
  CARTON_ECRASE: "Carton écrasé",
  CARTON_OUVERT: "Carton ouvert",
  CARTON_MOUILLE: "Mouillé",
  FILM_DECHIRE: "Film déchiré",
  PALETTE_CASSEE: "Palette cassée",
  CONTENU_VISIBLE_ABIME: "Contenu abîmé",
  AUTRE: "Autre",
};

const clientId = z.uuid();

export const scanOpSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("scan"),
    clientId,
    rawCode: z.string().min(1).max(200),
    scannedAt: z.iso.datetime(),
    /** Réception manuelle d'une position (étiquette illisible, palettes d'un envoi groupé) */
    positionId: z.string().max(40).optional(),
    quantity: z.number().int().min(1).max(99).default(1),
  }),
  z.object({
    type: z.literal("damage"),
    clientId,
    damageType: z.enum(DAMAGE_TYPES).nullable(),
    comment: z.string().max(500).nullable(),
  }),
  z.object({ type: z.literal("cancel"), clientId }),
]);

export const syncBodySchema = z.object({ ops: z.array(scanOpSchema).min(1).max(500) });

export type ScanOp = z.input<typeof scanOpSchema>;

export type SyncResponse = {
  positions: { id: string; packagesReceived: number; status: string }[];
  unknown: { clientId: string; rawCode: string; scannedAt: string }[];
  scannedCodes: string[];
  receptionStatus: string;
};
