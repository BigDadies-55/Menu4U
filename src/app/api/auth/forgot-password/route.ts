import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashOtp } from "@/lib/otp";
import { sendPasswordResetEmail } from "@/lib/email";
import { checkRateLimit } from "@/lib/rateLimit";
import { getIpKey } from "@/lib/rateLimit";
import crypto from "crypto";

export async function POST(req: Request) {
  const ip = getIpKey(req);
  const allowed = await checkRateLimit(`forgot-pw:${ip}`, 5, 15 * 60 * 1000);
  if (!allowed) {
    return NextResponse.json(
      { error: "יותר מדי בקשות. נסה שוב בעוד מספר דקות." },
      { status: 429 }
    );
  }

  const { email } = await req.json();
  if (!email || typeof email !== "string") {
    return NextResponse.json({ error: "נדרש אימייל" }, { status: 400 });
  }

  // Always return the same response to prevent user-enumeration
  const genericOk = NextResponse.json({ ok: true });

  const user = await prisma.user.findFirst({
    where: { email: email.toLowerCase().trim() },
    select: { id: true, email: true, name: true },
  });
  if (!user || !user.email) return genericOk;

  await prisma.verificationToken.deleteMany({ where: { identifier: user.email } });

  const rawToken = crypto.randomBytes(32).toString("hex");
  const hashedToken = hashOtp(rawToken);
  const expires = new Date(Date.now() + 60 * 60 * 1000);

  await prisma.verificationToken.create({
    data: { identifier: user.email, token: hashedToken, expires },
  });

  const baseUrl = process.env.AUTH_URL ?? process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  const resetLink = `${baseUrl}/reset-password?token=${rawToken}`;

  try {
    await sendPasswordResetEmail(user.email, resetLink, user.name);
  } catch (err) {
    console.error("[email] Failed to send password reset email:", err);
  }

  return genericOk;
}
