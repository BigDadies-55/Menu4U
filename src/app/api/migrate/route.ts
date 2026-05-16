import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  if (searchParams.get("secret") !== process.env.SETUP_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "Restaurant" ADD COLUMN IF NOT EXISTS "phone2" TEXT;
    `);
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "Restaurant" ADD COLUMN IF NOT EXISTS "orderPhone" TEXT;
    `);
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "Item" ADD COLUMN IF NOT EXISTS "tags" TEXT[] DEFAULT '{}';
    `);
    return NextResponse.json({ success: true, message: "Migrations applied" });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
