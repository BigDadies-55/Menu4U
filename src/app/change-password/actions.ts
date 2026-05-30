"use server";

import { auth, signOut } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { logAudit } from "@/lib/audit";

export async function changePasswordAction(newPassword: string, confirmPassword: string) {
  if (newPassword !== confirmPassword) {
    return { error: "הסיסמאות אינן תואמות" };
  }

  const policy = await prisma.passwordPolicy.findUnique({ where: { id: "default" } }).catch(() => null);
  const minLen = policy?.minLength ?? 8;
  if (newPassword.length < minLen) {
    return { error: `הסיסמה חייבת להכיל לפחות ${minLen} תווים` };
  }
  if (policy?.requireUppercase && !/[A-Z]/.test(newPassword)) {
    return { error: "הסיסמה חייבת לכלול לפחות אות גדולה אחת" };
  }
  if (policy?.requireNumbers && !/[0-9]/.test(newPassword)) {
    return { error: "הסיסמה חייבת לכלול לפחות ספרה אחת" };
  }
  if (policy?.requireSymbols && !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(newPassword)) {
    return { error: "הסיסמה חייבת לכלול לפחות תו מיוחד אחד" };
  }

  const session = await auth();
  if (!session?.user?.id) {
    return { error: "לא מחובר" };
  }

  const hashed = await bcrypt.hash(newPassword, 12);
  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      password: hashed,
      mustChangePassword: false,
      passwordChangedAt: new Date(),
    },
  });

  await logAudit({
    userId: session.user.id,
    userEmail: session.user.email,
    action: "CHANGE_PASSWORD",
    entity: "user",
    entityId: session.user.id,
  });

  await signOut({ redirect: false });
  redirect("/login");
}
