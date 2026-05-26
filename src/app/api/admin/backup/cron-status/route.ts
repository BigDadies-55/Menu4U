import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const hasCronSecret  = !!process.env.CRON_SECRET;
  const hasGmail       = !!process.env.GMAIL_USER && !!process.env.GMAIL_APP_PASSWORD;
  const scheduleRaw    = (process.env.BACKUP_SCHEDULE ?? "").toLowerCase().trim();
  const schedule       = ["daily", "weekly"].includes(scheduleRaw) ? scheduleRaw : scheduleRaw === "off" ? "off" : null;
  const isActive       = hasCronSecret && hasGmail && schedule !== null && schedule !== "off";

  // Next scheduled time (rough estimate, UTC)
  let nextRun: string | null = null;
  if (isActive) {
    const now = new Date();
    const next = new Date(now);
    next.setUTCHours(2, 0, 0, 0);
    if (next <= now) next.setUTCDate(next.getUTCDate() + 1);
    if (schedule === "weekly") {
      // advance to next Sunday
      const daysUntilSunday = (7 - next.getUTCDay()) % 7 || 7;
      next.setUTCDate(next.getUTCDate() + daysUntilSunday - (next.getUTCDay() === 0 ? 0 : 0));
      // simpler: find next Sunday
      const d = new Date(now);
      d.setUTCHours(2, 0, 0, 0);
      while (d.getUTCDay() !== 0 || d <= now) d.setUTCDate(d.getUTCDate() + 1);
      nextRun = d.toISOString();
    } else {
      nextRun = next.toISOString();
    }
  }

  return NextResponse.json({
    isActive,
    schedule,          // "daily" | "weekly" | "off" | null
    hasCronSecret,
    hasGmail,
    nextRun,
    missing: [
      !hasCronSecret && "CRON_SECRET",
      !hasGmail      && "GMAIL_USER / GMAIL_APP_PASSWORD",
      !schedule      && "BACKUP_SCHEDULE",
    ].filter(Boolean) as string[],
  });
}
