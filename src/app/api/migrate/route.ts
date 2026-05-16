import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  if (searchParams.get("secret") !== process.env.SETUP_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await prisma.$executeRawUnsafe(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'OWNER' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'Role')) THEN
          ALTER TYPE "Role" ADD VALUE 'OWNER';
        END IF;
      END $$;
    `);
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
