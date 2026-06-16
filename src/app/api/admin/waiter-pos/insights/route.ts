import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { computeInsights, type TableInput, type CustomRule, type BuiltinRuleOverrides } from "@/lib/waiter-insights";

async function ensureSuppressColumn() {
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "Restaurant" ADD COLUMN IF NOT EXISTS "insightSuppressJson" TEXT DEFAULT '{}'`
  );
}

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

type SuppressEntry = { firedAt: string; minutesSittingAtFire: number };
type SuppressMap = Record<string, SuppressEntry>; // key = "ruleId|tableNum"

async function getSuppressMap(restaurantId: string): Promise<SuppressMap> {
  try {
    const rows = await prisma.$queryRawUnsafe<Array<{ insightSuppressJson: string | null }>>(
      `SELECT "insightSuppressJson" FROM "Restaurant" WHERE id = $1`,
      restaurantId
    );
    return JSON.parse(rows[0]?.insightSuppressJson ?? "{}");
  } catch { return {}; }
}

async function saveSuppressMap(restaurantId: string, map: SuppressMap): Promise<void> {
  await prisma.$executeRawUnsafe(
    `UPDATE "Restaurant" SET "insightSuppressJson" = $1 WHERE id = $2`,
    JSON.stringify(map),
    restaurantId
  );
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

  await ensureSuppressColumn();

  const [customRules, builtinOverrides, suppressMap] = await Promise.all([
    getCustomRules(restaurantId),
    getBuiltinOverrides(restaurantId),
    getSuppressMap(restaurantId),
  ]);

  // Build a lookup of tableNum -> minutesSitting for session reset detection
  const tableMinutes: Record<string, number> = {};
  for (const t of (tables ?? [])) {
    tableMinutes[t.tableNum] = t.minutesSitting;
  }

  // Clean up stale suppressions where table was freed and re-occupied
  // (current minutesSitting < minutesSittingAtFire => new sitting session)
  let suppressChanged = false;
  for (const key of Object.keys(suppressMap)) {
    const [, tableNum] = key.split("|");
    const entry = suppressMap[key];
    const currentMinutes = tableMinutes[tableNum];
    if (currentMinutes !== undefined && currentMinutes < entry.minutesSittingAtFire) {
      delete suppressMap[key];
      suppressChanged = true;
    }
  }

  // Compute insights — both builtin and custom now carry ruleId
  const allInsights = computeInsights(tables ?? [], customRules, builtinOverrides);

  // Build set of fireOnce ruleIds (custom rules + builtin overrides)
  const fireOnceRuleIds = new Set<string>([
    ...customRules.filter(r => r.fireOnce && r.enabled).map(r => r.id),
    ...Object.entries(builtinOverrides).filter(([, ov]) => ov.fireOnce && ov.enabled !== false).map(([id]) => id),
  ]);

  // Filter out suppressed fireOnce insights; record newly fired ones
  const tableMinutesMap: Record<string, number> = {};
  for (const t of (tables ?? [])) tableMinutesMap[t.tableNum] = t.minutesSitting;

  const now = new Date().toISOString();
  const filteredInsights = allInsights.filter(ins => {
    if (!ins.ruleId || !fireOnceRuleIds.has(ins.ruleId)) return true;
    const key = `${ins.ruleId}|${ins.tableNum}`;
    if (suppressMap[key]) return false; // already fired this session
    // Record first fire
    suppressMap[key] = { firedAt: now, minutesSittingAtFire: tableMinutesMap[ins.tableNum] ?? 0 };
    suppressChanged = true;
    return true;
  });

  if (suppressChanged) {
    await saveSuppressMap(restaurantId, suppressMap);
  }

  return NextResponse.json({ insights: filteredInsights });
}
