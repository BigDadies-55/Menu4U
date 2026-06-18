import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit, getIp } from "@/lib/audit";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { username } = await req.json();
  if (!username || typeof username !== "string") {
    return NextResponse.json({ error: "שם משתמש נדרש" }, { status: 400 });
  }

  const clean = username.trim().toLowerCase();
  if (!/^[a-z0-9_]{3,30}$/.test(clean)) {
    return NextResponse.json(
      { error: "שם משתמש חייב להכיל 3–30 תווים: אותיות אנגליות, מספרים או _" },
      { status: 400 }
    );
  }

  const existing = await prisma.user.findFirst({ where: { username: clean } });
  if (existing && existing.id !== session.user.id) {
    return NextResponse.json({ error: "שם המשתמש תפוס, בחר אחר" }, { status: 409 });
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { username: clean },
  });

  await logAudit({
    userId: session.user.id,
    userEmail: session.user.email,
    action: "SET_USERNAME",
    entity: "User",
    entityId: session.user.id,
    ip: getIp(req),
  });

  return NextResponse.json({ success: true });
}
