/**
 * Seed : crée le premier responsable (nom et PIN dans .env), un cariste de démonstration
 * et, sauf SEED_EXAMPLE="false", deux réceptions d'EXEMPLE illustrant les cas difficiles
 * (envoi groupé, n° imprimé en double, position hors adresse, note manuscrite, manquant ouvert).
 * Les chiffres des exemples sont fictifs, à part ceux cités dans le cahier des charges.
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { shipmentKey } from "../src/lib/codes";
import { isOffAddress } from "../src/lib/site";

const prisma = new PrismaClient();

async function upsertUser(name: string, pin: string, role: "CARISTE" | "RESPONSABLE") {
  if (!/^\d{4,6}$/.test(pin)) throw new Error(`PIN invalide pour ${name} : 4 à 6 chiffres.`);
  return prisma.user.upsert({
    where: { name },
    update: {},
    create: { name, role, pinHash: await bcrypt.hash(pin, 10) },
  });
}

type P = {
  shipmentNumber: string;
  printedNumber?: string;
  description: string;
  consigneeName: string;
  deliveryZip: string;
  deliveryCity: string;
  packagesExpected: number;
  weightKg: number;
  valueCents?: number;
  borderoNumbers?: string[];
  isGrouped?: boolean;
  packagesReceived?: number;
  status?: "ATTENDU" | "RECU" | "PARTIEL" | "MANQUANT" | "HORS_ADRESSE";
};

const position = (p: P, i: number) => {
  const off = isOffAddress(p.deliveryZip, p.deliveryCity);
  return {
    lineNumber: i + 1,
    shipmentNumber: p.shipmentNumber,
    shipmentKey: shipmentKey(p.shipmentNumber),
    printedNumber: p.printedNumber,
    description: p.description,
    shipper: "Amazon EU SARL",
    consigneeName: p.consigneeName,
    deliveryStreet: off ? null : "2 rue de Pâques",
    deliveryZip: p.deliveryZip,
    deliveryCity: p.deliveryCity,
    isOffAddress: off,
    packagesExpected: p.packagesExpected,
    packagingType: "SPEZ. PA",
    packagesReceived: p.packagesReceived ?? 0,
    weightKg: p.weightKg,
    valueCents: p.valueCents,
    borderoNumbers: p.borderoNumbers ?? [],
    isGrouped: p.isGrouped ?? false,
    status: off ? ("HORS_ADRESSE" as const) : (p.status ?? "ATTENDU"),
  };
};

async function seedExamples(managerId: string, caristeId: string) {
  if (await prisma.reception.findFirst({ where: { comment: { startsWith: "EXEMPLE" } } })) return;

  const douvrin = { consigneeName: "SAS KASMI / NEOTRADE", deliveryZip: "62138", deliveryCity: "DOUVRIN" };
  const yesterday = new Date(Date.now() - 24 * 3600_000);

  // Camion d'hier, clôturé avec un colis manquant
  const old = await prisma.reception.create({
    data: {
      comment: "EXEMPLE — réception fictive pour la démonstration",
      loadingListNumber: "80977/652700",
      tripNumber: "4410001",
      documentDate: yesterday,
      arrivedAt: yesterday,
      vehiclePlate: "XX-001-XX",
      sealsExpected: ["1234567"],
      sealsFound: ["1234567"],
      expectedPackages: 3,
      expectedWeightKg: 41.5,
      expectedValueCents: 25890,
      status: "CLOTUREE",
      closedAt: yesterday,
      createdById: caristeId,
      controllerId: caristeId,
      closedById: managerId,
      positions: {
        create: ([
          { shipmentNumber: "362/000/4650001", printedNumber: "00340312892450001", description: "SWEATSHIRT ITEM", packagesExpected: 2, packagesReceived: 2, status: "RECU", weightKg: 30, valueCents: 17900, ...douvrin },
          { shipmentNumber: "362/000/4650002", printedNumber: "00340312892450999", description: "GIFT_WRAP ITEM", packagesExpected: 1, packagesReceived: 0, status: "MANQUANT", weightKg: 11.5, valueCents: 7990, ...douvrin },
        ] satisfies P[]).map(position),
      },
    },
    include: { positions: true },
  });
  const missing = old.positions.find((p) => p.status === "MANQUANT")!;
  await prisma.dispute.create({
    data: {
      originReceptionId: old.id,
      originPositionId: missing.id,
      oldShipmentNumber: missing.shipmentNumber,
      printedNumber: missing.printedNumber,
      packagesMissing: 1,
      weightKg: missing.weightKg,
      valueCents: missing.valueCents,
      comment: "EXEMPLE — doit être rapproché si le même n° imprimé revient avec un nouveau n° d'envoi",
    },
  });

  // Camion du jour, en contrôle
  const today = await prisma.reception.create({
    data: {
      comment: "EXEMPLE — réception fictive pour la démonstration",
      loadingListNumber: "80977/652701",
      tripNumber: "4410002",
      documentDate: new Date(),
      arrivedAt: new Date(),
      vehiclePlate: "XX-002-XX",
      trailerPlate: "XX-003-XX",
      unloadingPlaces: "DOUVRIN, LOOS-EN-GOHELLE",
      sealsExpected: ["7654321", "7654322"],
      expectedPackages: 19,
      expectedWeightKg: 3735.2,
      status: "EN_CONTROLE",
      createdById: caristeId,
      controllerId: caristeId,
      positions: {
        create: ([
          // Cas 1 : envoi groupé (15 palettes, plusieurs Bordero, sans détail)
          { shipmentNumber: "362/000/4659205", description: "GOODS", packagesExpected: 15, packagesReceived: 9, status: "PARTIEL", weightKg: 3673, borderoNumbers: ["900001", "900002", "900003"], isGrouped: true, ...douvrin },
          // Cas 2 : même n° imprimé sur deux positions
          { shipmentNumber: "362/000/4659206", printedNumber: "00340312892450832", description: "GIFT_WRAP ITEM", packagesExpected: 1, weightKg: 8.2, valueCents: 4590, ...douvrin },
          { shipmentNumber: "362/000/4659207", printedNumber: "00340312892450832", description: "GIFT_WRAP ITEM", packagesExpected: 1, weightKg: 8.2, valueCents: 4590, ...douvrin },
          // Cas 3 : le manquant d'hier revient avec un nouveau n° d'envoi
          { shipmentNumber: "362/000/4659208", printedNumber: "00340312892450999", description: "GIFT_WRAP ITEM", packagesExpected: 1, weightKg: 11.5, valueCents: 7990, ...douvrin },
          // Cas 4 : position adressée ailleurs
          { shipmentNumber: "362/000/4659209", printedNumber: "00340312892451111", description: "SWEATSHIRT ITEM", packagesExpected: 1, weightKg: 34.3, valueCents: 21000, consigneeName: "DESTINATAIRE EXEMPLE", deliveryZip: "62750", deliveryCity: "LOOS-EN-GOHELLE" },
        ] satisfies P[]).map(position),
      },
    },
  });
  // Cas 5 : note manuscrite qui contredit la liste
  await prisma.receptionNote.create({
    data: { receptionId: today.id, kind: "MANUSCRITE", text: "25 Missing Box", declaredMissingPackages: 25, authorId: caristeId },
  });
}

async function main() {
  const manager = await upsertUser(process.env.SEED_MANAGER_NAME || "Responsable", process.env.SEED_MANAGER_PIN || "2468", "RESPONSABLE");
  const cariste = await upsertUser("Cariste démo", process.env.SEED_CARISTE_PIN || "1357", "CARISTE");
  if (process.env.SEED_EXAMPLE !== "false") await seedExamples(manager.id, cariste.id);
  console.log(`Seed terminé : responsable « ${manager.name} », cariste « ${cariste.name} ».`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
