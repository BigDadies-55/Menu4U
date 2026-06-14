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

  // Compute insights
  const allInsights = computeInsights(tables ?? [], customRules, builtinOverrides);

  // Identify fireOnce rules by id
  const fireOnceRuleIds = new Set(
    customRules.filter(r => r.fireOnce && r.enabled).map(r => r.id)
  );

  // Re-run custom rule matching to find ruleId->tableNum pairs for fired insights.
  const firedFireOnce: Array<{ ruleId: string; tableNum: string; minutesSitting: number }> = [];

  if (fireOnceRuleIds.size > 0) {
    for (const table of (tables ?? [])) {
      for (const rule of customRules.filter(r => r.fireOnce && r.enabled && r.conditions.length > 0)) {
        // Check if this rule's insight is in allInsights for this table
        const insight = allInsights.find(i => i.tableNum === table.tableNum);
        if (!insight) continue;
        // Check conditions match
        const matches = rule.conditions.every(c => {
          const actual = (table as unknown as Record<string, unknown>)[c.field] as string | number | null;
          switch (c.operator) {
            case "gt":  return Number(actual) >  Number(c.value);
            case "lt":  return Number(actual) <  Number(c.value);
            case "gte": return Number(actual) >= Number(c.value);
            case "lte": return Number(actual) <= Number(c.value);
            case "eq":  return String(actual ?? "") === String(c.value);
            case "neq": return String(actual ?? "") !== String(c.value);
            default: return false;
          }
        });
        if (matches) {
          // Check stop conditions
          if (rule.stopAfterMinutes !== undefined && table.minutesSitting >= rule.stopAfterMinutes) continue;
          if (rule.stopTrigger) {
            const st = rule.stopTrigger;
            const actual = (table as unknown as Record<string, unknown>)[st.field] as string | number | null;
            let triggered = false;
            switch (st.operator) {
              case "gt":  triggered = Number(actual) >  Number(st.value); break;
              case "lt":  triggered = Number(actual) <  Number(st.value); break;
              case "gte": triggered = Number(actual) >= Number(st.value); break;
              case "lte": triggered = Number(actual) <= Number(st.value); break;
              case "eq":  triggered = String(actual ?? "") === String(st.value); break;
              case "neq": triggered = String(actual ?? "") !== String(st.value); break;
            }
            if (triggered) continue;
          }
          firedFireOnce.push({ ruleId: rule.id, tableNum: table.tableNum, minutesSitting: table.minutesSitting });
          break; // only first matching custom rule per table
        }
      }
    }
  }

  // Build the set of tableNums to suppress based on fireOnce rules that already fired
  const tablesToSuppress = new Set<string>();
  for (const { ruleId, tableNum } of firedFireOnce) {
    const key = `${ruleId}|${tableNum}`;
    if (suppressMap[key]) {
      tablesToSuppress.add(tableNum);
    }
  }

  const filteredInsights = allInsights.filter(i => !tablesToSuppress.has(i.tableNum));

  // Record newly fired fireOnce insights (not yet suppressed)
  const now = new Date().toISOString();
  for (const { ruleId, tableNum, minutesSitting } of firedFireOnce) {
    const key = `${ruleId}|${tableNum}`;
    if (!suppressMap[key]) {
      suppressMap[key] = { firedAt: now, minutesSittingAtFire: minutesSitting };
      suppressChanged = true;
    }
  }

  if (suppressChanged) {
    await saveSuppressMap(restaurantId, suppressMap);
  }

  return NextResponse.json({ insights: filteredInsights });
}
