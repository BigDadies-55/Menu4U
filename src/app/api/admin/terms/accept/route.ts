import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit, getIp } from "@/lib/audit";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ip = getIp(req);
  const userAgent = req.headers.get("user-agent") ?? null;

  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      termsAccepted: true,
      termsAcceptedAt: new Date(),
      termsAcceptedIp: ip,
      termsAcceptedUserAgent: userAgent,
    },
  });

  await logAudit({
    userId: session.user.id,
    userEmail: session.user.email,
    action: "ACCEPT_TERMS",
    entity: "User",
    entityId: session.user.id,
    ip,
  });

  return NextResponse.json({ success: true });
}
