import { prisma } from "@/lib/prisma";
import { checkRateLimit, getIpKey } from "@/lib/rateLimit";
import { NextResponse } from "next/server";
import { sendOtpEmail } from "@/lib/email";
import crypto from "crypto";

function hashOtp(otp: string): string {
  return crypto.createHash("sha256").update(otp).digest("hex");
}

async function ensureOtpTable() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "_OtpStore" (
      "key"       TEXT PRIMARY KEY,
      "code"      TEXT NOT NULL,
      "expires"   TIMESTAMP NOT NULL,
      "sendCount" INTEGER NOT NULL DEFAULT 1,
      "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);
}

export async function POST(req: Request, { params }: { params: Promise<{ restaurantId: string }> }) {
  const { restaurantId } = await params;
  const body = await req.json();
  const { action, email, code } = body;

  if (action === "send") {
    if (!email || !email.includes("@")) {
      return NextResponse.json({ error: "invalid email" }, { status: 400 });
    }

    // Rate limit: 4 OTP sends per email per 10 min
    const ip = getIpKey(req);
    const allowed = await checkRateLimit(`otp-send:${ip}:${email}`, 4, 10 * 60 * 1000);
    if (!allowed) return NextResponse.json({ error: "max_attempts" }, { status: 429 });

    await ensureOtpTable();

    const key = `${restaurantId}:${email.toLowerCase()}`;

    // Check existing send count in DB
    type OtpRow = { sendCount: number; expires: Date };
    const existing = await prisma.$queryRawUnsafe<OtpRow[]>(
      `SELECT "sendCount", "expires" FROM "_OtpStore" WHERE "key" = $1 LIMIT 1`,
      key
    );
    const sendCount = existing[0]?.sendCount ?? 0;
    if (sendCount >= 4) {
      return NextResponse.json({ error: "max_attempts" }, { status: 429 });
    }

    const otp = String(Math.floor(100000 + Math.random() * 900000));
    const expires = new Date(Date.now() + 10 * 60 * 1000);

    await prisma.$executeRawUnsafe(
      `INSERT INTO "_OtpStore" ("key", "code", "expires", "sendCount")
       VALUES ($1, $2, $3, 1)
       ON CONFLICT ("key") DO UPDATE
         SET "code" = $2, "expires" = $3, "sendCount" = "_OtpStore"."sendCount" + 1`,
      key, hashOtp(otp), expires
    );

    try {
      await sendOtpEmail(email, otp);
    } catch (e) {
      console.error("OTP email send error:", e);
      if (process.env.NODE_ENV !== "production") {
        console.log(`[OTP DEV] ${email}: ${otp}`);
        return NextResponse.json({ ok: true, sendCount: sendCount + 1 });
      }
      return NextResponse.json({ error: "email_failed" }, { status: 500 });
    }

    return NextResponse.json({ ok: true, sendCount: sendCount + 1 });
  }

  if (action === "verify") {
    if (!email || !code) return NextResponse.json({ error: "missing params" }, { status: 400 });

    await ensureOtpTable();

    const key = `${restaurantId}:${email.toLowerCase()}`;
    type OtpRow = { code: string; expires: Date };
    const rows = await prisma.$queryRawUnsafe<OtpRow[]>(
      `SELECT "code", "expires" FROM "_OtpStore" WHERE "key" = $1 LIMIT 1`,
      key
    );
    const stored = rows[0];
    if (!stored || stored.expires < new Date()) {
      return NextResponse.json({ error: "expired" }, { status: 400 });
    }
    if (stored.code !== hashOtp(String(code))) {
      return NextResponse.json({ error: "invalid" }, { status: 400 });
    }

    // Delete after successful verification
    await prisma.$executeRawUnsafe(`DELETE FROM "_OtpStore" WHERE "key" = $1`, key);

    return NextResponse.json({ ok: true, verified: true });
  }

  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}
