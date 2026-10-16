-- Reseña en Google ya dejada (marca manual "Ya comentó" o cruce con Places).
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "googleReviewAt" TIMESTAMP(3);
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "googleReviewSource" TEXT;
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "googleReviewBy" TEXT;

-- 2º pedido de reseña: uno solo por cada 1º pedido (lo garantiza el índice único).
ALTER TABLE "ClientTask" ADD COLUMN IF NOT EXISTS "reminderOfTaskId" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "ClientTask_reminderOfTaskId_key" ON "ClientTask"("reminderOfTaskId");
