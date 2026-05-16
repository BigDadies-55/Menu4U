import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { isEditor } from "@/lib/permissions";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user || !isEditor(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { name, description, price, categoryId, image, isVegetarian, isVegan, isGlutenFree, tags } = await req.json();
  if (!name || !categoryId || price === undefined) {
    return NextResponse.json({ error: "Name, categoryId and price are required" }, { status: 400 });
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
  return NextResponse.json(item, { status: 201 });
}
