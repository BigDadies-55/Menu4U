import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashOtp } from "@/lib/otp";
import { logAudit, getIp } from "@/lib/audit";
import bcrypt from "bcryptjs";

export async function POST(req: Request) {
  const { token, password } = await req.json();

  if (!token || !password || typeof token !== "string" || typeof password !== "string") {
    return NextResponse.json({ error: "נתונים חסרים" }, { status: 400 });
  }

  if (password.length < 8) {
    return NextResponse.json({ error: "הסיסמה חייבת להכיל לפחות 8 תווים" }, { status: 400 });
  }

  const hashedToken = hashOtp(token);
  const record = await prisma.verificationToken.findFirst({
    where: { token: hashedToken, expires: { gt: new Date() } },
  });

  if (!record) {
    return NextResponse.json({ error: "הקישור אינו תקף או שפג תוקפו" }, { status: 400 });
  }

  // Target the most-recently invited (still unverified) account for this email,
  // so the password attaches to the right user even if duplicates exist.
  const user =
    (await prisma.user.findFirst({
      where: { email: record.identifier, emailVerified: null },
      orderBy: { createdAt: "desc" },
      select: { id: true, email: true, name: true },
    })) ??
    (await prisma.user.findFirst({
      where: { email: record.identifier },
      orderBy: { createdAt: "desc" },
      select: { id: true, email: true, name: true },
    }));

  if (!user) {
    return NextResponse.json({ error: "משתמש לא נמצא" }, { status: 404 });
  }

  const hashed = await bcrypt.hash(password, 12);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashed,
        emailVerified: new Date(),
        mustChangePassword: false,
        passwordChangedAt: new Date(),
      },
    }),
    prisma.verificationToken.deleteMany({
      where: { identifier: record.identifier },
    }),
  ]);

  await logAudit({
    userId: user.id,
    userEmail: user.email,
    action: "ACCEPT_INVITE",
    entity: "User",
    entityId: user.id,
    ip: getIp(req),
  });

  return NextResponse.json({ success: true });
}
