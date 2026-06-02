import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

// GET /api/admin/restaurants/[id]/users
// Returns all users assigned to a restaurant with their roles
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  if (session.user.role !== "SUPER_ADMIN") {
    const access = await prisma.restaurantUser.findFirst({
      where: { userId: session.user.id, restaurantId: id },
    });
    if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const restaurantUsers = await prisma.restaurantUser.findMany({
    where: { restaurantId: id },
    include: { user: { select: { id: true, name: true, email: true, role: true } } },
    orderBy: { user: { name: "asc" } },
  });

  return NextResponse.json(restaurantUsers.map(ru => ({
    role: ru.role,
    user: ru.user,
  })));
}
