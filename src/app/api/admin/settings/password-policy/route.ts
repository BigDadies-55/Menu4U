import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { isSuperAdmin } from "@/lib/permissions";

const DEFAULT_POLICY = {
  maxAgeDays: 0,
  minLength: 8,
  historyCount: 3,
  requireUppercase: false,
  requireNumbers: false,
  requireSymbols: false,
  idleTimeoutMinutes: 0,
};

export async function GET() {
  const session = await auth();
  if (!session?.user || !isSuperAdmin(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const policy = await prisma.passwordPolicy.findUnique({ where: { id: "default" } });
  return NextResponse.json(policy ?? { id: "default", ...DEFAULT_POLICY });
}

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user || !isSuperAdmin(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const policy = await prisma.passwordPolicy.upsert({
    where: { id: "default" },
    create: { id: "default", ...DEFAULT_POLICY, ...body },
    update: body,
  });

  return NextResponse.json(policy);
}
