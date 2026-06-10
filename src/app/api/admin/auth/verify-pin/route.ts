import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { SignJWT } from "jose";

const PIN_SECRET = new TextEncoder().encode(
  process.env.NEXTAUTH_SECRET ?? "menu4u-pin-secret"
);

// POST /api/admin/auth/verify-pin
// Body: { restaurantId, pin }
// Returns: { token } valid 5 minutes — used as managerToken for void/comp
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { restaurantId, pin } = await req.json();
  if (!pin || !/^\d{4}$/.test(String(pin)))
    return NextResponse.json({ error: "PIN חייב להיות 4 ספרות" }, { status: 400 });

  // Find a manager in this restaurant with a set PIN
  const eligibleRoles = ["SUPER_ADMIN", "ADMIN", "OWNER", "SHIFT_MANAGER"];

  let managers;
  if (session.user.role === "SUPER_ADMIN") {
    managers = await prisma.user.findMany({
      where: { role: { in: eligibleRoles as never[] }, managerPin: { not: null } },
      select: { id: true, name: true, email: true, managerPin: true, role: true },
    });
  } else {
    const ruRecords = await prisma.restaurantUser.findMany({
      where: { restaurantId, user: { role: { in: eligibleRoles as never[] }, managerPin: { not: null } } },
      include: { user: { select: { id: true, name: true, email: true, managerPin: true, role: true } } },
    });
    managers = ruRecords.map(r => r.user);
  }

  // Try PIN against each manager
  for (const mgr of managers) {
    if (!mgr.managerPin) continue;
    const match = await bcrypt.compare(String(pin), mgr.managerPin);
    if (match) {
      // Issue a short-lived JWT
      const token = await new SignJWT({ managerId: mgr.id, managerName: mgr.name, restaurantId })
        .setProtectedHeader({ alg: "HS256" })
        .setExpirationTime("5m")
        .setIssuedAt()
        .sign(PIN_SECRET);

      return NextResponse.json({ token, managerName: mgr.name });
    }
  }

  return NextResponse.json({ error: "PIN שגוי" }, { status: 401 });
}
