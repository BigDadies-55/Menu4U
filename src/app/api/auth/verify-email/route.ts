import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hashOtp } from "@/lib/otp";
import { logAudit, getIp } from "@/lib/audit";
import { checkRateLimit } from "@/lib/rateLimit";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Lock after 3 failed attempts within 3 minutes
  const allowed = await checkRateLimit(`otp-verify:${session.user.id}`, 3, 3 * 60 * 1000);
  if (!allowed) {
    return NextResponse.json(
      { error: "יותר מדי ניסיונות שגויים. בקש קוד חדש." },
      { status: 429 }
    );
  }

  const { otp } = await req.json();
  if (!otp || typeof otp !== "string") {
    return NextResponse.json({ error: "קוד לא תקין" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { email: true, name: true, emailVerified: true },
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
    action: "VERIFY_PHONE_OTP",
    entity: "User",
    entityId: session.user.id,
    ip: getIp(req),
  });

  return NextResponse.json({ success: true });
}
