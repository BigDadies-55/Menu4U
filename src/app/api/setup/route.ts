import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

async function runSetup() {
  const existing = await prisma.user.findUnique({
    where: { email: "admin@menu4u.com" },
  });

  if (existing) {
    return { message: "Admin already exists", email: "admin@menu4u.com" };
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

  try {
    await prisma.restaurant.create({
      data: {
        id: "demo-restaurant",
        name: "מסעדת הדגמה",
        email: "demo@menu4u.com",
        phone: "03-1234567",
        address: "רחוב הדגמה 1, תל אביב",
      },
    });
  } catch {
    // restaurant might already exist
  }

  return { success: true, email: "admin@menu4u.com", password: "admin123" };
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const secret = searchParams.get("secret");

  if (secret !== process.env.SETUP_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await runSetup();
  return NextResponse.json(result);
}

export async function POST(req: Request) {
  const { secret } = await req.json();

  if (secret !== process.env.SETUP_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await runSetup();
  return NextResponse.json(result);
}
