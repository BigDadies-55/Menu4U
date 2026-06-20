// ── Auto-assigned employee numbers ───────────────────────────────────────────
// Every user gets a permanent, immutable 6-digit employee number. The first digit
// identifies the restaurant (each restaurant gets a distinct leading digit) and
// the remaining five are a per-restaurant running sequence — e.g. restaurant #1 →
// 100001, 100002 …, restaurant #2 → 200001 … . Numbers are generated lazily and
// are never editable by anyone.
//
// Stored as raw columns (not in schema.prisma), matching the project convention
// for additive columns ("column not in Prisma schema").

import { prisma } from "@/lib/prisma";

let columnsEnsured = false;
async function ensureColumns() {
  if (columnsEnsured) return;
  await prisma.$executeRawUnsafe(`ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "employeeNo" TEXT`);
  await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "User_employeeNo_key" ON "User"("employeeNo") WHERE "employeeNo" IS NOT NULL`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "Restaurant" ADD COLUMN IF NOT EXISTS "employeeNoPrefix" INTEGER`);
  columnsEnsured = true;
}

// First digit per restaurant. Assigned in ascending order (1, 2, 3 …) the first
// time a restaurant needs an employee number. (Supports up to 9 restaurants within
// a 6-digit scheme; beyond that the sequence simply widens.)
async function getOrAssignPrefix(restaurantId: string): Promise<number> {
  const rows = await prisma.$queryRawUnsafe<{ employeeNoPrefix: number | null }[]>(
    `SELECT "employeeNoPrefix" FROM "Restaurant" WHERE id=$1`, restaurantId
  );
  if (rows[0]?.employeeNoPrefix) return rows[0].employeeNoPrefix;
  const maxRows = await prisma.$queryRawUnsafe<{ m: number | null }[]>(
    `SELECT MAX("employeeNoPrefix") AS m FROM "Restaurant"`
  );
  const next = (maxRows[0]?.m ?? 0) + 1;
  await prisma.$executeRawUnsafe(`UPDATE "Restaurant" SET "employeeNoPrefix"=$1 WHERE id=$2`, next, restaurantId);
  return next;
}

/**
 * Make sure every user linked to the restaurant has an employee number, assigning
 * any that are missing. Idempotent. Returns a userId → employeeNo map.
 */
export async function ensureEmployeeNumbers(restaurantId: string): Promise<Record<string, string>> {
  await ensureColumns();
  const prefix = await getOrAssignPrefix(restaurantId);
  const base = prefix * 100000; // prefix 1 → 100000 → first number 100001 (6 digits)

  // Oldest employees first → lowest numbers (stable, deterministic).
  const users = await prisma.$queryRawUnsafe<{ userId: string; employeeNo: string | null }[]>(
    `SELECT ru."userId", u."employeeNo"
     FROM "RestaurantUser" ru JOIN "User" u ON u.id = ru."userId"
     WHERE ru."restaurantId"=$1
     ORDER BY u."createdAt" ASC, ru."userId" ASC`,
    restaurantId
  );

  const maxRows = await prisma.$queryRawUnsafe<{ m: number | null }[]>(
    `SELECT MAX(CAST("employeeNo" AS INTEGER)) AS m FROM "User"
     WHERE "employeeNo" ~ '^[0-9]+$'
       AND CAST("employeeNo" AS INTEGER) >= $1 AND CAST("employeeNo" AS INTEGER) < $2`,
    base, base + 100000
  );
  let nextN = maxRows[0]?.m ?? base;

  const result: Record<string, string> = {};
  for (const u of users) {
    if (u.employeeNo) { result[u.userId] = u.employeeNo; continue; }
    nextN += 1;
    const no = String(nextN);
    // WHERE employeeNo IS NULL guards against double-assignment under races.
    await prisma.$executeRawUnsafe(
      `UPDATE "User" SET "employeeNo"=$1 WHERE id=$2 AND "employeeNo" IS NULL`, no, u.userId
    );
    result[u.userId] = no;
  }
  return result;
}
