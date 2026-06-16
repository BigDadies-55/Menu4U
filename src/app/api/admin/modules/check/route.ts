import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { isModuleEnabled } from "@/lib/moduleUtils";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const restaurantId = searchParams.get("restaurantId");
  const key = searchParams.get("key");

  if (!restaurantId || !key) {
    return NextResponse.json({ error: "Missing restaurantId or key" }, { status: 400 });
  }

  const enabled = await isModuleEnabled(restaurantId, key);
  return NextResponse.json({ enabled });
}
