import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { verifyInviteToken } from "@/lib/invite";
import { validatePassword, savePasswordToHistory } from "@/lib/passwordPolicy";

// GET — validate token (called from /register page on load)
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");
  if (!token) return NextResponse.json({ error: "token missing" }, { status: 400 });

  const invite = await verifyInviteToken(token);
  if (!invite) return NextResponse.json({ error: "הזמנה לא תקפה או פגה תוקף" }, { status: 410 });

  return NextResponse.json({
    firstName: invite.firstName,
    lastName: invite.lastName,
    email: invite.email,
    phone: invite.phone,
    role: invite.role,
  });
}

// POST — complete registration
export async function POST(req: Request) {
  const body = await req.json();
  const { token, username, password } = body;

  if (!token || !username || !password)
    return NextResponse.json({ error: "חסרים שדות חובה" }, { status: 400 });

  const invite = await verifyInviteToken(token);
  if (!invite) return NextResponse.json({ error: "הזמנה לא תקפה או פגה תוקף" }, { status: 410 });

  // Validate username format
  if (!/^[a-z0-9._-]{3,30}$/.test(username))
    return NextResponse.json({ error: "שם משתמש לא תקין (3-30 תווים, אותיות לטיניות קטנות, ספרות, . _ -)" }, { status: 400 });

  const taken = await prisma.user.findUnique({ where: { username } });
  if (taken) return NextResponse.json({ error: "שם המשתמש תפוס" }, { status: 409 });

  const pwError = await validatePassword(password);
  if (pwError) return NextResponse.json({ error: pwError }, { status: 400 });

  const hashed = await bcrypt.hash(password, 12);

  const user = await prisma.user.create({
    data: {
      username,
      firstName: invite.firstName,
      lastName: invite.lastName,
      name: `${invite.firstName} ${invite.lastName}`,
      email: invite.email ?? null,
      phone: invite.phone ?? null,
      password: hashed,
      role: invite.role,
      mustChangePassword: false,
      passwordChangedAt: new Date(),
      emailVerified: invite.email ? new Date() : null,
    },
  });

  // Link to restaurants
  if (invite.restaurantIds.length > 0) {
    await prisma.restaurantUser.createMany({
      data: invite.restaurantIds.map(rid => ({ userId: user.id, restaurantId: rid, role: invite.role })),
      skipDuplicates: true,
    });
  }

  await savePasswordToHistory(user.id, hashed);

  await prisma.userInvite.update({
    where: { id: invite.id },
    data: { status: "COMPLETED" },
  });

  return NextResponse.json({ ok: true });
}
