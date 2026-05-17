import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hashOtp } from "@/lib/otp";
import { logAudit, getIp } from "@/lib/audit";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { otp } = await req.json();
  if (!otp || typeof otp !== "string") {
    return NextResponse.json({ error: "קוד לא תקין" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { email: true, emailVerified: true },
  });

  if (!user) return NextResponse.json({ error: "משתמש לא נמצא" }, { status: 404 });
  if (user.emailVerified) return NextResponse.json({ success: true });

  const hashed = hashOtp(otp.trim());
  const token = await prisma.verificationToken.findFirst({
    where: {
      identifier: user.email,
      token: hashed,
      expires: { gt: new Date() },
    },
  });

  if (!token) {
    return NextResponse.json({ error: "קוד שגוי או שפג תוקפו" }, { status: 400 });
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: session.user.id },
      data: { emailVerified: new Date() },
    }),
    prisma.verificationToken.deleteMany({
      where: { identifier: user.email },
    }),
  ]);

  await logAudit({
    userId: session.user.id,
    userEmail: user.email,
    action: "VERIFY_EMAIL",
    entity: "User",
    entityId: session.user.id,
    ip: getIp(req),
  });

  return NextResponse.json({ success: true });
}
