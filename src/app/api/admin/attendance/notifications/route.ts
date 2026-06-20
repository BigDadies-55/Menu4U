import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { getRules, saveRules, channelStatus, evaluateRestaurant, RULE_META, type NotificationRule } from "@/lib/attendanceNotify";
import { logAudit, getIp } from "@/lib/audit";

const VIEW_ROLES = ["SUPER_ADMIN", "ADMIN", "OWNER", "SHIFT_MANAGER"];
const EDIT_ROLES = ["SUPER_ADMIN", "ADMIN", "OWNER"];

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!VIEW_ROLES.includes(session.user.role ?? "")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const restaurantId = searchParams.get("restaurantId") ?? "";
  if (!restaurantId) return NextResponse.json({ error: "Missing restaurantId" }, { status: 400 });

  const rules = await getRules(restaurantId);
  return NextResponse.json({
    rules,
    channels: channelStatus(),
    meta: RULE_META,
    canEdit: EDIT_ROLES.includes(session.user.role ?? ""),
  });
}

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!EDIT_ROLES.includes(session.user.role ?? "")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { restaurantId, rules } = body as { restaurantId: string; rules: NotificationRule[] };
  if (!restaurantId || !Array.isArray(rules)) return NextResponse.json({ error: "Invalid params" }, { status: 400 });

  await saveRules(restaurantId, rules);
  await logAudit({
    userId: session.user.id, userEmail: session.user.email,
    action: "NOTIFICATION_RULES_UPDATE", entity: "notificationRule", entityId: restaurantId,
    meta: { restaurantId, rules: rules.map(r => ({ type: r.type, enabled: r.enabled, channels: r.channels })) },
    ip: getIp(req),
  });
  return NextResponse.json({ ok: true });
}

// POST { restaurantId, runNow: true } — evaluate + dispatch immediately ("שלח עכשיו").
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!EDIT_ROLES.includes(session.user.role ?? "")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { restaurantId } = (await req.json()) as { restaurantId: string };
  if (!restaurantId) return NextResponse.json({ error: "Missing restaurantId" }, { status: 400 });

  const result = await evaluateRestaurant(restaurantId);
  await logAudit({
    userId: session.user.id, userEmail: session.user.email,
    action: "NOTIFICATION_RUN_NOW", entity: "notificationRule", entityId: restaurantId,
    meta: { restaurantId, sent: result.sent, byRule: result.byRule },
    ip: getIp(req),
  });
  return NextResponse.json({ ok: true, ...result });
}
