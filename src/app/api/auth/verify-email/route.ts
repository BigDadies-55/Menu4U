import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hashOtp } from "@/lib/otp";
import { logAudit, getIp } from "@/lib/audit";
import { sendWelcomeEmail } from "@/lib/email";
import { checkRateLimit } from "@/lib/rateLimit";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Rate limit: 5 attempts per 10 minutes per user
  const allowed = await checkRateLimit(`otp-verify:${session.user.id}`, 5, 10 * 60 * 1000);
  if (!allowed) return NextResponse.json({ error: "יותר מדי ניסיונות. נסה שוב בעוד מספר דקות." }, { status: 429 });

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
    action: "VERIFY_EMAIL",
    entity: "User",
    entityId: session.user.id,
    ip: getIp(req),
  });

  try { await sendWelcomeEmail(user.email, user.name); } catch (err) { console.error("[welcome] Failed to send welcome email:", err); }

  return NextResponse.json({ success: true });
}
