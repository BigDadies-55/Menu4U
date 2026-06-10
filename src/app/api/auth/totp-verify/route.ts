import { auth, unstable_update } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { verifyTotpCode } from "@/lib/totp";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { code } = await req.json();
  if (!code) return NextResponse.json({ error: "code required" }, { status: 400 });

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { totpSecret: true, totpEnabled: true },
  });

  if (!user?.totpEnabled || !user.totpSecret) {
    return NextResponse.json({ error: "2FA not enabled" }, { status: 400 });
  }

  if (!verifyTotpCode(user.totpSecret, code)) {
    return NextResponse.json({ error: "קוד שגוי" }, { status: 401 });
  }

  await unstable_update({ user: { requires2fa: false } } as never);
  return NextResponse.json({ ok: true });
}
