-- AlterTable
ALTER TABLE "Position" ADD COLUMN     "shipperCity" TEXT,
ADD COLUMN     "shipperZip" TEXT;

-- AlterTable
ALTER TABLE "Reception" ADD COLUMN     "importRaw" JSONB,
ADD COLUMN     "importSource" TEXT,
ADD COLUMN     "importWarnings" TEXT[],
ADD COLUMN     "subcontractor" TEXT;
