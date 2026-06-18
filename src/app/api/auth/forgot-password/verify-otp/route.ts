import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashOtp, generateOtp } from "@/lib/otp";
import { checkRateLimit, getIpKey } from "@/lib/rateLimit";
import crypto from "crypto";

export async function POST(req: Request) {
  const ip = getIpKey(req);
  const allowed = await checkRateLimit(`fp-otp:${ip}`, 3, 3 * 60 * 1000);
  if (!allowed) {
    return NextResponse.json(
      { error: "יותר מדי ניסיונות. בקש קוד חדש." },
      { status: 429 }
    );
  }

  const { userId, otp } = await req.json();
  if (!userId || !otp || typeof userId !== "string" || typeof otp !== "string") {
    return NextResponse.json({ error: "נתונים חסרים" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });
  if (!user) return NextResponse.json({ error: "קוד שגוי" }, { status: 400 });

  const identifier = `fp:${user.email}`;
  const hashed = hashOtp(otp.trim());
  const token = await prisma.verificationToken.findFirst({
    where: { identifier, token: hashed, expires: { gt: new Date() } },
  });

  if (!token) {
    return NextResponse.json({ error: "קוד שגוי או שפג תוקפו" }, { status: 400 });
  }

  // OTP verified — issue a 15-minute reset token
  const rawResetToken = crypto.randomBytes(32).toString("hex");
  const hashedReset = hashOtp(rawResetToken);
  const resetExpires = new Date(Date.now() + 15 * 60 * 1000);

  await prisma.$transaction([
    prisma.verificationToken.deleteMany({ where: { identifier } }),
    prisma.verificationToken.deleteMany({ where: { identifier: user.email } }),
    prisma.verificationToken.create({
      data: { identifier: user.email, token: hashedReset, expires: resetExpires },
    }),
  ]);

  return NextResponse.json({ success: true, resetToken: rawResetToken });
}
