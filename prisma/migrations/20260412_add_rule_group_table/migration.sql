-- CreateTable
CREATE TABLE "RuleGroup" (
    "id" TEXT NOT NULL,
    "orderNumber" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RuleGroup_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RuleGroup_orderNumber_key" ON "RuleGroup"("orderNumber");

-- AlterTable: add ruleGroupId to Rule (nullable first to allow backfill on existing rows)
ALTER TABLE "Rule" ADD COLUMN "ruleGroupId" TEXT;

-- Insert a default group for any existing rules
INSERT INTO "RuleGroup" ("id", "orderNumber", "title", "updatedAt")
SELECT gen_random_uuid(), 1, 'Algemeen', NOW()
WHERE EXISTS (SELECT 1 FROM "Rule");

-- Assign existing rules to the default group
UPDATE "Rule" SET "ruleGroupId" = (SELECT "id" FROM "RuleGroup" LIMIT 1)
WHERE "ruleGroupId" IS NULL;

-- Make ruleGroupId NOT NULL now that all rows are filled
ALTER TABLE "Rule" ALTER COLUMN "ruleGroupId" SET NOT NULL;

-- Drop old unique constraint on orderNumber alone, replace with (ruleGroupId, orderNumber)
DROP INDEX IF EXISTS "Rule_orderNumber_key";

-- CreateIndex
CREATE UNIQUE INDEX "Rule_ruleGroupId_orderNumber_key" ON "Rule"("ruleGroupId", "orderNumber");

-- AddForeignKey
ALTER TABLE "Rule" ADD CONSTRAINT "Rule_ruleGroupId_fkey" FOREIGN KEY ("ruleGroupId") REFERENCES "RuleGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
