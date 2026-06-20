import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit, getIp } from "@/lib/audit";
import { sendOnboardingWelcomeEmail, isEmailConfigured } from "@/lib/email";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  // Employee number is auto-assigned by the system (not entered here); ID number is optional.
  const { fullName, idNumber, city, address, altPhone, image } = body;

  // Mandatory fields
  if (!fullName || !city) {
    return NextResponse.json({ error: "יש למלא את כל שדות החובה" }, { status: 400 });
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      name: fullName,
      status: "ACTIVE",
      // Optional fields stored in existing columns where possible
      ...(altPhone ? { phone: altPhone } : {}),
      ...(image ? { image } : {}),
    },
  });

  // Welcome email with the username + login link.
  if (isEmailConfigured()) {
    try {
      const u = await prisma.user.findUnique({ where: { id: session.user.id }, select: { email: true, username: true } });
      if (u?.email && u.username) await sendOnboardingWelcomeEmail(u.email, u.username, fullName);
    } catch (err) { console.error("[complete-profile] welcome email failed:", err); }
  }

  await logAudit({
    userId: session.user.id,
    userEmail: session.user.email,
    action: "COMPLETE_PROFILE",
    entity: "User",
    entityId: session.user.id,
    meta: { city, idNumber: idNumber ? "***" : null },
    ip: getIp(req),
  });

  return NextResponse.json({ success: true });
}
