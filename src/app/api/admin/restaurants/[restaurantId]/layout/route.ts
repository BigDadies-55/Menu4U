import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ restaurantId: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { restaurantId } = await params;

  const r = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    select: { tableLayoutJson: true },
  });
  if (!r) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ tableLayoutJson: r.tableLayoutJson });
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ restaurantId: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { restaurantId } = await params;

  if (session.user.role !== "SUPER_ADMIN") {
    const access = await prisma.restaurantUser.findFirst({
      where: { userId: session.user.id, restaurantId },
    });
    if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { tableLayoutJson } = await req.json();

  await prisma.restaurant.update({
    where: { id: restaurantId },
    data: { tableLayoutJson },
  });

  return NextResponse.json({ ok: true });
}
