-- CreateTable
CREATE TABLE "TintStylePrice" (
    "category" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TintStylePrice_pkey" PRIMARY KEY ("category")
);
