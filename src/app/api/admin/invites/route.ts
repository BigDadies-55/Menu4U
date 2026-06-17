import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createInvite, sendInviteNotifications, expireStaleInvites } from "@/lib/invite";
import { Role } from "@/generated/prisma/client";

// Roles that each role level can invite
const INVITABLE_BY: Record<string, Role[]> = {
  SUPER_ADMIN:   ["SUPER_ADMIN","ADMIN","OWNER","SHIFT_MANAGER","EDITOR","VIEWER","WAITER","DISPLAY"],
  ADMIN:         ["ADMIN","OWNER","SHIFT_MANAGER","EDITOR","VIEWER","WAITER","DISPLAY"],
  OWNER:         ["SHIFT_MANAGER","EDITOR","VIEWER","WAITER","DISPLAY"],
  SHIFT_MANAGER: ["VIEWER","WAITER","DISPLAY"],
};

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await expireStaleInvites();

  const isSuperAdmin = session.user.role === "SUPER_ADMIN";
  const invites = await prisma.userInvite.findMany({
    where: isSuperAdmin ? {} : { invitedById: session.user.id },
    orderBy: { createdAt: "desc" },
    include: { invitedBy: { select: { name: true, username: true } } },
  });

  return NextResponse.json(invites);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { firstName, lastName, email, phone, role, restaurantIds } = body;

  if (!firstName || !lastName) return NextResponse.json({ error: "שם חובה" }, { status: 400 });
  if (!email && !phone) return NextResponse.json({ error: "נדרש אימייל או טלפון" }, { status: 400 });
  if (!role) return NextResponse.json({ error: "תפקיד חובה" }, { status: 400 });

  const allowed = INVITABLE_BY[session.user.role] ?? [];
  if (!allowed.includes(role as Role))
    return NextResponse.json({ error: "אין הרשאה ליצור תפקיד זה" }, { status: 403 });

  // OWNER/SHIFT_MANAGER can only invite to their own restaurants
  if (!["SUPER_ADMIN", "ADMIN"].includes(session.user.role)) {
    const myRestaurants = await prisma.restaurantUser.findMany({
      where: { userId: session.user.id },
      select: { restaurantId: true },
    });
    const myIds = myRestaurants.map(r => r.restaurantId);
    const invalid = (restaurantIds as string[]).filter(id => !myIds.includes(id));
    if (invalid.length > 0)
      return NextResponse.json({ error: "מסעדה לא מורשית" }, { status: 403 });
  }

  let invite;
  try {
    invite = await createInvite({
      firstName, lastName, email, phone,
      role: role as Role,
      restaurantIds: restaurantIds ?? [],
      invitedById: session.user.id,
    });
  } catch (err) {
    console.error("[invites] createInvite failed:", err);
    return NextResponse.json({ error: "שגיאה ביצירת ההזמנה" }, { status: 500 });
  }

  try {
    await sendInviteNotifications(invite);
  } catch (err) {
    console.error("[invites] sendInviteNotifications failed:", err);
  }

  return NextResponse.json(invite, { status: 201 });
}
