import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashOtp } from "@/lib/otp";

type Row = {
  id: string;
  otpHash: string | null;
  otpExpiry: Date | null;
  isVerified: boolean;
  couponCode: string | null;
};

export async function POST(
  req: Request,
  { params }: { params: Promise<{ restaurantId: string }> }
) {
  const { restaurantId } = await params;
  const { pendingId, otp } = await req.json();

  if (!pendingId || !otp?.trim()) {
    return NextResponse.json({ error: "נתונים חסרים" }, { status: 400 });
  }

  const rows = await prisma.$queryRaw<Row[]>`
    SELECT id, "otpHash", "otpExpiry", "isVerified", "couponCode"
    FROM "Customer"
    WHERE id = ${pendingId} AND "restaurantId" = ${restaurantId}
    LIMIT 1
  `;

  if (!rows.length) {
    return NextResponse.json({ error: "בקשה לא נמצאה" }, { status: 404 });
  }

  const row = rows[0];

  if (row.isVerified) {
    return NextResponse.json({ error: "כבר מאומת" }, { status: 409 });
  }

  // Check expiry
  if (!row.otpExpiry || new Date() > new Date(row.otpExpiry)) {
    return NextResponse.json({ error: "הקוד פג תוקף — יש לחזור ולהירשם מחדש" }, { status: 410 });
  }

  // Check OTP hash
  if (!row.otpHash || hashOtp(otp.trim()) !== row.otpHash) {
    return NextResponse.json({ error: "קוד שגוי" }, { status: 422 });
  }

  // Mark verified, clear OTP fields
  await prisma.$executeRawUnsafe(
    `UPDATE "Customer"
     SET "isVerified" = true, "otpHash" = NULL, "otpExpiry" = NULL, "updatedAt" = NOW()
     WHERE id = $1`,
    pendingId
  );

  return NextResponse.json({ success: true, couponCode: row.couponCode });
}
