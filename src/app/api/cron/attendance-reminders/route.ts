import { NextResponse } from "next/server";
import { evaluateAll } from "@/lib/attendanceNotify";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Cron entry-point for attendance automations. Secured with CRON_SECRET, same as
// the backup cron. Vercel schedule is defined in vercel.json.
export async function GET(req: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || req.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const result = await evaluateAll();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[cron/attendance-reminders]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
