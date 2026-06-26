import { prisma } from "@/lib/prisma";

// Server-side idempotency for outbox replays. The client sends X-Idempotency-Key
// with every mutation; if the same key arrives twice (e.g. the response was lost
// after the write committed) we return the stored result instead of re-applying.

let ensured = false;
async function ensureTable() {
  if (ensured) return;
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "IdempotencyKey" (
      "key"        TEXT NOT NULL,
      "statusCode" INTEGER NOT NULL DEFAULT 200,
      "response"   JSONB,
      "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "IdempotencyKey_pkey" PRIMARY KEY ("key")
    )
  `);
  ensured = true;
}

export function idempotencyKey(req: Request): string | null {
  return req.headers.get("x-idempotency-key");
}

type Cached = { statusCode: number; response: unknown };

export async function getIdempotent(key: string | null): Promise<Cached | null> {
  if (!key) return null;
  await ensureTable();
  const rows = await prisma.$queryRawUnsafe<{ statusCode: number; response: unknown }[]>(
    `SELECT "statusCode", "response" FROM "IdempotencyKey" WHERE "key"=$1`,
    key
  );
  if (rows.length === 0) return null;
  return { statusCode: rows[0].statusCode, response: rows[0].response };
}

export async function saveIdempotent(key: string | null, statusCode: number, response: unknown): Promise<void> {
  if (!key) return;
  await ensureTable();
  await prisma.$executeRawUnsafe(
    `INSERT INTO "IdempotencyKey"("key","statusCode","response") VALUES($1,$2,$3::jsonb)
     ON CONFLICT ("key") DO NOTHING`,
    key, statusCode, JSON.stringify(response ?? null)
  );
}
