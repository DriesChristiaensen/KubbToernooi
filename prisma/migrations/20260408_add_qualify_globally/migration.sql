-- AlterTable
ALTER TABLE "Tournament" ADD COLUMN "qualifyGlobally" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Tournament" ADD COLUMN "globalQualifyingTeams" INTEGER NOT NULL DEFAULT 8;
