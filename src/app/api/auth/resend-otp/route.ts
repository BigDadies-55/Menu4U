import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateOtp, hashOtp } from "@/lib/otp";
import { sendOtpEmail } from "@/lib/email";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { email: true, name: true, emailVerified: true },
  });

  if (!user || !user.email) return NextResponse.json({ error: "משתמש לא נמצא או אין אימייל" }, { status: 404 });
  if (user.emailVerified) return NextResponse.json({ success: true });

  const otp = generateOtp();
  const expires = new Date(Date.now() + 15 * 60 * 1000);

  await prisma.verificationToken.deleteMany({ where: { identifier: user.email } });
  await prisma.verificationToken.create({
    data: { identifier: user.email, token: hashOtp(otp), expires },
  });

  try { await sendOtpEmail(user.email, otp, user.name); } catch (err) { console.error("[otp] resend failed:", err); }

  return NextResponse.json({ success: true });
}
