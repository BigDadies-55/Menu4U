import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import type { CustomRule, BuiltinRuleOverrides } from "@/lib/waiter-insights";
import { randomUUID } from "crypto";

async function ensureColumn() {
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "Restaurant" ADD COLUMN IF NOT EXISTS "insightRulesJson" TEXT DEFAULT '[]'`
  );
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "Restaurant" ADD COLUMN IF NOT EXISTS "insightBuiltinOverridesJson" TEXT DEFAULT '{}'`
  );
}

async function getBuiltinOverrides(restaurantId: string): Promise<BuiltinRuleOverrides> {
  await ensureColumn();
  const rows = await prisma.$queryRawUnsafe<Array<{ insightBuiltinOverridesJson: string | null }>>(
    `SELECT "insightBuiltinOverridesJson" FROM "Restaurant" WHERE id = $1`,
    restaurantId
  );
  try { return JSON.parse(rows[0]?.insightBuiltinOverridesJson ?? "{}"); } catch { return {}; }
}

async function saveBuiltinOverrides(restaurantId: string, overrides: BuiltinRuleOverrides) {
  await prisma.$executeRawUnsafe(
    `UPDATE "Restaurant" SET "insightBuiltinOverridesJson" = $1 WHERE id = $2`,
    JSON.stringify(overrides),
    restaurantId
  );
}

async function checkAccess(userId: string, role: string, restaurantId: string): Promise<boolean> {
  if (role === "SUPER_ADMIN") return true;
  const access = await prisma.restaurantUser.findFirst({ where: { userId, restaurantId } });
  return !!access;
}

async function getRules(restaurantId: string): Promise<CustomRule[]> {
  await ensureColumn();
  const rows = await prisma.$queryRawUnsafe<Array<{ insightRulesJson: string | null }>>(
    `SELECT "insightRulesJson" FROM "Restaurant" WHERE id = $1`,
    restaurantId
  );
  try { return JSON.parse(rows[0]?.insightRulesJson ?? "[]"); } catch { return []; }
}

async function saveRules(restaurantId: string, rules: CustomRule[]) {
  await prisma.$executeRawUnsafe(
    `UPDATE "Restaurant" SET "insightRulesJson" = $1 WHERE id = $2`,
    JSON.stringify(rules),
    restaurantId
  );
}

// GET /api/admin/insight-rules?restaurantId=X
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const restaurantId = searchParams.get("restaurantId");
  if (!restaurantId) return NextResponse.json({ error: "restaurantId required" }, { status: 400 });

  if (!(await checkAccess(session.user.id, session.user.role, restaurantId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [rules, builtinOverrides] = await Promise.all([
    getRules(restaurantId),
    getBuiltinOverrides(restaurantId),
  ]);
  return NextResponse.json({ rules, builtinOverrides });
}

// POST /api/admin/insight-rules — create rule
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { restaurantId, rule } = body as { restaurantId: string; rule: Omit<CustomRule, "id"> };

  if (!restaurantId || !rule) return NextResponse.json({ error: "restaurantId and rule required" }, { status: 400 });
  if (!(await checkAccess(session.user.id, session.user.role, restaurantId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const rules = await getRules(restaurantId);
  const newRule: CustomRule = { ...rule, id: randomUUID() };
  rules.push(newRule);
  await saveRules(restaurantId, rules);
  return NextResponse.json({ rule: newRule });
}

// PUT /api/admin/insight-rules — update rule
export async function PUT(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { restaurantId, rule } = body as { restaurantId: string; rule: CustomRule };

  if (!restaurantId || !rule?.id) return NextResponse.json({ error: "restaurantId and rule.id required" }, { status: 400 });
  if (!(await checkAccess(session.user.id, session.user.role, restaurantId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const rules = await getRules(restaurantId);
  const idx = rules.findIndex(r => r.id === rule.id);
  if (idx < 0) return NextResponse.json({ error: "Rule not found" }, { status: 404 });
  rules[idx] = rule;
  await saveRules(restaurantId, rules);
  return NextResponse.json({ rule });
}

// PATCH /api/admin/insight-rules — update a single builtin rule override
export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { restaurantId, ruleId, override } = body as {
    restaurantId: string;
    ruleId: string;
    override: { enabled: boolean; text?: string; priority?: number } | null;
  };

  if (!restaurantId || !ruleId) return NextResponse.json({ error: "restaurantId and ruleId required" }, { status: 400 });
  if (!(await checkAccess(session.user.id, session.user.role, restaurantId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const overrides = await getBuiltinOverrides(restaurantId);
  if (override === null) {
    delete overrides[ruleId]; // reset to default
  } else {
    overrides[ruleId] = override;
  }
  await saveBuiltinOverrides(restaurantId, overrides);
  return NextResponse.json({ ok: true, builtinOverrides: overrides });
}

// DELETE /api/admin/insight-rules?restaurantId=X&id=Y
export async function DELETE(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const restaurantId = searchParams.get("restaurantId");
  const id = searchParams.get("id");

  if (!restaurantId || !id) return NextResponse.json({ error: "restaurantId and id required" }, { status: 400 });
  if (!(await checkAccess(session.user.id, session.user.role, restaurantId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const rules = await getRules(restaurantId);
  const filtered = rules.filter(r => r.id !== id);
  await saveRules(restaurantId, filtered);
  return NextResponse.json({ ok: true });
}
