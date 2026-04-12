-- CreateTable
CREATE TABLE "BeverageGroup" (
    "id" TEXT NOT NULL,
    "orderNumber" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BeverageGroup_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BeverageGroup_orderNumber_key" ON "BeverageGroup"("orderNumber");

-- CreateTable
CREATE TABLE "Beverage" (
    "id" TEXT NOT NULL,
    "orderNumber" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "beverageGroupId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Beverage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Beverage_beverageGroupId_orderNumber_key" ON "Beverage"("beverageGroupId", "orderNumber");

-- AddForeignKey
ALTER TABLE "Beverage" ADD CONSTRAINT "Beverage_beverageGroupId_fkey" FOREIGN KEY ("beverageGroupId") REFERENCES "BeverageGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
