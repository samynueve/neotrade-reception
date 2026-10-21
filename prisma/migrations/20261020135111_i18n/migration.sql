-- AlterTable
ALTER TABLE "Reception" DROP COLUMN "importWarnings",
ADD COLUMN     "importChecks" JSONB;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "locale" TEXT;

