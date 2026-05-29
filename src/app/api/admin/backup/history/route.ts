import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const logs = await prisma.auditLog.findMany({
    where: { action: "EXPORT_BACKUP" },
    orderBy: { createdAt: "desc" },
    take: 10,
  });
  return NextResponse.json(logs);
}
