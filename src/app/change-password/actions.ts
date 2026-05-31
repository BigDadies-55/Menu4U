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

  const historyCount = policy?.historyCount ?? 3;

  // Check against password history
  if (historyCount > 0) {
    const history = await prisma.$queryRaw<{ password: string }[]>`
      SELECT password FROM "PasswordHistory"
      WHERE "userId" = ${session.user.id}
      ORDER BY "createdAt" DESC
      LIMIT ${historyCount}
    `.catch(() => []);

    // Also check current password
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { password: true },
    });
    const allHashes = [
      ...(currentUser?.password ? [{ password: currentUser.password }] : []),
      ...history,
    ];

    for (const { password: hash } of allHashes) {
      if (await bcrypt.compare(newPassword, hash)) {
        return { error: `לא ניתן לחזור על אחת מ-${historyCount} הסיסמאות האחרונות` };
      }
    }
  }

  const hashed = await bcrypt.hash(newPassword, 12);

  // Save current password to history before replacing
  const currentUser2 = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { password: true },
  });
  if (currentUser2?.password) {
    await prisma.$executeRaw`
      INSERT INTO "PasswordHistory" ("id", "userId", "password", "createdAt")
      VALUES (gen_random_uuid()::text, ${session.user.id}, ${currentUser2.password}, NOW())
    `.catch(() => null);

    // Prune old entries beyond historyCount
    if (historyCount > 0) {
      await prisma.$executeRaw`
        DELETE FROM "PasswordHistory"
        WHERE "userId" = ${session.user.id}
        AND "id" NOT IN (
          SELECT "id" FROM "PasswordHistory"
          WHERE "userId" = ${session.user.id}
          ORDER BY "createdAt" DESC
          LIMIT ${historyCount}
        )
      `.catch(() => null);
    }
  }

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
