import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const invite = await prisma.userInvite.findUnique({ where: { id } });
  if (!invite) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isSuperAdmin = session.user.role === "SUPER_ADMIN";
  if (!isSuperAdmin && invite.invitedById !== session.user.id)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await prisma.userInvite.update({ where: { id }, data: { status: "CANCELLED" } });
  return NextResponse.json({ ok: true });
}
