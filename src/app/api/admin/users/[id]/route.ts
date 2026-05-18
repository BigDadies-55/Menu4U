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

  if (body.role === "SUPER_ADMIN" && session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Cannot assign Super Admin role" }, { status: 403 });
  }

  const updateData: Record<string, unknown> = {};
  if (body.role) updateData.role = body.role as Role;
  if (body.password) updateData.password = await bcrypt.hash(body.password, 12);
  if (body.name !== undefined) updateData.name = body.name || null;
  if (body.email) {
    if (session.user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Only Super Admin can change email" }, { status: 403 });
    }
    const conflict = await prisma.user.findFirst({ where: { email: body.email, NOT: { id } } });
    if (conflict) return NextResponse.json({ error: "אימייל כבר קיים במערכת" }, { status: 400 });
    updateData.email = body.email;
    updateData.emailVerified = null;
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const user = await prisma.user.update({
    where: { id },
    data: updateData,
    select: { id: true, name: true, email: true, role: true, emailVerified: true, createdAt: true },
  });
  await logAudit({ userId: session.user.id, userEmail: session.user.email, action: "UPDATE_USER", entity: "user", entityId: id, entityName: user.email, meta: { changed: Object.keys(updateData) }, ip: getIp(req) });

  if (body.email) {
    const otp = generateOtp();
    const expires = new Date(Date.now() + 15 * 60 * 1000);
    await prisma.verificationToken.deleteMany({ where: { identifier: body.email } });
    await prisma.verificationToken.create({ data: { identifier: body.email, token: hashOtp(otp), expires } });
    sendOtpEmail(body.email, otp, user.name).catch((err) => console.error("[otp] email change send failed:", err));
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
