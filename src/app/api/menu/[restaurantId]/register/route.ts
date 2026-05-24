import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateOtp, hashOtp } from "@/lib/otp";
import { sendOtpEmail } from "@/lib/email";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ restaurantId: string }> }
) {
  const { restaurantId } = await params;
  const { name, phone, email } = await req.json();

  // All fields required
  const trimName  = name?.trim() ?? "";
  const trimPhone = phone?.trim().replace(/\s/g, "") ?? "";
  const trimEmail = email?.trim().toLowerCase() ?? "";

  if (!trimName)  return NextResponse.json({ error: "שם נדרש" }, { status: 400 });
  if (!trimPhone || trimPhone.length < 9) return NextResponse.json({ error: "מספר טלפון נדרש" }, { status: 400 });
  if (!trimEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimEmail))
    return NextResponse.json({ error: "אימייל תקין נדרש" }, { status: 400 });

  // Check restaurant exists
  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId, isActive: true },
    select: { id: true, name: true },
  });
  if (!restaurant) return NextResponse.json({ error: "מסעדה לא נמצאה" }, { status: 404 });

  // Check if a verified customer already exists with same phone OR email
  const verified = await prisma.$queryRaw<{ id: string }[]>`
    SELECT id FROM "Customer"
    WHERE "restaurantId" = ${restaurantId}
      AND "isVerified" = true
      AND (phone = ${trimPhone} OR LOWER(email) = ${trimEmail})
    LIMIT 1
  `;
  if (verified.length > 0) {
    return NextResponse.json({ error: "משתמש כבר קיים" }, { status: 409 });
  }

  // Remove stale unverified records for same phone or email (allow retry)
  await prisma.$executeRawUnsafe(
    `DELETE FROM "Customer"
     WHERE "restaurantId" = $1 AND "isVerified" = false
       AND (phone = $2 OR LOWER(email) = $3)`,
    restaurantId, trimPhone, trimEmail
  );

  // Generate OTP + coupon code
  const otp     = generateOtp();
  const otpHash = hashOtp(otp);
  const expiry  = new Date(Date.now() + 15 * 60 * 1000); // 15 min
  const coupon  = "MENU5-" + Math.random().toString(36).slice(2, 7).toUpperCase();
  const id      = `cust_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  await prisma.$executeRawUnsafe(
    `INSERT INTO "Customer"
       ("id","restaurantId","name","phone","email","otpHash","otpExpiry","isVerified","couponCode","createdAt","updatedAt")
     VALUES ($1,$2,$3,$4,$5,$6,$7,false,$8,NOW(),NOW())`,
    id, restaurantId, trimName, trimPhone, trimEmail, otpHash, expiry, coupon
  );

  // Send OTP email
  await sendOtpEmail(trimEmail, otp, trimName);

  return NextResponse.json({ success: true, pendingId: id });
}
