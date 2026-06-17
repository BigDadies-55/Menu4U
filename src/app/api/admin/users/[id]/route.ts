import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/permissions";
import type { Role } from "@/generated/prisma/client";
import bcrypt from "bcryptjs";
import { logAudit, getIp } from "@/lib/audit";
import { generateOtp, hashOtp } from "@/lib/otp";
import { sendOtpEmail } from "@/lib/email";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user || !isAdmin(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();

  // Non-SUPER_ADMIN cannot modify other admins
  if (session.user.role !== "SUPER_ADMIN" && id !== session.user.id) {
    const target = await prisma.user.findUnique({ where: { id }, select: { role: true } });
    if (target && (target.role === "SUPER_ADMIN" || target.role === "ADMIN")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  if (body.role === "SUPER_ADMIN") {
    if (session.user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Cannot assign Super Admin role" }, { status: 403 });
    }
    const count = await prisma.user.count({ where: { role: "SUPER_ADMIN", NOT: { id } } });
    if (count >= 2) {
      return NextResponse.json({ error: "לא ניתן להוסיף יותר מ-2 Super Admin" }, { status: 403 });
    }
  }

  const updateData: Record<string, unknown> = {};
  if (body.role) updateData.role = body.role as Role;
  if (body.password) {
    updateData.password = await bcrypt.hash(body.password, 12);
    updateData.mustChangePassword = true;
    updateData.passwordChangedAt = null;
  }
  if (body.mustChangePassword !== undefined) updateData.mustChangePassword = body.mustChangePassword;
  if (body.name     !== undefined) updateData.name  = body.name  || null;
  if (body.phone    !== undefined) updateData.phone = body.phone || null;
  if (body.email    !== undefined) updateData.email = body.email || null;
  if (body.username !== undefined) {
    const uname = (body.username as string).toLowerCase().trim();
    if (!/^[a-z0-9._-]{3,30}$/.test(uname))
      return NextResponse.json({ error: "שם משתמש לא תקין (3-30 תווים, a-z 0-9 . _ -)" }, { status: 400 });
    const conflict = await prisma.user.findUnique({ where: { username: uname } });
    if (conflict && conflict.id !== id)
      return NextResponse.json({ error: "שם המשתמש תפוס" }, { status: 409 });
    updateData.username = uname;
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const user = await prisma.user.update({
    where: { id },
    data: updateData,
    select: { id: true, username: true, name: true, email: true, phone: true, role: true, emailVerified: true, createdAt: true },
  });
  await logAudit({ userId: session.user.id, userEmail: session.user.email, action: "UPDATE_USER", entity: "user", entityId: id, entityName: user.email ?? user.username, meta: { changed: Object.keys(updateData) }, ip: getIp(req) });

  if (body.email) {
    const otp = generateOtp();
    const expires = new Date(Date.now() + 15 * 60 * 1000);
    await prisma.verificationToken.deleteMany({ where: { identifier: body.email } });
    await prisma.verificationToken.create({ data: { identifier: body.email, token: hashOtp(otp), expires } });
    try { await sendOtpEmail(body.email, otp, user.name); } catch (err) { console.error("[otp] email change send failed:", err); }
  }

  return NextResponse.json(user);
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user || !isAdmin(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  if (id === session.user.id) {
    return NextResponse.json({ error: "Cannot delete yourself" }, { status: 400 });
  }

  const userToDelete = await prisma.user.findUnique({ where: { id }, select: { email: true } });
  await prisma.user.delete({ where: { id } });
  await logAudit({ userId: session.user.id, userEmail: session.user.email, action: "DELETE_USER", entity: "user", entityId: id, entityName: userToDelete?.email, ip: getIp(req) });
  return NextResponse.json({ success: true });
}
