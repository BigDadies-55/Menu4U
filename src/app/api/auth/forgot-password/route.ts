import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateOtp, hashOtp } from "@/lib/otp";
import { sendSms, isSmsConfigured } from "@/lib/sms";
import { checkRateLimit, getIpKey } from "@/lib/rateLimit";

function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 7) return "***";
  return digits.slice(0, 3) + "•".repeat(digits.length - 6) + digits.slice(-3);
}

export async function POST(req: Request) {
  const ip = getIpKey(req);
  const allowed = await checkRateLimit(`forgot-pw:${ip}`, 5, 15 * 60 * 1000);
  if (!allowed) {
    return NextResponse.json(
      { error: "יותר מדי בקשות. נסה שוב בעוד מספר דקות." },
      { status: 429 }
    );
  }

  const { username } = await req.json();
  if (!username || typeof username !== "string") {
    return NextResponse.json({ error: "נדרש שם משתמש" }, { status: 400 });
  }

  const genericOk = NextResponse.json({ ok: true, message: "אם הפרטים נכונים, נשלח קוד" });

  const user = await prisma.user.findFirst({
    where: { username: username.trim().toLowerCase() },
    select: { id: true, email: true, name: true, phone: true },
  });
  if (!user || !user.phone) return genericOk;

  const otp = generateOtp();
  const expires = new Date(Date.now() + 3 * 60 * 1000);

  const identifier = `fp:${user.email}`;
  await prisma.verificationToken.deleteMany({ where: { identifier } });
  await prisma.verificationToken.create({
    data: { identifier, token: hashOtp(otp), expires },
  });

  if (isSmsConfigured()) {
    try {
      await sendSms(user.phone, `קוד איפוס סיסמה: ${otp}\nתקף ל-3 דקות. אל תשתף קוד זה עם אחרים.`);
    } catch (err) {
      console.error("[forgot-pw] SMS send failed:", err);
    }
  } else {
    console.log(`[forgot-pw-dev] OTP for ${user.email}: ${otp}`);
  }

  return NextResponse.json({
    ok: true,
    maskedPhone: maskPhone(user.phone),
    userId: user.id,
  });
}
