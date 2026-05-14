import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { isEditor } from "@/lib/permissions";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user || !isEditor(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { name, description, menuId } = await req.json();
  if (!name || !menuId) {
    return NextResponse.json({ error: "Name and menuId are required" }, { status: 400 });
  }
  const category = await prisma.category.create({ data: { name, description: description || null, menuId } });
  return NextResponse.json(category, { status: 201 });
}
