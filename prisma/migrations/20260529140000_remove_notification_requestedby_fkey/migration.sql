-- DropForeignKey
ALTER TABLE "Notification" DROP CONSTRAINT IF EXISTS "Notification_requestedBy_fkey";

-- DropIndex (the index on requestedBy if it exists)
DROP INDEX IF EXISTS "Notification_requestedBy_fkey";
