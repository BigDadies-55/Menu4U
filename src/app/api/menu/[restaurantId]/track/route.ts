import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const VALID_TYPES = ["page", "category", "item"];

export async function POST(
  req: Request,
  { params }: { params: Promise<{ restaurantId: string }> }
) {
  const { restaurantId } = await params;
  const body = await req.json().catch(() => ({}));
  const { type, refId, refName } = body;

  if (!VALID_TYPES.includes(type)) {
    return NextResponse.json({ error: "Invalid type" }, { status: 400 });
  }

  await prisma.menuView.create({
    data: {
      restaurantId,
      type,
      refId: refId ?? null,
      refName: refName ?? null,
    },
  });

  return NextResponse.json({ ok: true });
}
