import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import crypto from "crypto";

async function runSetup() {
  const existing = await prisma.user.findUnique({
    where: { username: "admin" },
  });

  if (existing) {
    return { message: "Admin already exists" };
  }

  const tempPassword = crypto.randomBytes(16).toString("hex");
  const password = await bcrypt.hash(tempPassword, 12);

  await prisma.user.create({
    data: {
      username: "admin",
      email: "admin@menu4u.com",
      name: "Super Admin",
      firstName: "Super",
      lastName: "Admin",
      password,
      role: "SUPER_ADMIN",
      mustChangePassword: true,
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

  // Return password only via this one-time call — store it immediately
  return { success: true, username: "admin", email: "admin@menu4u.com", tempPassword };
}

function checkSecret(secret: string | null): boolean {
  const env = process.env.SETUP_SECRET;
  if (!env || !secret) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(secret), Buffer.from(env));
  } catch {
    return false;
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  if (!checkSecret(searchParams.get("secret"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = await runSetup();
  return NextResponse.json(result);
}

export async function POST(req: Request) {
  const { secret } = await req.json();
  if (!checkSecret(secret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = await runSetup();
  return NextResponse.json(result);
}
