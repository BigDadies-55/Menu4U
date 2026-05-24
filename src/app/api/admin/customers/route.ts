import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type CustomerRow = {
  id: string; restaurantId: string; restaurantName: string;
  name: string; phone: string | null; email: string | null;
  notes: string | null; createdAt: Date;
};

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const restaurantId = searchParams.get("restaurantId");
  const q = searchParams.get("q") ?? "";

  const isSuperAdmin = session.user.role === "SUPER_ADMIN";

  // Get allowed restaurant IDs for this user
  let allowedIds: string[] = [];
  if (!isSuperAdmin) {
    const links = await prisma.restaurantUser.findMany({
      where: { userId: session.user.id },
      select: { restaurantId: true },
    });
    allowedIds = links.map(l => l.restaurantId);
    if (allowedIds.length === 0) return NextResponse.json([]);
  }

  // Build query
  let rows: CustomerRow[];
  if (isSuperAdmin) {
    if (restaurantId) {
      rows = await prisma.$queryRaw<CustomerRow[]>`
        SELECT c.id, c."restaurantId", r.name AS "restaurantName",
               c.name, c.phone, c.email, c.notes, c."createdAt"
        FROM "Customer" c
        JOIN "Restaurant" r ON r.id = c."restaurantId"
        WHERE c."restaurantId" = ${restaurantId}
          AND (${q} = '' OR c.name ILIKE ${'%'+q+'%'} OR c.phone ILIKE ${'%'+q+'%'} OR c.email ILIKE ${'%'+q+'%'})
        ORDER BY c."createdAt" DESC
        LIMIT 500
      `;
    } else {
      rows = await prisma.$queryRaw<CustomerRow[]>`
        SELECT c.id, c."restaurantId", r.name AS "restaurantName",
               c.name, c.phone, c.email, c.notes, c."createdAt"
        FROM "Customer" c
        JOIN "Restaurant" r ON r.id = c."restaurantId"
        WHERE (${q} = '' OR c.name ILIKE ${'%'+q+'%'} OR c.phone ILIKE ${'%'+q+'%'} OR c.email ILIKE ${'%'+q+'%'})
        ORDER BY c."createdAt" DESC
        LIMIT 500
      `;
    }
  } else {
    rows = await prisma.$queryRaw<CustomerRow[]>`
      SELECT c.id, c."restaurantId", r.name AS "restaurantName",
             c.name, c.phone, c.email, c.notes, c."createdAt"
      FROM "Customer" c
      JOIN "Restaurant" r ON r.id = c."restaurantId"
      WHERE c."restaurantId" = ANY(${allowedIds}::text[])
        AND (${q} = '' OR c.name ILIKE ${'%'+q+'%'} OR c.phone ILIKE ${'%'+q+'%'} OR c.email ILIKE ${'%'+q+'%'})
      ORDER BY c."createdAt" DESC
      LIMIT 500
    `;
  }

  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { restaurantId, name, phone, email, notes } = await req.json();
  if (!restaurantId || !name?.trim()) return NextResponse.json({ error: "שם ומסעדה נדרשים" }, { status: 400 });

  const isSuperAdmin = session.user.role === "SUPER_ADMIN";
  if (!isSuperAdmin) {
    const link = await prisma.restaurantUser.findFirst({ where: { userId: session.user.id, restaurantId } });
    if (!link) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const id = `cust_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
  await prisma.$executeRawUnsafe(
    `INSERT INTO "Customer" ("id","restaurantId","name","phone","email","notes","createdAt","updatedAt") VALUES ($1,$2,$3,$4,$5,$6,NOW(),NOW())`,
    id, restaurantId, name.trim(), phone?.trim() || null, email?.trim() || null, notes?.trim() || null
  );
  return NextResponse.json({ success: true, id });
}
