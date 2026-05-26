import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const cronSecretRaw    = process.env.CRON_SECRET ?? "";
  const gmailUser        = process.env.GMAIL_USER ?? "";
  const gmailPass        = process.env.GMAIL_APP_PASSWORD ?? "";
  const scheduleRaw      = process.env.BACKUP_SCHEDULE ?? "";

  const hasCronSecret    = cronSecretRaw.length > 0;
  const hasGmail         = gmailUser.length > 0 && gmailPass.length > 0;
  // Strip surrounding quotes, whitespace, invisible chars
  const scheduleNorm     = scheduleRaw
    .toLowerCase()
    .trim()
    .replace(/^["'​ ]+|["'​ ]+$/g, "") // remove quotes + invisible chars
    .trim();
  const schedule         = ["daily", "weekly"].includes(scheduleNorm)
    ? scheduleNorm
    : scheduleNorm === "off" ? "off" : null;
  const isActive         = hasCronSecret && hasGmail && schedule !== null && schedule !== "off";

  // Next scheduled time
  let nextRun: string | null = null;
  if (isActive) {
    if (schedule === "weekly") {
      const d = new Date();
      d.setUTCHours(2, 0, 0, 0);
      do { d.setUTCDate(d.getUTCDate() + 1); } while (d.getUTCDay() !== 0);
      nextRun = d.toISOString();
    } else {
      const d = new Date();
      d.setUTCHours(2, 0, 0, 0);
      if (d <= new Date()) d.setUTCDate(d.getUTCDate() + 1);
      nextRun = d.toISOString();
    }
  }

  return NextResponse.json({
    isActive,
    schedule,
    hasCronSecret,
    hasGmail,
    nextRun,
    // Debug info (non-sensitive) — helps diagnose config issues
    debug: {
      CRON_SECRET:        hasCronSecret ? `✓ מוגדר (${cronSecretRaw.length} תווים)` : "✗ חסר",
      BACKUP_SCHEDULE:    scheduleRaw.length > 0 ? `"${scheduleRaw}" → מנורמל: "${scheduleNorm}"` : "✗ חסר",
      GMAIL_USER:         gmailUser.length > 0 ? `✓ ${gmailUser}` : "✗ חסר",
      GMAIL_APP_PASSWORD: gmailPass.length > 0 ? `✓ מוגדר (${gmailPass.length} תווים)` : "✗ חסר",
      scheduleValid:      schedule !== null,
    },
    missing: [
      !hasCronSecret && "CRON_SECRET",
      !hasGmail      && "GMAIL_USER / GMAIL_APP_PASSWORD",
      !schedule      && `BACKUP_SCHEDULE (ערך נוכחי: "${scheduleRaw || "ריק"}")`,
    ].filter(Boolean) as string[],
  });
}
