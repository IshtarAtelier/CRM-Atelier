-- AlterTable: Add category and laboratory columns to CashMovement
ALTER TABLE "CashMovement" ADD COLUMN "category" TEXT NOT NULL DEFAULT 'OTRO';
ALTER TABLE "CashMovement" ADD COLUMN "laboratory" TEXT;
