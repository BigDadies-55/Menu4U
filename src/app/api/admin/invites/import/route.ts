import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createInvite, sendInviteNotifications } from "@/lib/invite";
import { Role } from "@/generated/prisma/client";

const ALLOWED_ROLES: Role[] = ["WAITER", "EDITOR", "VIEWER"];

type CsvRow = {
  firstName:    string;
  lastName:     string;
  email?:       string;
  phone?:       string;
  role:         Role;
  restaurantId?: string;
};

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { rows }: { rows: CsvRow[] } = await req.json();
  if (!Array.isArray(rows) || rows.length === 0)
    return NextResponse.json({ error: "אין שורות לייבוא" }, { status: 400 });
  if (rows.length > 200)
    return NextResponse.json({ error: "מקסימום 200 שורות בייבוא אחד" }, { status: 400 });

  // Verify caller's restaurant access
  let myRestaurantIds: string[] | null = null;
  if (!["SUPER_ADMIN", "ADMIN"].includes(session.user.role)) {
    const links = await prisma.restaurantUser.findMany({
      where: { userId: session.user.id },
      select: { restaurantId: true },
    });
    myRestaurantIds = links.map(l => l.restaurantId);
  }

  const results: { row: number; status: "ok" | "error"; name: string; error?: string }[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 1;

    try {
      if (!row.firstName?.trim() || !row.lastName?.trim()) {
        results.push({ row: rowNum, status: "error", name: `שורה ${rowNum}`, error: "שם חסר" });
        continue;
      }
      if (!row.email?.trim() && !row.phone?.trim()) {
        results.push({ row: rowNum, status: "error", name: `${row.firstName} ${row.lastName}`, error: "נדרש אימייל או טלפון" });
        continue;
      }
      if (!ALLOWED_ROLES.includes(row.role)) {
        results.push({ row: rowNum, status: "error", name: `${row.firstName} ${row.lastName}`, error: `תפקיד לא מותר: ${row.role}` });
        continue;
      }

      const restaurantIds: string[] = [];
      if (row.restaurantId?.trim()) {
        if (myRestaurantIds && !myRestaurantIds.includes(row.restaurantId)) {
          results.push({ row: rowNum, status: "error", name: `${row.firstName} ${row.lastName}`, error: "מסעדה לא מורשית" });
          continue;
        }
        restaurantIds.push(row.restaurantId);
      }

      const invite = await createInvite({
        firstName:     row.firstName.trim(),
        lastName:      row.lastName.trim(),
        email:         row.email?.trim()  || undefined,
        phone:         row.phone?.trim()  || undefined,
        role:          row.role,
        restaurantIds,
        invitedById:   session.user.id,
      });

      // fire-and-forget notifications
      sendInviteNotifications(invite).catch(e => console.error("[csv-import] notify:", e));

      results.push({ row: rowNum, status: "ok", name: `${row.firstName} ${row.lastName}` });
    } catch (err) {
      results.push({ row: rowNum, status: "error", name: `שורה ${rowNum}`, error: err instanceof Error ? err.message : "שגיאה" });
    }
  }

  const ok    = results.filter(r => r.status === "ok").length;
  const failed = results.filter(r => r.status === "error").length;
  return NextResponse.json({ ok, failed, results });
}
