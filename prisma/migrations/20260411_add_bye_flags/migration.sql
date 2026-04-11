-- AlterTable Match: add explicit bye flags for KO bracket
ALTER TABLE "Match" ADD COLUMN "isByeA" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Match" ADD COLUMN "isByeB" BOOLEAN NOT NULL DEFAULT false;
