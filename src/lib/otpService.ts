import crypto from "crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { sendSms } from "@/lib/sms";
import { sendOtpEmail } from "@/lib/email";

const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes
const MAX_ATTEMPTS = 3;

function generateCode(): string {
  return String(crypto.randomInt(100000, 999999));
}

export async function createOtp(userId: string, channel: "email" | "sms"): Promise<string> {
  // Invalidate existing OTPs for this user+channel
  await prisma.$executeRawUnsafe(
    `DELETE FROM "OtpCode" WHERE identifier = $1 AND channel = $2`,
    userId,
    channel
  );

  const code = generateCode();
  const hash = await bcrypt.hash(code, 10);
  const expires = new Date(Date.now() + OTP_TTL_MS);

  await prisma.$executeRawUnsafe(
    `INSERT INTO "OtpCode" (id, identifier, channel, code, expires, attempts)
     VALUES ($1, $2, $3, $4, $5, 0)`,
    crypto.randomUUID(),
    userId,
    channel,
    hash,
    expires
  );

  return code;
}

export async function sendOtp(
  userId: string,
  channel: "email" | "sms",
  destination: string,
  userName: string
): Promise<void> {
  const code = await createOtp(userId, channel);
  const message = `שלום ${userName}, קוד האימות שלך הוא: ${code}\nהקוד בתוקף ל-10 דקות.`;

  if (channel === "sms") {
    await sendSms(destination, message);
  } else {
    await sendOtpEmail(destination, code, userName);
  }
}

export type OtpVerifyResult = "ok" | "invalid" | "expired" | "max_attempts";

export async function verifyOtp(
  userId: string,
  channel: "email" | "sms",
  inputCode: string
): Promise<OtpVerifyResult> {
  const rows = await prisma.$queryRawUnsafe<
    { id: string; code: string; expires: Date; attempts: number }[]
  >(
    `SELECT id, code, expires, attempts FROM "OtpCode"
     WHERE identifier = $1 AND channel = $2
     ORDER BY expires DESC LIMIT 1`,
    userId,
    channel
  );

  if (!rows.length) return "invalid";
  const row = rows[0];

  if (new Date() > row.expires) {
    await prisma.$executeRawUnsafe(`DELETE FROM "OtpCode" WHERE id = $1`, row.id);
    return "expired";
  }

  if (row.attempts >= MAX_ATTEMPTS) return "max_attempts";

  const match = await bcrypt.compare(inputCode, row.code);

  if (!match) {
    await prisma.$executeRawUnsafe(
      `UPDATE "OtpCode" SET attempts = attempts + 1 WHERE id = $1`,
      row.id
    );
    return "invalid";
  }

  await prisma.$executeRawUnsafe(`DELETE FROM "OtpCode" WHERE id = $1`, row.id);
  return "ok";
}
