import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { isAdmin, canViewUsers } from "@/lib/permissions";
import type { Role } from "@/generated/prisma/client";
import { logAudit, getIp } from "@/lib/audit";
import { sendInviteEmail } from "@/lib/email";
import { hashOtp } from "@/lib/otp";
import crypto from "crypto";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user || !canViewUsers(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { name, email, role, restaurantIds = [] } = body;

  if (!email) {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }

  // OWNER / SHIFT_MANAGER cannot assign ADMIN or SUPER_ADMIN roles
  if (!isAdmin(session.user.role) && ["ADMIN", "SUPER_ADMIN"].includes(role)) {
    return NextResponse.json({ error: "אין הרשאה לשייך תפקיד מנהל" }, { status: 403 });
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

  // Generate unique username from email prefix
  const baseUsername = email.split("@")[0].toLowerCase().replace(/[^a-z0-9._-]/g, "_");
  let username = baseUsername;
  let suffix = 2;
  while (await prisma.user.findUnique({ where: { username } })) {
    username = `${baseUsername}_${suffix++}`;
  }

  let user;
  try {
    user = await prisma.user.create({
      data: {
        username,
        name: name || null,
        email,
        password: null,
        role: (role as Role) ?? "VIEWER",
        mustChangePassword: false,
        emailVerified: null,
        ...(restaurantIds.length > 0 ? {
          restaurantUsers: {
            create: (restaurantIds as string[]).map((rid) => ({ restaurantId: rid })),
          },
        } : {}),
      },
      select: { id: true, name: true, email: true, role: true, createdAt: true, mustChangePassword: true },
    });
  } catch (err: unknown) {
    if ((err as { code?: string })?.code === "P2002") {
      return NextResponse.json({ error: "אימייל כבר קיים במערכת" }, { status: 400 });
    }
    throw err;
  }

  // Generate invite token — 72 h expiry
  const rawToken = crypto.randomBytes(32).toString("hex");
  const hashedToken = hashOtp(rawToken);
  const expires = new Date(Date.now() + 72 * 60 * 60 * 1000);
  await prisma.verificationToken.create({
    data: { identifier: email, token: hashedToken, expires },
  });

  const baseUrl = process.env.AUTH_URL ?? process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  const inviteLink = `${baseUrl}/accept-invite?token=${rawToken}`;

  await logAudit({
    userId: session.user.id,
    userEmail: session.user.email,
    action: "CREATE_USER",
    entity: "user",
    entityId: user.id,
    entityName: user.email ?? user.id,
    meta: { role: user.role },
    ip: getIp(req),
  });

  const hasEmailService = !!process.env.GMAIL_USER && !!process.env.GMAIL_APP_PASSWORD;
  let emailSent = false;
  if (hasEmailService) {
    try {
      await sendInviteEmail(email, inviteLink, name);
      emailSent = true;
    } catch (err) {
      console.error("[email] Failed to send invite email:", err);
    }
  }

  return NextResponse.json(
    {
      ...user,
      emailVerified: null,
      restaurantUsers: [],
      emailSent,
      // expose invite link only when email was not sent (so admin can share it manually)
      inviteLink: emailSent ? undefined : inviteLink,
    },
    { status: 201 }
  );
}
