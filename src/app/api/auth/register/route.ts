import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { verifyInviteToken } from "@/lib/invite";
import { validatePassword, savePasswordToHistory } from "@/lib/passwordPolicy";
import { generateOtp, hashOtp } from "@/lib/otp";
import { sendOtpEmail } from "@/lib/email";
import { ensureEmployeeNumbers } from "@/lib/employeeNumber";

// GET — validate token
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");
  if (!token) return NextResponse.json({ error: "token missing" }, { status: 400 });

  const invite = await verifyInviteToken(token);
  if (!invite) return NextResponse.json({ error: "הזמנה לא תקפה או פגה תוקף" }, { status: 410 });

  return NextResponse.json({
    firstName: invite.firstName,
    lastName:  invite.lastName,
    email:     invite.email,
    phone:     invite.phone,
    role:      invite.role,
  });
}

// POST step 1 — validate form + send OTP
export async function POST(req: Request) {
  const body = await req.json();
  const { token, username, password } = body;

  if (!token || !username || !password)
    return NextResponse.json({ error: "חסרים שדות חובה" }, { status: 400 });

  const invite = await verifyInviteToken(token);
  if (!invite) return NextResponse.json({ error: "הזמנה לא תקפה או פגה תוקף" }, { status: 410 });

  if (!invite.email)
    return NextResponse.json({ error: "אין כתובת מייל בהזמנה — פנה למנהל" }, { status: 400 });

  if (!/^[a-z0-9._-]{3,30}$/.test(username))
    return NextResponse.json({ error: "שם משתמש לא תקין (3-30 תווים, a-z 0-9 . _ -)" }, { status: 400 });

  const taken = await prisma.user.findUnique({ where: { username } });
  if (taken) return NextResponse.json({ error: "שם המשתמש תפוס" }, { status: 409 });

  const pwError = await validatePassword(password);
  if (pwError) return NextResponse.json({ error: pwError }, { status: 400 });

  // Send OTP to email
  const otp     = generateOtp();
  const expires = new Date(Date.now() + 15 * 60 * 1000);
  await prisma.verificationToken.deleteMany({ where: { identifier: invite.email } });
  await prisma.verificationToken.create({
    data: { identifier: invite.email, token: hashOtp(otp), expires },
  });

  try {
    await sendOtpEmail(invite.email, otp, invite.firstName);
  } catch (err) {
    console.error("[register] sendOtpEmail failed:", err);
    return NextResponse.json({ error: "שגיאה בשליחת קוד האימות" }, { status: 500 });
  }

  const masked = invite.email.replace(/(.{2}).+(@.+)/, "$1***$2");
  return NextResponse.json({ pending: true, maskedEmail: masked });
}

// PUT step 2 — verify OTP + create user
export async function PUT(req: Request) {
  const body = await req.json();
  const { token, username, password, otp } = body;

  if (!token || !username || !password || !otp)
    return NextResponse.json({ error: "חסרים שדות חובה" }, { status: 400 });

  const invite = await verifyInviteToken(token);
  if (!invite || !invite.email)
    return NextResponse.json({ error: "הזמנה לא תקפה" }, { status: 410 });

  // Verify OTP
  const hashed = hashOtp(otp.trim());
  const record = await prisma.verificationToken.findFirst({
    where: { identifier: invite.email, token: hashed, expires: { gt: new Date() } },
  });
  if (!record) return NextResponse.json({ error: "קוד שגוי או שפג תוקפו" }, { status: 400 });

  // Re-validate (safety)
  const taken = await prisma.user.findUnique({ where: { username } });
  if (taken) return NextResponse.json({ error: "שם המשתמש תפוס" }, { status: 409 });

  const pwError = await validatePassword(password);
  if (pwError) return NextResponse.json({ error: pwError }, { status: 400 });

  const hpwd = await bcrypt.hash(password, 12);

  const user = await prisma.user.create({
    data: {
      username,
      firstName:         invite.firstName,
      lastName:          invite.lastName,
      name:              `${invite.firstName} ${invite.lastName}`,
      email:             invite.email,
      phone:             invite.phone ?? null,
      password:          hpwd,
      role:              invite.role,
      mustChangePassword: false,
      passwordChangedAt: new Date(),
      emailVerified:     new Date(),
    },
  });

  if (invite.restaurantIds.length > 0) {
    await prisma.restaurantUser.createMany({
      data: invite.restaurantIds.map(rid => ({ userId: user.id, restaurantId: rid, role: invite.role })),
      skipDuplicates: true,
    });
    // Auto-assign an employee number per linked restaurant.
    for (const rid of invite.restaurantIds) {
      try { await ensureEmployeeNumbers(rid); } catch (e) { console.error("[employeeNo] assign failed:", e); }
    }
  }

  await savePasswordToHistory(user.id, hpwd);
  await prisma.verificationToken.deleteMany({ where: { identifier: invite.email } });
  await prisma.userInvite.update({ where: { id: invite.id }, data: { status: "COMPLETED" } });

  return NextResponse.json({ ok: true });
}
