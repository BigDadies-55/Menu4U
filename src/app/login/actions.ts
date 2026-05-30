"use server";

import { signIn } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AuthError } from "next-auth";
import { headers } from "next/headers";
import { cookies } from "next/headers";

export async function loginAction(email: string, password: string) {
  const h = await headers();
  const host  = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const proto = h.get("x-forwarded-proto") ?? "https";
  const redirectTo = `${proto}://${host}/admin`;

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
        path: "/",
      });
    }
  } catch {
    // policy not yet seeded — ignore
  }
}
