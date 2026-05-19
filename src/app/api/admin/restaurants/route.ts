import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { logAudit, getIp } from "@/lib/audit";

export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const restaurants = await prisma.restaurant.findMany({ orderBy: { name: "asc" } });
  return NextResponse.json(restaurants);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await req.json();
  const { name, email, phone, address, description } = body;
  if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });

  const restaurant = await prisma.restaurant.create({
    data: {
      name,
      email: email || null,
      phone: phone || null,
      address: address || null,
      description: description || null,
      menuTheme: body.menuTheme || 'luxury',
      menuPalette: body.menuPalette || '0',
      menuPaletteData: body.menuPaletteData || null,
    },
  });
  await logAudit({ userId: session.user.id, userEmail: session.user.email, action: "CREATE_RESTAURANT", entity: "restaurant", entityId: restaurant.id, entityName: restaurant.name, ip: getIp(req) });
  return NextResponse.json(restaurant, { status: 201 });
}
