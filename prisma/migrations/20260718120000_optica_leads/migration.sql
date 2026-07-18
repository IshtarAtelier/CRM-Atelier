-- CreateTable
CREATE TABLE "OpticaLead" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "phoneWa" TEXT,
    "rating" DOUBLE PRECISION,
    "reviewsCount" INTEGER,
    "category" TEXT,
    "address" TEXT,
    "city" TEXT,
    "province" TEXT,
    "mapsUrl" TEXT,
    "placeId" TEXT,
    "website" TEXT,
    "instagram" TEXT,
    "status" TEXT NOT NULL DEFAULT 'NUEVO',
    "hasWhatsapp" BOOLEAN,
    "notes" TEXT,
    "contactedAt" TIMESTAMP(3),
    "contactedBy" TEXT,
    "source" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OpticaLead_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OpticaLead_placeId_key" ON "OpticaLead"("placeId");
CREATE INDEX "OpticaLead_status_idx" ON "OpticaLead"("status");
CREATE INDEX "OpticaLead_city_idx" ON "OpticaLead"("city");
CREATE INDEX "OpticaLead_rating_idx" ON "OpticaLead"("rating");
CREATE INDEX "OpticaLead_phoneWa_idx" ON "OpticaLead"("phoneWa");
