import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { isEditor } from "@/lib/permissions";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user || !isEditor(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { name, description, restaurantId } = await req.json();
  if (!name || !restaurantId) {
    return NextResponse.json({ error: "Name and restaurantId are required" }, { status: 400 });
  }
  const menu = await prisma.menu.create({ data: { name, description: description || null, restaurantId } });
  return NextResponse.json(menu, { status: 201 });
}
