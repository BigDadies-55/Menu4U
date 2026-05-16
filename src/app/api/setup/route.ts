import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function POST(req: Request) {
  const { secret } = await req.json();

  if (secret !== process.env.SETUP_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const existing = await prisma.user.findUnique({
    where: { email: "admin@menu4u.com" },
  });

  if (existing) {
    return NextResponse.json({ message: "Admin already exists" });
  }

  const password = await bcrypt.hash("admin123", 12);

  await prisma.user.create({
    data: {
      email: "admin@menu4u.com",
      name: "Super Admin",
      password,
      role: "SUPER_ADMIN",
    },
  });

  await prisma.restaurant.create({
    data: {
      id: "demo-restaurant",
      name: "מסעדת הדגמה",
      email: "demo@menu4u.com",
      phone: "03-1234567",
      address: "רחוב הדגמה 1, תל אביב",
    },
  });

  return NextResponse.json({
    success: true,
    message: "Setup complete",
    credentials: { email: "admin@menu4u.com", password: "admin123" },
  });
}
