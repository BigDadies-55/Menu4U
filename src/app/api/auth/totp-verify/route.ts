import { auth, unstable_update } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { verifyTotpCode } from "@/lib/totp";
import { logAudit, getIp } from "@/lib/audit";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!(session.user as { requires2fa?: boolean }).requires2fa) {
    return NextResponse.json({ error: "2FA not required" }, { status: 400 });
  }

  const { code } = await req.json();
  if (!code) return NextResponse.json({ error: "Code is required" }, { status: 400 });

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { totpSecret: true, totpEnabled: true },
  });

  if (!user?.totpEnabled || !user.totpSecret) {
    return NextResponse.json({ error: "TOTP not configured" }, { status: 400 });
  }

  if (!verifyTotpCode(user.totpSecret, code)) {
    await logAudit({ action: "LOGIN_FAILED", userId: session.user.id, userEmail: session.user.email, meta: { reason: "bad_totp_verify" }, ip: getIp(req) });
    return NextResponse.json({ error: "קוד שגוי" }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await unstable_update({ user: { requires2fa: false } } as any);
  await logAudit({ action: "LOGIN_SUCCESS", userId: session.user.id, userEmail: session.user.email, meta: { via: "totp_verify" }, ip: getIp(req) });

  return NextResponse.json({ ok: true });
}
