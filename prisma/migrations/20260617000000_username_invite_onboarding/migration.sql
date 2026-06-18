-- Migration: username_invite_onboarding
-- Adds username + phone + firstName + lastName to User
-- Makes email nullable and non-unique
-- Adds UserInvite model and InviteStatus enum

-- 1. Add InviteStatus enum
CREATE TYPE "InviteStatus" AS ENUM ('PENDING', 'COMPLETED', 'EXPIRED', 'CANCELLED');

-- 2. Add new columns to User (nullable first)
ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "username"  TEXT,
  ADD COLUMN IF NOT EXISTS "firstName" TEXT,
  ADD COLUMN IF NOT EXISTS "lastName"  TEXT,
  ADD COLUMN IF NOT EXISTS "phone"     TEXT;

-- 3. Populate username from email (part before @), deduplicate with suffix
DO $$
DECLARE
  rec    RECORD;
  base   TEXT;
  candidate TEXT;
  suffix INT;
BEGIN
  FOR rec IN SELECT id, email FROM "User" ORDER BY "createdAt" ASC LOOP
    IF rec.email IS NULL THEN
      base := 'user_' || LEFT(rec.id, 8);
    ELSE
      base := LOWER(SPLIT_PART(rec.email, '@', 1));
      -- sanitize: keep only a-z 0-9 . _ -
      base := REGEXP_REPLACE(base, '[^a-z0-9._\-]', '_', 'g');
      IF LENGTH(base) < 3 THEN base := base || '_user'; END IF;
    END IF;

    candidate := base;
    suffix    := 2;
    WHILE EXISTS (SELECT 1 FROM "User" WHERE username = candidate AND id <> rec.id) LOOP
      candidate := base || '_' || suffix;
      suffix    := suffix + 1;
    END LOOP;

    UPDATE "User" SET username = candidate WHERE id = rec.id;
  END LOOP;
END $$;

-- 4. Now make username NOT NULL and UNIQUE
ALTER TABLE "User" ALTER COLUMN "username" SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "User_username_key" ON "User"("username");

-- 5. Drop old email unique constraint, make nullable
DROP INDEX IF EXISTS "User_email_key";
ALTER TABLE "User" ALTER COLUMN "email" DROP NOT NULL;

-- 6. Create UserInvite table
CREATE TABLE IF NOT EXISTS "UserInvite" (
  "id"             TEXT         NOT NULL,
  "token"          TEXT         NOT NULL,
  "firstName"      TEXT         NOT NULL,
  "lastName"       TEXT         NOT NULL,
  "email"          TEXT,
  "phone"          TEXT,
  "role"           "Role"       NOT NULL,
  "restaurantIds"  TEXT[]       NOT NULL DEFAULT '{}',
  "invitedById"    TEXT         NOT NULL,
  "status"         "InviteStatus" NOT NULL DEFAULT 'PENDING',
  "expiresAt"      TIMESTAMP(3) NOT NULL,
  "reminderSentAt" TIMESTAMP(3),
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "UserInvite_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "UserInvite_token_key" UNIQUE ("token"),
  CONSTRAINT "UserInvite_invitedById_fkey"
    FOREIGN KEY ("invitedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "UserInvite_token_idx"  ON "UserInvite"("token");
CREATE INDEX IF NOT EXISTS "UserInvite_status_idx" ON "UserInvite"("status");

-- 7. Create OtpCode table
CREATE TABLE IF NOT EXISTS "OtpCode" (
  "id"         TEXT         NOT NULL,
  "identifier" TEXT         NOT NULL,
  "channel"    TEXT         NOT NULL,
  "code"       TEXT         NOT NULL,
  "expires"    TIMESTAMP(3) NOT NULL,
  "attempts"   INT          NOT NULL DEFAULT 0,
  CONSTRAINT "OtpCode_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "OtpCode_identifier_idx" ON "OtpCode"("identifier");
