import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateOtp, hashOtp } from "@/lib/otp";
import { sendSms, isSmsConfigured } from "@/lib/sms";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { email: true, name: true, phone: true, emailVerified: true },
  });

  if (!user || !user.email) return NextResponse.json({ error: "משתמש לא נמצא או אין אימייל" }, { status: 404 });
  if (user.emailVerified) return NextResponse.json({ success: true });

  if (!user.phone) {
    return NextResponse.json({ error: "לא הוגדר מספר טלפון לחשבון זה" }, { status: 400 });
  }

  const otp = generateOtp();
  const expires = new Date(Date.now() + 3 * 60 * 1000); // 3 minutes

  await prisma.verificationToken.deleteMany({ where: { identifier: user.email } });
  await prisma.verificationToken.create({
    data: { identifier: user.email, token: hashOtp(otp), expires },
  });

  if (isSmsConfigured()) {
    try {
      await sendSms(user.phone, `קוד האימות שלך הוא: ${otp}\nתקף ל-3 דקות בלבד.`);
    } catch (err) {
      console.error("[otp] SMS send failed:", err);
    }
  } else {
    console.log(`[otp-dev] OTP for ${user.email}: ${otp}`);
  }

  return NextResponse.json({ success: true });
}
