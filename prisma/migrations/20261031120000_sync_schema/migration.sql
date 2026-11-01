-- Sync the database with the current Prisma schema that includes the profile/group/resource fields used by the app.

ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "nickname" TEXT;

ALTER TABLE "Group"
  ADD COLUMN IF NOT EXISTS "isBanned" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Resource"
  ADD COLUMN IF NOT EXISTS "groupId" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'Resource_groupId_fkey'
  ) THEN
    ALTER TABLE "Resource"
      ADD CONSTRAINT "Resource_groupId_fkey"
      FOREIGN KEY ("groupId") REFERENCES "Group"("id")
      ON DELETE SET NULL
      ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "Resource_groupId_idx"
  ON "Resource"("groupId");
