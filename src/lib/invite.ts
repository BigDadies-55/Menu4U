import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { Role } from "@/generated/prisma/client";
import { sendSms } from "@/lib/sms";
import { sendInviteEmail } from "@/lib/email";

const INVITE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export async function createInvite(params: {
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  role: Role;
  restaurantIds: string[];
  invitedById: string;
}) {
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + INVITE_TTL_MS);

  const invite = await prisma.userInvite.create({
    data: {
      token,
      firstName: params.firstName,
      lastName: params.lastName,
      email: params.email ?? null,
      phone: params.phone ?? null,
      role: params.role,
      restaurantIds: params.restaurantIds,
      invitedById: params.invitedById,
      expiresAt,
    },
  });

  return invite;
}

export async function sendInviteNotifications(
  invite: { token: string; firstName: string; lastName: string; email?: string | null; phone?: string | null }
) {
  const baseUrl = process.env.AUTH_URL ?? process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  const link = `${baseUrl}/register?token=${invite.token}`;
  const fullName = `${invite.firstName} ${invite.lastName}`;
  const smsText = `שלום ${invite.firstName}, הוזמנת להצטרף ל-Menu4U. להשלמת הרישום: ${link}`;

  const promises: Promise<unknown>[] = [];

  if (invite.phone) {
    promises.push(sendSms(invite.phone, smsText).catch(e => console.error("[invite sms]", e)));
  }

  if (invite.email) {
    promises.push(
      sendInviteEmail(invite.email, link, fullName).catch((e: unknown) => console.error("[invite email]", e))
    );
  }

  await Promise.all(promises);
}

export async function sendInviteReminder(inviteId: string) {
  const invite = await prisma.userInvite.findUnique({ where: { id: inviteId } });
  if (!invite || invite.status !== "PENDING") return;

  const newExpiry = new Date(Date.now() + INVITE_TTL_MS);
  await prisma.userInvite.update({
    where: { id: inviteId },
    data: { expiresAt: newExpiry, reminderSentAt: new Date() },
  });

  await sendInviteNotifications({ ...invite, email: invite.email ?? undefined, phone: invite.phone ?? undefined });
}

export async function expireStaleInvites() {
  await prisma.userInvite.updateMany({
    where: { status: "PENDING", expiresAt: { lt: new Date() } },
    data: { status: "EXPIRED" },
  });
}

export async function verifyInviteToken(token: string) {
  const invite = await prisma.userInvite.findUnique({ where: { token } });
  if (!invite) return null;
  if (invite.status !== "PENDING") return null;
  if (invite.expiresAt < new Date()) {
    await prisma.userInvite.update({ where: { id: invite.id }, data: { status: "EXPIRED" } });
    return null;
  }
  return invite;
}
