import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

// One-time migration runner — SUPER_ADMIN only
// Applies pending schema changes that can't be run via CLI
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const results: { sql: string; status: string }[] = [];

  const migrations = [
    `ALTER TABLE "Restaurant" ADD COLUMN IF NOT EXISTS "splashImage" TEXT`,
    `ALTER TABLE "Category" ADD COLUMN IF NOT EXISTS "autoReady" BOOLEAN NOT NULL DEFAULT false`,
    `ALTER TABLE "Restaurant" ADD COLUMN IF NOT EXISTS "openingHours" TEXT`,
  ];

  for (const sql of migrations) {
    try {
      await prisma.$executeRawUnsafe(sql);
      results.push({ sql, status: "ok" });
    } catch (e: unknown) {
      results.push({ sql, status: (e as Error).message });
    }
  }

  return NextResponse.json({ results });
}
