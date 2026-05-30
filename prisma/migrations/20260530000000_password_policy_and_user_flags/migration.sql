-- AlterTable: add password management fields to User
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "mustChangePassword" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "passwordChangedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lastActivityAt" TIMESTAMP(3);

-- CreateTable: PasswordPolicy
CREATE TABLE IF NOT EXISTS "PasswordPolicy" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "maxAgeDays" INTEGER NOT NULL DEFAULT 0,
    "minLength" INTEGER NOT NULL DEFAULT 8,
    "requireUppercase" BOOLEAN NOT NULL DEFAULT false,
    "requireNumbers" BOOLEAN NOT NULL DEFAULT false,
    "requireSymbols" BOOLEAN NOT NULL DEFAULT false,
    "idleTimeoutMinutes" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PasswordPolicy_pkey" PRIMARY KEY ("id")
);
