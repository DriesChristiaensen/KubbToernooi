-- AlterTable
ALTER TABLE "Tournament" ADD COLUMN "poolScheduleLive" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Tournament" ADD COLUMN "koScheduleLive" BOOLEAN NOT NULL DEFAULT false;
