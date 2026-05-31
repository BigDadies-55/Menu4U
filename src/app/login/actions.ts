"use server";

import { signIn } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AuthError } from "next-auth";
import { headers } from "next/headers";
import { cookies } from "next/headers";
import { checkRateLimit } from "@/lib/rateLimit";

export async function loginAction(email: string, password: string) {
  const h = await headers();

  // Rate limit: 10 attempts per 15 minutes per IP
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? "unknown";
  const allowed = await checkRateLimit(`login:${ip}`, 10, 15 * 60 * 1000);
  if (!allowed) return { error: "יותר מדי ניסיונות כניסה. נסה שוב בעוד מספר דקות." };

  const appUrl = process.env.NEXTAUTH_URL ?? process.env.AUTH_URL ?? `https://${h.get("host")}`;
  const redirectTo = `${appUrl}/admin`;

  try {
    await signIn("credentials", { email, password, redirectTo });
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "אימייל או סיסמה שגויים" };
    }
    throw error;
  }

  // Set idle-timeout cookie from password policy after successful login
  try {
    const policy = await prisma.passwordPolicy.findUnique({ where: { id: "default" } });
    if (policy?.idleTimeoutMinutes && policy.idleTimeoutMinutes > 0) {
      const jar = await cookies();
      jar.set("idle-timeout", String(policy.idleTimeoutMinutes), {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
      });
    }
  } catch {
    // policy not yet seeded — ignore
  }
}
