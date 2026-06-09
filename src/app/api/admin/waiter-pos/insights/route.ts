import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { computeInsights, type TableInput } from "@/lib/waiter-insights";

async function checkAccess(userId: string, role: string, restaurantId: string): Promise<boolean> {
  if (role === "SUPER_ADMIN") return true;
  const access = await prisma.restaurantUser.findFirst({ where: { userId, restaurantId } });
  return !!access;
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

  const insights = computeInsights(tables ?? []);
  return NextResponse.json({ insights });
}
