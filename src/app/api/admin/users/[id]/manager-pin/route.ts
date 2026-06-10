import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";

// PUT — set or clear manager PIN for a user
// Only ADMIN / SUPER_ADMIN can set; user can set their own PIN
// Body: { pin: string } — 4 digits, or { pin: null } to clear
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: userId } = await params;
  const { pin } = await req.json();

  const isSelf = session.user.id === userId;
  const isAdmin = ["SUPER_ADMIN", "ADMIN", "OWNER"].includes(session.user.role ?? "");

  if (!isSelf && !isAdmin)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Only eligible roles can have a PIN
  const target = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const eligible = ["SUPER_ADMIN", "ADMIN", "OWNER", "SHIFT_MANAGER"];
  if (!eligible.includes(target.role))
    return NextResponse.json({ error: "רק מנהלים ומנהלי משמרת יכולים לקבל PIN" }, { status: 400 });

  await prisma.$executeRawUnsafe(`ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "managerPin" TEXT`);

  if (pin === null || pin === "") {
    await prisma.user.update({ where: { id: userId }, data: { managerPin: null } });
    return NextResponse.json({ ok: true, cleared: true });
  }

  if (!/^\d{4}$/.test(String(pin)))
    return NextResponse.json({ error: "PIN חייב להיות בדיוק 4 ספרות" }, { status: 400 });

  const hashed = await bcrypt.hash(String(pin), 10);
  await prisma.user.update({ where: { id: userId }, data: { managerPin: hashed } });

  return NextResponse.json({ ok: true });
}

// GET — check if user has a PIN set (without revealing it)
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: userId } = await params;
  const isSelf = session.user.id === userId;
  const isAdmin = ["SUPER_ADMIN", "ADMIN", "OWNER"].includes(session.user.role ?? "");
  if (!isSelf && !isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await prisma.$executeRawUnsafe(`ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "managerPin" TEXT`);
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { managerPin: true } });
  return NextResponse.json({ hasPin: !!user?.managerPin });
}
