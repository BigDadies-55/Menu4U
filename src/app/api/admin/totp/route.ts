import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createTotpSecret, verifyTotpCode, buildTotpUri } from "@/lib/totp";
import { NextResponse } from "next/server";
import QRCode from "qrcode";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { totpEnabled: true, totpSecret: true, email: true },
  });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (user.totpEnabled) {
    return NextResponse.json({ enabled: true });
  }

  // Generate a fresh temp secret for setup
  const secret = createTotpSecret();
  const uri    = buildTotpUri(user.email ?? "user", secret);
  const qr     = await QRCode.toDataURL(uri);

  return NextResponse.json({ enabled: false, secret, qr });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { secret, code } = await req.json();
  if (!secret || !code) return NextResponse.json({ error: "secret and code required" }, { status: 400 });

  if (!verifyTotpCode(secret, code)) {
    return NextResponse.json({ error: "קוד שגוי — נסה שנית" }, { status: 400 });
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { totpSecret: secret, totpEnabled: true },
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { code } = await req.json();

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { totpSecret: true, totpEnabled: true },
  });

  if (user?.totpEnabled && user.totpSecret) {
    if (!verifyTotpCode(user.totpSecret, code ?? "")) {
      return NextResponse.json({ error: "קוד שגוי" }, { status: 401 });
    }
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { totpSecret: null, totpEnabled: false },
  });

  return NextResponse.json({ ok: true });
}
