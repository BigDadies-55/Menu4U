import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { isAdmin } from "@/lib/permissions";
import type { Role } from "@/generated/prisma/client";
import { logAudit, getIp } from "@/lib/audit";
import { sendTempPasswordEmail } from "@/lib/email";

function generateTempPassword(): string {
  const upper = "ABCDEFGHJKMNPQRSTUVWXYZ";
  const lower = "abcdefghjkmnpqrstuvwxyz";
  const digits = "23456789";
  const symbols = "!@#$%&*";
  const all = upper + lower + digits + symbols;
  // Guarantee at least one of each required type
  const required = [
    upper[Math.floor(Math.random() * upper.length)],
    lower[Math.floor(Math.random() * lower.length)],
    digits[Math.floor(Math.random() * digits.length)],
    symbols[Math.floor(Math.random() * symbols.length)],
  ];
  const rest = Array.from({ length: 8 }, () => all[Math.floor(Math.random() * all.length)]);
  return [...required, ...rest].sort(() => Math.random() - 0.5).join("");
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user || !isAdmin(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { name, email, role } = body;

  if (!email) {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }

  if (role === "SUPER_ADMIN") {
    if (session.user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Cannot create Super Admin" }, { status: 403 });
    }
    const count = await prisma.user.count({ where: { role: "SUPER_ADMIN" } });
    if (count >= 2) {
      return NextResponse.json({ error: "לא ניתן להוסיף יותר מ-2 Super Admin" }, { status: 403 });
    }
  }

  const existing = await prisma.user.findFirst({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "אימייל כבר קיים במערכת" }, { status: 400 });
  }

  const tempPassword = generateTempPassword();
  const hashed = await bcrypt.hash(tempPassword, 12);

  let user;
  try {
    user = await prisma.user.create({
      data: {
        name: name || null,
        email,
        password: hashed,
        role: (role as Role) ?? "VIEWER",
        mustChangePassword: true,
        passwordChangedAt: null,
        emailVerified: new Date(),
      },
      select: { id: true, name: true, email: true, role: true, createdAt: true, mustChangePassword: true },
    });
  } catch (err: unknown) {
    if ((err as { code?: string })?.code === "P2002") {
      return NextResponse.json({ error: "אימייל כבר קיים במערכת" }, { status: 400 });
    }
    throw err;
  }

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

  // Send temp password email
  const hasEmail = !!process.env.GMAIL_USER && !!process.env.GMAIL_APP_PASSWORD;
  let emailSent = false;
  if (hasEmail) {
    try {
      await sendTempPasswordEmail(email, tempPassword, name);
      emailSent = true;
    } catch (err) {
      console.error("[email] Failed to send temp password email:", err);
    }
  }

  return NextResponse.json(
    { ...user, emailVerified: null, restaurantUsers: [], emailSent },
    { status: 201 }
  );
}
