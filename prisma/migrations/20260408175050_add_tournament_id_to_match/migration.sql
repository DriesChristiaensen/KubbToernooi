-- Add tournamentId to Match for direct tournament scoping.
-- Populated from the match's field for existing rows (fresh DB = no existing rows).
-- Cascade-deletes matches when the owning tournament is hard-deleted.

-- AlterTable
ALTER TABLE "Match" ADD COLUMN "tournamentId" TEXT NOT NULL DEFAULT '';

-- Backfill from Field (no-op on empty DB; safe data migration for future deploys)
UPDATE "Match" SET "tournamentId" = (
  SELECT "tournamentId" FROM "Field" WHERE "Field"."id" = "Match"."fieldId"
);

-- Remove the placeholder default now that rows are populated
ALTER TABLE "Match" ALTER COLUMN "tournamentId" DROP DEFAULT;

-- CreateIndex
CREATE INDEX "Match_tournamentId_idx" ON "Match"("tournamentId");

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;
