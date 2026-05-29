"use server";

import { signIn } from "@/lib/auth";
import { AuthError } from "next-auth";
import { headers } from "next/headers";

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
}
