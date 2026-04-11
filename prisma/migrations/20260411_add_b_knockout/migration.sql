-- AlterTable Tournament: add hasBKnockout and bKoScheduleLive
ALTER TABLE "Tournament" ADD COLUMN "hasBKnockout" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Tournament" ADD COLUMN "bKoScheduleLive" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable Match: add koBracket (defaults to "A" for all existing matches)
ALTER TABLE "Match" ADD COLUMN "koBracket" TEXT NOT NULL DEFAULT 'A';
