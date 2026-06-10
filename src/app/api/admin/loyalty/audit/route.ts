import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getScopeRestaurantIds, getGroupId } from "@/lib/loyalty-scope";
import { ROLE_HIERARCHY } from "@/lib/permissions";
import type { Role } from "@/generated/prisma/client";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const restaurantId = searchParams.get("restaurantId");
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
  const limit = 50;
  const offset = (page - 1) * limit;

  if (!restaurantId) return NextResponse.json({ error: "restaurantId required" }, { status: 400 });

  // Only OWNER and above can view audit logs
  if (session.user.role !== "SUPER_ADMIN") {
    const ru = await prisma.restaurantUser.findFirst({
      where: { userId: session.user.id, restaurantId },
      select: { role: true },
    });
    const userLevel = ROLE_HIERARCHY[(ru?.role ?? "VIEWER") as Role] ?? 0;
    const ownerLevel = ROLE_HIERARCHY["OWNER"];
    if (userLevel < ownerLevel) {
      return NextResponse.json({ error: "נדרש תפקיד בעל מסעדה לצפייה ביומן" }, { status: 403 });
    }
  }

  // Scope: collect member/entity IDs visible from this restaurant (chain-aware)
  const groupId = await getGroupId(restaurantId);
  const scopeIds = await getScopeRestaurantIds(restaurantId, groupId);

  // Fetch loyalty audit entries — filter by entityId matching scope members
  // or by restaurant entity
  const loyaltyActions = [
    "LOYALTY_ADJUST_POINTS",
    "LOYALTY_ISSUE_COUPON",
    "LOYALTY_REDEEM_COUPON",
    "LOYALTY_UPDATE_MEMBER",
    "LOYALTY_CREATE_MEMBER",
    "LOYALTY_SEND_SMS",
    "LOYALTY_UPDATE_SETTINGS",
  ];

  // Get all member IDs in scope so we can filter logs
  type IdRow = { id: string };
  const memberIds = await prisma.$queryRawUnsafe<IdRow[]>(
    `SELECT id FROM "LoyaltyMember" WHERE "restaurantId" = ANY($1::text[])`,
    scopeIds
  ).then(rows => rows.map(r => r.id)).catch(() => [] as string[]);

  const relevantEntityIds = [...memberIds, ...scopeIds];

  type LogRow = {
    id: string; userId: string | null; userEmail: string | null;
    action: string; entity: string | null; entityId: string | null;
    entityName: string | null; meta: unknown; ip: string | null; createdAt: Date;
  };

  const [logs, countRows] = await Promise.all([
    prisma.$queryRawUnsafe<LogRow[]>(
      `SELECT * FROM "AuditLog"
        WHERE action = ANY($1::text[])
          AND "entityId" = ANY($2::text[])
        ORDER BY "createdAt" DESC
        LIMIT $3 OFFSET $4`,
      loyaltyActions, relevantEntityIds, limit, offset
    ),
    prisma.$queryRawUnsafe<{ count: number }[]>(
      `SELECT COUNT(*)::int AS count FROM "AuditLog"
        WHERE action = ANY($1::text[])
          AND "entityId" = ANY($2::text[])`,
      loyaltyActions, relevantEntityIds
    ),
  ]);

  return NextResponse.json({
    logs,
    total: Number(countRows[0]?.count ?? 0),
    page,
    pages: Math.ceil(Number(countRows[0]?.count ?? 0) / limit),
  });
}
