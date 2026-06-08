import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { createTotpSecret, verifyTotpCode, buildTotpUri } from "@/lib/totp";
import { logAudit, getIp } from "@/lib/audit";
import QRCode from "qrcode";

// GET — return TOTP status + QR code for setup (generates a pending secret if not enabled)
export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { email: true, totpEnabled: true, totpSecret: true },
  });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (user.totpEnabled) {
    return NextResponse.json({ enabled: true });
  }

  // Generate a new (unconfirmed) secret for setup
  const secret = createTotpSecret();
  const uri    = buildTotpUri(user.email, secret);
  const qr     = await QRCode.toDataURL(uri);

  return NextResponse.json({ enabled: false, secret, qr });
}

// POST — enable TOTP (verify first code, save secret)
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { secret, code } = await req.json();
  if (!secret || !code) return NextResponse.json({ error: "secret and code are required" }, { status: 400 });

  if (!verifyTotpCode(secret, code)) {
    return NextResponse.json({ error: "קוד שגוי — נסה שוב" }, { status: 400 });
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { totpSecret: secret, totpEnabled: true },
  });

  await logAudit({ action: "TOTP_ENABLED", userId: session.user.id, userEmail: session.user.email, entity: "user", entityId: session.user.id, ip: getIp(req) });

  return NextResponse.json({ ok: true });
}

// DELETE — disable TOTP (requires current TOTP code)
export async function DELETE(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { code } = await req.json();
  if (!code) return NextResponse.json({ error: "Code is required" }, { status: 400 });

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { totpSecret: true, totpEnabled: true },
  });

  if (!user?.totpEnabled || !user.totpSecret) {
    return NextResponse.json({ error: "TOTP not enabled" }, { status: 400 });
  }

  if (!verifyTotpCode(user.totpSecret, code)) {
    return NextResponse.json({ error: "קוד שגוי" }, { status: 400 });
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { totpSecret: null, totpEnabled: false },
  });

  await logAudit({ action: "TOTP_DISABLED", userId: session.user.id, userEmail: session.user.email, entity: "user", entityId: session.user.id, ip: getIp(req) });

  return NextResponse.json({ ok: true });
}
