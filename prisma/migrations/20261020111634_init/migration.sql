-- CreateEnum
CREATE TYPE "Role" AS ENUM ('CARISTE', 'RESPONSABLE');

-- CreateEnum
CREATE TYPE "ReceptionStatus" AS ENUM ('BROUILLON', 'EN_CONTROLE', 'CLOTUREE');

-- CreateEnum
CREATE TYPE "PositionStatus" AS ENUM ('ATTENDU', 'RECU', 'PARTIEL', 'MANQUANT', 'HORS_ADRESSE');

-- CreateEnum
CREATE TYPE "ScanMatch" AS ENUM ('N_ENVOI', 'N_IMPRIME', 'MANUEL', 'INCONNU');

-- CreateEnum
CREATE TYPE "PackageCondition" AS ENUM ('OK', 'ENDOMMAGE');

-- CreateEnum
CREATE TYPE "DamageType" AS ENUM ('CARTON_ECRASE', 'CARTON_OUVERT', 'CARTON_MOUILLE', 'FILM_DECHIRE', 'PALETTE_CASSEE', 'CONTENU_VISIBLE_ABIME', 'AUTRE');

-- CreateEnum
CREATE TYPE "DisputeType" AS ENUM ('MANQUANT', 'AVARIE', 'HORS_ADRESSE', 'ECART_PLOMB');

-- CreateEnum
CREATE TYPE "DisputeStatus" AS ENUM ('OUVERT', 'RETROUVE', 'CLOS_PERTE', 'ANNULE');

-- CreateEnum
CREATE TYPE "PhotoKind" AS ENUM ('CAMION', 'PLOMB', 'CMR_LADELISTE', 'FAHRAUFTRAG', 'COLIS', 'DOMMAGE', 'NOTE_MANUSCRITE', 'AUTRE');

