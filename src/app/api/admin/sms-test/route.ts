import { auth } from "@/lib/auth";
import { smsConfigStatus, sendSmsDetailed } from "@/lib/sms";
import { NextResponse } from "next/server";

// Diagnostic endpoint — SUPER_ADMIN only.
// GET  /api/admin/sms-test                  → reports which INFORU_* vars are present
// GET  /api/admin/sms-test?phone=05...      → sends one test SMS, returns raw gateway response
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const phone = searchParams.get("phone");

  const config = smsConfigStatus();

  if (!phone) {
    return NextResponse.json({ config });
  }

  const result = await sendSmsDetailed(phone, "בדיקת מערכת Menu4U ✓");
  return NextResponse.json({ config, test: result });
}
