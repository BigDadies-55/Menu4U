import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { isAdmin } from "@/lib/permissions";
import type { Role } from "@/generated/prisma/client";
import { logAudit, getIp } from "@/lib/audit";
import { generateOtp, hashOtp } from "@/lib/otp";
import { sendOtpEmail } from "@/lib/email";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user || !isAdmin(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { name, email, password, role } = body;

  if (!email || !password) {
    return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
  }

  if (role === "SUPER_ADMIN" && session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Cannot create Super Admin" }, { status: 403 });
  }

  // Only block duplicate emails for non-SUPER_ADMIN creators
  if (session.user.role !== "SUPER_ADMIN") {
    const existing = await prisma.user.findFirst({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: "אימייל כבר קיים במערכת" }, { status: 400 });
    }
  }

  const hashed = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: { name: name || null, email, password: hashed, role: (role as Role) ?? "VIEWER" },
    select: { id: true, name: true, email: true, role: true, createdAt: true },
  });

  await logAudit({
    userId: session.user.id,
    userEmail: session.user.email,
    action: "CREATE_USER",
    entity: "user",
    entityId: user.id,
    entityName: user.email,
    meta: { role: user.role },
    ip: getIp(req),
  });

  // Send OTP verification email (non-blocking)
  try {
    const otp = generateOtp();
    const expires = new Date(Date.now() + 15 * 60 * 1000);
    await prisma.verificationToken.deleteMany({ where: { identifier: email } });
    await prisma.verificationToken.create({
      data: { identifier: email, token: hashOtp(otp), expires },
    });
    await sendOtpEmail(email, otp, name);
  } catch (err) {
    console.error("[otp] Failed to send verification email:", err);
  }

  return NextResponse.json(user, { status: 201 });
}