-- CreateEnum
CREATE TYPE "NoteKind" AS ENUM ('MANUSCRITE', 'OBSERVATION');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "pinHash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'CARISTE',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "failedPinAttempts" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reception" (
    "id" TEXT NOT NULL,
    "loadingListNumber" TEXT,
    "documentDate" TIMESTAMP(3),
    "relation" TEXT NOT NULL DEFAULT 'X085',
    "agency" TEXT NOT NULL DEFAULT 'Hauneck',
    "tripNumber" TEXT,
    "tripDate" TIMESTAMP(3),
    "carrier" TEXT NOT NULL DEFAULT 'Kuehne+Nagel',
    "vehiclePlate" TEXT,
    "trailerPlate" TEXT,
    "unloadingPlaces" TEXT,
    "sealsExpected" TEXT[],
    "sealsFound" TEXT[],
    "expectedPackages" INTEGER,
    "expectedWeightKg" DECIMAL(10,2),
    "expectedValueCents" INTEGER,
    "arrivedAt" TIMESTAMP(3),
    "status" "ReceptionStatus" NOT NULL DEFAULT 'BROUILLON',
    "createdById" TEXT NOT NULL,
    "controllerId" TEXT,
    "closedAt" TIMESTAMP(3),
    "closedById" TEXT,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Reception_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Position" (
    "id" TEXT NOT NULL,
    "receptionId" TEXT NOT NULL,
    "lineNumber" INTEGER NOT NULL,
    "shipmentNumber" TEXT NOT NULL,
    "shipmentKey" TEXT NOT NULL,
    "printedNumber" TEXT,
    "description" TEXT,
    "shipper" TEXT,
    "consigneeName" TEXT,
    "deliveryStreet" TEXT,
    "deliveryZip" TEXT,
    "deliveryCity" TEXT,
    "isOffAddress" BOOLEAN NOT NULL DEFAULT false,
    "packagesExpected" INTEGER NOT NULL,
    "packagingType" TEXT,
    "packagesReceived" INTEGER NOT NULL DEFAULT 0,
    "weightKg" DECIMAL(10,2) NOT NULL,
    "valueCents" INTEGER,
    "borderoNumbers" TEXT[],
    "isGrouped" BOOLEAN NOT NULL DEFAULT false,
    "status" "PositionStatus" NOT NULL DEFAULT 'ATTENDU',
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Position_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Scan" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "receptionId" TEXT NOT NULL,
    "positionId" TEXT,
    "rawCode" TEXT NOT NULL,
    "normalizedCode" TEXT NOT NULL,
    "match" "ScanMatch" NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "condition" "PackageCondition" NOT NULL DEFAULT 'OK',
    "damageType" "DamageType",
    "comment" TEXT,
    "userId" TEXT NOT NULL,
    "scannedAt" TIMESTAMP(3) NOT NULL,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Scan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Photo" (
    "id" TEXT NOT NULL,
    "receptionId" TEXT NOT NULL,
    "positionId" TEXT,
    "scanId" TEXT,
    "disputeId" TEXT,
    "kind" "PhotoKind" NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "takenAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Photo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReceptionNote" (
    "id" TEXT NOT NULL,
    "receptionId" TEXT NOT NULL,
    "positionId" TEXT,
    "kind" "NoteKind" NOT NULL,
    "text" TEXT NOT NULL,
    "declaredMissingPackages" INTEGER,
    "authorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReceptionNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Dispute" (
    "id" TEXT NOT NULL,
    "type" "DisputeType" NOT NULL DEFAULT 'MANQUANT',
    "originReceptionId" TEXT NOT NULL,
    "originPositionId" TEXT,
    "oldShipmentNumber" TEXT NOT NULL,
    "printedNumber" TEXT,
    "packagesMissing" INTEGER NOT NULL,
    "weightKg" DECIMAL(10,2) NOT NULL,
    "valueCents" INTEGER,
    "status" "DisputeStatus" NOT NULL DEFAULT 'OUVERT',
    "foundReceptionId" TEXT,
    "foundPositionId" TEXT,
    "newShipmentNumber" TEXT,
    "foundAt" TIMESTAMP(3),
    "resolvedById" TEXT,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Dispute_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_name_key" ON "User"("name");

-- CreateIndex
CREATE INDEX "Reception_status_idx" ON "Reception"("status");

-- CreateIndex
CREATE INDEX "Reception_arrivedAt_idx" ON "Reception"("arrivedAt");

-- CreateIndex
CREATE INDEX "Reception_loadingListNumber_idx" ON "Reception"("loadingListNumber");

-- CreateIndex
CREATE INDEX "Position_receptionId_lineNumber_idx" ON "Position"("receptionId", "lineNumber");

-- CreateIndex
CREATE INDEX "Position_shipmentKey_idx" ON "Position"("shipmentKey");

-- CreateIndex
CREATE INDEX "Position_printedNumber_idx" ON "Position"("printedNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Scan_clientId_key" ON "Scan"("clientId");

-- CreateIndex
CREATE INDEX "Scan_receptionId_scannedAt_idx" ON "Scan"("receptionId", "scannedAt");

-- CreateIndex
CREATE INDEX "Scan_normalizedCode_idx" ON "Scan"("normalizedCode");

-- CreateIndex
CREATE INDEX "Photo_receptionId_idx" ON "Photo"("receptionId");

-- CreateIndex
CREATE INDEX "ReceptionNote_receptionId_idx" ON "ReceptionNote"("receptionId");

-- CreateIndex
CREATE INDEX "Dispute_status_idx" ON "Dispute"("status");

-- CreateIndex
CREATE INDEX "Dispute_printedNumber_idx" ON "Dispute"("printedNumber");

-- AddForeignKey
ALTER TABLE "Reception" ADD CONSTRAINT "Reception_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reception" ADD CONSTRAINT "Reception_controllerId_fkey" FOREIGN KEY ("controllerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reception" ADD CONSTRAINT "Reception_closedById_fkey" FOREIGN KEY ("closedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Position" ADD CONSTRAINT "Position_receptionId_fkey" FOREIGN KEY ("receptionId") REFERENCES "Reception"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Scan" ADD CONSTRAINT "Scan_receptionId_fkey" FOREIGN KEY ("receptionId") REFERENCES "Reception"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Scan" ADD CONSTRAINT "Scan_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "Position"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Scan" ADD CONSTRAINT "Scan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Photo" ADD CONSTRAINT "Photo_receptionId_fkey" FOREIGN KEY ("receptionId") REFERENCES "Reception"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Photo" ADD CONSTRAINT "Photo_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "Position"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Photo" ADD CONSTRAINT "Photo_scanId_fkey" FOREIGN KEY ("scanId") REFERENCES "Scan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Photo" ADD CONSTRAINT "Photo_disputeId_fkey" FOREIGN KEY ("disputeId") REFERENCES "Dispute"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Photo" ADD CONSTRAINT "Photo_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReceptionNote" ADD CONSTRAINT "ReceptionNote_receptionId_fkey" FOREIGN KEY ("receptionId") REFERENCES "Reception"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReceptionNote" ADD CONSTRAINT "ReceptionNote_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "Position"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReceptionNote" ADD CONSTRAINT "ReceptionNote_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dispute" ADD CONSTRAINT "Dispute_originReceptionId_fkey" FOREIGN KEY ("originReceptionId") REFERENCES "Reception"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dispute" ADD CONSTRAINT "Dispute_originPositionId_fkey" FOREIGN KEY ("originPositionId") REFERENCES "Position"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dispute" ADD CONSTRAINT "Dispute_foundReceptionId_fkey" FOREIGN KEY ("foundReceptionId") REFERENCES "Reception"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dispute" ADD CONSTRAINT "Dispute_foundPositionId_fkey" FOREIGN KEY ("foundPositionId") REFERENCES "Position"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dispute" ADD CONSTRAINT "Dispute_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
