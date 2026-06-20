import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { ensureEmployeeNumbers } from "@/lib/employeeNumber";

// Returns the userId → employee-number map for a restaurant (and assigns any
// missing numbers). Available to any authenticated user so the attendance views
// can show the number alongside the employee picker. Numbers are not sensitive
// within a business and are never editable here.
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const restaurantId = searchParams.get("restaurantId") ?? "";
  if (!restaurantId) return NextResponse.json({ error: "Missing restaurantId" }, { status: 400 });

  const employeeNos = await ensureEmployeeNumbers(restaurantId);
  return NextResponse.json({ employeeNos });
}
