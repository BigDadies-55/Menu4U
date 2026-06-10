import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { computeInsights, type TableInput, type CustomRule } from "@/lib/waiter-insights";

async function checkAccess(userId: string, role: string, restaurantId: string): Promise<boolean> {
  if (role === "SUPER_ADMIN") return true;
  const access = await prisma.restaurantUser.findFirst({ where: { userId, restaurantId } });
  return !!access;
}

async function getCustomRules(restaurantId: string): Promise<CustomRule[]> {
  try {
    const rows = await prisma.$queryRawUnsafe<Array<{ insightRulesJson: string | null }>>(
      `SELECT "insightRulesJson" FROM "Restaurant" WHERE id = $1`,
      restaurantId
    );
    return JSON.parse(rows[0]?.insightRulesJson ?? "[]");
  } catch { return []; }
}

// POST /api/admin/waiter-pos/insights
// Body: { restaurantId, tables: TableInput[] }
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { restaurantId, tables } = body as { restaurantId: string; tables: TableInput[] };

  if (!restaurantId) return NextResponse.json({ error: "restaurantId required" }, { status: 400 });

  if (!(await checkAccess(session.user.id, session.user.role, restaurantId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const customRules = await getCustomRules(restaurantId);
  const insights = computeInsights(tables ?? [], customRules);
  return NextResponse.json({ insights });
}
