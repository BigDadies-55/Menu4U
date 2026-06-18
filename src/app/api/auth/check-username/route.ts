import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const username = (searchParams.get("username") ?? "").trim().toLowerCase();

  if (!/^[a-z0-9._-]{3,30}$/.test(username))
    return NextResponse.json({ taken: false, invalid: true });

  const existing = await prisma.user.findUnique({ where: { username }, select: { id: true } });
  return NextResponse.json({ taken: !!existing });
}
