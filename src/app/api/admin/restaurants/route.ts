import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

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
    data: { name, email: email || null, phone: phone || null, address: address || null, description: description || null },
  });
  return NextResponse.json(restaurant, { status: 201 });
}
