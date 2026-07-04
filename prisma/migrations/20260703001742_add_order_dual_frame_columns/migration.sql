-- Add dual-frame (2x1) columns to Order.
-- These fields exist in schema.prisma (commit ff45ae43) but were never migrated,
-- causing prisma.order.create() to fail on checkout: column "Order.frameA2" does not exist.
-- Idempotent (IF NOT EXISTS) so it is safe whether or not the columns already exist in a given DB.
ALTER TABLE "Order"
  ADD COLUMN IF NOT EXISTS "frameA2" TEXT,
  ADD COLUMN IF NOT EXISTS "frameB2" TEXT,
  ADD COLUMN IF NOT EXISTS "frameDbl2" TEXT,
  ADD COLUMN IF NOT EXISTS "frameEdc2" TEXT,
  ADD COLUMN IF NOT EXISTS "labFrameDetails2" TEXT,
  ADD COLUMN IF NOT EXISTS "labFrameShape2" TEXT;
