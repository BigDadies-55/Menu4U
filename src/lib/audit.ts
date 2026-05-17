import { prisma } from "@/lib/prisma";

export interface AuditInput {
  userId?: string | null;
  userEmail?: string | null;
  action: string;
  entity?: string | null;
  entityId?: string | null;
  entityName?: string | null;
  meta?: Record<string, unknown> | null;
  ip?: string | null;
}

export async function logAudit(input: AuditInput): Promise<void> {
  try {
    await prisma.auditLog.create({ data: input });
  } catch (err) {
    console.error("[audit] Failed to write log:", input.action, err);
  }
}

export function getIp(req: Request): string | null {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
}
