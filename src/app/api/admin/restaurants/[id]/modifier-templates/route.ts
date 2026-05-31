import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

// GET — return all modifier groups (with options) for all items of a restaurant
// Used as a "template library" so admins can copy groups to new items
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  // Verify access
  const role = session.user.role;
  const userId = session.user.id;
  if (role !== "SUPER_ADMIN") {
    const membership = await prisma.restaurantUser.findFirst({
      where: { userId, restaurantId: id },
    });
    if (!membership) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Fetch all modifier groups for this restaurant's items
  const groups = await prisma.itemModifierGroup.findMany({
    where: {
      item: {
        category: {
          menu: { restaurantId: id },
        },
      },
    },
    include: {
      options: { orderBy: { order: "asc" } },
      item: { select: { id: true, name: true } },
    },
    orderBy: [{ item: { name: "asc" } }, { order: "asc" }],
  });

  return NextResponse.json(groups);
}
