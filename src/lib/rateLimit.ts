import { prisma } from "./prisma";

let tableReady = false;

async function ensureTable() {
  if (tableReady) return;
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "_RateLimit" (
      "key"         TEXT    PRIMARY KEY,
      "hits"        INTEGER NOT NULL DEFAULT 1,
      "windowStart" TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);
  tableReady = true;
}

/**
 * Returns true if the request is within limits, false if the limit is exceeded.
 * Uses the DB so it works across serverless instances.
 * key       — unique identifier, e.g. "member-lookup:IP:restaurantId"
 * max       — max requests allowed in the window
 * windowMs  — rolling window length in milliseconds
 */
export async function checkRateLimit(
  key: string,
  max: number,
  windowMs: number
): Promise<boolean> {
  try {
    await ensureTable();
    const cutoff = new Date(Date.now() - windowMs);
    type Row = { hits: number };
    const rows = await prisma.$queryRawUnsafe<Row[]>(
      `INSERT INTO "_RateLimit" ("key", "hits", "windowStart")
       VALUES ($1, 1, NOW())
       ON CONFLICT ("key") DO UPDATE
         SET "hits" = CASE
               WHEN "_RateLimit"."windowStart" < $2 THEN 1
               ELSE "_RateLimit"."hits" + 1
             END,
             "windowStart" = CASE
               WHEN "_RateLimit"."windowStart" < $2 THEN NOW()
               ELSE "_RateLimit"."windowStart"
             END
       RETURNING "hits"`,
      key,
      cutoff
    );
    return (rows[0]?.hits ?? 1) <= max;
  } catch {
    return true; // fail open — don't block on DB error
  }
}

export function getIpKey(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  return forwarded ? forwarded.split(",")[0].trim() : "unknown";
}
