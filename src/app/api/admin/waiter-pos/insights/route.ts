import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { computeInsights, type TableInput, type CustomRule, type BuiltinRuleOverrides } from "@/lib/waiter-insights";

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

async function getBuiltinOverrides(restaurantId: string): Promise<BuiltinRuleOverrides> {
  try {
    // Fetch global overrides + restaurant-specific overrides in parallel
    const [globalRows, restRows] = await Promise.all([
      prisma.$queryRawUnsafe<Array<{ builtinOverridesJson: string | null }>>(
        `SELECT "builtinOverridesJson" FROM "InsightGlobalConfig" WHERE id = 'GLOBAL'`
      ).catch(() => [] as Array<{ builtinOverridesJson: string | null }>),
      prisma.$queryRawUnsafe<Array<{ insightBuiltinOverridesJson: string | null }>>(
        `SELECT "insightBuiltinOverridesJson" FROM "Restaurant" WHERE id = $1`,
        restaurantId
      ),
    ]);
    const global: BuiltinRuleOverrides = JSON.parse(globalRows[0]?.builtinOverridesJson ?? "{}");
    const local: BuiltinRuleOverrides  = JSON.parse(restRows[0]?.insightBuiltinOverridesJson ?? "{}");
    // Restaurant-specific overrides take precedence over global
    return { ...global, ...local };
  } catch { return {}; }
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

  const [customRules, builtinOverrides] = await Promise.all([
    getCustomRules(restaurantId),
    getBuiltinOverrides(restaurantId),
  ]);
  const insights = computeInsights(tables ?? [], customRules, builtinOverrides);
  return NextResponse.json({ insights });
}
