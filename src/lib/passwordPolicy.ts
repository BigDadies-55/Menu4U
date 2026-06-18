import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export interface PasswordPolicy {
  minLength: number;
  requireUppercase: boolean;
  requireNumbers: boolean;
  requireSymbols: boolean;
  historyCount: number;
  maxAgeDays: number;
  idleTimeoutMinutes: number;
}

const DEFAULT_POLICY: PasswordPolicy = {
  minLength: 8,
  requireUppercase: false,
  requireNumbers: false,
  requireSymbols: false,
  historyCount: 3,
  maxAgeDays: 0,
  idleTimeoutMinutes: 0,
};

export async function getPasswordPolicy(): Promise<PasswordPolicy> {
  try {
    const p = await prisma.passwordPolicy.findUnique({ where: { id: "default" } });
    return p ? { ...DEFAULT_POLICY, ...p } : DEFAULT_POLICY;
  } catch {
    return DEFAULT_POLICY;
  }
}

export function validatePasswordAgainstPolicy(
  password: string,
  policy: PasswordPolicy
): string | null {
  if (password.length < policy.minLength)
    return `הסיסמה חייבת להכיל לפחות ${policy.minLength} תווים`;
  if (policy.requireUppercase && !/[A-Z]/.test(password))
    return "הסיסמה חייבת להכיל לפחות אות גדולה אחת";
  if (policy.requireNumbers && !/[0-9]/.test(password))
    return "הסיסמה חייבת להכיל לפחות ספרה אחת";
  if (policy.requireSymbols && !/[^A-Za-z0-9]/.test(password))
    return "הסיסמה חייבת להכיל לפחות תו מיוחד אחד";
  return null;
}

export async function validatePassword(password: string): Promise<string | null> {
  const policy = await getPasswordPolicy();
  return validatePasswordAgainstPolicy(password, policy);
}

export async function isPasswordInHistory(
  userId: string,
  plainPassword: string,
  historyCount: number
): Promise<boolean> {
  if (historyCount <= 0) return false;
  const history = await prisma.passwordHistory.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: historyCount,
    select: { password: true },
  });
  for (const h of history) {
    if (await bcrypt.compare(plainPassword, h.password)) return true;
  }
  return false;
}

export async function savePasswordToHistory(
  userId: string,
  hashedPassword: string
): Promise<void> {
  const policy = await getPasswordPolicy();
  await prisma.passwordHistory.create({ data: { userId, password: hashedPassword } });
  if (policy.historyCount > 0) {
    const all = await prisma.passwordHistory.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });
    const toDelete = all.slice(policy.historyCount).map(h => h.id);
    if (toDelete.length > 0)
      await prisma.passwordHistory.deleteMany({ where: { id: { in: toDelete } } });
  }
}
