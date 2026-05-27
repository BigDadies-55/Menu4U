import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET(_req: Request, { params }: { params: Promise<{ restaurantId: string }> }) {
  const { restaurantId } = await params;
  const settings = await prisma.loyaltySettings.findUnique({ where: { restaurantId } });
  return NextResponse.json({
    shekelPerPoint: settings?.shekelPerPoint ?? 0.1,
    minRedeemPoints: settings?.minRedeemPoints ?? 100,
    isActive: settings?.isActive ?? true,
  });
}
