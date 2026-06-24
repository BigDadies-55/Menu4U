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

  // Generate a fresh temp secret — store server-side only, never expose to client
  const secret = createTotpSecret();
  await prisma.user.update({
    where: { id: session.user.id },
    data: { totpPendingSecret: secret },
  });
  const uri = buildTotpUri(user.email ?? "user", secret);
  const qr  = await QRCode.toDataURL(uri);

  return NextResponse.json({ enabled: false, qr }); // secret NOT returned
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { code } = await req.json();
  if (!code) return NextResponse.json({ error: "code required" }, { status: 400 });

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { totpPendingSecret: true },
  });
  if (!user?.totpPendingSecret) return NextResponse.json({ error: "לא נמצא secret — התחל מחדש" }, { status: 400 });

  if (!verifyTotpCode(user.totpPendingSecret, code)) {
    return NextResponse.json({ error: "קוד שגוי — נסה שנית" }, { status: 400 });
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { totpSecret: user.totpPendingSecret, totpPendingSecret: null, totpEnabled: true },
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
