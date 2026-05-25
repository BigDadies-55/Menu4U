/**
 * Next.js instrumentation hook — runs once when the server starts.
 * Applies any pending schema migrations that can't wait for a full deploy.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const DATABASE_URL = process.env.DATABASE_URL;
  if (!DATABASE_URL) return;

  try {
    const { Client } = await import("pg");
    const client = new Client({ connectionString: DATABASE_URL, connectionTimeoutMillis: 8000 });
    await client.connect();

    // All migrations are idempotent (IF NOT EXISTS / IF EXISTS guards)
    const migrations = [
      `ALTER TABLE "OrderItem" ADD COLUMN IF NOT EXISTS "servedAt" TIMESTAMP(3);`,
    ];

    for (const sql of migrations) {
      try {
        await client.query(sql);
      } catch (e: unknown) {
        console.warn("[instrumentation] migration warning:", (e as Error).message);
      }
    }

    await client.end();
    console.log("[instrumentation] DB migrations applied.");
  } catch (e: unknown) {
    // Non-fatal — log and continue; the app may still work if columns already exist
    console.warn("[instrumentation] DB migration skipped:", (e as Error).message);
  }
}
