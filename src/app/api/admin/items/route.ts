import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { isEditor } from "@/lib/permissions";
import { logAudit, getIp } from "@/lib/audit";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user || !isEditor(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { name, description, price, categoryId, image, isVegetarian, isVegan, isGlutenFree, tags } = await req.json();
  if (!name || !categoryId || price === undefined) {
    return NextResponse.json({ error: "Name, categoryId and price are required" }, { status: 400 });
  }

  if (session.user.role !== "SUPER_ADMIN") {
    const category = await prisma.category.findUnique({
      where: { id: categoryId },
      select: { menu: { select: { restaurantId: true } } },
    });
    if (!category) return NextResponse.json({ error: "Category not found" }, { status: 404 });
    const access = await prisma.restaurantUser.findUnique({
      where: { userId_restaurantId: { userId: session.user.id, restaurantId: category.menu.restaurantId } },
    });
    if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const item = await prisma.item.create({
    data: {
      name,
      description: description || null,
      price: parseFloat(price),
      categoryId,
      image: image || null,
      isVegetarian: !!isVegetarian,
      isVegan: !!isVegan,
      isGlutenFree: !!isGlutenFree,
      tags: Array.isArray(tags) ? tags : [],
    },
  });
  await logAudit({ userId: session.user.id, userEmail: session.user.email, action: "CREATE_ITEM", entity: "item", entityId: item.id, entityName: item.name, meta: { price: item.price, categoryId }, ip: getIp(req) });
  return NextResponse.json(item, { status: 201 });
}
