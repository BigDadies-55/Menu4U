import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

type ModuleRow = {
  id: string;
  restaurantId: string | null;
  groupId: string | null;
  moduleKey: string;
  isEnabled: boolean;
  enabledFrom: Date | null;
  enabledTo: Date | null;
  enabledBy: string | null;
  note: string | null;
  createdAt: Date;
  updatedAt: Date;
};

// GET ?restaurantId=... — list all module rows for a restaurant
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "SUPER_ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const restaurantId = searchParams.get("restaurantId");

  try {
    let rows: ModuleRow[];
    if (restaurantId) {
      rows = await prisma.$queryRawUnsafe<ModuleRow[]>(
        `SELECT * FROM "RestaurantModule" WHERE "restaurantId" = $1 ORDER BY "moduleKey" ASC`,
        restaurantId
      );
    } else {
      rows = await prisma.$queryRawUnsafe<ModuleRow[]>(
        `SELECT * FROM "RestaurantModule" ORDER BY "restaurantId" ASC, "moduleKey" ASC`
      );
    }
    return NextResponse.json({ rows });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// POST — upsert a module entry
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "SUPER_ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { restaurantId, moduleKey, isEnabled, enabledFrom, enabledTo, note } = body;

  if (!moduleKey) return NextResponse.json({ error: "moduleKey required" }, { status: 400 });

  try {
    // Check if a row exists for this restaurant+module
    const existing = await prisma.$queryRawUnsafe<{ id: string }[]>(
      `SELECT id FROM "RestaurantModule" WHERE "moduleKey" = $1 AND "restaurantId" IS NOT DISTINCT FROM $2 LIMIT 1`,
      moduleKey, restaurantId ?? null
    );

    if (existing.length > 0) {
      await prisma.$executeRawUnsafe(
        `UPDATE "RestaurantModule"
         SET "isEnabled" = $1,
             "enabledFrom" = $2,
             "enabledTo" = $3,
             "note" = $4,
             "enabledBy" = $5,
             "updatedAt" = NOW()
         WHERE id = $6`,
        isEnabled ?? true,
        enabledFrom ? new Date(enabledFrom) : null,
        enabledTo ? new Date(enabledTo) : null,
        note ?? null,
        session.user.id,
        existing[0].id
      );
      return NextResponse.json({ ok: true, action: "updated", id: existing[0].id });
    } else {
      const rows = await prisma.$queryRawUnsafe<{ id: string }[]>(
        `INSERT INTO "RestaurantModule" ("restaurantId", "moduleKey", "isEnabled", "enabledFrom", "enabledTo", "note", "enabledBy")
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id`,
        restaurantId ?? null,
        moduleKey,
        isEnabled ?? true,
        enabledFrom ? new Date(enabledFrom) : null,
        enabledTo ? new Date(enabledTo) : null,
        note ?? null,
        session.user.id
      );
      return NextResponse.json({ ok: true, action: "created", id: rows[0]?.id });
    }
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// DELETE ?id=...
export async function DELETE(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "SUPER_ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  try {
    await prisma.$executeRawUnsafe(`DELETE FROM "RestaurantModule" WHERE id = $1`, id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
