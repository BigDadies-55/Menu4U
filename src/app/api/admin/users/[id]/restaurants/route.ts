import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/permissions";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user || !isAdmin(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const { restaurantId } = await req.json();
  if (!restaurantId) return NextResponse.json({ error: "restaurantId required" }, { status: 400 });

  const existing = await prisma.restaurantUser.findUnique({
    where: { userId_restaurantId: { userId: id, restaurantId } },
  });
  if (existing) return NextResponse.json(existing);

  const ru = await prisma.restaurantUser.create({
    data: { userId: id, restaurantId, role: "ADMIN" },
    include: { restaurant: { select: { id: true, name: true } } },
  });
  return NextResponse.json(ru, { status: 201 });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user || !isAdmin(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const { restaurantId } = await req.json();
  if (!restaurantId) return NextResponse.json({ error: "restaurantId required" }, { status: 400 });

  await prisma.restaurantUser.deleteMany({
    where: { userId: id, restaurantId },
  });
  return NextResponse.json({ success: true });
}
