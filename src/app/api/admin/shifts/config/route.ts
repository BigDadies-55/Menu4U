import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

const MANAGER_ROLES = ["SUPER_ADMIN", "ADMIN", "OWNER", "SHIFT_MANAGER"];

export type ShiftTypeCfg = {
  key: string;
  label: string;
  startTime: string;
  endTime: string;
  color: string;
  visible: boolean;
};

export const DEFAULT_SHIFT_CONFIG: ShiftTypeCfg[] = [
  { key: "MORNING",   label: "בוקר",    startTime: "07:00", endTime: "15:00", color: "#f59e0b", visible: true },
  { key: "AFTERNOON", label: "צהריים",  startTime: "12:00", endTime: "20:00", color: "#3b82f6", visible: true },
  { key: "EVENING",   label: "ערב",     startTime: "17:00", endTime: "01:00", color: "#a855f7", visible: true },
  { key: "NIGHT",     label: "לילה",    startTime: "22:00", endTime: "06:00", color: "#6b7280", visible: true },
];

async function verifyAccess(restaurantId: string, userId: string, role: string) {
  if (role === "SUPER_ADMIN") return true;
  const rows = await prisma.$queryRawUnsafe<{ id: string }[]>(
    `SELECT id FROM "RestaurantUser" WHERE "restaurantId" = $1 AND "userId" = $2 LIMIT 1`,
    restaurantId, userId
  );
  return rows.length > 0;
}

// GET /api/admin/shifts/config?restaurantId=...
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const restaurantId = new URL(req.url).searchParams.get("restaurantId");
  if (!restaurantId) return NextResponse.json({ error: "restaurantId required" }, { status: 400 });

  if (!await verifyAccess(restaurantId, session.user.id, session.user.role))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let config: ShiftTypeCfg[] = DEFAULT_SHIFT_CONFIG;
  try {
    const rows = await prisma.$queryRawUnsafe<{ shiftConfig: string | null }[]>(
      `SELECT "shiftConfig" FROM "Restaurant" WHERE id = $1`, restaurantId
    );
    const raw = rows[0]?.shiftConfig;
    if (raw) config = JSON.parse(raw);
  } catch { /* column may not exist yet, return defaults */ }
  return NextResponse.json({ config });
}

// PATCH /api/admin/shifts/config
export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!MANAGER_ROLES.includes(session.user.role))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { restaurantId, config } = await req.json() as { restaurantId: string; config: ShiftTypeCfg[] };
  if (!restaurantId || !Array.isArray(config))
    return NextResponse.json({ error: "restaurantId and config required" }, { status: 400 });

  if (!await verifyAccess(restaurantId, session.user.id, session.user.role))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await prisma.$executeRawUnsafe(
    `UPDATE "Restaurant" SET "shiftConfig" = $1 WHERE id = $2`,
    JSON.stringify(config), restaurantId
  );
  return NextResponse.json({ ok: true });
}
